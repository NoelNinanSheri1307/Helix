import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load env variables from .env
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("DATABASE_URL is not set!")
    exit(1)

print(f"Connecting to database: {DATABASE_URL}")
engine = create_engine(DATABASE_URL)

alter_statements = [
    "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS repository_name VARCHAR;",
    "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS owner VARCHAR;",
    "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS description VARCHAR;",
    "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS language VARCHAR;",
    "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS stars INTEGER;",
    "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS forks INTEGER;",
    "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS github_id VARCHAR;",
    "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS default_branch VARCHAR;",
    "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS size_kb INTEGER;",
    "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS local_path VARCHAR;",
    "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS analysis_status VARCHAR NOT NULL DEFAULT 'READY';",
    "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS framework VARCHAR;",
    "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS framework_confidence DOUBLE PRECISION;",
    "ALTER TABLE repository_structures ADD COLUMN IF NOT EXISTS config_files JSON NOT NULL DEFAULT '[]';",
    "ALTER TABLE repository_structures ADD COLUMN IF NOT EXISTS dev_config_files JSON NOT NULL DEFAULT '[]';",
    "ALTER TABLE repository_structures ADD COLUMN IF NOT EXISTS app_config_files JSON NOT NULL DEFAULT '[]';",
    "ALTER TABLE repository_structures ADD COLUMN IF NOT EXISTS documentation_files JSON NOT NULL DEFAULT '[]';",
    "ALTER TABLE repository_structures ADD COLUMN IF NOT EXISTS repository_statistics JSON NOT NULL DEFAULT '{}';",
    "ALTER TABLE repository_structures ADD COLUMN IF NOT EXISTS frameworks JSON NOT NULL DEFAULT '[]';",
    "ALTER TABLE repository_structures ADD COLUMN IF NOT EXISTS dependencies JSON NOT NULL DEFAULT '[]';",
    "ALTER TABLE repository_structures ADD COLUMN IF NOT EXISTS repository_summary JSON NOT NULL DEFAULT '{}';",
    "ALTER TABLE repository_structures ADD COLUMN IF NOT EXISTS runtimes JSON NOT NULL DEFAULT '[]';",
    "ALTER TABLE repository_structures ADD COLUMN IF NOT EXISTS build_tools JSON NOT NULL DEFAULT '[]';",
    "ALTER TABLE repository_structures ADD COLUMN IF NOT EXISTS project_type VARCHAR;",
    """
    CREATE TABLE IF NOT EXISTS repository_structures (
        id SERIAL PRIMARY KEY,
        repository_id INTEGER NOT NULL UNIQUE REFERENCES repositories(id) ON DELETE CASCADE,
        directories JSON NOT NULL DEFAULT '[]',
        files JSON NOT NULL DEFAULT '[]',
        languages JSON NOT NULL DEFAULT '[]',
        top_level_directories JSON NOT NULL DEFAULT '[]',
        configuration_files JSON NOT NULL DEFAULT '[]',
        config_files JSON NOT NULL DEFAULT '[]',
        dev_config_files JSON NOT NULL DEFAULT '[]',
        app_config_files JSON NOT NULL DEFAULT '[]',
        documentation_files JSON NOT NULL DEFAULT '[]',
        entry_points JSON NOT NULL DEFAULT '[]',
        total_files INTEGER NOT NULL DEFAULT 0,
        total_directories INTEGER NOT NULL DEFAULT 0,
        repository_statistics JSON NOT NULL DEFAULT '{}',
        frameworks JSON NOT NULL DEFAULT '[]',
        dependencies JSON NOT NULL DEFAULT '[]',
        repository_summary JSON NOT NULL DEFAULT '{}',
        runtimes JSON NOT NULL DEFAULT '[]',
        build_tools JSON NOT NULL DEFAULT '[]',
        project_type VARCHAR,
        scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_repository_structures_repository_id ON repository_structures(repository_id);",
    "ALTER TABLE knowledge_edges ADD COLUMN IF NOT EXISTS caller_name VARCHAR;",
    "ALTER TABLE knowledge_edges ADD COLUMN IF NOT EXISTS callee_name VARCHAR;",
    "ALTER TABLE knowledge_edges ADD COLUMN IF NOT EXISTS line_number INTEGER;",
    "ALTER TABLE knowledge_edges ADD COLUMN IF NOT EXISTS file_path VARCHAR;",
    "ALTER TABLE knowledge_edges ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION;",
    "ALTER TABLE knowledge_edges ALTER COLUMN target_node_id DROP NOT NULL;",
]

with engine.connect() as conn:
    # Begin transaction
    trans = conn.begin()
    try:
        for statement in alter_statements:
            print(f"Running: {statement}")
            conn.execute(text(statement))
        trans.commit()
        print("Migration completed successfully!")
    except Exception as e:
        trans.rollback()
        print(f"Migration failed: {e}")
        exit(1)
