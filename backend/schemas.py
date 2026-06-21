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


class CodeEntityResponse(BaseModel):
    id: int
    repository_id: int
    file_path: str
    entity_type: str
    entity_name: str
    line_number: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class KnowledgeNodeResponse(BaseModel):
    id: int
    repository_id: int
    entity_id: int | None = None
    node_type: str
    node_name: str

    model_config = ConfigDict(from_attributes=True)


class KnowledgeEdgeResponse(BaseModel):
    id: int
    repository_id: int
    source_node_id: int
    target_node_id: int
    relationship_type: str

    model_config = ConfigDict(from_attributes=True)


class RepositoryGraphResponse(BaseModel):
    nodes: list[KnowledgeNodeResponse]
    edges: list[KnowledgeEdgeResponse]
    architecture_hint: str | None = None


class RepositoryArchitectureResponse(BaseModel):
    id: int
    repository_id: int
    architecture_type: str
    project_type: str
    components: list[dict]
    deployment_model: str | None = None
    architecture_summary: dict
    detected_flows: list[dict]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

