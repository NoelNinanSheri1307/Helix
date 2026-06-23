# c:\Users\VICTUS\helix\backend\context_assembly_service.py

import re
import logging
from sqlalchemy.orm import Session
from models import (
    Repository, RepositoryStructure, CodeEntity, KnowledgeNode,
    KnowledgeEdge, RepositoryArchitecture, ExecutionFlow, FlowStep,
    OnboardingDocument
)
from repository_memory_service import RepositoryMemoryService

logger = logging.getLogger(__name__)

class ContextAssemblyService:
    @staticmethod
    def assemble_context(db: Session, repository_id: int, query: str) -> dict:
        """
        Assembles all relevant repository knowledge and intelligence into
        a structured, deduplicated, and relevance-ranked context package.
        """
        logger.info(f"[Context Assembly] Assembling context for repo {repository_id} with query: '{query}'")

        # Basic setup
        query_lower = query.lower()
        query_words = set(re.findall(r'[a-zA-Z0-9_-]{3,}', query_lower))

        # Helper to check keyword matches
        def has_keyword(text: str) -> bool:
            if not text:
                return False
            t_lower = text.lower()
            if t_lower in query_lower:
                return True
            t_words = set(re.findall(r'[a-zA-Z0-9_-]{3,}', t_lower))
            if t_words & query_words:
                return True
            return False

        # ── Source 8: Semantic Retrieval (Code Atlas) ──
        # Get matching semantic chunks to seed our relevance engine
        atlas_data = RepositoryMemoryService.semantic_search(db, repository_id, query, top_k=12)
        semantic_chunks = atlas_data.get("results", [])
        ref_components = set(atlas_data.get("referenced_components", []))
        ref_flows = set(atlas_data.get("referenced_flows", []))

        # Create quick-lookup maps for semantic match relevance
        semantic_relevance_map = {} # (section_type, section_key) -> relevance_level
        for idx, chunk in enumerate(semantic_chunks):
            # Top 3 are HIGH relevance, 4-10 are MEDIUM, rest are SUPPORTING
            if idx < 3:
                rel = "HIGH"
            elif idx < 10:
                rel = "MEDIUM"
            else:
                rel = "SUPPORTING"
            semantic_relevance_map[(chunk["section_type"], chunk["section_key"])] = rel

        # ── Source 1: Repository Metadata ──
        repo = db.query(Repository).filter(Repository.id == repository_id).first()
        if not repo:
            raise ValueError(f"Repository {repository_id} not found")

        structure = db.query(RepositoryStructure).filter(
            RepositoryStructure.repository_id == repository_id
        ).first()

        metadata_relevance = "SUPPORTING"
        if has_keyword(repo.repository_name) or has_keyword(repo.description) or has_keyword(repo.language):
            metadata_relevance = "HIGH"
        elif any(has_keyword(lang) for lang in (structure.languages if structure else [])):
            metadata_relevance = "MEDIUM"
        elif ("OVERVIEW", "repository_overview") in semantic_relevance_map:
            metadata_relevance = semantic_relevance_map[("OVERVIEW", "repository_overview")]

        metadata_package = {
            "name": repo.repository_name,
            "description": repo.description,
            "language": repo.language,
            "framework": repo.framework,
            "stars": repo.stars,
            "forks": repo.forks,
            "size_kb": repo.size_kb,
            "default_branch": repo.default_branch,
            "relevance": metadata_relevance
        }

        # ── Source 2: Architecture Intelligence ──
        architecture = db.query(RepositoryArchitecture).filter(
            RepositoryArchitecture.repository_id == repository_id
        ).first()

        architecture_package = {}
        if architecture:
            arch_rel = "SUPPORTING"
            if ("ARCHITECTURE", "architecture_summary") in semantic_relevance_map:
                arch_rel = semantic_relevance_map[("ARCHITECTURE", "architecture_summary")]
            elif any(kw in query_lower for kw in ["arch", "pattern", "design", "structure"]):
                arch_rel = "HIGH"

            architecture_package = {
                "architecture_type": architecture.architecture_type,
                "project_type": architecture.project_type,
                "deployment_model": architecture.deployment_model,
                "summary": architecture.architecture_summary,
                "evidence": architecture.architecture_summary.get("evidence", []) if isinstance(architecture.architecture_summary, dict) else [],
                "components": [
                    {
                        "name": c.get("name"),
                        "type": c.get("type"),
                        "description": c.get("description", ""),
                        "technologies": c.get("technologies", [])
                    } for c in architecture.components
                ],
                "relevance": arch_rel
            }

        # ── Source 3: Execution Flows ──
        flows = db.query(ExecutionFlow).filter(ExecutionFlow.repository_id == repository_id).all()
        flows_package = []
        relevant_flow_ids = set()

        for flow in flows:
            flow_steps = db.query(FlowStep).filter(FlowStep.flow_id == flow.id).order_by(FlowStep.step_number).all()
            
            # Compute relevance
            flow_key = f"flow_{flow.flow_name}"
            flow_rel = "SUPPORTING"
            
            if ("FLOW", flow_key) in semantic_relevance_map:
                flow_rel = semantic_relevance_map[("FLOW", flow_key)]
            elif flow_key in ref_flows or has_keyword(flow.flow_name) or has_keyword(flow.flow_type):
                flow_rel = "HIGH"
            elif any(has_keyword(step.step_name) or has_keyword(step.description) for step in flow_steps):
                flow_rel = "MEDIUM"

            # Filter out completely irrelevant flows if the query is specific and this is supporting without any keywords
            if flow_rel == "SUPPORTING" and not any(kw in query_lower for kw in ["flow", "execution", "step", "run"]):
                continue

            relevant_flow_ids.add(flow.id)
            flows_package.append({
                "flow_name": flow.flow_name,
                "flow_type": flow.flow_type,
                "entry_point": flow.entry_point,
                "components_used": flow.components_used,
                "database_interactions": flow.database_interactions,
                "external_services": flow.external_services,
                "steps": [
                    {
                        "step_number": s.step_number,
                        "step_name": s.step_name,
                        "description": s.description,
                        "file_path": s.file_path,
                        "line_number": s.line_number
                    } for s in flow_steps
                ],
                "relevance": flow_rel
            })

        # ── Source 5: AST Intelligence (Code Entities) ──
        entities = db.query(CodeEntity).filter(CodeEntity.repository_id == repository_id).all()
        entities_package = []
        entity_by_name = {}
        relevant_entity_names = set()

        for e in entities:
            # Map type to standardized categories
            # Skip imports as entities (we track dependencies and graph relationships instead)
            if e.entity_type == "IMPORT":
                continue

            entity_key = f"component_{e.entity_name}"
            ent_rel = "SUPPORTING"

            # Check semantic map
            if ("COMPONENT", entity_key) in semantic_relevance_map:
                ent_rel = semantic_relevance_map[("COMPONENT", entity_key)]
            elif entity_key in ref_components or has_keyword(e.entity_name):
                ent_rel = "HIGH"
            elif has_keyword(e.file_path) or has_keyword(e.entity_type):
                ent_rel = "MEDIUM"
            
            # Check if this entity is part of a highly/moderately relevant flow step
            entity_in_flow = False
            for f in flows_package:
                if f["relevance"] in ("HIGH", "MEDIUM"):
                    for step in f["steps"]:
                        if step["step_name"] == e.entity_name or step["file_path"] == e.file_path:
                            entity_in_flow = True
                            break
            if entity_in_flow and ent_rel == "SUPPORTING":
                ent_rel = "MEDIUM"

            # Filter out completely unrelated entities to avoid flooding context
            if ent_rel == "SUPPORTING" and not any(kw in query_lower for kw in ["code", "class", "function", "entity"]):
                continue

            entity_data = {
                "name": e.entity_name,
                "type": e.entity_type,
                "file": e.file_path,
                "line": e.line_number,
                "relevance": ent_rel
            }
            entities_package.append(entity_data)
            entity_by_name[e.entity_name] = entity_data
            relevant_entity_names.add(e.entity_name)

        # Deduplicate entities
        unique_entities = {}
        for ent in entities_package:
            key = (ent["name"], ent["file"])
            if key not in unique_entities or (ent["relevance"] == "HIGH" and unique_entities[key]["relevance"] != "HIGH"):
                unique_entities[key] = ent
        entities_package = list(unique_entities.values())

        # ── Source 6: Knowledge Graph ──
        nodes = db.query(KnowledgeNode).filter(KnowledgeNode.repository_id == repository_id).all()
        edges = db.query(KnowledgeEdge).filter(KnowledgeEdge.repository_id == repository_id).all()

        nodes_by_id = {n.id: n for n in nodes}
        nodes_by_name = {n.node_name: n for n in nodes}
        
        relevant_nodes = set()
        for n in nodes:
            if n.node_name in relevant_entity_names or has_keyword(n.node_name) or has_keyword(n.node_type):
                relevant_nodes.add(n.id)

        # Fetch edges connecting these relevant nodes
        kg_package = []
        for e in edges:
            src = nodes_by_id.get(e.source_node_id)
            tgt = nodes_by_id.get(e.target_node_id) if e.target_node_id else None

            # Skip if source node is missing
            if not src:
                continue

            is_relevant_edge = (e.source_node_id in relevant_nodes) or (tgt and e.target_node_id in relevant_nodes)
            
            # If not matching directly, check relationship keywords
            if not is_relevant_edge:
                if has_keyword(e.caller_name) or has_keyword(e.callee_name) or has_keyword(e.relationship_type):
                    is_relevant_edge = True
            
            if is_relevant_edge:
                edge_rel = "SUPPORTING"
                if (src.node_name in query_lower) or (tgt and tgt.node_name in query_lower):
                    edge_rel = "HIGH"
                elif src.id in relevant_nodes and tgt and tgt.id in relevant_nodes:
                    edge_rel = "MEDIUM"

                kg_package.append({
                    "source": src.node_name,
                    "source_type": src.node_type,
                    "target": tgt.node_name if tgt else None,
                    "target_type": tgt.node_type if tgt else None,
                    "relationship": e.relationship_type,
                    "file_path": e.file_path,
                    "line_number": e.line_number,
                    "relevance": edge_rel
                })

        # ── Source 4: Call Graph (Call Chains) ──
        # Extract call chains from CALLS relationships
        call_chains = []
        call_edges = [edge for edge in kg_package if edge["relationship"] == "CALLS"]

        # Build adjacency map
        adj = {}
        for e in call_edges:
            if e["source"] and e["target"]:
                adj.setdefault(e["source"], []).append(e["target"])

        # Trace paths starting from "HIGH" relevance entities or entry points
        visited_nodes = set()
        def dfs(node, path, depth):
            if depth > 3 or node in visited_nodes or len(path) > 4:
                if len(path) > 1:
                    call_chains.append(list(path))
                return
            
            visited_nodes.add(node)
            path.append(node)
            
            neighbors = adj.get(node, [])
            if not neighbors:
                if len(path) > 1:
                    call_chains.append(list(path))
            else:
                for n in neighbors:
                    dfs(n, list(path), depth + 1)
            
            visited_nodes.remove(node)

        # Identify starting nodes for chain exploration
        starts = [ent["name"] for ent in entities_package if ent["relevance"] == "HIGH"]
        # Fallback to general functions if no high relevance starts found
        if not starts:
            starts = [e["source"] for e in call_edges[:5]]

        for start in starts[:10]:
            dfs(start, [], 0)

        # Deduplicate and prioritize shortest/most useful chains
        unique_chains = []
        for chain in call_chains:
            # Check if this chain is a subchain of another already in unique_chains
            is_sub = False
            for other in unique_chains:
                if len(chain) < len(other):
                    # Check list sub-sequence
                    for i in range(len(other) - len(chain) + 1):
                        if other[i:i+len(chain)] == chain:
                            is_sub = True
                            break
                if is_sub:
                    break
            if not is_sub:
                unique_chains.append(chain)

        # Sort by length and relevance
        unique_chains.sort(key=len)
        call_graph_package = unique_chains[:15] # Limit to top 15 chains

        # ── Source 7: Developer Onboarding ──
        onboard_docs = db.query(OnboardingDocument).filter(
            OnboardingDocument.repository_id == repository_id
        ).all()

        onboarding_package = []
        for doc in onboard_docs:
            content = doc.generated_content
            if isinstance(content, dict) and "sections" in content:
                for sec in content["sections"]:
                    heading = sec.get("heading", "")
                    body = sec.get("content", "")
                    
                    onboard_rel = "SUPPORTING"
                    # Match semantic key if stored
                    sec_key = f"onboarding_{doc.document_type}_{heading}"
                    
                    if ("ONBOARDING", sec_key) in semantic_relevance_map:
                        onboard_rel = semantic_relevance_map[("ONBOARDING", sec_key)]
                    elif has_keyword(heading) or has_keyword(body):
                        onboard_rel = "HIGH"

                    if onboard_rel != "SUPPORTING" or any(kw in query_lower for kw in ["setup", "install", "guide", "onboard"]):
                        onboarding_package.append({
                            "level": doc.document_type,
                            "heading": heading,
                            "content": body,
                            "relevance": onboard_rel
                        })

        # ── Source 9 & 10 & 11: Technologies, Dependencies, Infrastructure & ML ──
        # Extract from structure dependencies
        deps_list = (structure.dependencies if structure else []) or []
        tech_list = (structure.frameworks if structure else []) or []
        
        dependencies_package = []
        infrastructure_package = []
        ml_package = []

        # Keywords classifications
        infra_keywords = ["docker", "postgres", "mysql", "mongo", "redis", "kubernetes", "k8s", "terraform", "ansible", "nginx", "rabbitmq", "kafka", "aws", "gcp", "azure", "firebase"]
        ml_keywords = ["tensorflow", "pytorch", "sklearn", "keras", "transformers", "huggingface", "model", "inference", "training", "embedding", "vector", "rag"]

        # 9. Dependencies
        for dep in deps_list:
            dep_lower = dep.lower()
            is_infra = any(k in dep_lower for k in infra_keywords)
            is_ml = any(k in dep_lower for k in ml_keywords)

            # Determine relevance
            dep_rel = "SUPPORTING"
            if has_keyword(dep):
                dep_rel = "HIGH"

            dep_data = {"name": dep, "type": "library", "relevance": dep_rel}

            if is_infra:
                infrastructure_package.append(dep_data)
            elif is_ml:
                ml_package.append(dep_data)
            else:
                dependencies_package.append(dep_data)

        # Add framework/tech list
        for tech in tech_list:
            tech_rel = "SUPPORTING"
            if has_keyword(tech):
                tech_rel = "HIGH"

            tech_data = {"name": tech, "type": "framework", "relevance": tech_rel}
            if any(k in tech.lower() for k in infra_keywords):
                infrastructure_package.append(tech_data)
            elif any(k in tech.lower() for k in ml_keywords):
                ml_package.append(tech_data)
            else:
                dependencies_package.append(tech_data)

        # Deduplicate lists
        def dedup_list(lst):
            seen = set()
            res = []
            for item in lst:
                if item["name"] not in seen:
                    seen.add(item["name"])
                    res.append(item)
            return res

        dependencies_package = dedup_list(dependencies_package)
        infrastructure_package = dedup_list(infrastructure_package)
        ml_package = dedup_list(ml_package)

        # Filter out irrelevant dependencies to minimize bloat
        dependencies_package = [d for d in dependencies_package if d["relevance"] != "SUPPORTING"][:15]
        
        # If query specifically asks about infra/database/ml, keep all, else filter out supporting
        if not any(kw in query_lower for kw in ["deploy", "docker", "infra", "cloud", "aws", "gcp", "database", "postgres", "sql", "redis"]):
            infrastructure_package = [i for i in infrastructure_package if i["relevance"] != "SUPPORTING"]
        if not any(kw in query_lower for kw in ["ml", "ai", "model", "prediction", "train", "embed"]):
            ml_package = [m for m in ml_package if m["relevance"] != "SUPPORTING"]

        # ── Deduplicated Files List ──
        # Aggregate all unique files referenced in our high/medium components, flows, and graphs
        files_map = {} # path -> {relevance, reasons}

        def add_file(path, relevance, reason):
            if not path:
                return
            # Normalize path
            p = path.replace("\\", "/")
            if p not in files_map:
                files_map[p] = {"file_path": p, "relevance": relevance, "reasons": [reason]}
            else:
                # Elevate relevance if needed
                if relevance == "HIGH" or (relevance == "MEDIUM" and files_map[p]["relevance"] == "SUPPORTING"):
                    files_map[p]["relevance"] = relevance
                if reason not in files_map[p]["reasons"]:
                    files_map[p]["reasons"].append(reason)

        for ent in entities_package:
            add_file(ent["file"], ent["relevance"], f"Contains entity '{ent['name']}' ({ent['type']})")

        for flow in flows_package:
            for step in flow["steps"]:
                add_file(step["file_path"], flow["relevance"], f"Flow Step: {flow['flow_name']} - {step['step_name']}")

        for edge in kg_package:
            add_file(edge["file_path"], edge["relevance"], f"Graph relationship: {edge['source']} {edge['relationship']} {edge['target']}")

        # Convert to list and sort by relevance
        files_package = list(files_map.values())
        # Sort so that HIGH is first, then MEDIUM, then SUPPORTING
        relevance_order = {"HIGH": 0, "MEDIUM": 1, "SUPPORTING": 2}
        files_package.sort(key=lambda f: relevance_order.get(f["relevance"], 3))

        # Limit files context bloat
        files_package = files_package[:20]

        # ── Assemble and return context package ──
        context_package = {
            "query": query,
            "metadata": metadata_package,
            "architecture": architecture_package,
            "flows": flows_package,
            "call_graph": call_graph_package,
            "components": entities_package,
            "files": files_package,
            "knowledge_graph": kg_package,
            "onboarding": onboarding_package,
            "dependencies": dependencies_package,
            "infrastructure": infrastructure_package,
            "ml_components": ml_package,
            "semantic_chunks": [
                {
                    "section_type": sc["section_type"],
                    "section_key": sc["section_key"],
                    "section_text": sc["section_text"],
                    "similarity_score": sc["similarity_score"]
                } for sc in semantic_chunks
            ]
        }

        return context_package
