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
    "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS size_kb INTEGER;"
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
