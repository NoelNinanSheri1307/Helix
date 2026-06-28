import logging
import os
import shutil
import stat
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from github_service import validate_and_fetch_metadata
from models import Repository, RepositoryStructure
from repository_scanner import (
    RepositoryAnalysisConstraints,
    RepositoryStructureScanner,
    StructureScanResult,
)
from ast_analyzer import ASTAnalysisService

logger = logging.getLogger(__name__)


class RepositoryCloneService:
    def __init__(
        self,
        db: Session,
        storage_root: Path | None = None,
        constraints: RepositoryAnalysisConstraints | None = None,
    ):
        self.db = db
        self.storage_root = (
            storage_root or Path(__file__).resolve().parent.parent / "storage" / "repositories"
        ).resolve()
        self.constraints = constraints or RepositoryAnalysisConstraints()
        self.scanner = RepositoryStructureScanner(self.constraints)

    def clone_and_scan(self, repository: Repository) -> Path:
        if repository.analysis_status == "CLONING":
            raise HTTPException(status_code=409, detail="Repository clone is already in progress")

        # 1. Setup path
        self.storage_root.mkdir(parents=True, exist_ok=True)
        # Create .gitignore in storage_root if it doesn't exist
        gitignore_path = self.storage_root / ".gitignore"
        if not gitignore_path.exists():
            try:
                with open(gitignore_path, "w") as f:
                    f.write("*\n!.gitignore\n!.gitkeep\n")
            except Exception as e:
                logger.warning(f"Could not create .gitignore in storage_root: {e}")

        final_path = (self.storage_root / str(repository.id)).resolve()
        self._assert_storage_path(final_path)

        logger.info(f"[Clone Start] Repo ID: {repository.id}, repository path: {final_path}")
        start_time = datetime.now(timezone.utc)

        # 2. Before cloning cleanups:
        # A. Remove stale temp folders (matching .{repository.id}-*)
        logger.info(f"Checking for stale temp/backup folders matching .{repository.id}-* in {self.storage_root}")
        for p in self.storage_root.glob(f".{repository.id}-*"):
            logger.info(f"Removing stale temp directory/file: {p}")
            if p.is_dir():
                self._rmtree(p)
            else:
                try:
                    os.chmod(p, stat.S_IWRITE)
                    p.unlink()
                except Exception as e:
                    logger.warning(f"Could not delete stale file {p}: {e}")

        # B. Remove stale repository folder if repository status is not CLONED
        if repository.analysis_status != "CLONED" and final_path.exists():
            logger.info(f"Removing stale repository folder (status is {repository.analysis_status}): {final_path}")
            self._rmtree(final_path)

        # Ensure final_path is empty before direct clone to prevent git clone failure
        if final_path.exists():
            logger.info(f"Removing existing folder before direct clone: {final_path}")
            self._rmtree(final_path)

        try:
            metadata = validate_and_fetch_metadata(repository.github_url)
        except HTTPException:
            self._mark_failed(repository)
            raise
        if metadata.size_kb > self.constraints.max_repository_size_kb:
            self._mark_failed(repository)
            raise HTTPException(
                status_code=413,
                detail="Repository exceeds supported size limit.",
            )

        self._update_metadata(repository, metadata)
        repository.analysis_status = "CLONING"
        repository.status = "CLONING"
        self.db.commit()

        git_cmd = [
            "git", "clone", "--depth", "1", "--single-branch",
            "--branch", metadata.default_branch,
            metadata.github_url, str(final_path),
        ]
        logger.info(f"Executing Git Clone Command: {' '.join(git_cmd)}")

        try:
            completed = subprocess.run(
                git_cmd,
                capture_output=True,
                text=True,
                timeout=self.constraints.max_analysis_seconds,
                check=False,
            )
            
            logger.info(f"Git Return Code: {completed.returncode}")
            logger.info(f"Git stdout: {completed.stdout.strip()}")
            logger.info(f"Git stderr: {completed.stderr.strip()}")

            if completed.returncode != 0:
                error_msg = (completed.stderr or completed.stdout or "git clone failed").strip()
                raise RuntimeError(error_msg[-1000:])

            logger.info(f"Cloned successfully into {final_path}. Scanning structure...")
            scan = self.scanner.scan(final_path)

            self._store_scan(repository.id, scan)
            repository.local_path = str(final_path)
            
            # Run AST Analysis
            try:
                ASTAnalysisService.analyze_repository(self.db, repository.id, str(final_path))
            except Exception as ast_exc:
                logger.error(f"AST Analysis failed for repository {repository.id}: {ast_exc}", exc_info=True)

            repository.framework = scan.repository_statistics.get("framework", "Unknown")
            repository.framework_confidence = scan.repository_statistics.get("framework_confidence", 0.0)

            # Extract local Git branch and commit SHA
            current_branch = "main"
            current_sha = None
            try:
                branch_res = subprocess.run(
                    ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                    cwd=str(final_path),
                    capture_output=True,
                    text=True,
                    check=False
                )
                if branch_res.returncode == 0:
                    current_branch = branch_res.stdout.strip()

                sha_res = subprocess.run(
                    ["git", "rev-parse", "HEAD"],
                    cwd=str(final_path),
                    capture_output=True,
                    text=True,
                    check=False
                )
                if sha_res.returncode == 0:
                    current_sha = sha_res.stdout.strip()
            except Exception as git_meta_exc:
                logger.error(f"Failed to fetch git metadata: {git_meta_exc}")

            repository.analysis_status = "READY"
            repository.status = "READY"
            repository.current_branch = current_branch
            repository.current_commit_sha = current_sha
            repository.latest_github_commit_sha = current_sha
            repository.last_synced_timestamp = datetime.now(timezone.utc)
            repository.last_analysis_timestamp = datetime.now(timezone.utc)

            self.db.commit()
            
            duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            logger.info(f"[Clone Finish] Repo ID: {repository.id}, repository path: {final_path}, clone duration: {duration:.2f}s")
            logger.info(f"Successfully processed repository ID: {repository.id}")
            return final_path

        except subprocess.TimeoutExpired as exc:
            duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            logger.error(f"[Clone Failed/Timeout] Repo ID: {repository.id}, repository path: {final_path}, clone duration: {duration:.2f}s")
            self.db.rollback()
            self._mark_failed(repository)
            if final_path.exists():
                self._rmtree(final_path)
            raise HTTPException(status_code=504, detail="Repository clone timed out") from exc
        except HTTPException as exc:
            duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            logger.error(f"[Clone Failed/HTTPException] Repo ID: {repository.id}, repository path: {final_path}, clone duration: {duration:.2f}s")
            self.db.rollback()
            self._mark_failed(repository)
            if final_path.exists():
                self._rmtree(final_path)
            raise
        except Exception as exc:
            duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            logger.error(f"[Clone Failed/Exception] Repo ID: {repository.id}, repository path: {final_path}, clone duration: {duration:.2f}s, error: {exc}", exc_info=True)
            self.db.rollback()
            self._mark_failed(repository)
            if final_path.exists():
                self._rmtree(final_path)
            raise HTTPException(
                status_code=500,
                detail=f"Repository clone failed: {exc}",
            ) from exc

    def delete_local_clone(self, repository: Repository) -> bool:
        if not repository.local_path:
            return True
        path = Path(repository.local_path).resolve()
        try:
            self._assert_storage_path(path)
        except Exception as exc:
            logging.error(f"Unsafe path check failed for repository path {path}: {exc}")
            return False

        return self._rmtree(path)

    def _rmtree(self, path: Path) -> bool:
        if not path.exists():
            return True

        def remove_readonly(func, p, exc_info):
            try:
                os.chmod(p, stat.S_IWRITE)
                func(p)
            except Exception as exc:
                logging.warning(f"Failed to remove read-only status or delete {p}: {exc}")

        try:
            shutil.rmtree(path, onerror=remove_readonly)
            if path.exists():
                logging.error(f"Directory still exists after rmtree: {path}")
                return False
            return True
        except Exception as exc:
            logging.error(f"Failed to delete directory {path}: {exc}")
            return False

    def _assert_storage_path(self, path: Path) -> None:
        if path == self.storage_root or self.storage_root not in path.parents:
            raise RuntimeError("Unsafe repository storage path")

    def _mark_failed(self, repository: Repository) -> None:
        repository.analysis_status = "FAILED"
        self.db.add(repository)
        self.db.commit()

    def _store_scan(self, repository_id: int, scan: StructureScanResult) -> None:
        structure = (
            self.db.query(RepositoryStructure)
            .filter(RepositoryStructure.repository_id == repository_id)
            .first()
        )
        if not structure:
            structure = RepositoryStructure(repository_id=repository_id)
            self.db.add(structure)

        structure.directories = scan.directories
        structure.files = scan.files
        structure.languages = scan.languages
        structure.top_level_directories = scan.top_level_directories
        structure.configuration_files = scan.configuration_files
        structure.config_files = scan.config_files
        structure.dev_config_files = scan.dev_config_files
        structure.app_config_files = scan.app_config_files
        structure.documentation_files = scan.documentation_files
        structure.entry_points = scan.entry_points
        structure.total_files = scan.total_files
        structure.total_directories = scan.total_directories
        structure.repository_statistics = scan.repository_statistics
        structure.frameworks = scan.frameworks
        structure.dependencies = scan.dependencies
        structure.repository_summary = scan.repository_summary
        structure.runtimes = scan.runtimes
        structure.build_tools = scan.build_tools
        structure.project_type = scan.project_type
        structure.scanned_at = datetime.now(timezone.utc)

    @staticmethod
    def _update_metadata(repository: Repository, metadata) -> None:
        repository.repository_name = metadata.repository_name
        repository.owner = metadata.owner
        repository.description = metadata.description
        repository.language = metadata.language
        repository.stars = metadata.stars
        repository.forks = metadata.forks
        repository.github_id = metadata.github_id
        repository.default_branch = metadata.default_branch
        repository.size_kb = metadata.size_kb
        repository.last_metadata_sync = datetime.now(timezone.utc)
