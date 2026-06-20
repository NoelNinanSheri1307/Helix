from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
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

    last_metadata_sync = Column(
        DateTime(timezone=True),
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )