# c:\Users\VICTUS\helix\backend\graph_service.py

import os
import re
import logging
from pathlib import Path
from sqlalchemy.orm import Session

from models import CodeEntity, KnowledgeNode, KnowledgeEdge, Repository, RepositoryStructure

logger = logging.getLogger(__name__)

class KnowledgeGraphService:
    @staticmethod
    def generate_graph(db: Session, repository_id: int) -> None:
        logger.info(f"[Graph Generation] Starting for repository ID: {repository_id}")
        
        # 1. Clear old graph elements
        db.query(KnowledgeEdge).filter(KnowledgeEdge.repository_id == repository_id).delete()
        db.query(KnowledgeNode).filter(KnowledgeNode.repository_id == repository_id).delete()
        db.commit()

        # 2. Fetch all code entities
        entities = db.query(CodeEntity).filter(CodeEntity.repository_id == repository_id).all()
        repo = db.query(Repository).filter(Repository.id == repository_id).first()
        structure = db.query(RepositoryStructure).filter(RepositoryStructure.repository_id == repository_id).first()
        
        if not repo or not repo.local_path:
            logger.error(f"[Graph Generation] Repository local path not found for repo {repository_id}")
            return

        local_path = Path(repo.local_path)
        if not local_path.exists():
            logger.error(f"[Graph Generation] Local clone directory does not exist: {local_path}")
            return

        # 3. Create Nodes
        node_by_entity_id = {}
        node_by_name = {}
        file_entities = {} # file_path -> list of entities

        # Exclude IMPORTS from direct class/function nodes to avoid node cluttering (we resolve them as relationships)
        ast_entities = [e for e in entities if e.entity_type != "IMPORT"]

        # Track frameworks for database nodes
        frameworks_set = set(structure.frameworks or []) if structure else set()
        
        # Map database framework/ecosystem keywords to DB nodes
        db_keywords = {
            "PostgreSQL": "PostgreSQL",
            "MySQL": "MySQL",
            "MongoDB": "MongoDB",
            "Redis": "Redis",
            "SQLite": "SQLite",
            "Firestore": "Firestore",
            "DynamoDB": "DynamoDB",
            "Neo4j": "Neo4j"
        }
        detected_dbs = []
        for kw, db_name in db_keywords.items():
            if kw in frameworks_set:
                detected_dbs.append(db_name)

        # Insert entity nodes
        for entity in ast_entities:
            # Map type to standardized NODE TYPES
            ntype = entity.entity_type
            if ntype == "SCREEN":
                ntype = "WIDGET"
            elif ntype in ("HANDLER", "EXPORT"):
                ntype = "FUNCTION"
            
            node = KnowledgeNode(
                repository_id=repository_id,
                entity_id=entity.id,
                node_type=ntype,
                node_name=entity.entity_name
            )
            db.add(node)
            db.flush() # Populate ID

            node_by_entity_id[entity.id] = node
            node_by_name[entity.entity_name] = node
            file_entities.setdefault(entity.file_path, []).append((entity, node))

        # Insert Database nodes if detected
        db_nodes = []
        for db_name in detected_dbs:
            db_node = KnowledgeNode(
                repository_id=repository_id,
                entity_id=None,
                node_type="DATABASE",
                node_name=db_name
            )
            db.add(db_node)
            db.flush()
            db_nodes.append(db_node)

        db.commit()

        # 4. Resolve Relationships (Edges)
        edges = []

        # Read source files on disk to build high-fidelity calls/dependencies
        for file_path, items in file_entities.items():
            full_file_path = local_path / file_path
            if not full_file_path.exists():
                continue

            try:
                code_lines = full_file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
            except Exception:
                continue

            # Sort items by line number to establish ranges
            sorted_items = sorted(items, key=lambda x: x[0].line_number)
            
            # Helper to find where class/function block ends
            for i, (entity, node) in enumerate(sorted_items):
                start_line = entity.line_number
                end_line = sorted_items[i+1][0].line_number - 1 if i + 1 < len(sorted_items) else len(code_lines)
                
                # Fetch target code range for analysis
                block_lines = code_lines[start_line-1:end_line]
                block_text = "\n".join(block_lines)

                # Check references to other node names in the same repository
                for target_name, target_node in node_by_name.items():
                    if target_node.id == node.id:
                        continue
                    
                    # Word boundary match to ensure accuracy
                    if re.search(r'\b' + re.escape(target_name) + r'\b', block_text):
                        # Determine relationship type
                        rel = "USES"
                        
                        if node.node_type in ("CLASS", "WIDGET", "COMPONENT") and target_node.node_type in ("CLASS", "WIDGET", "COMPONENT"):
                            rel = "USES"
                        elif target_node.node_type in ("FUNCTION", "METHOD"):
                            rel = "CALLS"
                        elif node.node_type in ("SERVICE", "CONTROLLER") and target_node.node_type == "REPOSITORY":
                            rel = "USES"
                        elif node.node_type == "CONTROLLER" and target_node.node_type == "SERVICE":
                            rel = "USES"
                        
                        # Avoid duplicates
                        edge_exists = any(e.source_node_id == node.id and e.target_node_id == target_node.id and e.relationship_type == rel for e in edges)
                        if not edge_exists:
                            edge = KnowledgeEdge(
                                repository_id=repository_id,
                                source_node_id=node.id,
                                target_node_id=target_node.id,
                                relationship_type=rel
                            )
                            edges.append(edge)

                # Check database relationships
                for db_node in db_nodes:
                    db_keywords_regex = r'\b(db|postgres|sql|mongo|redis|query|gorm|hibernate|jpa|model)\b'
                    if re.search(db_keywords_regex, block_text.lower()):
                        if node.node_type in ("REPOSITORY", "SERVICE", "MODEL"):
                            edge = KnowledgeEdge(
                                repository_id=repository_id,
                                source_node_id=node.id,
                                target_node_id=db_node.id,
                                relationship_type="DEPENDS_ON"
                            )
                            edges.append(edge)

                # Check extends / inheritance in the declaration header line
                header_line = code_lines[start_line-1] if start_line-1 < len(code_lines) else ""
                extends_match = re.search(r'\b(extends|implements|with|\:)\s+([\w\s,<>\?]+)', header_line)
                if extends_match:
                    parent_names = extends_clause = extends_match.group(2)
                    for target_name, target_node in node_by_name.items():
                        if target_name in parent_names:
                            rel_type = "IMPLEMENTS" if "implements" in extends_match.group(1) else "EXTENDS"
                            edge = KnowledgeEdge(
                                repository_id=repository_id,
                                source_node_id=node.id,
                                target_node_id=target_node.id,
                                relationship_type=rel_type
                            )
                            edges.append(edge)

            # Expose endpoints / routes contains
            controllers = [item for item in items if item[0].entity_type == "CONTROLLER"]
            endpoints = [item for item in items if item[0].entity_type == "ENDPOINT"]
            classes = [item for item in items if item[0].entity_type in ("CLASS", "SERVICE", "REPOSITORY", "MODEL")]
            methods = [item for item in items if item[0].entity_type == "METHOD"]

            # Route exposes controller endpoints
            for c_ent, c_node in controllers:
                for ep_ent, ep_node in endpoints:
                    edge = KnowledgeEdge(
                        repository_id=repository_id,
                        source_node_id=c_node.id,
                        target_node_id=ep_node.id,
                        relationship_type="EXPOSES_ENDPOINT"
                    )
                    edges.append(edge)

            # File contains classes / functions
            for cl_ent, cl_node in classes:
                for m_ent, m_node in methods:
                    # If method is structurally in the class range
                    # Check list range
                    if cl_ent.line_number < m_ent.line_number:
                        # Find next class line
                        next_cl = [x for x in classes if x[0].line_number > cl_ent.line_number]
                        if not next_cl or m_ent.line_number < next_cl[0][0].line_number:
                            edge = KnowledgeEdge(
                                repository_id=repository_id,
                                source_node_id=cl_node.id,
                                target_node_id=m_node.id,
                                relationship_type="CONTAINS"
                            )
                            edges.append(edge)

        # Batch write edges to DB
        for edge in edges:
            db.add(edge)
        db.commit()

        # 5. Architecture Inference
        inferred_arch = "Standard Directory Layout"
        node_types = [n.node_type for n in db.query(KnowledgeNode).filter(KnowledgeNode.repository_id == repository_id).all()]
        
        has_controller = "CONTROLLER" in node_types
        has_service = "SERVICE" in node_types
        has_repository = "REPOSITORY" in node_types
        has_widget = "WIDGET" in node_types
        
        # Check files/folder paths for Clean Architecture keywords
        folder_names = [d.lower() for d in (structure.directories or [])]
        has_clean_kw = any(kw in folder_names for kw in ["domain", "usecase", "adapters", "clean_arch", "core"])
        
        # Check files for microservices (multiple dockerfiles or multiple projects/services config)
        config_files = structure.config_files or []
        docker_compose_files = [f for f in config_files if "docker-compose" in f.lower() or "compose.yaml" in f.lower()]
        
        if docker_compose_files or len([f for f in config_files if "dockerfile" in f.lower()]) > 1:
            inferred_arch = "Microservice Architecture"
        elif has_clean_kw:
            inferred_arch = "Clean Architecture"
        elif has_controller and has_service and has_repository:
            inferred_arch = "Layered Architecture (Controller-Service-Repository)"
        elif has_controller and "MODEL" in node_types:
            inferred_arch = "MVC (Model-View-Controller)"
        elif has_widget and "PROVIDER" in node_types:
            inferred_arch = "MVVM / State-Driven Architecture"
        elif repo.language == "Python" and "Streamlit" in frameworks_set:
            inferred_arch = "Single-Page Interactive Dashboard"

        # Save architecture hint
        if structure:
            summary = dict(structure.repository_summary or {})
            summary["architecture_hint"] = inferred_arch
            structure.repository_summary = summary
            db.add(structure)
            db.commit()

        logger.info(f"[Graph Generation] Successfully generated knowledge graph for repo {repository_id}. Architecture hint: {inferred_arch}")
