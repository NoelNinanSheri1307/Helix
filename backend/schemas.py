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
    target_node_id: int | None = None
    relationship_type: str
    caller_name: str | None = None
    callee_name: str | None = None
    line_number: int | None = None
    file_path: str | None = None
    confidence_score: float | None = None

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


class CallGraphResponse(BaseModel):
    nodes: list[KnowledgeNodeResponse]
    edges: list[KnowledgeEdgeResponse]
    call_chains: list[list[str]]


class FlowStepResponse(BaseModel):
    id: int
    flow_id: int
    step_number: int
    step_name: str
    description: str | None = None
    entity_id: int | None = None
    file_path: str | None = None
    line_number: int | None = None
    node_type: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ExecutionFlowResponse(BaseModel):
    id: int
    repository_id: int
    flow_name: str
    flow_type: str
    entry_point: str | None = None
    components_used: list[str]
    database_interactions: list[str]
    external_services: list[str]
    confidence_score: float
    created_at: datetime
    steps: list[FlowStepResponse] = []

    model_config = ConfigDict(from_attributes=True)


class OnboardingDocumentResponse(BaseModel):
    document_type: str
    generated_content: dict
    generated_at: str | None = None
    version: int

    model_config = ConfigDict(from_attributes=True)


class MemorySnapshotResponse(BaseModel):
    repository_id: int
    snapshot_content: dict
    snapshot_version: int
    created_at: str | None = None
    updated_at: str | None = None
    embedding_count: int = 0


class MemorySearchResultItem(BaseModel):
    section_type: str
    section_key: str
    section_text: str
    similarity_score: float


class MemorySearchResponse(BaseModel):
    query: str
    results: list[MemorySearchResultItem]
    total_embeddings: int
    referenced_components: list[str] = []
    referenced_flows: list[str] = []


class MemorySearchRequest(BaseModel):
    query: str
    top_k: int = 10


class ContextAssemblyRequest(BaseModel):
    query: str


class ChatRequest(BaseModel):
    message: str
    mode: str = "explain"  # "explain" or "analyze"


class ChatResponse(BaseModel):
    answer: str
    confidence: float
    provider: str
    model: str
    referenced_files: list[str] = []
    referenced_components: list[str] = []
    referenced_flows: list[str] = []
    response_time_ms: int


