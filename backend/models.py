from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import JSON
from sqlalchemy import Float
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String, unique=True, nullable=False)

    name = Column(String, nullable=False)

    avatar_url = Column(String)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


class Repository(Base):
    __tablename__ = "repositories"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"))

    github_url = Column(String, nullable=False)

    status = Column(String, default="PENDING")

    repository_name = Column(String, nullable=True)
    owner = Column(String, nullable=True)
    description = Column(String, nullable=True)
    language = Column(String, nullable=True)
    stars = Column(Integer, nullable=True)
    forks = Column(Integer, nullable=True)
    github_id = Column(String, nullable=True)
    default_branch = Column(String, nullable=True)
    size_kb = Column(Integer, nullable=True)
    local_path = Column(String, nullable=True)
    analysis_status = Column(String, nullable=False, default="READY")
    
    framework = Column(String, nullable=True)
    framework_confidence = Column(Float, nullable=True)

    last_metadata_sync = Column(
        DateTime(timezone=True),
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )


class RepositoryStructure(Base):
    __tablename__ = "repository_structures"

    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(
        Integer,
        ForeignKey("repositories.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    directories = Column(JSON, nullable=False, default=list)
    files = Column(JSON, nullable=False, default=list)
    languages = Column(JSON, nullable=False, default=list)
    top_level_directories = Column(JSON, nullable=False, default=list)
    configuration_files = Column(JSON, nullable=False, default=list)
    config_files = Column(JSON, nullable=False, default=list)
    dev_config_files = Column(JSON, nullable=False, default=list)
    app_config_files = Column(JSON, nullable=False, default=list)
    documentation_files = Column(JSON, nullable=False, default=list)
    entry_points = Column(JSON, nullable=False, default=list)
    total_files = Column(Integer, nullable=False, default=0)
    total_directories = Column(Integer, nullable=False, default=0)
    repository_statistics = Column(JSON, nullable=False, default=dict)
    frameworks = Column(JSON, nullable=False, default=list)
    dependencies = Column(JSON, nullable=False, default=list)
    repository_summary = Column(JSON, nullable=False, default=dict)
    runtimes = Column(JSON, nullable=False, default=list)
    build_tools = Column(JSON, nullable=False, default=list)
    project_type = Column(String, nullable=True)
    scanned_at = Column(DateTime(timezone=True), server_default=func.now())


class CodeEntity(Base):
    __tablename__ = "code_entities"

    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(
        Integer,
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_path = Column(String, nullable=False, index=True)
    entity_type = Column(String, nullable=False, index=True)  # IMPORT, CLASS, FUNCTION, METHOD, INTERFACE, EXPORT
    entity_name = Column(String, nullable=False, index=True)
    line_number = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"

    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(
        Integer,
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_id = Column(
        Integer,
        ForeignKey("code_entities.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    node_type = Column(String, nullable=False, index=True)  # CLASS, FUNCTION, METHOD, etc.
    node_name = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class KnowledgeEdge(Base):
    __tablename__ = "knowledge_edges"

    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(
        Integer,
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_node_id = Column(
        Integer,
        ForeignKey("knowledge_nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_node_id = Column(
        Integer,
        ForeignKey("knowledge_nodes.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    relationship_type = Column(String, nullable=False, index=True)  # IMPORTS, CALLS, etc.
    
    caller_name = Column(String, nullable=True)
    callee_name = Column(String, nullable=True)
    line_number = Column(Integer, nullable=True)
    file_path = Column(String, nullable=True)
    confidence_score = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RepositoryArchitecture(Base):
    __tablename__ = "repository_architectures"

    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(
        Integer,
        ForeignKey("repositories.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    architecture_type = Column(String, nullable=False)
    project_type = Column(String, nullable=False)
    components = Column(JSON, nullable=False, default=list)  # List of dicts representing system components
    deployment_model = Column(String, nullable=True)
    architecture_summary = Column(JSON, nullable=False, default=dict)  # Key-value summary of fields
    detected_flows = Column(JSON, nullable=False, default=list)  # Inferred call/request flows
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ExecutionFlow(Base):
    __tablename__ = "execution_flows"

    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(
        Integer,
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    flow_name = Column(String, nullable=False, index=True)
    flow_type = Column(String, nullable=False, index=True)
    entry_point = Column(String, nullable=True)
    components_used = Column(JSON, nullable=False, default=list)
    database_interactions = Column(JSON, nullable=False, default=list)
    external_services = Column(JSON, nullable=False, default=list)
    confidence_score = Column(Float, nullable=False, default=1.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FlowStep(Base):
    __tablename__ = "flow_steps"

    id = Column(Integer, primary_key=True, index=True)
    flow_id = Column(
        Integer,
        ForeignKey("execution_flows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step_number = Column(Integer, nullable=False)
    step_name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    entity_id = Column(
        Integer,
        ForeignKey("code_entities.id", ondelete="SET NULL"),
        nullable=True,
    )
    file_path = Column(String, nullable=True)
    line_number = Column(Integer, nullable=True)
    node_type = Column(String, nullable=True)


class OnboardingDocument(Base):
    __tablename__ = "onboarding_documents"

    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(
        Integer,
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_type = Column(String, nullable=False, index=True)  # LEVEL_1, LEVEL_2, etc.
    generated_content = Column(JSON, nullable=False)  # JSON holding level-specific onboarding documents
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    version = Column(Integer, nullable=False, default=1)


