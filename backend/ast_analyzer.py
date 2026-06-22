# c:\Users\VICTUS\helix\backend\ast_analyzer.py

import logging
import os
from pathlib import Path
from sqlalchemy.orm import Session

from models import CodeEntity, Repository, RepositoryStructure
from analyzers.python_analyzer import PythonAnalyzer
from analyzers.java_analyzer import JavaAnalyzer
from analyzers.javascript_analyzer import JavascriptAnalyzer
from analyzers.typescript_analyzer import TypescriptAnalyzer
from analyzers.dart_analyzer import DartAnalyzer
from analyzers.go_analyzer import GoAnalyzer
from analyzers.csharp_analyzer import CsharpAnalyzer
from analyzers.config_analyzer import ConfigAnalyzer

logger = logging.getLogger(__name__)

ANALYZERS = {
    "python": PythonAnalyzer(),
    "java": JavaAnalyzer(),
    "javascript": JavascriptAnalyzer(),
    "typescript": TypescriptAnalyzer(),
    "dart": DartAnalyzer(),
    "go": GoAnalyzer(),
    "csharp": CsharpAnalyzer(),
    "config": ConfigAnalyzer(),
}

def get_language_or_config(file_name: str, suffix: str) -> str | None:
    suffix = suffix.lower()
    fn = file_name.lower()
    if suffix == ".py":
        return "python"
    elif suffix == ".java":
        return "java"
    elif suffix in (".js", ".jsx", ".mjs", ".cjs"):
        return "javascript"
    elif suffix in (".ts", ".tsx"):
        return "typescript"
    elif suffix == ".dart":
        return "dart"
    elif suffix == ".go":
        return "go"
    elif suffix == ".cs":
        return "csharp"
    elif fn in ("dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yaml", "compose.yml") or suffix in (".tf", ".yaml", ".yml"):
        return "config"
    return None

class ASTAnalysisService:
    @staticmethod
    def analyze_repository(db: Session, repository_id: int, local_path_str: str) -> None:
        local_path = Path(local_path_str).resolve()
        if not local_path.exists():
            logger.error(f"Repository local path does not exist for analysis: {local_path}")
            return

        # 1. Clear old entities
        db.query(CodeEntity).filter(CodeEntity.repository_id == repository_id).delete()
        db.commit()

        logger.info(f"[AST Analysis] Starting on repository ID: {repository_id} at {local_path}")

        ignored_dirs = {
            "node_modules", ".git", "dist", "build", "target", "venv",
            "__pycache__", "coverage", "out", ".next"
        }

        # Sets to collect details for merging
        aggregated_frameworks = set()
        aggregated_dependencies = set()
        aggregated_runtimes = set()
        aggregated_build_tools = set()
        aggregated_project_types = set()
        all_calls = []

        # 2. Walk files and analyze
        for root, dirs, files in os.walk(local_path, followlinks=False):
            dirs[:] = [d for d in dirs if d not in ignored_dirs]
            for file_name in files:
                file_path = Path(root) / file_name
                suffix = file_path.suffix.lower()
                language = get_language_or_config(file_name, suffix)
                if not language:
                    continue

                relative_path = file_path.relative_to(local_path).as_posix()
                try:
                    code_bytes = file_path.read_bytes()
                    analyzer = ANALYZERS.get(language)
                    if not analyzer:
                        continue

                    analysis = analyzer.analyze(relative_path, code_bytes, language)
                    
                    # Track runtimes / project types based on language
                    if language == "python":
                        aggregated_runtimes.add("Python")
                    elif language == "java":
                        aggregated_runtimes.add("Java")
                    elif language in ("javascript", "typescript"):
                        aggregated_runtimes.add("Node.js")
                    elif language == "dart":
                        aggregated_runtimes.add("Dart")
                        aggregated_project_types.add("Mobile Application")
                    elif language == "go":
                        aggregated_runtimes.add("Go")
                    elif language == "csharp":
                        aggregated_runtimes.add("C#")

                    # Add frameworks & dependencies
                    for fw in analysis.get("frameworks", []):
                        aggregated_frameworks.add(fw)
                    for dep in analysis.get("dependencies", []):
                        aggregated_dependencies.add(dep)

                    # Save classes / models / controllers / etc.
                    for item in analysis.get("classes", []):
                        entity = CodeEntity(
                            repository_id=repository_id,
                            file_path=relative_path,
                            entity_type=item["type"],
                            entity_name=item["name"],
                            line_number=item["line"],
                        )
                        db.add(entity)

                    # Save functions / methods / handlers / hooks
                    for item in analysis.get("functions", []):
                        entity = CodeEntity(
                            repository_id=repository_id,
                            file_path=relative_path,
                            entity_type=item["type"],
                            entity_name=item["name"],
                            line_number=item["line"],
                        )
                        db.add(entity)

                    # Save imports
                    for item in analysis.get("imports", []):
                        entity = CodeEntity(
                            repository_id=repository_id,
                            file_path=relative_path,
                            entity_type="IMPORT",
                            entity_name=item["name"],
                            line_number=item["line"],
                        )
                        db.add(entity)

                    # Save endpoints
                    for item in analysis.get("endpoints", []):
                        entity = CodeEntity(
                            repository_id=repository_id,
                            file_path=relative_path,
                            entity_type="ENDPOINT",
                            entity_name=f"{item['method']} {item['path']}",
                            line_number=item["line"],
                        )
                        db.add(entity)

                    # Collect calls
                    for item in analysis.get("calls", []):
                        all_calls.append({
                            "file_path": relative_path,
                            "caller": item.get("caller"),
                            "callee": item.get("callee"),
                            "line": item.get("line"),
                            "type": item.get("type", "CALLS")
                        })

                    db.commit()

                except Exception as exc:
                    logger.error(f"Failed to analyze file {relative_path}: {exc}", exc_info=True)
                    db.rollback()

        # 3. Merge aggregated intelligence back to DB tables
        try:
            repo = db.query(Repository).filter(Repository.id == repository_id).first()
            structure = db.query(RepositoryStructure).filter(RepositoryStructure.repository_id == repository_id).first()

            if structure:
                # Merge lists
                existing_fws = set(structure.frameworks or [])
                existing_deps = set(structure.dependencies or [])
                existing_runtimes = set(structure.runtimes or [])
                existing_build_tools = set(structure.build_tools or [])

                # Add new ones
                existing_fws.update(aggregated_frameworks)
                existing_deps.update(aggregated_dependencies)
                existing_runtimes.update(aggregated_runtimes)
                
                # Deduce build tools based on files scanned if not present
                if "Maven" in aggregated_build_tools or any("pom.xml" in d for d in existing_deps):
                    existing_build_tools.add("Maven")
                if "Gradle" in aggregated_build_tools:
                    existing_build_tools.add("Gradle")

                # Update structure
                structure.frameworks = sorted(list(existing_fws))
                structure.dependencies = sorted(list(existing_deps))
                structure.runtimes = sorted(list(existing_runtimes))
                if existing_build_tools:
                    structure.build_tools = sorted(list(existing_build_tools))
                
                if aggregated_project_types:
                    structure.project_type = next(iter(aggregated_project_types))
                elif not structure.project_type and existing_fws:
                    # Deduce project type
                    fw_list = list(existing_fws)
                    if "Spring Boot" in fw_list or "FastAPI" in fw_list or "Express" in fw_list or "Flask" in fw_list or "Django" in fw_list:
                        structure.project_type = "Backend Service"
                    elif "React" in fw_list or "Next.js" in fw_list or "Vue" in fw_list or "Angular" in fw_list:
                        structure.project_type = "Web Application"
                
                # Check for Machine Learning Project
                ml_frameworks = {"PyTorch", "TensorFlow", "Scikit-learn", "LangChain", "LlamaIndex", "YOLO"}
                if existing_fws.intersection(ml_frameworks):
                    structure.project_type = "Machine Learning Project"

                # Update repository summary
                summary = dict(structure.repository_summary or {})
                summary["frameworks"] = structure.frameworks
                summary["dependencies"] = structure.dependencies
                summary["runtimes"] = structure.runtimes
                summary["build_tools"] = structure.build_tools
                if structure.project_type:
                    summary["repository_type"] = structure.project_type
                structure.repository_summary = summary

                db.add(structure)

            if repo and repo.framework in (None, "Unknown", "None"):
                # Assign the first detected framework as primary
                if aggregated_frameworks:
                    repo.framework = next(iter(sorted(aggregated_frameworks)))
                    repo.framework_confidence = 1.0
                    db.add(repo)

            db.commit()
            logger.info(f"[AST Analysis] Successfully merged structural updates for repo {repository_id}")
        except Exception as merge_exc:
            logger.error(f"Failed to merge AST analysis updates into repository/structure: {merge_exc}", exc_info=True)
            db.rollback()

        # 4. Generate Knowledge Graph
        try:
            from graph_service import KnowledgeGraphService
            KnowledgeGraphService.generate_graph(db, repository_id, all_calls)
        except Exception as graph_exc:
            logger.error(f"Failed to generate knowledge graph for repo {repository_id}: {graph_exc}", exc_info=True)

        # 5. Generate Architecture Intelligence
        try:
            from architecture_service import ArchitectureService
            ArchitectureService.generate_architecture(db, repository_id)
        except Exception as arch_exc:
            logger.error(f"Failed to generate architecture intelligence for repo {repository_id}: {arch_exc}", exc_info=True)

        logger.info(f"[AST Analysis] Finished on repository ID: {repository_id}")

