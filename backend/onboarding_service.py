# c:\Users\VICTUS\helix\backend\onboarding_service.py

import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models import (
    Repository, RepositoryStructure, CodeEntity, KnowledgeNode, 
    KnowledgeEdge, RepositoryArchitecture, ExecutionFlow, OnboardingDocument
)

logger = logging.getLogger(__name__)

class OnboardingService:
    @staticmethod
    def get_or_generate_onboarding(db: Session, repository_id: int) -> dict:
        """
        Fetches the onboarding documents for a repository. 
        If none exist, automatically triggers generation.
        """
        levels = ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"]
        documents = {}
        
        for lvl in levels:
            doc = db.query(OnboardingDocument).filter(
                OnboardingDocument.repository_id == repository_id,
                OnboardingDocument.document_type == lvl
            ).order_by(OnboardingDocument.version.desc()).first()
            
            if not doc:
                # Trigger full generation if any level is missing
                return OnboardingService.generate_onboarding(db, repository_id)
            
            documents[lvl] = {
                "document_type": doc.document_type,
                "generated_content": doc.generated_content,
                "generated_at": doc.generated_at.isoformat() if doc.generated_at else None,
                "version": doc.version
            }
            
        return documents

    @staticmethod
    def generate_onboarding(db: Session, repository_id: int) -> dict:
        """
        Generates onboarding documents for a repository by analyzing:
        AST, Knowledge Graph, Architecture Intelligence, and Execution Flows.
        """
        logger.info(f"[Onboarding Platform] Generating onboarding docs for repo: {repository_id}")

        # 1. Fetch Repository and related intelligence objects
        repo = db.query(Repository).filter(Repository.id == repository_id).first()
        if not repo:
            raise ValueError(f"Repository with ID {repository_id} not found")

        structure = db.query(RepositoryStructure).filter(RepositoryStructure.repository_id == repository_id).first()
        entities = db.query(CodeEntity).filter(CodeEntity.repository_id == repository_id).all()
        nodes = db.query(KnowledgeNode).filter(KnowledgeNode.repository_id == repository_id).all()
        edges = db.query(KnowledgeEdge).filter(KnowledgeEdge.repository_id == repository_id).all()
        architecture = db.query(RepositoryArchitecture).filter(RepositoryArchitecture.repository_id == repository_id).first()
        flows = db.query(ExecutionFlow).filter(ExecutionFlow.repository_id == repository_id).all()

        # Prepare summary parameters
        project_type = repo.framework or repo.language or "General"
        if structure and structure.project_type:
            project_type = structure.project_type
        
        languages = structure.languages if structure else []
        frameworks = structure.frameworks if structure else []
        dependencies = structure.dependencies if structure else []
        entry_points = structure.entry_points if structure else []
        
        # Analyze entity counts
        controllers = [e for e in entities if e.entity_type == "CONTROLLER"]
        services = [e for e in entities if e.entity_type == "SERVICE"]
        repositories = [e for e in entities if e.entity_type == "REPOSITORY"]
        models = [e for e in entities if e.entity_type in ("MODEL", "ENTITY")]
        widgets = [e for e in entities if e.entity_type in ("WIDGET", "SCREEN", "COMPONENT")]

        # Determine architecture style
        arch_style = "Standard Directory Structure"
        if structure and structure.repository_summary:
            arch_style = structure.repository_summary.get("architecture_hint", arch_style)

        # ----------------------------------------------------
        # LEVEL 1: Executive Summary
        # ----------------------------------------------------
        level_1_content = {
            "title": "Level 1: Executive Summary",
            "sections": [
                {
                    "heading": "Project Purpose",
                    "content": f"This codebase is a **{project_type}** built primarily using **{repo.language or 'unknown'}**. "
                               f"It is designed as a {repo.description or 'general codebase package without description'}.\n\n"
                               f"It features {len(entities)} code entities, {len(nodes)} knowledge nodes, and {len(edges)} code relationships."
                },
                {
                    "heading": "Project Type & Ecosystem",
                    "content": f"- **Primary Language**: {repo.language or 'Unknown'}\n"
                               f"- **Project Frame/Structure**: {project_type}\n"
                               f"- **Frameworks/Technologies**: {', '.join(frameworks) if frameworks else 'None detected'}\n"
                               f"- **Build System**: {', '.join(structure.build_tools) if (structure and structure.build_tools) else 'None'}"
                },
                {
                    "heading": "Architecture Model",
                    "content": f"The project follows a **{arch_style}**.\n\n"
                               f"This layout segregates system components logically to provide structure and modularity."
                },
                {
                    "heading": "Core System Components",
                    "content": f"Key structures identified in the syntax trees:\n\n"
                               f"- **Controllers / Gateways**: {len(controllers)} controllers parsing incoming requests.\n"
                               f"- **Services / Business Logic**: {len(services)} services isolating core execution routines.\n"
                               f"- **Database / Repositories**: {len(repositories)} repository interfaces connecting to storage.\n"
                               f"- **Data Models / Entities**: {len(models)} domain objects representing schemas.\n"
                               f"- **Frontend Components**: {len(widgets)} interactive widgets/views."
                }
            ]
        }

        # ----------------------------------------------------
        # LEVEL 2: Developer Overview
        # ----------------------------------------------------
        # Determine authentication patterns
        auth_detected = "No dedicated authentication flow was discovered."
        auth_flows = [f for f in flows if f.flow_type == "AUTHENTICATION"]
        if auth_flows:
            auth_detected = f"Found **{len(auth_flows)} authentication flows**. Key entry point: `{auth_flows[0].entry_point}`."
        elif any("auth" in d.lower() or "jwt" in d.lower() for d in dependencies):
            auth_detected = "Authentication detected via package dependencies (e.g. JWT/OAuth library)."

        # Determine database layer details
        db_detected = "No active database libraries or nodes identified."
        db_nodes = [n for n in nodes if n.node_type == "DATABASE"]
        if db_nodes:
            db_detected = f"Database layer is backed by **{', '.join([d.node_name for d in db_nodes])}**."
        elif repositories:
            db_detected = f"Database connections are managed via **{len(repositories)} Repositories / DAOs**."

        # External services
        ext_services_list = []
        for f in flows:
            ext_services_list.extend(f.external_services)
        ext_services_list = list(set(ext_services_list))
        ext_detected = f"External services identified: {', '.join(ext_services_list)}." if ext_services_list else "No third-party SDK calls or external endpoints identified."

        # Directory structure summary
        dirs_summary = "Root Directory contains standard code components."
        if structure and structure.top_level_directories:
            dirs_summary = "Key root directories:\n\n" + "\n".join([f"- `/{d}`" for d in structure.top_level_directories])

        level_2_content = {
            "title": "Level 2: Developer Overview",
            "sections": [
                {
                    "heading": "Directory Layout",
                    "content": dirs_summary
                },
                {
                    "heading": "Authentication & Security",
                    "content": auth_detected
                },
                {
                    "heading": "Database Layer",
                    "content": db_detected
                },
                {
                    "heading": "External APIs & Services",
                    "content": ext_detected
                },
                {
                    "heading": "Execution Flows Summary",
                    "content": f"Helix discovered **{len(flows)} behavioral execution paths** across the repository.\n\n"
                               f"These cover workflows ranging from request processing to integrations. Use the **Execution Flows** section for step-by-step details."
                },
                {
                    "heading": "Key files to inspect first",
                    "content": "\n".join([f"- `{ep}`" for ep in entry_points[:5]]) if entry_points else "Inspect main controllers or boot files."
                }
            ]
        }

        # ----------------------------------------------------
        # LEVEL 3: Deep Technical Guide
        # ----------------------------------------------------
        arch_details = "Standard modular structure."
        if architecture:
            components_list = [f"{c['name']} ({c['type']})" for c in architecture.components]
            arch_details = f"**System Components**: {', '.join(components_list) if components_list else 'None'}\n\n" \
                           f"**Separation of Concerns Score**: {architecture.architecture_summary.get('health_signals', {}).get('separation_of_concerns_score', 'N/A')}/100\n" \
                           f"**Coupling Ratio**: {architecture.architecture_summary.get('health_signals', {}).get('coupling_score', 'N/A')}%\n" \
                           f"**God Classes**: {len(architecture.architecture_summary.get('health_signals', {}).get('god_classes', []))} detected."

        relation_types = {}
        for edge in edges:
            relation_types[edge.relationship_type] = relation_types.get(edge.relationship_type, 0) + 1
        relations_str = "\n".join([f"- **{k}**: {v} edges" for k, v in relation_types.items()])

        level_3_content = {
            "title": "Level 3: Deep Technical Guide",
            "sections": [
                {
                    "heading": "Architecture Intelligence",
                    "content": arch_details
                },
                {
                    "heading": "Knowledge Graph Metrics",
                    "content": f"The knowledge graph consists of **{len(nodes)} nodes** and **{len(edges)} relations**.\n\n{relations_str or 'No relationships stored.'}"
                },
                {
                    "heading": "Call Graph Details",
                    "content": f"Cross-file function call links: **{len([e for e in edges if e.relationship_type == 'CALLS'])} relationships**."
                },
                {
                    "heading": "Dependencies & Packages",
                    "content": f"Loaded packages from build configs ({len(dependencies)} total):\n\n" +
                               "\n".join([f"- `{dep}`" for dep in dependencies[:15]]) +
                               (f"\n- *And {len(dependencies) - 15} more...*" if len(dependencies) > 15 else "")
                }
            ]
        }

        # ----------------------------------------------------
        # LEVEL 4: First Contribution Guide
        # ----------------------------------------------------
        starting_files = []
        if entry_points:
            starting_files.extend(entry_points[:3])
        if controllers:
            starting_files.extend([c.file_path for c in controllers[:2]])
        starting_files = list(set(starting_files))

        beginner_friendly = "Adding a new endpoint routing, controller utility test, or enhancing documentation are great ways to start."
        if not controllers and widgets:
            beginner_friendly = "Try adding a simple widget or modifying component styling."

        high_risk_areas = "Highly coupled classes or services that carry high incoming call degrees."
        if architecture:
            god_list = [gc["class_name"] for gc in architecture.architecture_summary.get('health_signals', {}).get('god_classes', [])]
            if god_list:
                high_risk_areas = f"The following **God Classes** have high complexity and should be modified with care: {', '.join(god_list)}."

        level_4_content = {
            "title": "Level 4: First Contribution Guide",
            "sections": [
                {
                    "heading": "Recommended Starting Files",
                    "content": "\n".join([f"- `{f}`" for f in starting_files]) if starting_files else "Look for main entry points or controllers."
                },
                {
                    "heading": "Suggested Reading Order",
                    "content": "1. Review entry points to see application bootstrap.\n"
                               "2. Study controllers to understand API routes or widget trees.\n"
                               "3. Drill down into services for business workflow logic.\n"
                               "4. Examine repository classes for schema interactions."
                },
                {
                    "heading": "High-Risk Areas (Careful!)",
                    "content": high_risk_areas
                },
                {
                    "heading": "Beginner-Friendly Tasks",
                    "content": beginner_friendly
                }
            ]
        }

        # 2. Store generated onboarding documents (version management)
        onboarding_docs = {
            "LEVEL_1": level_1_content,
            "LEVEL_2": level_2_content,
            "LEVEL_3": level_3_content,
            "LEVEL_4": level_4_content
        }

        result = {}
        for lvl, content in onboarding_docs.items():
            # Get latest version number
            latest = db.query(OnboardingDocument).filter(
                OnboardingDocument.repository_id == repository_id,
                OnboardingDocument.document_type == lvl
            ).order_by(OnboardingDocument.version.desc()).first()
            
            next_ver = (latest.version + 1) if latest else 1

            new_doc = OnboardingDocument(
                repository_id=repository_id,
                document_type=lvl,
                generated_content=content,
                version=next_ver,
                generated_at=datetime.now(timezone.utc)
            )
            db.add(new_doc)
            db.flush()

            result[lvl] = {
                "document_type": lvl,
                "generated_content": content,
                "generated_at": new_doc.generated_at.isoformat(),
                "version": next_ver
            }

        db.commit()
        logger.info(f"[Onboarding Platform] Successfully generated 4 onboarding levels for repo {repository_id}")
        return result
