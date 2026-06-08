from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine,get_db
from database import Base
from fastapi import Depends
from sqlalchemy.orm import Session
from database import get_db
from schemas import UserSync, RepositoryCreate, RepositoryResponse
from models import User
from models import Repository
import models

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Helix API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "message": "Helix Backend Running"
    }
@app.post("/users/sync")
def sync_user(
    payload: UserSync,
    db: Session = Depends(get_db)
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
            "user_id": existing_user.id
        }

    new_user = User(
        email=payload.email,
        name=payload.name,
        avatar_url=payload.avatar_url
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User created",
        "user_id": new_user.id
    }

@app.post("/repository/submit")
def submit_repository(
    payload: RepositoryCreate,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(User.email == payload.user_email)
        .first()
    )

    if not user:
        return {
            "error": "User not found"
        }

    repository = Repository(
        user_id=user.id,
        github_url=payload.github_url,
        status="PENDING"
    )

    db.add(repository)
    db.commit()
    db.refresh(repository)

    return {
        "message": "Repository stored",
        "repository_id": repository.id
    }
@app.get("/repositories/{email}", response_model=list[RepositoryResponse])
def get_repositories(
    email: str,
    db: Session = Depends(get_db)
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
            Repository.user_id == user.id
        )
        .all()
    )

    return repositories