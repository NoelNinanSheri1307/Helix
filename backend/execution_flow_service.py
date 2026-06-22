# c:\Users\VICTUS\helix\backend\execution_flow_service.py

import logging
from sqlalchemy.orm import Session
from models import CodeEntity, KnowledgeNode, KnowledgeEdge, ExecutionFlow, FlowStep

logger = logging.getLogger(__name__)

class ExecutionFlowService:
    @staticmethod
    def discover_flows(db: Session, repository_id: int) -> None:
        logger.info(f"[Execution Flow Discovery] Starting for repository ID: {repository_id}")
        
        # 1. Clear old execution flows
        db.query(ExecutionFlow).filter(ExecutionFlow.repository_id == repository_id).delete()
        db.commit()

        # 2. Fetch all graph nodes and edges
        nodes = db.query(KnowledgeNode).filter(KnowledgeNode.repository_id == repository_id).all()
        edges = db.query(KnowledgeEdge).filter(
            KnowledgeEdge.repository_id == repository_id,
            KnowledgeEdge.relationship_type.in_(["CALLS", "INVOKES", "CREATES", "ROUTES_TO"])
        ).all()
        entities = db.query(CodeEntity).filter(CodeEntity.repository_id == repository_id).all()

        node_map = {n.id: n for n in nodes}
        entity_map = {e.id: e for e in entities}

        # Build adjacency list
        adj = {}
        in_degree = {}
        for edge in edges:
            src = edge.source_node_id
            tgt = edge.target_node_id
            if src and tgt:
                adj.setdefault(src, []).append((tgt, edge))
                in_degree[tgt] = in_degree.get(tgt, 0) + 1
                if src not in in_degree:
                    in_degree[src] = 0

        # 3. Identify starting points / entry points
        # Starting points can be:
        # - Endpoint nodes
        # - Handler nodes
        # - Nodes with in-degree = 0 (top-level entry points) that make outgoing calls
        starting_nodes = []
        for n in nodes:
            is_entry = n.node_type in ("ENDPOINT", "HANDLER")
            is_root = in_degree.get(n.id, 0) == 0 and len(adj.get(n.id, [])) > 0
            if is_entry or is_root:
                starting_nodes.append(n)

        # Traced paths store
        discovered_paths = []

        # Traversal to discover paths
        def dfs(node_id, current_path, current_edges, visited):
            node_name = node_map[node_id].node_name
            # Stop cycles or max length of 5 to keep flows high-level
            if node_id in visited or len(current_path) >= 5:
                discovered_paths.append((list(current_path), list(current_edges)))
                return
                
            neighbors = adj.get(node_id, [])
            new_path = current_path + [node_id]
            
            if not neighbors:
                discovered_paths.append((new_path, list(current_edges)))
                return
                
            new_visited = visited | {node_id}
            for neighbor_id, edge in neighbors:
                dfs(neighbor_id, new_path, current_edges + [edge], new_visited)

        for start_node in starting_nodes:
            dfs(start_node.id, [], [], set())

        # Deduplicate paths (keep only unique node paths)
        unique_paths = []
        seen_paths = set()
        for path_nodes, path_edges in discovered_paths:
            path_tuple = tuple(path_nodes)
            if path_tuple not in seen_paths:
                seen_paths.add(path_tuple)
                unique_paths.append((path_nodes, path_edges))

        # 4. Classify and Save Flows
        for path_nodes, path_edges in unique_paths:
            if not path_nodes:
                continue

            start_node = node_map[path_nodes[0]]
            start_entity = entity_map.get(start_node.entity_id) if start_node.entity_id else None
            
            # Flow Type Detection based on keywords in node names and endpoints
            flow_type = "API_REQUEST"
            all_names_lower = " ".join([node_map[nid].node_name.lower() for nid in path_nodes])
            
            # Check edge callee names for external triggers
            all_callees_lower = " ".join([edge.callee_name.lower() for edge in path_edges if edge.callee_name])
            combined_text = all_names_lower + " " + all_callees_lower

            # Classification rules
            if any(k in combined_text for k in ["login", "logout", "auth", "signin", "signup", "register", "token", "password"]):
                flow_type = "AUTHENTICATION"
            elif any(k in combined_text for k in ["pay", "stripe", "checkout", "billing", "invoice", "charge"]):
                flow_type = "PAYMENT"
            elif any(k in combined_text for k in ["upload", "download", "s3", "storage", "file", "avatar", "image"]):
                flow_type = "FILE_UPLOAD"
            elif any(k in combined_text for k in ["predict", "evaluate", "inference", "generate", "ask", "chat", "llm"]):
                flow_type = "PREDICTION"
            elif any(k in combined_text for k in ["train", "fit", "compile", "fine_tune", "epochs", "dataset"]):
                flow_type = "TRAINING"
            elif any(k in combined_text for k in ["save", "create", "update", "delete", "insert", "remove", "destroy"]):
                flow_type = "CRUD"
            elif "navigation" in combined_text or "route" in combined_text or start_node.node_type == "WIDGET":
                flow_type = "FLUTTER_NAVIGATION" if "dart" in [e.file_path.split(".")[-1].lower() for e in entities if e.file_path] else "FRONTEND_INTERACTION"
            elif "celery" in combined_text or "job" in combined_text or "task" in combined_text or "worker" in combined_text:
                flow_type = "BACKGROUND_JOB"

            # DB Interactions detection
            db_interactions = []
            db_keywords = {
                "postgresql": "PostgreSQL",
                "mysql": "MySQL",
                "mongodb": "MongoDB",
                "redis": "Redis",
                "sqlite": "SQLite",
                "gorm": "Gorm DB Integration",
                "hibernate": "Hibernate DB Integration",
                "repository": "Repository Access",
                "database": "Database Access",
                "query": "Database Query"
            }
            for kw, db_name in db_keywords.items():
                if kw in combined_text:
                    db_interactions.append(db_name)
            
            # Deduplicate DB interactions
            db_interactions = list(set(db_interactions))
            if not db_interactions and any(node_map[nid].node_type == "REPOSITORY" for nid in path_nodes):
                db_interactions.append("Database Repository Access")

            # External Services detection
            ext_services = []
            ext_keywords = {
                "stripe": "Stripe Payments",
                "firebase": "Firebase Service",
                "s3": "AWS S3 Cloud Storage",
                "auth0": "Auth0 Provider",
                "sendgrid": "SendGrid Email",
                "twilio": "Twilio SMS",
                "github": "GitHub API",
                "slack": "Slack Integration",
                "discord": "Discord Integration",
                "axios": "Axios HTTP Client",
                "fetch": "Fetch API Client",
                "http": "External HTTP Client"
            }
            for kw, svc_name in ext_keywords.items():
                if kw in combined_text:
                    ext_services.append(svc_name)
            ext_services = list(set(ext_services))

            # Components Used
            components_used = []
            for nid in path_nodes:
                node = node_map[nid]
                if node.node_type in ("CLASS", "SERVICE", "REPOSITORY", "CONTROLLER", "MODEL", "WIDGET", "COMPONENT"):
                    components_used.append(f"{node.node_name} ({node.node_type})")
            components_used = list(set(components_used))

            # Flow Name Formatting
            display_type = flow_type.replace("_", " ").title()
            entry_name = start_node.node_name
            if start_entity and start_entity.entity_type == "ENDPOINT":
                entry_name = start_entity.entity_name
            flow_name = f"{display_type} via {entry_name}"

            # Confidence scoring
            if len(path_nodes) > 1:
                confidence = 0.95
            else:
                confidence = 0.70
                
            if db_interactions or ext_services:
                confidence = max(confidence, 0.90)

            # Persist execution flow
            flow = ExecutionFlow(
                repository_id=repository_id,
                flow_name=flow_name,
                flow_type=flow_type,
                entry_point=entry_name,
                components_used=components_used,
                database_interactions=db_interactions,
                external_services=ext_services,
                confidence_score=confidence
            )
            db.add(flow)
            db.flush() # Populate flow ID

            # Save steps of the flow
            for idx, nid in enumerate(path_nodes, 1):
                node = node_map[nid]
                node_ent = entity_map.get(node.entity_id) if node.entity_id else None
                
                step_desc = f"Execute behavior {node.node_name}"
                if node.node_type == "ENDPOINT":
                    step_desc = f"Receive client API trigger at route {node.node_name}"
                elif node.node_type == "REPOSITORY":
                    step_desc = f"Perform database repository query inside {node.node_name}"
                elif node.node_type == "SERVICE":
                    step_desc = f"Execute core business logic in service {node.node_name}"
                
                step = FlowStep(
                    flow_id=flow.id,
                    step_number=idx,
                    step_name=node.node_name,
                    description=step_desc,
                    entity_id=node.entity_id,
                    file_path=node_ent.file_path if node_ent else None,
                    line_number=node_ent.line_number if node_ent else None,
                    node_type=node.node_type
                )
                db.add(step)

        db.commit()
        logger.info(f"[Execution Flow Discovery] Finished successfully. Discovered {len(unique_paths)} execution flows.")
