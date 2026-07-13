from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from starlette.requests import Request

import logging
logger = logging.getLogger(__name__)

from database import Base, engine, get_db
from github_service import RepoMetadata, validate_and_fetch_metadata
from models import Repository, RepositoryStructure, User, CodeEntity, KnowledgeNode, KnowledgeEdge, RepositoryArchitecture, ExecutionFlow, FlowStep, OnboardingDocument
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
    CallGraphResponse,
    FlowStepResponse,
    ExecutionFlowResponse,
    OnboardingDocumentResponse,
    MemorySnapshotResponse,
    MemorySearchResponse,
    MemorySearchRequest,
    ContextAssemblyRequest,
    ChatRequest,
    ChatResponse,
)


Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup event: cleanup repositories stuck in CLONING
    db = next(get_db())
    try:
        stuck_repos = db.query(Repository).filter(Repository.analysis_status.in_(["CLONING", "SYNCING", "ANALYZING"])).all()
        if stuck_repos:
            for repo in stuck_repos:
                repo.analysis_status = "FAILED"
                repo.status = "FAILED"
                logger.warning(f"Repository ID {repo.id} was found in {repo.analysis_status} status during startup, marking as FAILED.")
            db.commit()

        # Trigger execution flow discovery for already-cloned repos if they don't have flows yet
        from execution_flow_service import ExecutionFlowService
        cloned_repos = db.query(Repository).filter(Repository.analysis_status.in_(["READY", "CLONED", "UP_TO_DATE", "UPDATES_AVAILABLE"])).all()
        for repo in cloned_repos:
            has_flows = db.query(ExecutionFlow).filter(ExecutionFlow.repository_id == repo.id).first() is not None
            if not has_flows:
                logger.info(f"Repository ID {repo.id} ({repo.repository_name}) has no execution flows, running flow discovery...")
                try:
                    ExecutionFlowService.discover_flows(db, repo.id)
                except Exception as flow_exc:
                    logger.error(f"Failed to run startup flow discovery for repo {repo.id}: {flow_exc}")
    except Exception as exc:
        logger.error(f"Failed to clean up cloning status or run startup flow discovery: {exc}")
    finally:
        db.close()
    yield

app = FastAPI(
    title="Helix API",
    version="1.0.0",
    lifespan=lifespan,
)

import os
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
origins = [frontend_url]
if frontend_url != "http://localhost:3000":
    origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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

    # Enforce maximum 7 active repositories limit
    active_count = db.query(Repository).filter(Repository.user_id == user.id).count()
    if active_count >= 7:
        raise HTTPException(
            status_code=400,
            detail={"error": "repository_limit_exceeded", "detail": "Maximum limit of 7 active repositories reached. Please delete an existing repository to import a new one."}
        )

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
    if repository.analysis_status not in ["READY", "CLONED", "UP_TO_DATE", "UPDATES_AVAILABLE"]:
        raise HTTPException(
            status_code=409,
            detail="Repository is not ready or has not been cloned",
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


@app.get(
    "/repository/{id}/callgraph",
    response_model=CallGraphResponse,
)
def get_repository_call_graph(
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
        .filter(
            KnowledgeEdge.repository_id == repository.id,
            KnowledgeEdge.relationship_type.in_(["CALLS", "INVOKES", "CREATES", "ROUTES_TO"])
        )
        .all()
    )
    
    adj = {}
    in_degree = {}
    node_name_by_id = {n.id: n.node_name for n in nodes}
    
    for edge in edges:
        src = edge.source_node_id
        tgt = edge.target_node_id
        if src and tgt:
            adj.setdefault(src, []).append(tgt)
            in_degree[tgt] = in_degree.get(tgt, 0) + 1
            if src not in in_degree:
                in_degree[src] = 0

    roots = [node_id for node_id, deg in in_degree.items() if deg == 0]
    
    if not roots and adj:
        roots = list(adj.keys())
        
    call_chains = []
    
    def dfs(node_id, current_path, visited):
        node_name = node_name_by_id.get(node_id, f"Node-{node_id}")
        new_path = current_path + [node_name]
        
        if node_id in visited or len(new_path) >= 5:
            call_chains.append(new_path)
            return
            
        neighbors = adj.get(node_id, [])
        if not neighbors:
            call_chains.append(new_path)
            return
            
        new_visited = visited | {node_id}
        for neighbor in neighbors:
            dfs(neighbor, new_path, new_visited)

    for root in roots:
        dfs(root, [], set())
        
    unique_chains = []
    for chain in call_chains:
        if chain not in unique_chains:
            unique_chains.append(chain)
            
    return CallGraphResponse(
        nodes=nodes,
        edges=edges,
        call_chains=unique_chains,
    )


@app.get(
    "/repository/{id}/flows",
    response_model=list[ExecutionFlowResponse],
)
def get_repository_flows(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    flows = (
        db.query(ExecutionFlow)
        .filter(ExecutionFlow.repository_id == repository.id)
        .order_by(ExecutionFlow.id)
        .all()
    )
    for flow in flows:
        flow.steps = (
            db.query(FlowStep)
            .filter(FlowStep.flow_id == flow.id)
            .order_by(FlowStep.step_number)
            .all()
        )
    return flows


@app.get(
    "/repository/{id}/flows/search",
    response_model=list[ExecutionFlowResponse],
)
def search_repository_flows(
    id: int,
    email: str,
    q: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    from sqlalchemy import String, cast
    query = (
        db.query(ExecutionFlow)
        .filter(ExecutionFlow.repository_id == repository.id)
    )
    if q:
        query = query.filter(
            (ExecutionFlow.flow_name.ilike(f"%{q}%")) |
            (ExecutionFlow.flow_type.ilike(f"%{q}%")) |
            (cast(ExecutionFlow.components_used, String).ilike(f"%{q}%"))
        )
    flows = query.all()
    for flow in flows:
        flow.steps = (
            db.query(FlowStep)
            .filter(FlowStep.flow_id == flow.id)
            .order_by(FlowStep.step_number)
            .all()
        )
    return flows


@app.get(
    "/repository/{id}/flows/{flow_id}",
    response_model=ExecutionFlowResponse,
)
def get_repository_flow_detail(
    id: int,
    flow_id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    flow = (
        db.query(ExecutionFlow)
        .filter(
            ExecutionFlow.repository_id == repository.id,
            ExecutionFlow.id == flow_id,
        )
        .first()
    )
    if not flow:
        raise HTTPException(status_code=404, detail="Execution flow not found")
        
    flow.steps = (
        db.query(FlowStep)
        .filter(FlowStep.flow_id == flow.id)
        .order_by(FlowStep.step_number)
        .all()
    )
    return flow


@app.get(
    "/repository/{id}/onboarding",
    response_model=dict[str, OnboardingDocumentResponse],
)
def get_repository_onboarding(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    from onboarding_service import OnboardingService
    return OnboardingService.get_or_generate_onboarding(db, repository.id)


@app.post(
    "/repository/{id}/onboarding/regenerate",
    response_model=dict[str, OnboardingDocumentResponse],
)
def regenerate_repository_onboarding(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    from onboarding_service import OnboardingService
    return OnboardingService.generate_onboarding(db, repository.id)


@app.get(
    "/repository/{id}/onboarding/{document_type}",
    response_model=OnboardingDocumentResponse,
)
def get_repository_onboarding_by_type(
    id: int,
    document_type: str,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    doc = (
        db.query(OnboardingDocument)
        .filter(
            OnboardingDocument.repository_id == repository.id,
            OnboardingDocument.document_type == document_type,
        )
        .order_by(OnboardingDocument.version.desc())
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=404,
            detail=f"Onboarding document of type {document_type} not found",
        )
    return doc


# ════════════════════════════════════════════════════════════════════════════════
# REPOSITORY MEMORY LAYER
# ════════════════════════════════════════════════════════════════════════════════

@app.post(
    "/repository/{id}/memory/generate",
    response_model=MemorySnapshotResponse,
)
def generate_repository_memory(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    from repository_memory_service import RepositoryMemoryService
    return RepositoryMemoryService.generate_snapshot(db, repository.id)


@app.get(
    "/repository/{id}/memory",
    response_model=MemorySnapshotResponse,
)
def get_repository_memory(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    from repository_memory_service import RepositoryMemoryService
    result = RepositoryMemoryService.get_memory(db, repository.id)
    if not result:
        raise HTTPException(status_code=404, detail="Repository memory not generated yet")
    return result


@app.post(
    "/repository/{id}/memory/search",
    response_model=MemorySearchResponse,
)
def search_repository_memory(
    id: int,
    email: str,
    payload: MemorySearchRequest,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    from repository_memory_service import RepositoryMemoryService
    return RepositoryMemoryService.semantic_search(db, repository.id, payload.query, payload.top_k)


@app.post(
    "/repository/{id}/context",
    response_model=dict,
)
def assemble_repository_context(
    id: int,
    email: str,
    payload: ContextAssemblyRequest,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    from context_assembly_service import ContextAssemblyService
    return ContextAssemblyService.assemble_context(db, repository.id, payload.query)


@app.post(
    "/repository/{id}/chat",
    response_model=ChatResponse,
)
def repository_chat(
    id: int,
    email: str,
    payload: ChatRequest,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    from chat_service import ChatService
    return ChatService.chat(db, repository.id, payload.message, email, payload.mode)


import os

@app.post(
    "/repository/{id}/check-updates",
    response_model=RepositoryResponse,
)
def check_repository_updates(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    from github_service import parse_github_url, fetch_latest_commit_sha
    try:
        owner, repo_name, _ = parse_github_url(repository.github_url)
        branch = repository.current_branch or repository.default_branch or "main"
        latest_sha = fetch_latest_commit_sha(owner, repo_name, branch)
        
        repository.latest_github_commit_sha = latest_sha
        repository.last_synced_timestamp = datetime.now(timezone.utc)
        
        if repository.current_commit_sha == latest_sha:
            repository.analysis_status = "UP_TO_DATE"
            repository.status = "UP_TO_DATE"
        else:
            repository.analysis_status = "UPDATES_AVAILABLE"
            repository.status = "UPDATES_AVAILABLE"
            
        db.commit()
        db.refresh(repository)
    except Exception as e:
        logger.error(f"Failed to check updates for repository {id}: {e}")
    return repository


@app.post(
    "/repository/{id}/update",
    response_model=RepositoryResponse,
)
def update_repository(
    id: int,
    email: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    repository = get_owned_repository(id, email, db)
    
    # Run sync fetch check synchronously first. If already up to date, return immediately!
    import subprocess
    local_path = repository.local_path
    if local_path and os.path.exists(local_path):
        try:
            subprocess.run(["git", "fetch"], cwd=local_path, capture_output=True, text=True, timeout=10.0)
            branch = repository.current_branch or "main"
            remote_sha_res = subprocess.run(
                ["git", "rev-parse", f"origin/{branch}"],
                cwd=local_path,
                capture_output=True,
                text=True,
                timeout=10.0
            )
            remote_sha = remote_sha_res.stdout.strip()
            if remote_sha and remote_sha == repository.current_commit_sha:
                repository.analysis_status = "UP_TO_DATE"
                repository.status = "UP_TO_DATE"
                repository.latest_github_commit_sha = remote_sha
                repository.last_synced_timestamp = datetime.now(timezone.utc)
                db.commit()
                db.refresh(repository)
                return repository
        except Exception as fetch_exc:
            logger.error(f"Fetch pre-check failed: {fetch_exc}")

    # Set status to SYNCING
    repository.analysis_status = "SYNCING"
    repository.status = "SYNCING"
    db.commit()
    db.refresh(repository)
    
    background_tasks.add_task(
        run_repository_update_pipeline, repository.id, email
    )
    return repository


def run_repository_update_pipeline(repository_id: int, email: str):
    from database import get_db
    import subprocess
    db = next(get_db())
    
    try:
        from models import Repository, RepositoryStructure, CodeEntity, KnowledgeNode, KnowledgeEdge, ExecutionFlow, RepositoryArchitecture, OnboardingDocument, RepositoryMemory, RepositoryEmbedding, ChatCache
        repository = db.query(Repository).filter(Repository.id == repository_id).first()
        if not repository:
            return
            
        logger.info(f"Starting update pipeline for repository {repository_id}...")
        
        # 1. git pull
        local_path = repository.local_path
        pull_res = subprocess.run(["git", "pull"], cwd=local_path, capture_output=True, text=True, timeout=60.0)
        if pull_res.returncode != 0:
            raise RuntimeError(f"git pull failed: {pull_res.stderr}")
            
        # Get new SHA
        sha_res = subprocess.run(["git", "rev-parse", "HEAD"], cwd=local_path, capture_output=True, text=True)
        new_sha = sha_res.stdout.strip() if sha_res.returncode == 0 else repository.current_commit_sha
        
        repository.current_commit_sha = new_sha
        repository.latest_github_commit_sha = new_sha
        repository.last_synced_timestamp = datetime.now(timezone.utc)
        
        # 2. Update status to ANALYZING
        repository.analysis_status = "ANALYZING"
        repository.status = "ANALYZING"
        db.commit()
        
        # 3. Clear old analysis data
        db.query(CodeEntity).filter(CodeEntity.repository_id == repository_id).delete()
        db.query(KnowledgeNode).filter(KnowledgeNode.repository_id == repository_id).delete()
        db.query(KnowledgeEdge).filter(KnowledgeEdge.repository_id == repository_id).delete()
        db.query(ExecutionFlow).filter(ExecutionFlow.repository_id == repository_id).delete()
        db.query(RepositoryArchitecture).filter(RepositoryArchitecture.repository_id == repository_id).delete()
        db.query(OnboardingDocument).filter(OnboardingDocument.repository_id == repository_id).delete()
        db.query(RepositoryMemory).filter(RepositoryMemory.repository_id == repository_id).delete()
        db.query(RepositoryEmbedding).filter(RepositoryEmbedding.repository_id == repository_id).delete()
        db.query(ChatCache).filter(ChatCache.repository_id == repository_id).delete()
        db.commit()
        
        # 4. Refresh structure scan
        from repository_scanner import RepositoryStructureScanner
        scanner = RepositoryStructureScanner()
        scan = scanner.scan(local_path)
        
        # Save scan
        from repository_clone_service import RepositoryCloneService
        clone_service = RepositoryCloneService(db)
        clone_service._store_scan(repository.id, scan)
        
        repository.framework = scan.repository_statistics.get("framework", "Unknown")
        repository.framework_confidence = scan.repository_statistics.get("framework_confidence", 0.0)
        db.commit()
        
        # 5. Re-run AST analysis
        from ast_analyzer import ASTAnalysisService
        ASTAnalysisService.analyze_repository(db, repository.id, local_path)
        
        # 6. Rebuild Knowledge Graph & Call Graph
        from graph_service import KnowledgeGraphService
        KnowledgeGraphService.generate_graph(db, repository.id)
        
        # 7. Recompute Execution Flows
        from execution_flow_service import ExecutionFlowService
        ExecutionFlowService.discover_flows(db, repository.id)
        
        # 8. Recompute Architecture Intelligence
        from architecture_service import ArchitectureService
        ArchitectureService.generate_architecture(db, repository.id)
        
        # 9. Regenerate Code Atlas & Onboarding Document
        from onboarding_service import OnboardingService
        OnboardingService.generate_onboarding(db, repository.id)
        
        # 10. Regenerate Repository Memory & Embeddings
        from repository_memory_service import RepositoryMemoryService
        RepositoryMemoryService.generate_snapshot(db, repository.id)
        
        # 11. Finalize: Status = READY
        repository.analysis_status = "READY"
        repository.status = "READY"
        repository.last_analysis_timestamp = datetime.now(timezone.utc)
        db.commit()
        
        logger.info(f"Update pipeline completed successfully for repository {repository_id}!")
        
    except Exception as exc:
        logger.error(f"Update pipeline failed for repository {repository_id}: {exc}", exc_info=True)
        try:
            repository = db.query(Repository).filter(Repository.id == repository_id).first()
            if repository:
                repository.analysis_status = "FAILED"
                repository.status = "FAILED"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()



