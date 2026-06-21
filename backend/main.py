from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from starlette.requests import Request

import logging
logger = logging.getLogger(__name__)

from database import Base, engine, get_db
from github_service import RepoMetadata, validate_and_fetch_metadata
from models import Repository, RepositoryStructure, User, CodeEntity, KnowledgeNode, KnowledgeEdge, RepositoryArchitecture
from repository_clone_service import RepositoryCloneService
from schemas import (
    RepositoryCloneResponse,
    RepositoryCreate,
    RepositoryResponse,
    RepositoryStructureResponse,
    UserSync,
    CodeEntityResponse,
    KnowledgeNodeResponse,
    KnowledgeEdgeResponse,
    RepositoryGraphResponse,
    RepositoryArchitectureResponse,
)


Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup event: cleanup repositories stuck in CLONING
    db = next(get_db())
    try:
        stuck_repos = db.query(Repository).filter(Repository.analysis_status == "CLONING").all()
        if stuck_repos:
            for repo in stuck_repos:
                repo.analysis_status = "FAILED"
                repo.status = "FAILED"
                logger.warning(f"Repository ID {repo.id} was found in CLONING status during startup, marking as FAILED.")
            db.commit()
    except Exception as exc:
        logger.error(f"Failed to clean up cloning status on startup: {exc}")
    finally:
        db.close()
    yield

app = FastAPI(
    title="Helix API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail,
        )
    if isinstance(exc.detail, str):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail},
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": str(exc.detail)},
    )


def repository_from_metadata(user_id: int, metadata: RepoMetadata) -> Repository:
    return Repository(
        user_id=user_id,
        github_url=metadata.github_url,
        status="READY",
        analysis_status="READY",
        repository_name=metadata.repository_name,
        owner=metadata.owner,
        description=metadata.description,
        language=metadata.language,
        stars=metadata.stars,
        forks=metadata.forks,
        github_id=metadata.github_id,
        default_branch=metadata.default_branch,
        size_kb=metadata.size_kb,
    )


def get_owned_repository(
    repository_id: int,
    email: str,
    db: Session,
) -> Repository:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    repository = (
        db.query(Repository)
        .filter(Repository.id == repository_id)
        .first()
    )
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")
    if repository.user_id != user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    return repository


@app.get("/")
def root():
    return {
        "message": "Helix Backend Running",
        "version": "1.0.1-safe-clone"
    }


@app.post("/users/sync")
def sync_user(
    payload: UserSync,
    db: Session = Depends(get_db),
):
    existing_user = (
        db.query(User)
        .filter(User.email == payload.email)
        .first()
    )

    if existing_user:
        existing_user.name = payload.name
        existing_user.avatar_url = payload.avatar_url

        db.commit()

        return {
            "message": "User updated",
            "user_id": existing_user.id,
        }

    new_user = User(
        email=payload.email,
        name=payload.name,
        avatar_url=payload.avatar_url,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User created",
        "user_id": new_user.id,
    }


@app.post("/repository/submit", response_model=RepositoryResponse)
def submit_repository(
    payload: RepositoryCreate,
    db: Session = Depends(get_db),
):
    metadata = validate_and_fetch_metadata(payload.github_url)

    user = (
        db.query(User)
        .filter(User.email == payload.user_email)
        .first()
    )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        db.query(Repository)
        .filter(
            Repository.user_id == user.id,
            Repository.github_url == metadata.github_url,
        )
        .first()
    )

    if existing:
        existing.status = "READY"
        existing.repository_name = metadata.repository_name
        existing.owner = metadata.owner
        existing.description = metadata.description
        existing.language = metadata.language
        existing.stars = metadata.stars
        existing.forks = metadata.forks
        existing.github_id = metadata.github_id
        existing.default_branch = metadata.default_branch
        existing.size_kb = metadata.size_kb
        db.commit()
        db.refresh(existing)
        return existing

    repository = repository_from_metadata(user.id, metadata)

    db.add(repository)
    db.commit()
    db.refresh(repository)

    return repository


@app.get("/repositories/{email}", response_model=list[RepositoryResponse])
def get_repositories(
    email: str,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:
        return []

    repositories = (
        db.query(Repository)
        .filter(
            Repository.user_id == user.id,
        )
        .all()
    )

    return repositories


@app.delete("/repository/{id}")
def delete_repository(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repo = get_owned_repository(id, email, db)

    clone_deleted = False
    try:
        clone_deleted = RepositoryCloneService(db).delete_local_clone(repo)
    except Exception as exc:
        import logging
        logging.error(f"Failed to delete local clone for repository {id}: {exc}")

    db.query(RepositoryStructure).filter(
        RepositoryStructure.repository_id == repo.id
    ).delete()
    db.delete(repo)
    db.commit()

    if not clone_deleted:
        return {
            "success": True,
            "warning": "Repository deleted but local clone cleanup failed."
        }
    return {
        "success": True,
        "message": "Repository deleted successfully"
    }


@app.post("/repository/{id}/refresh", response_model=RepositoryResponse)
def refresh_repository(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repo = get_owned_repository(id, email, db)

    metadata = validate_and_fetch_metadata(repo.github_url)

    repo.status = "READY"
    repo.repository_name = metadata.repository_name
    repo.owner = metadata.owner
    repo.description = metadata.description
    repo.language = metadata.language
    repo.stars = metadata.stars
    repo.forks = metadata.forks
    repo.github_id = metadata.github_id
    repo.default_branch = metadata.default_branch
    repo.size_kb = metadata.size_kb
    repo.last_metadata_sync = datetime.now(timezone.utc)

    db.commit()
    db.refresh(repo)

    return repo


@app.post("/repository/{id}/clone", response_model=RepositoryCloneResponse)
def clone_repository(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    try:
        local_path = RepositoryCloneService(db).clone_and_scan(repository)
    except HTTPException as exc:
        db.refresh(repository)
        error = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "error": error,
                "repository_id": repository.id,
                "analysis_status": repository.analysis_status,
            },
        ) from exc
    db.refresh(repository)
    return RepositoryCloneResponse(
        repository_id=repository.id,
        analysis_status=repository.analysis_status,
        local_path=str(local_path),
        message="Repository cloned and structure scan completed successfully",
    )


@app.get(
    "/repository/{id}/structure",
    response_model=RepositoryStructureResponse,
)
def get_repository_structure(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    if repository.analysis_status != "CLONED":
        raise HTTPException(
            status_code=409,
            detail="Repository has not been cloned",
        )

    structure = (
        db.query(RepositoryStructure)
        .filter(RepositoryStructure.repository_id == repository.id)
        .first()
    )
    if not structure:
        raise HTTPException(status_code=404, detail="Repository structure not found")

    return RepositoryStructureResponse(
        repository_id=repository.id,
        directories=structure.directories,
        files=structure.files,
        languages=structure.languages,
        entry_points=structure.entry_points,
        configuration_files=structure.configuration_files,
        config_files=structure.config_files,
        dev_config_files=structure.dev_config_files,
        app_config_files=structure.app_config_files,
        documentation_files=structure.documentation_files,
        top_level_directories=structure.top_level_directories,
        total_files=structure.total_files,
        total_directories=structure.total_directories,
        repository_statistics=structure.repository_statistics,
        frameworks=structure.frameworks,
        dependencies=structure.dependencies,
        repository_summary=structure.repository_summary,
        runtimes=structure.runtimes,
        build_tools=structure.build_tools,
        project_type=structure.project_type,
        scanned_at=structure.scanned_at,
    )


@app.get(
    "/repository/{id}/entities",
    response_model=list[CodeEntityResponse],
)
def get_repository_entities(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    entities = (
        db.query(CodeEntity)
        .filter(CodeEntity.repository_id == repository.id)
        .order_by(CodeEntity.file_path, CodeEntity.line_number)
        .all()
    )
    return entities


@app.get(
    "/repository/{id}/entities/classes",
    response_model=list[CodeEntityResponse],
)
def get_repository_classes(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    entities = (
        db.query(CodeEntity)
        .filter(
            CodeEntity.repository_id == repository.id,
            CodeEntity.entity_type == "CLASS",
        )
        .order_by(CodeEntity.file_path, CodeEntity.line_number)
        .all()
    )
    return entities


@app.get(
    "/repository/{id}/entities/functions",
    response_model=list[CodeEntityResponse],
)
def get_repository_functions(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    entities = (
        db.query(CodeEntity)
        .filter(
            CodeEntity.repository_id == repository.id,
            CodeEntity.entity_type == "FUNCTION",
        )
        .order_by(CodeEntity.file_path, CodeEntity.line_number)
        .all()
    )
    return entities


@app.get(
    "/repository/{id}/entities/imports",
    response_model=list[CodeEntityResponse],
)
def get_repository_imports(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    entities = (
        db.query(CodeEntity)
        .filter(
            CodeEntity.repository_id == repository.id,
            CodeEntity.entity_type == "IMPORT",
        )
        .order_by(CodeEntity.file_path, CodeEntity.line_number)
        .all()
    )
    return entities


@app.get(
    "/repository/{id}/graph",
    response_model=RepositoryGraphResponse,
)
def get_repository_graph(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    nodes = (
        db.query(KnowledgeNode)
        .filter(KnowledgeNode.repository_id == repository.id)
        .all()
    )
    edges = (
        db.query(KnowledgeEdge)
        .filter(KnowledgeEdge.repository_id == repository.id)
        .all()
    )
    
    # Retrieve architecture hint
    arch_hint = "Standard Directory Layout"
    struct = (
        db.query(RepositoryStructure)
        .filter(RepositoryStructure.repository_id == repository.id)
        .first()
    )
    if struct and struct.repository_summary:
        arch_hint = struct.repository_summary.get("architecture_hint", "Standard Directory Layout")
        
    return RepositoryGraphResponse(
        nodes=nodes,
        edges=edges,
        architecture_hint=arch_hint,
    )


@app.get(
    "/repository/{id}/graph/nodes",
    response_model=list[KnowledgeNodeResponse],
)
def get_repository_graph_nodes(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    nodes = (
        db.query(KnowledgeNode)
        .filter(KnowledgeNode.repository_id == repository.id)
        .order_by(KnowledgeNode.node_type, KnowledgeNode.node_name)
        .all()
    )
    return nodes


@app.get(
    "/repository/{id}/graph/edges",
    response_model=list[KnowledgeEdgeResponse],
)
def get_repository_graph_edges(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    edges = (
        db.query(KnowledgeEdge)
        .filter(KnowledgeEdge.repository_id == repository.id)
        .all()
    )
    return edges


@app.get(
    "/repository/{id}/architecture",
    response_model=RepositoryArchitectureResponse,
)
def get_repository_architecture(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    
    arch = (
        db.query(RepositoryArchitecture)
        .filter(RepositoryArchitecture.repository_id == repository.id)
        .first()
    )
    if not arch:
        try:
            from architecture_service import ArchitectureService
            arch = ArchitectureService.generate_architecture(db, repository.id)
        except Exception as exc:
            logger.error(f"Failed to generate architecture on the fly for repo {repository.id}: {exc}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Architecture intelligence generation failed: {exc}")
            
    return arch


