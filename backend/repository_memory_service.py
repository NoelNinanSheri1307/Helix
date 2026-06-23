# c:\Users\VICTUS\helix\backend\repository_memory_service.py

import logging
import numpy as np
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models import (
    Repository, RepositoryStructure, CodeEntity, KnowledgeNode,
    KnowledgeEdge, RepositoryArchitecture, ExecutionFlow, FlowStep,
    OnboardingDocument, RepositoryMemory, RepositoryEmbedding
)

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────────────
# Embedding Model Singleton
# ────────────────────────────────────────────────────────────────────────────────

_model = None

def _get_embedding_model():
    """Lazy-load the sentence-transformer model once."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("[Memory Layer] Loading embedding model: BAAI/bge-small-en-v1.5 ...")
        _model = SentenceTransformer("BAAI/bge-small-en-v1.5")
        logger.info("[Memory Layer] Embedding model loaded successfully.")
    return _model


def _embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts and return list of float vectors."""
    model = _get_embedding_model()
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return [vec.tolist() for vec in embeddings]


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(dot / norm)


# ────────────────────────────────────────────────────────────────────────────────
# Repository Memory Service
# ────────────────────────────────────────────────────────────────────────────────

class RepositoryMemoryService:

    # ── Snapshot Generation ───────────────────────────────────────────────────

    @staticmethod
    def generate_snapshot(db: Session, repository_id: int) -> dict:
        """
        Generate a consolidated knowledge snapshot from all existing
        repository intelligence systems.  No new analysis is performed.
        """
        logger.info(f"[Memory Layer] Generating knowledge snapshot for repo {repository_id}")

        repo = db.query(Repository).filter(Repository.id == repository_id).first()
        if not repo:
            raise ValueError(f"Repository {repository_id} not found")

        structure = db.query(RepositoryStructure).filter(
            RepositoryStructure.repository_id == repository_id
        ).first()

        entities = db.query(CodeEntity).filter(
            CodeEntity.repository_id == repository_id
        ).all()

        nodes = db.query(KnowledgeNode).filter(
            KnowledgeNode.repository_id == repository_id
        ).all()

        edges = db.query(KnowledgeEdge).filter(
            KnowledgeEdge.repository_id == repository_id
        ).all()

        architecture = db.query(RepositoryArchitecture).filter(
            RepositoryArchitecture.repository_id == repository_id
        ).first()

        flows = db.query(ExecutionFlow).filter(
            ExecutionFlow.repository_id == repository_id
        ).all()
        for flow in flows:
            flow.steps = db.query(FlowStep).filter(
                FlowStep.flow_id == flow.id
            ).order_by(FlowStep.step_number).all()

        onboarding_docs = {}
        for lvl in ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"]:
            doc = db.query(OnboardingDocument).filter(
                OnboardingDocument.repository_id == repository_id,
                OnboardingDocument.document_type == lvl
            ).order_by(OnboardingDocument.version.desc()).first()
            if doc:
                onboarding_docs[lvl] = doc.generated_content

        # ── Entity Categorization ──
        entity_groups = {}
        for e in entities:
            entity_groups.setdefault(e.entity_type, []).append({
                "name": e.entity_name,
                "file": e.file_path,
                "line": e.line_number
            })

        controllers = entity_groups.get("CONTROLLER", [])
        services = entity_groups.get("SERVICE", [])
        models_list = entity_groups.get("MODEL", []) + entity_groups.get("ENTITY", [])
        repositories_list = entity_groups.get("REPOSITORY", [])
        widgets = entity_groups.get("WIDGET", []) + entity_groups.get("SCREEN", []) + entity_groups.get("COMPONENT", [])

        # ── Node Categorization ──
        node_type_counts = {}
        for n in nodes:
            node_type_counts[n.node_type] = node_type_counts.get(n.node_type, 0) + 1

        # ── Edge Categorization ──
        edge_type_counts = {}
        for e in edges:
            edge_type_counts[e.relationship_type] = edge_type_counts.get(e.relationship_type, 0) + 1

        # ── Architecture Summary ──
        arch_snapshot = {}
        if architecture:
            arch_snapshot = {
                "architecture_type": architecture.architecture_type,
                "project_type": architecture.project_type,
                "deployment_model": architecture.deployment_model,
                "components": [
                    {"name": c["name"], "type": c["type"], "description": c.get("description", ""), "technologies": c.get("technologies", [])}
                    for c in architecture.components
                ],
                "summary": architecture.architecture_summary,
                "detected_flows": architecture.detected_flows,
            }

            # Extract health signals
            health = architecture.architecture_summary.get("health_signals", {})
            if health:
                arch_snapshot["health_signals"] = health

        # ── Execution Flow Summaries ──
        flow_summaries = []
        for flow in flows:
            flow_summaries.append({
                "flow_name": flow.flow_name,
                "flow_type": flow.flow_type,
                "entry_point": flow.entry_point,
                "components_used": flow.components_used,
                "database_interactions": flow.database_interactions,
                "external_services": flow.external_services,
                "confidence_score": flow.confidence_score,
                "steps": [
                    {"step_name": s.step_name, "description": s.description, "file_path": s.file_path}
                    for s in flow.steps
                ]
            })

        # ── Structure Summary ──
        structure_snapshot = {}
        if structure:
            structure_snapshot = {
                "languages": structure.languages or [],
                "frameworks": structure.frameworks or [],
                "dependencies": structure.dependencies or [],
                "entry_points": structure.entry_points or [],
                "top_level_directories": structure.top_level_directories or [],
                "total_files": structure.total_files,
                "total_directories": structure.total_directories,
                "runtimes": structure.runtimes or [],
                "build_tools": structure.build_tools or [],
                "project_type": structure.project_type,
                "repository_summary": structure.repository_summary or {},
            }

        # ── Detect Special Components ──
        all_deps = (structure.dependencies if structure else []) or []
        all_components = [c["name"] for c in (architecture.components if architecture else [])]
        all_techs = []
        if architecture:
            for comp in architecture.components:
                all_techs.extend(comp.get("technologies", []))

        dep_lower = [d.lower() for d in all_deps]
        tech_lower = [t.lower() for t in all_techs]
        combined_lower = dep_lower + tech_lower

        database_usage = [d for d in all_deps if any(kw in d.lower() for kw in
            ["sql", "postgres", "mysql", "mongo", "redis", "sqlite", "typeorm", "prisma", "sequelize", "hibernate", "sqlalchemy", "knex", "drizzle"])]

        auth_mechanisms = [d for d in all_deps if any(kw in d.lower() for kw in
            ["auth", "jwt", "passport", "oauth", "bcrypt", "session", "cookie", "token", "firebase-auth"])]

        external_integrations = []
        for flow in flows:
            external_integrations.extend(flow.external_services)
        external_integrations = list(set(external_integrations))

        infra_keywords = ["docker", "kubernetes", "nginx", "terraform", "ansible", "helm", "vagrant"]
        infrastructure = [d for d in all_deps + all_techs if any(kw in d.lower() for kw in infra_keywords)]

        cloud_keywords = ["aws", "gcp", "azure", "s3", "lambda", "firebase", "heroku", "vercel", "netlify", "cloudflare"]
        cloud_components = [d for d in all_deps + all_techs if any(kw in d.lower() for kw in cloud_keywords)]

        container_keywords = ["docker", "podman", "containerd", "buildah"]
        containerization = [d for d in all_deps + all_techs if any(kw in d.lower() for kw in container_keywords)]

        ml_keywords = ["tensorflow", "pytorch", "sklearn", "scikit", "keras", "transformers", "huggingface", "ml", "model", "prediction", "training"]
        ml_components = [d for d in all_deps + all_techs if any(kw in d.lower() for kw in ml_keywords)]

        # ── Assemble Snapshot ──
        snapshot = {
            "repository_metadata": {
                "name": repo.repository_name,
                "url": repo.github_url,
                "owner": repo.owner,
                "description": repo.description,
                "language": repo.language,
                "stars": repo.stars,
                "forks": repo.forks,
                "size_kb": repo.size_kb,
                "default_branch": repo.default_branch,
                "framework": repo.framework,
                "framework_confidence": repo.framework_confidence,
            },
            "repository_summary": structure_snapshot.get("repository_summary", {}),
            "technology_stack": {
                "languages": structure_snapshot.get("languages", []),
                "frameworks": structure_snapshot.get("frameworks", []),
                "runtimes": structure_snapshot.get("runtimes", []),
                "build_tools": structure_snapshot.get("build_tools", []),
            },
            "dependencies": all_deps,
            "directory_structure": {
                "top_level_directories": structure_snapshot.get("top_level_directories", []),
                "total_files": structure_snapshot.get("total_files", 0),
                "total_directories": structure_snapshot.get("total_directories", 0),
                "entry_points": structure_snapshot.get("entry_points", []),
            },
            "architecture": arch_snapshot,
            "execution_flows": flow_summaries,
            "knowledge_graph_summary": {
                "total_nodes": len(nodes),
                "total_edges": len(edges),
                "node_type_distribution": node_type_counts,
                "edge_type_distribution": edge_type_counts,
            },
            "onboarding_summaries": onboarding_docs,
            "important_components": {
                "controllers": controllers[:20],
                "services": services[:20],
                "models": models_list[:20],
                "repositories": repositories_list[:20],
                "widgets": widgets[:20],
            },
            "important_files": {
                "entry_points": structure_snapshot.get("entry_points", []),
            },
            "database_usage": database_usage,
            "authentication_mechanisms": auth_mechanisms,
            "external_integrations": external_integrations,
            "infrastructure_components": infrastructure,
            "cloud_components": cloud_components,
            "containerization_components": containerization,
            "ml_components": ml_components,
            "health_signals": arch_snapshot.get("health_signals", {}),
        }

        # ── Persist Snapshot ──
        existing = db.query(RepositoryMemory).filter(
            RepositoryMemory.repository_id == repository_id
        ).first()

        if existing:
            existing.snapshot_content = snapshot
            existing.snapshot_version = existing.snapshot_version + 1
            existing.updated_at = datetime.now(timezone.utc)
        else:
            existing = RepositoryMemory(
                repository_id=repository_id,
                snapshot_content=snapshot,
                snapshot_version=1,
            )
            db.add(existing)

        db.flush()

        # ── Generate Embeddings ──
        RepositoryMemoryService._generate_embeddings(db, repository_id, snapshot)

        db.commit()

        logger.info(f"[Memory Layer] Snapshot v{existing.snapshot_version} generated for repo {repository_id}")

        return {
            "repository_id": repository_id,
            "snapshot_content": snapshot,
            "snapshot_version": existing.snapshot_version,
            "created_at": existing.created_at.isoformat() if existing.created_at else None,
            "updated_at": existing.updated_at.isoformat() if existing.updated_at else datetime.now(timezone.utc).isoformat(),
            "embedding_count": db.query(RepositoryEmbedding).filter(
                RepositoryEmbedding.repository_id == repository_id
            ).count(),
        }

    # ── Embedding Generation ──────────────────────────────────────────────────

    @staticmethod
    def _generate_embeddings(db: Session, repository_id: int, snapshot: dict):
        """Chunk the snapshot into semantic sections and generate embeddings."""
        logger.info(f"[Memory Layer] Generating embeddings for repo {repository_id}")

        # Clear old embeddings
        db.query(RepositoryEmbedding).filter(
            RepositoryEmbedding.repository_id == repository_id
        ).delete()
        db.flush()

        # Build text chunks to embed
        chunks: list[tuple[str, str, str]] = []  # (section_type, section_key, text)

        # 1. Repository Overview
        meta = snapshot.get("repository_metadata", {})
        overview_text = (
            f"Repository: {meta.get('name', 'Unknown')}. "
            f"Description: {meta.get('description', 'No description')}. "
            f"Language: {meta.get('language', 'Unknown')}. "
            f"Framework: {meta.get('framework', 'None')}."
        )
        chunks.append(("OVERVIEW", "repository_overview", overview_text))

        # 2. Technology Stack
        tech = snapshot.get("technology_stack", {})
        tech_text = (
            f"Languages: {', '.join(tech.get('languages', []))}. "
            f"Frameworks: {', '.join(tech.get('frameworks', []))}. "
            f"Runtimes: {', '.join(tech.get('runtimes', []))}. "
            f"Build tools: {', '.join(tech.get('build_tools', []))}."
        )
        chunks.append(("TECHNOLOGY", "technology_stack", tech_text))

        # 3. Dependencies
        deps = snapshot.get("dependencies", [])
        if deps:
            deps_text = f"Project dependencies: {', '.join(deps[:50])}."
            chunks.append(("DEPENDENCIES", "all_dependencies", deps_text))

        # 4. Architecture Summary
        arch = snapshot.get("architecture", {})
        if arch:
            arch_text = (
                f"Architecture type: {arch.get('architecture_type', 'Unknown')}. "
                f"Project type: {arch.get('project_type', 'Unknown')}. "
                f"Deployment: {arch.get('deployment_model', 'Not detected')}."
            )
            summary = arch.get("summary", {})
            if summary:
                arch_text += f" Pattern: {summary.get('architecture_pattern', '')}."
                arch_text += f" Primary technologies: {', '.join(summary.get('primary_technologies', []))}."
                arch_text += f" Core components: {', '.join(summary.get('core_components', []))}."
                arch_text += f" Database layer: {summary.get('database_layer', 'None')}."
                arch_text += f" Authentication: {summary.get('authentication_layer', 'None')}."
            chunks.append(("ARCHITECTURE", "architecture_summary", arch_text))

            # Architecture evidence
            evidence = summary.get("evidence", [])
            if evidence:
                chunks.append(("ARCHITECTURE", "architecture_evidence", f"Architecture evidence: {'. '.join(evidence)}"))

            # Each component
            for comp in arch.get("components", []):
                comp_text = (
                    f"Component: {comp.get('name', '')}. "
                    f"Type: {comp.get('type', '')}. "
                    f"Description: {comp.get('description', '')}. "
                    f"Technologies: {', '.join(comp.get('technologies', []))}."
                )
                chunks.append(("COMPONENT", f"component_{comp.get('name', 'unknown')}", comp_text))

        # 5. Execution Flows
        for flow in snapshot.get("execution_flows", []):
            steps_text = ". ".join(
                [f"Step {i+1}: {s.get('step_name', '')} - {s.get('description', '')}" for i, s in enumerate(flow.get("steps", []))]
            )
            flow_text = (
                f"Execution flow: {flow.get('flow_name', '')}. "
                f"Type: {flow.get('flow_type', '')}. "
                f"Entry point: {flow.get('entry_point', 'Unknown')}. "
                f"Components: {', '.join(flow.get('components_used', []))}. "
                f"Database interactions: {', '.join(flow.get('database_interactions', []))}. "
                f"External services: {', '.join(flow.get('external_services', []))}. "
                f"Steps: {steps_text}"
            )
            chunks.append(("FLOW", f"flow_{flow.get('flow_name', 'unknown')}", flow_text))

        # 6. Onboarding Summaries
        for level_key, content in snapshot.get("onboarding_summaries", {}).items():
            if isinstance(content, dict):
                sections = content.get("sections", [])
                for section in sections:
                    section_text = f"{section.get('heading', '')}: {section.get('content', '')}"
                    chunks.append(("ONBOARDING", f"onboarding_{level_key}_{section.get('heading', 'unknown')}", section_text))

        # 7. Important Components (controllers, services, models)
        important = snapshot.get("important_components", {})
        for comp_type, comp_list in important.items():
            if comp_list:
                names = [c.get("name", "") for c in comp_list if isinstance(c, dict)]
                files = [c.get("file", "") for c in comp_list if isinstance(c, dict)]
                comp_text = f"Important {comp_type}: {', '.join(names)}. Located in files: {', '.join(files[:10])}."
                chunks.append(("COMPONENT", f"important_{comp_type}", comp_text))

        # 8. Database, Auth, External, Infrastructure
        for section_type, section_key, items_key in [
            ("DATABASE", "database_usage", "database_usage"),
            ("AUTHENTICATION", "auth_mechanisms", "authentication_mechanisms"),
            ("EXTERNAL", "external_integrations", "external_integrations"),
            ("INFRASTRUCTURE", "infrastructure_components", "infrastructure_components"),
            ("CLOUD", "cloud_components", "cloud_components"),
            ("CONTAINERIZATION", "containerization_components", "containerization_components"),
            ("ML", "ml_components", "ml_components"),
        ]:
            items = snapshot.get(items_key, [])
            if items:
                text = f"{section_type.title()} components: {', '.join(items)}."
                chunks.append((section_type, section_key, text))

        # 9. Health Signals
        health = snapshot.get("health_signals", {})
        if health:
            health_text = (
                f"Repository health: "
                f"Coupling score: {health.get('coupling_score', 'N/A')}%. "
                f"Separation of concerns: {health.get('separation_of_concerns_score', 'N/A')}/100. "
                f"God classes: {len(health.get('god_classes', []))}. "
                f"Circular dependencies: {len(health.get('circular_dependencies', []))}. "
                f"Dead modules: {len(health.get('dead_modules', []))}."
            )
            god_classes = health.get("god_classes", [])
            if god_classes:
                health_text += f" God class names: {', '.join([gc.get('class_name', '') for gc in god_classes])}."
            chunks.append(("HEALTH", "health_signals", health_text))

        # 10. Directory structure
        dirs = snapshot.get("directory_structure", {})
        if dirs.get("top_level_directories"):
            dir_text = (
                f"Directory structure: {dirs.get('total_files', 0)} files in {dirs.get('total_directories', 0)} directories. "
                f"Top level directories: {', '.join(dirs.get('top_level_directories', []))}. "
                f"Entry points: {', '.join(dirs.get('entry_points', [])[:10])}."
            )
            chunks.append(("STRUCTURE", "directory_structure", dir_text))

        if not chunks:
            logger.info(f"[Memory Layer] No content to embed for repo {repository_id}")
            return

        # Batch embed
        texts = [c[2] for c in chunks]
        embeddings = _embed_texts(texts)

        # Store
        for (section_type, section_key, section_text), embedding_vec in zip(chunks, embeddings):
            db.add(RepositoryEmbedding(
                repository_id=repository_id,
                section_type=section_type,
                section_key=section_key,
                section_text=section_text,
                embedding=embedding_vec,
            ))

        db.flush()
        logger.info(f"[Memory Layer] Stored {len(chunks)} embeddings for repo {repository_id}")

    # ── Retrieval ─────────────────────────────────────────────────────────────

    @staticmethod
    def get_memory(db: Session, repository_id: int) -> dict | None:
        """Retrieve the stored memory snapshot for a repository."""
        memory = db.query(RepositoryMemory).filter(
            RepositoryMemory.repository_id == repository_id
        ).first()

        if not memory:
            return None

        embedding_count = db.query(RepositoryEmbedding).filter(
            RepositoryEmbedding.repository_id == repository_id
        ).count()

        return {
            "repository_id": repository_id,
            "snapshot_content": memory.snapshot_content,
            "snapshot_version": memory.snapshot_version,
            "created_at": memory.created_at.isoformat() if memory.created_at else None,
            "updated_at": memory.updated_at.isoformat() if memory.updated_at else None,
            "embedding_count": embedding_count,
        }

    # ── Semantic Search ───────────────────────────────────────────────────────

    @staticmethod
    def semantic_search(db: Session, repository_id: int, query: str, top_k: int = 10) -> dict:
        """
        Perform semantic search over the repository's embedded knowledge.
        Returns the top-k most relevant sections with similarity scores.
        """
        logger.info(f"[Memory Layer] Semantic search for repo {repository_id}: '{query}'")

        embeddings = db.query(RepositoryEmbedding).filter(
            RepositoryEmbedding.repository_id == repository_id
        ).all()

        if not embeddings:
            return {
                "query": query,
                "results": [],
                "total_embeddings": 0,
            }

        # Embed query
        query_vec = _embed_texts([query])[0]

        # Score each embedding
        scored = []
        for emb in embeddings:
            similarity = _cosine_similarity(query_vec, emb.embedding)
            scored.append({
                "section_type": emb.section_type,
                "section_key": emb.section_key,
                "section_text": emb.section_text,
                "similarity_score": round(similarity, 4),
            })

        # Sort by similarity descending
        scored.sort(key=lambda x: x["similarity_score"], reverse=True)
        top_results = scored[:top_k]

        # Extract referenced components and flows
        referenced_components = []
        referenced_flows = []
        for result in top_results:
            if result["section_type"] == "COMPONENT":
                referenced_components.append(result["section_key"])
            elif result["section_type"] == "FLOW":
                referenced_flows.append(result["section_key"])

        return {
            "query": query,
            "results": top_results,
            "total_embeddings": len(embeddings),
            "referenced_components": list(set(referenced_components)),
            "referenced_flows": list(set(referenced_flows)),
        }
