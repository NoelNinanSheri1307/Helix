from pydantic import BaseModel
from datetime import datetime

class UserSync(BaseModel):
    email: str
    name: str
    avatar_url: str | None = None

class RepositoryCreate(BaseModel):
    user_email: str
    github_url: str

class RepositoryResponse(BaseModel):
    id: int
    user_id: int
    github_url: str
    status: str
    created_at: datetime
    
    repository_name: str | None = None
    owner: str | None = None
    description: str | None = None
    language: str | None = None
    stars: int | None = None
    forks: int | None = None
    github_id: str | None = None
    default_branch: str | None = None
    size_kb: int | None = None
    last_metadata_sync: datetime | None = None

    class Config:
        orm_mode = True
        from_attributes = True