# Helix Stage 2: Repository Acquisition and Structure Intelligence

## Lifecycle

`READY -> CLONING -> CLONED`

Any metadata validation, size validation, clone, timeout, storage, scan, or persistence
failure moves the repository to `FAILED`. A failed repository may be cloned again.

## Clone repository

`POST /repository/{id}/clone?email={user_email}`

The endpoint verifies the user and repository ownership, refreshes public GitHub
metadata, rejects repositories larger than 100 MB, performs a shallow `git clone`,
scans structure, and stores the clone at `backend/storage/repositories/{id}/`.

Successful response:

```json
{
  "repository_id": 1,
  "analysis_status": "CLONED",
  "local_path": ".../backend/storage/repositories/1",
  "message": "Repository cloned and structure scan completed successfully"
}
```

Failure response:

```json
{
  "error": "Repository exceeds supported size limit.",
  "repository_id": 1,
  "analysis_status": "FAILED"
}
```

## Get repository structure

`GET /repository/{id}/structure?email={user_email}`

Only the owning user can retrieve a completed structure scan.

```json
{
  "repository_id": 1,
  "directories": ["src"],
  "files": ["package.json", "src/index.ts"],
  "languages": ["TypeScript"],
  "entry_points": ["package.json", "src/index.ts"],
  "configuration_files": ["package.json"],
  "top_level_directories": ["src"],
  "total_files": 2,
  "total_directories": 1,
  "scanned_at": "2026-06-20T00:00:00Z"
}
```

## Constraints

- Maximum GitHub repository size: 100 MB (enforced before cloning)
- Maximum analysis time: 5 minutes
- Maximum files: 5,000 (architecture constant only; not enforced in Stage 2)

## Architecture

- `RepositoryCloneService` owns metadata revalidation, status transitions, safe
  temporary cloning, atomic replacement, cleanup, scan orchestration, and persistence.
- `RepositoryStructureScanner` walks names and paths while excluding `.git`; it does
  not open source files or perform AST parsing.
- `RepositoryStructure` stores the scan separately from repository metadata so list
  endpoints do not load the full directory tree.
- All repository-specific routes resolve the requesting user first and compare the
  repository's `user_id` before returning or mutating data.
