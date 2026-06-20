from datetime import datetime, timezone
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from starlette.requests import Request

from database import Base, engine, get_db
from github_service import RepoMetadata, validate_and_fetch_metadata
from models import Repository, User
from schemas import RepositoryCreate, RepositoryResponse, UserSync

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Helix API",
    version="1.0.0",
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


@app.get("/")
def root():
    return {
        "message": "Helix Backend Running",
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
    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    repo = (
        db.query(Repository)
        .filter(Repository.id == id)
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    if repo.user_id != user.id:
        raise HTTPException(status_code=403, detail="Permission denied")

    db.delete(repo)
    db.commit()
    return {"message": "Repository deleted successfully"}


@app.post("/repository/{id}/refresh", response_model=RepositoryResponse)
def refresh_repository(
    id: int,
    email: str,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    repo = (
        db.query(Repository)
        .filter(Repository.id == id)
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    if repo.user_id != user.id:
        raise HTTPException(status_code=403, detail="Permission denied")

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

