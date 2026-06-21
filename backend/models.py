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
