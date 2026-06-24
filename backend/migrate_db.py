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
    """
    CREATE TABLE IF NOT EXISTS execution_flows (
        id SERIAL PRIMARY KEY,
        repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        flow_name VARCHAR NOT NULL,
        flow_type VARCHAR NOT NULL,
        entry_point VARCHAR,
        components_used JSON NOT NULL DEFAULT '[]',
        database_interactions JSON NOT NULL DEFAULT '[]',
        external_services JSON NOT NULL DEFAULT '[]',
        confidence_score DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_execution_flows_repository_id ON execution_flows(repository_id);",
    "CREATE INDEX IF NOT EXISTS ix_execution_flows_flow_name ON execution_flows(flow_name);",
    "CREATE INDEX IF NOT EXISTS ix_execution_flows_flow_type ON execution_flows(flow_type);",
    """
    CREATE TABLE IF NOT EXISTS flow_steps (
        id SERIAL PRIMARY KEY,
        flow_id INTEGER NOT NULL REFERENCES execution_flows(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        step_name VARCHAR NOT NULL,
        description VARCHAR,
        entity_id INTEGER REFERENCES code_entities(id) ON DELETE SET NULL,
        file_path VARCHAR,
        line_number INTEGER,
        node_type VARCHAR
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_flow_steps_flow_id ON flow_steps(flow_id);",
    """
    CREATE TABLE IF NOT EXISTS onboarding_documents (
        id SERIAL PRIMARY KEY,
        repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        document_type VARCHAR NOT NULL,
        generated_content JSON NOT NULL DEFAULT '{}',
        generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        version INTEGER NOT NULL DEFAULT 1
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_onboarding_documents_repository_id ON onboarding_documents(repository_id);",
    "CREATE INDEX IF NOT EXISTS ix_onboarding_documents_document_type ON onboarding_documents(document_type);",
    """
    CREATE TABLE IF NOT EXISTS repository_memory (
        id SERIAL PRIMARY KEY,
        repository_id INTEGER NOT NULL UNIQUE REFERENCES repositories(id) ON DELETE CASCADE,
        snapshot_content JSON NOT NULL DEFAULT '{}',
        snapshot_version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_repository_memory_repository_id ON repository_memory(repository_id);",
    """
    CREATE TABLE IF NOT EXISTS repository_embeddings (
        id SERIAL PRIMARY KEY,
        repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        section_type VARCHAR NOT NULL,
        section_key VARCHAR NOT NULL,
        section_text TEXT NOT NULL,
        embedding JSON NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_repository_embeddings_repository_id ON repository_embeddings(repository_id);",
    "CREATE INDEX IF NOT EXISTS ix_repository_embeddings_section_type ON repository_embeddings(section_type);",
    """
    CREATE TABLE IF NOT EXISTS chat_usage_logs (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR NOT NULL,
        repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        query_mode VARCHAR NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_chat_usage_logs_user_email_created_at ON chat_usage_logs(user_email, created_at);",
    """
    CREATE TABLE IF NOT EXISTS chat_cache (
        id SERIAL PRIMARY KEY,
        repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        question_hash VARCHAR NOT NULL,
        mode VARCHAR NOT NULL,
        response_content JSON NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_chat_cache_repo_hash_mode ON chat_cache(repository_id, question_hash, mode);",
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
