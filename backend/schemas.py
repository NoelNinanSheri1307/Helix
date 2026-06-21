from pydantic import BaseModel, ConfigDict
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
    framework: str | None = None
    framework_confidence: float | None = None
    local_path: str | None = None
    analysis_status: str = "READY"

    model_config = ConfigDict(from_attributes=True)


class RepositoryCloneResponse(BaseModel):
    repository_id: int
    analysis_status: str
    local_path: str | None = None
    message: str


class RepositoryStructureResponse(BaseModel):
    repository_id: int
    directories: list[str]
    files: list[str]
    languages: list[str]
    entry_points: list[str]
    configuration_files: list[str]
    config_files: list[str]
    dev_config_files: list[str]
    app_config_files: list[str]
    documentation_files: list[str]
    top_level_directories: list[str]
    total_files: int
    total_directories: int
    repository_statistics: dict
    frameworks: list[str]
    dependencies: list[str]
    repository_summary: dict
    runtimes: list[str]
    build_tools: list[str]
    project_type: str | None = None
    scanned_at: datetime
