# c:\Users\VICTUS\helix\backend\architecture_service.py

import logging
import re
from sqlalchemy.orm import Session
from models import CodeEntity, Repository, RepositoryStructure, KnowledgeNode, KnowledgeEdge, RepositoryArchitecture

logger = logging.getLogger(__name__)

class ArchitectureService:
    @staticmethod
    def generate_architecture(db: Session, repository_id: int) -> RepositoryArchitecture:
        logger.info(f"[Architecture Service] Running for repository ID: {repository_id}")
        
        # 1. Fetch Repository Details
        repo = db.query(Repository).filter(Repository.id == repository_id).first()
        struct = db.query(RepositoryStructure).filter(RepositoryStructure.repository_id == repository_id).first()
        entities = db.query(CodeEntity).filter(CodeEntity.repository_id == repository_id).all()
        nodes = db.query(KnowledgeNode).filter(KnowledgeNode.repository_id == repository_id).all()
        edges = db.query(KnowledgeEdge).filter(KnowledgeEdge.repository_id == repository_id).all()
        
        # 2. Extract Frameworks, Dependencies, Files, Directories
        frameworks = set(struct.frameworks or []) if struct else set()
        dependencies = set(struct.dependencies or []) if struct else set()
        files = struct.files or [] if struct else []
        directories = struct.directories or [] if struct else []
        primary_lang = repo.language if repo else "Unknown"
        
        # Add primary framework to list if present
        if repo and repo.framework and repo.framework != "Unknown":
            frameworks.add(repo.framework)

        # Build helpers for scoring
        dir_names = {d.split("/")[-1].lower() for d in directories}
        files_lower = [f.lower() for f in files]
        deps_lower = {d.lower() for d in dependencies}
        frameworks_lower = {fw.lower() for fw in frameworks}

        # 3. Detect Project Type
        project_type = struct.project_type if struct and struct.project_type else "Full Stack Project"
        if not project_type or project_type == "Unknown":
            if "Flutter" in frameworks or "iOS" in frameworks or "Android" in frameworks:
                project_type = "Mobile Application"
            elif any(fw in frameworks for fw in ["React", "Vue", "Angular", "Next.js", "Nuxt"]):
                if any(fw in frameworks for fw in ["FastAPI", "Spring Boot", "Express", "Django", "Flask", "Go"]):
                    project_type = "Full Stack Application"
                else:
                    project_type = "Web Frontend Application"
            elif any(fw in frameworks for fw in ["FastAPI", "Spring Boot", "Express", "Django", "Flask", "Go", "NestJS"]):
                project_type = "Backend Service / API"
            elif any(fw in frameworks for fw in ["PyTorch", "TensorFlow", "Scikit-learn", "LangChain", "LlamaIndex"]):
                project_type = "Machine Learning Project"
            else:
                project_type = "General Software Repository"

        # 4. Detect Deployment Model
        deployment_model = "Local/Virtual Machine Execution"
        if any("k8s" in f or "kubernetes" in f or "helm" in f for f in files_lower):
            deployment_model = "Kubernetes Cluster Deployment"
        elif any("serverless.yml" in f or "serverless.yaml" in f for f in files_lower):
            deployment_model = "Serverless Cloud Infrastructure"
        elif any("docker-compose" in f or "compose.yml" in f or "compose.yaml" in f for f in files_lower):
            deployment_model = "Containerized (Docker Compose)"
        elif any("dockerfile" in f for f in files_lower):
            deployment_model = "Containerized (Single Dockerfile)"
        elif any(f.endswith(".tf") for f in files_lower) or any("terraform" in d for d in dir_names):
            deployment_model = "Infrastructure as Code (Terraform)"
        elif any("aws" in f or "azure" in f or "gcp" in f or "firebase" in f for f in files_lower):
            deployment_model = "Cloud-Native Hosting"

        # 5. Detect Authentication Layer
        auth_layer = "No authentication logic identified"
        imports_lower = [e.entity_name.lower() for e in entities if e.entity_type == "IMPORT"]
        
        if any("next-auth" in d or "nextauth" in d for d in deps_lower):
            auth_layer = "NextAuth.js (Next.js Authentication)"
        elif any("spring-security" in d or "springsecurity" in d for d in deps_lower) or any("org.springframework.security" in i for i in imports_lower):
            auth_layer = "Spring Security Authentication Framework"
        elif any("firebase" in d and "auth" in d for d in deps_lower) or any("firebase-auth" in d for d in deps_lower):
            auth_layer = "Firebase Auth / Identity Provider"
        elif any("jwt" in d or "jsonwebtoken" in d or "pyjwt" in d for d in deps_lower) or any("jwt" in i or "jose" in i for i in imports_lower):
            auth_layer = "JSON Web Tokens (JWT) Claims Verification"
        elif any("oauth" in d or "oauth2" in d for d in deps_lower) or any("oauth" in i for i in imports_lower):
            auth_layer = "OAuth 2.0 / OpenID Connect Protocol"
        elif any("passport" in d for d in deps_lower):
            auth_layer = "Passport.js Authentication Middleware"
        elif any("auth0" in d for d in deps_lower):
            auth_layer = "Auth0 Managed Identity Service"
        elif any("cognito" in d for d in deps_lower):
            auth_layer = "Amazon Cognito Managed Auth"

        # 6. Detect Database Layer
        database_layer = "No database dependencies detected"
        if "postgresql" in frameworks or any("postgres" in d or "pq" in d for d in deps_lower):
            database_layer = "PostgreSQL Database Connection"
        elif "mysql" in frameworks or any("mysql" in d for d in deps_lower):
            database_layer = "MySQL Database Connection"
        elif "mongodb" in frameworks or any("mongo" in d for d in deps_lower):
            database_layer = "MongoDB Document Store"
        elif "redis" in frameworks or any("redis" in d for d in deps_lower):
            database_layer = "Redis In-Memory Key-Value Cache"
        elif "sqlite" in frameworks or any("sqlite" in d for d in deps_lower) or any("sqlite" in f for f in files_lower):
            database_layer = "SQLite Local Relational Database"
        elif any("sqlalchemy" in d for d in deps_lower) or any("sqlalchemy" in i for i in imports_lower):
            database_layer = "SQLAlchemy ORM (SQLite/PostgreSQL)"
        elif any("gorm" in d for d in deps_lower):
            database_layer = "GORM (Go Object Relational Mapping)"
        elif any("hibernate" in d for d in deps_lower) or any("jakarta.persistence" in i for i in imports_lower):
            database_layer = "Hibernate JPA ORM Framework"
        elif any("mongoose" in d for d in deps_lower):
            database_layer = "Mongoose ODM Layer (MongoDB)"

        # ==================================================
        # MULTI-SIGNAL CLASSIFICATION FOR 25 TEMPLATES
        # ==================================================
        templates = {}

        # 1. Full Stack Web Application
        def score_full_stack():
            score = 0
            ev = []
            matched_dirs = {"frontend", "backend", "client", "server", "front", "back", "web", "api"}.intersection(dir_names)
            if matched_dirs:
                score += 25
                ev.append(f"Contains frontend/backend boundary directories: {', '.join(matched_dirs)}")
            
            has_fe_fw = any(fw in ["React", "Vue", "Angular", "Next.js", "Svelte", "Flutter"] for fw in frameworks)
            has_be_fw = any(fw in ["FastAPI", "Spring Boot", "Express", "Django", "Flask", "Go", "NestJS", "Gin"] for fw in frameworks)
            if has_fe_fw and has_be_fw:
                score += 40
                ev.append("Detected both client-side and server-side framework conventions")
            elif has_fe_fw or has_be_fw:
                score += 15
                ev.append("Detected either client-side or server-side framework convention")
                
            has_ui = any(n.node_type in ("WIDGET", "COMPONENT") for n in nodes)
            has_endpoints = any(n.node_type in ("CONTROLLER", "ENDPOINT") for n in nodes)
            if has_ui and has_endpoints:
                score += 35
                ev.append("AST includes both user interface components and server endpoints")
            elif has_ui or has_endpoints:
                score += 10
                ev.append("AST contains either UI components or endpoints")
                
            return min(100, score), ev
        templates["Full Stack Web Application"] = score_full_stack

        # 2. Single Page Application (SPA)
        def score_spa():
            score = 0
            ev = []
            spa_dirs = {"components", "pages", "src", "client", "public", "static"}.intersection(dir_names)
            if spa_dirs:
                score += 20
                ev.append(f"Contains client UI folders: {', '.join(spa_dirs)}")
            
            fe_only = {"React", "Vue", "Angular", "Svelte", "Vite", "Webpack"}.intersection(frameworks)
            if fe_only:
                score += 40
                ev.append(f"Identified frontend frameworks: {', '.join(fe_only)}")
                
            ui_nodes = [n for n in nodes if n.node_type in ("COMPONENT", "WIDGET")]
            if ui_nodes:
                score += 30
                ev.append(f"AST contains {len(ui_nodes)} UI components/widgets")
                
            if any("react" in d or "vue" in d or "angular" in d or "svelte" in d or "vite" in d for d in deps_lower):
                score += 20
                ev.append("Dependencies contain standard web client libraries")
                
            if any(fw in ["FastAPI", "Spring Boot", "Django", "Rails", "NestJS", "Go", "Gin"] for fw in frameworks):
                score = max(0, score - 40)
                ev.append("Backend server framework detected; reducing SPA likelihood")
                
            return min(100, score), ev
        templates["Single Page Application"] = score_spa

        # 3. Server Side Rendered Application (SSR)
        def score_ssr():
            score = 0
            ev = []
            ssr_dirs = {"pages", "views", "templates", "layouts"}.intersection(dir_names)
            if ssr_dirs:
                score += 20
                ev.append(f"Contains template/view folders: {', '.join(ssr_dirs)}")
                
            ssr_fws = {"Next.js", "Nuxt", "Django", "Flask", "Rails", "Laravel", "ASP.NET Core", "Spring Boot"}.intersection(frameworks)
            if ssr_fws:
                score += 30
                ev.append(f"Server-side execution/routing frameworks: {', '.join(ssr_fws)}")
                
            if any("render" in n.node_name.lower() or "template" in n.node_name.lower() for n in nodes):
                score += 25
                ev.append("Found rendering methods or template handlers in AST")
                
            if any("next" in d or "nuxt" in d or "ejs" in d or "thymeleaf" in d or "jinja" in d or "pug" in d for d in deps_lower):
                score += 25
                ev.append("Dependencies contain template engine or SSR framework libraries")
                
            return min(100, score), ev
        templates["Server Side Rendered Application"] = score_ssr

        # 4. Backend API
        def score_backend_api():
            score = 0
            ev = []
            api_dirs = {"controllers", "routes", "endpoints", "api", "handlers", "routers"}.intersection(dir_names)
            if api_dirs:
                score += 20
                ev.append(f"Contains API routing folders: {', '.join(api_dirs)}")
                
            be_fws = {"FastAPI", "Express", "Spring Boot", "NestJS", "Flask", "Django", "Gin", "Fiber"}.intersection(frameworks)
            if be_fws:
                score += 30
                ev.append(f"Identified backend frameworks: {', '.join(be_fws)}")
                
            endpoints = [n for n in nodes if n.node_type == "ENDPOINT"]
            if endpoints:
                score += 30
                ev.append(f"AST exposes {len(endpoints)} endpoints/routes")
                
            if any(n.node_type in ("WIDGET", "COMPONENT") for n in nodes):
                score = max(0, score - 30)
                ev.append("UI components or widgets found; reducing Backend API likelihood")
                
            return min(100, score), ev
        templates["Backend API"] = score_backend_api

        # 5. Layered Architecture
        def score_layered():
            score = 0
            ev = []
            layered_dirs = {"service", "services", "repository", "repositories", "dao", "dto", "mapper", "controllers"}
            matched_dirs = layered_dirs.intersection(dir_names)
            if matched_dirs:
                score += len(matched_dirs) * 8
                ev.append(f"Contains classic layered directories: {', '.join(matched_dirs)}")
            
            c_nodes = [n for n in nodes if n.node_type == "CONTROLLER"]
            s_nodes = [n for n in nodes if n.node_type == "SERVICE"]
            r_nodes = [n for n in nodes if n.node_type == "REPOSITORY"]
            
            if c_nodes:
                score += 15
                ev.append(f"AST contains Controller nodes ({len(c_nodes)})")
            if s_nodes:
                score += 15
                ev.append(f"AST contains Service nodes ({len(s_nodes)})")
            if r_nodes:
                score += 15
                ev.append(f"AST contains Repository nodes ({len(r_nodes)})")
                
            flow_signals = 0
            for edge in edges:
                src = next((n for n in nodes if n.id == edge.source_node_id), None)
                tgt = next((n for n in nodes if n.id == edge.target_node_id), None)
                if src and tgt:
                    if src.node_type == "CONTROLLER" and tgt.node_type == "SERVICE":
                        flow_signals += 10
                    if src.node_type == "SERVICE" and tgt.node_type == "REPOSITORY":
                        flow_signals += 10
            if flow_signals > 0:
                score += min(20, flow_signals)
                ev.append("Detected request call flow between Controller, Service, and Repository layers")
                
            if "Spring Boot" in frameworks or "NestJS" in frameworks:
                score += 15
                ev.append("Using standard layered-by-default frameworks (Spring Boot/NestJS)")
                
            return min(100, score), ev
        templates["Layered Architecture"] = score_layered

        # 6. MVC
        def score_mvc():
            score = 0
            ev = []
            mvc_dirs = {"model", "models", "view", "views", "controller", "controllers"}.intersection(dir_names)
            if mvc_dirs:
                score += len(mvc_dirs) * 10
                ev.append(f"Contains Model-View-Controller folders: {', '.join(mvc_dirs)}")
                
            c_nodes = [n for n in nodes if n.node_type == "CONTROLLER"]
            m_nodes = [n for n in nodes if n.node_type == "MODEL"]
            v_nodes = [n for n in nodes if n.node_type in ("WIDGET", "COMPONENT")] or "views" in dir_names
            
            if c_nodes:
                score += 15
                ev.append("Found controller classes/logic")
            if m_nodes:
                score += 15
                ev.append("Found schema/entity model classes")
            if v_nodes:
                score += 15
                ev.append("Found frontend view representation components")
                
            mvc_fws = {"Django", "Rails", "Laravel", "ASP.NET Core", "Flask"}.intersection(frameworks)
            if mvc_fws:
                score += 20
                ev.append(f"Using default MVC framework: {', '.join(mvc_fws)}")
                
            return min(100, score), ev
        templates["MVC"] = score_mvc

        # 7. MVVM
        def score_mvvm():
            score = 0
            ev = []
            mvvm_dirs = {"viewmodel", "viewmodels", "view_model", "view_models", "views", "models"}.intersection(dir_names)
            if mvvm_dirs:
                score += len(mvvm_dirs) * 12
                ev.append(f"Contains MVVM structured folders: {', '.join(mvvm_dirs)}")
                
            vm_classes = [n for n in nodes if "viewmodel" in n.node_name.lower()]
            if vm_classes:
                score += 25
                ev.append(f"AST contains explicit ViewModel classes ({len(vm_classes)})")
                
            w_nodes = [n for n in nodes if n.node_type in ("WIDGET", "COMPONENT")]
            m_nodes = [n for n in nodes if n.node_type == "MODEL"]
            if w_nodes:
                score += 15
                ev.append("Found Widget/UI nodes")
            if m_nodes:
                score += 15
                ev.append("Found Model entities")
                
            if "Flutter" in frameworks or any("viewmodel" in d for d in deps_lower):
                score += 20
                ev.append("Framework or dependencies support VM state pattern (Flutter/MVVM bindings)")
                
            return min(100, score), ev
        templates["MVVM"] = score_mvvm

        # 8. Clean Architecture
        def score_clean():
            score = 0
            ev = []
            clean_dirs = {"domain", "application", "infrastructure", "adapters", "ports", "core", "usecase", "usecases", "entities"}.intersection(dir_names)
            if clean_dirs:
                score += len(clean_dirs) * 12
                ev.append(f"Contains Clean Architecture boundaries folders: {', '.join(clean_dirs)}")
                
            use_cases = [n for n in nodes if "usecase" in n.node_name.lower() or "interactor" in n.node_name.lower()]
            if use_cases:
                score += 25
                ev.append(f"Found {len(use_cases)} explicit UseCase/Interactor classes")
                
            if any("domain" in d or "usecase" in d for d in files_lower):
                score += 15
                ev.append("File paths reference domain/usecase layers")
                
            return min(100, score), ev
        templates["Clean Architecture"] = score_clean

        # 9. Hexagonal Architecture
        def score_hexagonal():
            score = 0
            ev = []
            hex_dirs = {"ports", "adapters", "inbound", "outbound", "domain", "application"}.intersection(dir_names)
            if hex_dirs:
                score += len(hex_dirs) * 15
                ev.append(f"Contains Hexagonal (Ports & Adapters) folders: {', '.join(hex_dirs)}")
                
            ports_adapters = [n for n in nodes if "port" in n.node_name.lower() or "adapter" in n.node_name.lower()]
            if ports_adapters:
                score += 30
                ev.append(f"Found {len(ports_adapters)} classes matching Port or Adapter pattern")
                
            return min(100, score), ev
        templates["Hexagonal Architecture"] = score_hexagonal

        # 10. Microservice
        def score_microservice():
            score = 0
            ev = []
            svc_dirs = {"services", "apps", "microservices", "gateway", "apis"}.intersection(dir_names)
            if svc_dirs:
                score += 20
                ev.append(f"Contains service orchestration folders: {', '.join(svc_dirs)}")
                
            docker_compose = [f for f in files_lower if "docker-compose" in f or "compose.yml" in f or "compose.yaml" in f]
            dockerfiles = [f for f in files_lower if "dockerfile" in f]
            k8s_files = [f for f in files_lower if "k8s" in f or "kubernetes" in f or "helm" in f or f.endswith(".yaml") and ("deployment" in f or "service" in f)]
            
            if docker_compose:
                score += 30
                ev.append(f"Found container orchestration: {', '.join(docker_compose)}")
            if len(dockerfiles) > 1:
                score += 25
                ev.append(f"Found multiple build manifests: {len(dockerfiles)} Dockerfiles")
            if k8s_files:
                score += 25
                ev.append("Found Kubernetes orchestration manifests")
                
            return min(100, score), ev
        templates["Microservice"] = score_microservice

        # 11. Monolith
        def score_monolith():
            score = 50 
            ev = ["Assuming standard Monolithic deployment unless services division is found"]
            
            docker_compose = [f for f in files_lower if "docker-compose" in f or "compose.yml" in f or "compose.yaml" in f]
            dockerfiles = [f for f in files_lower if "dockerfile" in f]
            
            if len(dockerfiles) == 1 and not docker_compose:
                score += 30
                ev.append("Single entrypoint Dockerfile identified with no service orchestrators")
            elif len(dockerfiles) == 0 and not docker_compose:
                score += 20
                ev.append("No container-compose or distributed service files detected")
                
            ms_score, _ = score_microservice()
            if ms_score > 60:
                score = max(0, score - 50)
                ev.append("High microservice scoring details present; lowering Monolithic score")
                
            return min(100, score), ev
        templates["Monolith"] = score_monolith

        # 12. Event Driven
        def score_event_driven():
            score = 0
            ev = []
            msg_dirs = {"events", "listeners", "consumers", "producers", "pubsub", "topics", "messaging", "queues"}.intersection(dir_names)
            if msg_dirs:
                score += 20
                ev.append(f"Contains event/messaging folders: {', '.join(msg_dirs)}")
                
            event_nodes = [n for n in nodes if any(k in n.node_name.lower() for k in ["consumer", "producer", "listener", "subscriber", "publisher", "event", "broker"])]
            if event_nodes:
                score += 30
                ev.append(f"AST contains {len(event_nodes)} event-driven handler nodes")
                
            msg_deps = {"kafka", "rabbitmq", "celery", "redis", "sqs", "sns", "amqp", "activemq", "mqtt", "pubsub", "nats"}.intersection(deps_lower)
            if msg_deps:
                score += 35
                ev.append(f"Identified messaging/queue packages: {', '.join(msg_deps)}")
                
            if "Celery" in frameworks or "Kafka" in frameworks:
                score += 15
                ev.append("Using primary event framework")
                
            return min(100, score), ev
        templates["Event Driven"] = score_event_driven

        # 13. Data Pipeline
        def score_data_pipeline():
            score = 0
            ev = []
            pipeline_dirs = {"pipelines", "jobs", "steps", "tasks", "dags", "pipeline"}.intersection(dir_names)
            if pipeline_dirs:
                score += 25
                ev.append(f"Contains workflow/pipeline directories: {', '.join(pipeline_dirs)}")
                
            pipe_nodes = [n for n in nodes if any(k in n.node_name.lower() for k in ["pipeline", "job", "step", "task"])]
            if pipe_nodes:
                score += 25
                ev.append(f"AST contains {len(pipe_nodes)} pipeline-related classes/functions")
                
            pipe_deps = {"airflow", "prefect", "dagster", "luigi", "beam", "pyspark"}.intersection(deps_lower)
            if pipe_deps:
                score += 35
                ev.append(f"Identified workflow orchestration dependencies: {', '.join(pipe_deps)}")
                
            if any(f.endswith(".py") and "dag" in f for f in files_lower):
                score += 15
                ev.append("Found Python DAG file definitions")
                
            return min(100, score), ev
        templates["Data Pipeline"] = score_data_pipeline

        # 14. ETL System
        def score_etl():
            score = 0
            ev = []
            etl_dirs = {"etl", "extractors", "loaders", "transformers", "extract", "transform", "load"}.intersection(dir_names)
            if etl_dirs:
                score += 25
                ev.append(f"Contains ETL-specific stage directories: {', '.join(etl_dirs)}")
                
            etl_nodes = [n for n in nodes if any(k in n.node_name.lower() for k in ["extract", "transform", "load", "etl"])]
            if etl_nodes:
                score += 25
                ev.append(f"AST contains {len(etl_nodes)} data stage handler classes/functions")
                
            etl_deps = {"pandas", "petl", "pyspark", "sqlalchemy"}.intersection(deps_lower)
            if etl_deps:
                score += 25
                ev.append(f"Identified ETL utility packages: {', '.join(etl_deps)}")
                
            if any("etl" in f for f in files_lower):
                score += 25
                ev.append("File names explicitly declare ETL operations")
                
            return min(100, score), ev
        templates["ETL System"] = score_etl

        # 15. Machine Learning Pipeline
        def score_ml_pipeline():
            score = 0
            ev = []
            ml_dirs = {"training", "inference", "preprocessing", "models", "pipeline", "train", "predict"}.intersection(dir_names)
            if ml_dirs:
                score += 20
                ev.append(f"Contains model training or inference directories: {', '.join(ml_dirs)}")
                
            ml_nodes = [n for n in nodes if any(k in n.node_name.lower() for k in ["train", "predict", "fit", "evaluate", "preprocess"])]
            if ml_nodes:
                score += 25
                ev.append(f"AST contains {len(ml_nodes)} machine learning operational routines")
                
            ml_deps = {"pytorch", "tensorflow", "sklearn", "scikit-learn", "xgboost", "lightgbm", "keras", "torch"}.intersection(deps_lower)
            if ml_deps:
                score += 35
                ev.append(f"Identified core ML engineering dependencies: {', '.join(ml_deps)}")
                
            if any("train" in f or "predict" in f or "model" in f and f.endswith(".py") for f in files_lower):
                score += 20
                ev.append("Contains training or prediction scripts")
                
            return min(100, score), ev
        templates["Machine Learning Pipeline"] = score_ml_pipeline

        # 16. MLOps Platform
        def score_mlops():
            score = 0
            ev = []
            mlops_dirs = {"mlruns", "deployments", "mlflow", "pipelines", "monitoring", "feature_store"}.intersection(dir_names)
            if mlops_dirs:
                score += 25
                ev.append(f"Contains model operations (MLOps) directories: {', '.join(mlops_dirs)}")
                
            mlops_deps = {"mlflow", "dvc", "kubeflow", "feast", "sagemaker", "bentoml"}.intersection(deps_lower)
            if mlops_deps:
                score += 45
                ev.append(f"Identified model tracking/ops dependencies: {', '.join(mlops_deps)}")
                
            if any("mlflow" in f or "dvc" in f for f in files_lower):
                score += 30
                ev.append("Found ML tracking/registry configuration files")
                
            return min(100, score), ev
        templates["MLOps Platform"] = score_mlops

        # 17. RAG Application
        def score_rag():
            score = 0
            ev = []
            rag_dirs = {"ingest", "retrieval", "vectorstore", "embeddings", "rag", "chunking", "prompts"}.intersection(dir_names)
            if rag_dirs:
                score += 20
                ev.append(f"Contains RAG-specific source directories: {', '.join(rag_dirs)}")
                
            rag_nodes = [n for n in nodes if any(k in n.node_name.lower() for k in ["vectorstore", "embeddings", "rag", "retriever", "chunk", "prompt"])]
            if rag_nodes:
                score += 30
                ev.append(f"AST references vector store, chunking, or embedding abstractions ({len(rag_nodes)} matches)")
                
            rag_deps = {"langchain", "llamaindex", "chromadb", "pinecone", "qdrant", "openai", "weaviate"}.intersection(deps_lower)
            if rag_deps:
                score += 35
                ev.append(f"Identified LLM and Vector Indexing libraries: {', '.join(rag_deps)}")
                
            if any("rag" in f or "vector" in f for f in files_lower):
                score += 15
                ev.append("RAG keyword matching filenames detected")
                
            return min(100, score), ev
        templates["RAG Application"] = score_rag

        # 18. LLM Application
        def score_llm():
            score = 0
            ev = []
            llm_dirs = {"prompts", "agents", "chains", "llm", "models"}.intersection(dir_names)
            if llm_dirs:
                score += 20
                ev.append(f"Contains conversational LLM layout folders: {', '.join(llm_dirs)}")
                
            llm_nodes = [n for n in nodes if any(k in n.node_name.lower() for k in ["agent", "chain", "llm", "completion", "prompt", "chatbot"])]
            if llm_nodes:
                score += 25
                ev.append(f"AST classes/functions handle agents, chains, or completions ({len(llm_nodes)} matches)")
                
            llm_deps = {"openai", "langchain", "anthropic", "ollama", "huggingface", "cohere"}.intersection(deps_lower)
            if llm_deps:
                score += 35
                ev.append(f"Identified core generative LLM integration packages: {', '.join(llm_deps)}")
                
            return min(100, score), ev
        templates["LLM Application"] = score_llm

        # 19. Computer Vision Application
        def score_cv():
            score = 0
            ev = []
            cv_dirs = {"cv", "images", "videos", "frames", "detection", "segmentation", "classification", "opencv"}.intersection(dir_names)
            if cv_dirs:
                score += 20
                ev.append(f"Contains image/video CV storage or logic folders: {', '.join(cv_dirs)}")
                
            cv_nodes = [n for n in nodes if any(k in n.node_name.lower() for k in ["detect", "segment", "classify", "opencv", "cv2", "image", "video"])]
            if cv_nodes:
                score += 25
                ev.append(f"AST contains visual model prediction or image frame processing ({len(cv_nodes)} matches)")
                
            cv_deps = {"opencv-python", "cv2", "albumentations", "mediapipe", "torchvision", "imageio", "pil", "pillow"}.intersection(deps_lower)
            if cv_deps:
                score += 40
                ev.append(f"Identified computer vision frameworks: {', '.join(cv_deps)}")
                
            if any("cv2" in e.entity_name.lower() or "opencv" in e.entity_name.lower() for e in entities if e.entity_type == "IMPORT"):
                score += 15
                ev.append("Imports OpenCV / CV2 APIs")
                
            return min(100, score), ev
        templates["Computer Vision Application"] = score_cv

        # 20. Mobile Application
        def score_mobile():
            score = 0
            ev = []
            mob_dirs = {"ios", "android", "lib", "app/src/main", "flutter", "react-native"}.intersection(dir_names)
            if mob_dirs:
                score += 25
                ev.append(f"Contains mobile platform builds directories: {', '.join(mob_dirs)}")
                
            mob_nodes = [n for n in nodes if any(k in n.node_name.lower() for k in ["widget", "activity", "viewcontroller", "intent", "screen"])]
            if mob_nodes:
                score += 20
                ev.append(f"AST includes mobile widget views or activity classes ({len(mob_nodes)} matches)")
                
            mob_fws = {"Flutter", "React Native", "Android", "iOS"}.intersection(frameworks)
            if mob_fws:
                score += 35
                ev.append(f"Using primary mobile framework: {', '.join(mob_fws)}")
                
            if any(f.endswith(".dart") or f.endswith(".swift") or f.endswith(".kt") for f in files_lower):
                score += 20
                ev.append("Contains native platform source files (.dart, .swift, .kt)")
                
            return min(100, score), ev
        templates["Mobile Application"] = score_mobile

        # 21. Desktop Application
        def score_desktop():
            score = 0
            ev = []
            dt_dirs = {"electron", "src-tauri", "pyqt", "tkinter", "wpf", "winforms"}.intersection(dir_names)
            if dt_dirs:
                score += 25
                ev.append(f"Contains desktop packaging configuration folders: {', '.join(dt_dirs)}")
                
            dt_nodes = [n for n in nodes if any(k in n.node_name.lower() for k in ["mainwindow", "browserwindow", "window", "frame", "qwidget", "qmainwindow"])]
            if dt_nodes:
                score += 25
                ev.append(f"AST references window container components ({len(dt_nodes)} matches)")
                
            dt_fws = {"Electron", "Tauri", "PyQt", "Tkinter", "WPF", "WinForms"}.intersection(frameworks)
            if dt_fws:
                score += 35
                ev.append(f"Using desktop windowing frameworks: {', '.join(dt_fws)}")
                
            if any("tauri" in d or "electron" in d or "pyqt" in d for d in deps_lower):
                score += 15
                ev.append("Desktop packaging library identified in dependencies list")
                
            return min(100, score), ev
        templates["Desktop Application"] = score_desktop

        # 22. CLI Tool
        def score_cli():
            score = 0
            ev = []
            cli_dirs = {"cli", "cmd", "commands", "bin", "scripts"}.intersection(dir_names)
            if cli_dirs:
                score += 20
                ev.append(f"Contains command routing or script entry folders: {', '.join(cli_dirs)}")
                
            cli_nodes = [n for n in nodes if any(k in n.node_name.lower() for k in ["argparse", "click", "cobra", "parser", "main_cli", "run_command"])]
            if cli_nodes:
                score += 20
                ev.append("AST includes command parsers or CLI arguments parsing")
                
            cli_deps = {"click", "argparse", "cobra", "commander", "yargs", "urcli"}.intersection(deps_lower)
            if cli_deps:
                score += 40
                ev.append(f"Identified terminal interaction utility dependencies: {', '.join(cli_deps)}")
                
            if any(f.startswith("cli") or "cmd" in f for f in files_lower):
                score += 20
                ev.append("Filenames declare command line utility behaviors")
                
            return min(100, score), ev
        templates["CLI Tool"] = score_cli

        # 23. IoT System
        def score_iot():
            score = 0
            ev = []
            iot_dirs = {"firmware", "hardware", "esp32", "arduino", "sensors", "mqtt", "serial", "gpio", "devices"}.intersection(dir_names)
            if iot_dirs:
                score += 25
                ev.append(f"Contains firmware/hardware routing folders: {', '.join(iot_dirs)}")
                
            iot_nodes = [n for n in nodes if any(k in n.node_name.lower() for k in ["setup", "loop", "pinmode", "digitalwrite", "analogread", "mqtt_callback"])]
            if iot_nodes:
                score += 25
                ev.append("AST features hardware pin setup or loop operations")
                
            iot_deps = {"paho-mqtt", "rpi.gpio", "pyserial", "wiringpi"}.intersection(deps_lower)
            if iot_deps:
                score += 35
                ev.append(f"Identified device/protocol communication libraries: {', '.join(iot_deps)}")
                
            if any(f.endswith(".ino") or f.endswith(".cpp") and "firmware" in f for f in files_lower):
                score += 15
                ev.append("Found Arduino sketches or firmware files")
                
            return min(100, score), ev
        templates["IoT System"] = score_iot

        # 24. Cloud Native Platform
        def score_cloud_native():
            score = 0
            ev = []
            cn_dirs = {"k8s", "kubernetes", "helm", "terraform", "cloudformation", "manifests"}.intersection(dir_names)
            if cn_dirs:
                score += 25
                ev.append(f"Contains cloud orchestration directory tags: {', '.join(cn_dirs)}")
                
            cn_deps = {"aws-sdk", "boto3", "google-cloud-storage", "azure-storage", "kubernetes"}.intersection(deps_lower)
            if cn_deps:
                score += 35
                ev.append(f"Identified Cloud Services SDK dependencies: {', '.join(cn_deps)}")
                
            if "Kubernetes" in deployment_model or "Terraform" in deployment_model:
                score += 40
                ev.append(f"Configured cloud deployment model: {deployment_model}")
                
            return min(100, score), ev
        templates["Cloud Native Platform"] = score_cloud_native

        # 25. Admin Dashboard
        def score_admin_dashboard():
            score = 0
            ev = []
            admin_dirs = {"admin", "dashboard", "panel", "management", "portal"}.intersection(dir_names)
            if admin_dirs:
                score += 25
                ev.append(f"Contains administrative control folders: {', '.join(admin_dirs)}")
                
            admin_nodes = [n for n in nodes if any(k in n.node_name.lower() for k in ["admin", "dashboard", "panel"])]
            if admin_nodes:
                score += 25
                ev.append(f"AST structures list administrative controllers/views ({len(admin_nodes)} matches)")
                
            admin_deps = {"react-admin", "adminjs", "filament"}.intersection(deps_lower)
            if admin_deps:
                score += 30
                ev.append(f"Identified administrative portal packages: {', '.join(admin_deps)}")
                
            if any("admin" in f for f in files_lower):
                score += 20
                ev.append("File name attributes mapping administrative profiles detected")
                
            return min(100, score), ev
        templates["Admin Dashboard"] = score_admin_dashboard

        # Run all template scorers
        scored_templates = {}
        template_evidences = {}
        for name, func in templates.items():
            sc, ev_list = func()
            scored_templates[name] = sc
            template_evidences[name] = ev_list

        # Pick primary and secondary architectures
        sorted_templates = sorted(scored_templates.items(), key=lambda x: x[1], reverse=True)
        primary_pattern, primary_score = sorted_templates[0]
        secondary_pattern, secondary_score = None, 0
        if len(sorted_templates) > 1:
            sec_pat, sec_sc = sorted_templates[1]
            if sec_sc >= 50 and sec_pat != primary_pattern:
                secondary_pattern = sec_pat
                secondary_score = sec_sc

        # Evidence Storage
        evidence = template_evidences[primary_pattern] if primary_score >= 60 else []

        # Confidence Scoring & Auto-classification rules
        final_architecture_type = primary_pattern
        if primary_score < 60:
            final_architecture_type = "Custom Architecture"
            # Topology analysis for Custom Architecture
            total_nodes = len(nodes)
            total_edges = len(edges)
            density = 0.0
            if total_nodes > 1:
                density = total_edges / (total_nodes * (total_nodes - 1))
            density_label = "sparse coupling"
            if density > 0.1:
                density_label = "dense connections"
            elif density > 0.03:
                density_label = "moderate coupling"

            # Find hubs
            degrees = {}
            for edge in edges:
                degrees[edge.source_node_id] = degrees.get(edge.source_node_id, 0) + 1
                degrees[edge.target_node_id] = degrees.get(edge.target_node_id, 0) + 1
            sorted_nodes_by_degree = sorted(degrees.items(), key=lambda x: x[1], reverse=True)
            top_hubs = []
            for node_id, degree in sorted_nodes_by_degree[:3]:
                node_obj = next((n for n in nodes if n.id == node_id), None)
                if node_obj:
                    top_hubs.append(f"{node_obj.node_name} ({node_obj.node_type}, {degree} connections)")

            by_type = {}
            for n in nodes:
                by_type[n.node_type] = by_type.get(n.node_type, 0) + 1
            components_breakdown = ", ".join([f"{count} {t.lower()}s" for t, count in by_type.items()])

            topology_desc = (
                f"Custom topological layout with {total_nodes} nodes and {total_edges} connections "
                f"({density_label}, density: {density:.2%}). "
                f"Includes: {components_breakdown or 'no standard entities'}."
            )
            if top_hubs:
                topology_desc += f" Key structural hubs: {', '.join(top_hubs)}."
            evidence = [topology_desc]
        elif primary_score < 85:
            evidence.insert(0, "Warning: Classified with moderate confidence (60-85%). Check custom patterns.")

        # ==================================================
        # TECHNOLOGY ROLE MAPPING
        # ==================================================
        role_categories = {
            "Frontend": ["react", "vue", "angular", "next.js", "nuxt", "flutter", "react native", "svelte", "html", "javascript", "typescript", "tailwindcss", "bootstrap", "sass", "css"],
            "Backend": ["fastapi", "spring boot", "django", "flask", "express", "nestjs", "gin", "fiber", "echo", "asp.net core", "rails", "laravel", "go", "python", "java", "c#", "node.js", "c++"],
            "Database": ["postgresql", "postgres", "mysql", "mongodb", "sqlite", "mariadb", "oracle", "sql server", "dynamodb", "firestore", "sqlalchemy", "gorm", "hibernate", "mongoose", "prisma"],
            "Cache": ["redis", "memcached"],
            "Messaging": ["kafka", "rabbitmq", "celery", "activemq", "sqs", "sns", "pubsub", "nats", "amqp"],
            "Authentication": ["nextauth", "next-auth", "spring-security", "firebase-auth", "jwt", "oauth", "passport", "auth0", "cognito"],
            "Storage": ["s3", "minio", "azure blob", "gcs", "cloudinary", "multer"],
            "AI/ML": ["pytorch", "tensorflow", "scikit-learn", "sklearn", "langchain", "llamaindex", "keras", "opencv", "numpy", "pandas", "openai", "huggingface", "transformers"],
            "Infrastructure": ["kubernetes", "docker", "docker-compose", "terraform", "helm", "aws", "azure", "gcp", "firebase", "ansible", "nginx"]
        }

        technology_roles = {}
        all_techs = frameworks.union(dependencies).union({primary_lang})
        for tech in all_techs:
            tech_lower = tech.lower()
            mapped = False
            for role, keywords in role_categories.items():
                if any(kw in tech_lower for kw in keywords):
                    technology_roles.setdefault(role, []).append(tech)
                    mapped = True
            if not mapped:
                technology_roles.setdefault("Other Utilities", []).append(tech)

        # Make list unique
        for role in technology_roles:
            technology_roles[role] = sorted(list(set(technology_roles[role])))

        # ==================================================
        # ARCHITECTURAL DRIFT DETECTION
        # ==================================================
        architectural_drift = []
        # Mixed patterns detection
        high_scorers = [name for name, score in scored_templates.items() if score >= 60]
        if len(high_scorers) > 1:
            architectural_drift.append(f"Mixed Architecture: Coexistence of patterns {', '.join(high_scorers)}")
        
        # Legacy/old files detection
        legacy_files = [f for f in files_lower if any(kw in f for kw in ["legacy", "old", "backup", "v1", "deprecated"])]
        if legacy_files:
            architectural_drift.append(f"Legacy modules detected: Found {len(legacy_files)} legacy or deprecated files (e.g. {legacy_files[0]})")
            
        # Conflicting framework setups
        active_fws = sorted(list(frameworks))
        if any(fw in ["FastAPI", "Flask", "Django"] for fw in frameworks) and "Spring Boot" in frameworks:
            architectural_drift.append("Conflicting backend frameworks: Mixing Python backend stack with JVM Spring Boot")
        if any(fw in ["React", "Vue", "Angular"] for fw in frameworks) and "Flutter" in frameworks:
            architectural_drift.append("Multiple view engines: Mixing Flutter mobile widgets with Single Page Web frameworks")

        # ==================================================
        # REPOSITORY HEALTH SIGNALS
        # ==================================================
        # 1. Coupling Score
        coupling_score = 0
        non_contains_edges = [e for e in edges if e.relationship_type != "CONTAINS"]
        if nodes:
            coupling_score = min(100, int((len(non_contains_edges) / max(1, len(nodes))) * 20))

        # 2. Circular Dependency cycles (DFS)
        adj = {n.id: [] for n in nodes}
        id_to_name = {n.id: n.node_name for n in nodes}
        for e in edges:
            if e.relationship_type != "CONTAINS" and e.source_node_id in adj and e.target_node_id in adj:
                adj[e.source_node_id].append(e.target_node_id)
                
        circular_dependencies = []
        visited = {} # id -> state (0=unvisited, 1=visiting, 2=visited)
        
        def dfs_cycles(u, path):
            visited[u] = 1
            path.append(u)
            for v in adj[u]:
                if visited.get(v, 0) == 1:
                    cycle_idx = path.index(v)
                    cycle_path = [id_to_name[node_id] for node_id in path[cycle_idx:]] + [id_to_name[v]]
                    cycle_key = " ➔ ".join(cycle_path)
                    if cycle_key not in circular_dependencies:
                        circular_dependencies.append(cycle_key)
                elif visited.get(v, 0) == 0:
                    dfs_cycles(v, path)
            path.pop()
            visited[u] = 2
            
        for n in nodes:
            if visited.get(n.id, 0) == 0:
                dfs_cycles(n.id, [])
                
        # 3. God Classes
        god_classes = []
        class_methods = {}
        for e in edges:
            if e.relationship_type == "CONTAINS":
                src = next((n for n in nodes if n.id == e.source_node_id), None)
                tgt = next((n for n in nodes if n.id == e.target_node_id), None)
                if src and tgt and src.node_type == "CLASS" and tgt.node_type == "METHOD":
                    class_methods.setdefault(src.node_name, []).append(tgt.node_name)
                    
        for cname, m_list in class_methods.items():
            if len(m_list) >= 8: # God Class threshold
                god_classes.append({
                    "class_name": cname,
                    "method_count": len(m_list)
                })
        # Sort god classes descending
        god_classes = sorted(god_classes, key=lambda x: x["method_count"], reverse=True)

        # 4. Dead Modules
        dead_modules = []
        target_ids = {e.target_node_id for e in edges}
        for n in nodes:
            # Exclude entrypoints, routers, or databases
            if n.node_type not in ("CONTROLLER", "ENDPOINT", "DATABASE", "WIDGET"):
                if n.id not in target_ids:
                    dead_modules.append(n.node_name)
        dead_modules = sorted(list(set(dead_modules)))[:15] # Top 15 dead modules

        # 5. Separation of Concerns (SoC) score
        soc_score = 100
        violations_count = 0
        for e in edges:
            src = next((n for n in nodes if n.id == e.source_node_id), None)
            tgt = next((n for n in nodes if n.id == e.target_node_id), None)
            if src and tgt:
                # Controller bypassing Service to directly query Database/Repository
                if src.node_type == "CONTROLLER" and tgt.node_type in ("REPOSITORY", "DATABASE"):
                    soc_score -= 15
                    violations_count += 1
                # View component bypassing controller/server logic
                elif src.node_type in ("WIDGET", "COMPONENT") and tgt.node_type in ("REPOSITORY", "DATABASE"):
                    soc_score -= 20
                    violations_count += 1
                    
        soc_score = max(10, soc_score)

        # 8. Identify System Components
        components = []
        fe_techs = [fw for fw in ["React", "Next.js", "Vue", "Angular", "Flutter", "Svelte", "Blazor"] if fw in frameworks]
        if not fe_techs and primary_lang in ("JavaScript", "TypeScript", "HTML"):
            fe_techs = ["HTML5", "JavaScript"]
        if fe_techs:
            components.append({
                "name": "User Interface Portal",
                "type": "Frontend Client",
                "description": f"Responsive frontend application developed in {', '.join(fe_techs)}.",
                "technologies": fe_techs
            })
            
        be_techs = [fw for fw in ["FastAPI", "Spring Boot", "Flask", "Django", "Express", "NestJS", "Gin", "Fiber", "Echo", "ASP.NET Core"] if fw in frameworks]
        if not be_techs and primary_lang in ("Python", "Java", "Go", "C#"):
            be_techs = [primary_lang]
        if be_techs:
            components.append({
                "name": "Application API Gateway / Server",
                "type": "Backend API Server",
                "description": f"Logical business controller and routing gateway using {', '.join(be_techs)}.",
                "technologies": be_techs
            })
            
        db_techs = []
        for db_name in ["PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "SQLAlchemy", "Gorm", "Hibernate", "Mongoose"]:
            if db_name in database_layer or db_name in frameworks:
                db_techs.append(db_name)
        if db_techs:
            components.append({
                "name": "System Database Service",
                "type": "Database Layer",
                "description": f"Persistent storage backend utilising {', '.join(db_techs)}.",
                "technologies": db_techs
            })

        # 9. Inferred Request Flows
        detected_flows = []
        controllers = [e.entity_name for e in entities if e.entity_type == "CONTROLLER"]
        services = [e.entity_name for e in entities if e.entity_type in ("SERVICE", "PROVIDER")]
        repositories = [e.entity_name for e in entities if e.entity_type == "REPOSITORY"]
        models = [e.entity_name for e in entities if e.entity_type in ("MODEL", "ENTITY")]
        
        def get_prefix(name: str, suffixes: list[str]) -> str:
            for s in suffixes:
                if name.endswith(s) and len(name) > len(s):
                    return name[:-len(s)]
            return ""

        domain_groups = {}
        for c in controllers:
            pref = get_prefix(c, ["Controller", "RestController", "Router"])
            if pref:
                domain_groups.setdefault(pref, {})["CONTROLLER"] = c
        for s in services:
            pref = get_prefix(s, ["Service", "Provider", "Notifier"])
            if pref:
                domain_groups.setdefault(pref, {})["SERVICE"] = s
        for r in repositories:
            pref = get_prefix(r, ["Repository", "Dao"])
            if pref:
                domain_groups.setdefault(pref, {})["REPOSITORY"] = r
        for m in models:
            pref = get_prefix(m, ["Model", "Entity", "Document"])
            if pref:
                domain_groups.setdefault(pref, {})["MODEL"] = m

        for domain, parts in domain_groups.items():
            steps = ["Client Request"]
            if "CONTROLLER" in parts:
                steps.append(f"Controller: {parts['CONTROLLER']}")
            else:
                steps.append("Controller Layer (Implicit)")
            if "SERVICE" in parts:
                steps.append(f"Service Logic: {parts['SERVICE']}")
            elif "REPOSITORY" in parts:
                steps.append(f"Service Layer: {domain}Service (Implicit)")
            if "REPOSITORY" in parts:
                steps.append(f"Data Access: {parts['REPOSITORY']}")
            elif "MODEL" in parts:
                steps.append(f"Data Mapper: {domain}Mapper (Implicit)")
            if "MODEL" in parts:
                steps.append(f"Entity Model: {parts['MODEL']}")
            steps.append(f"Database ({database_layer.split(' ')[0]})")
            
            detected_flows.append({
                "name": f"{domain} Lifecycle Flow",
                "steps": steps
            })

        if not detected_flows:
            if "Spring Boot" in frameworks:
                detected_flows.append({
                    "name": "Standard Spring Controller Pipeline",
                    "steps": [
                        "HTTP Web client",
                        "Spring RestController Endpoint",
                        "Service Layer Service Logic",
                        "Spring Data JPA Repository",
                        database_layer.split(' ')[0] if database_layer != "No database dependencies detected" else "Database Engine"
                    ]
                })
            elif "FastAPI" in frameworks or "Flask" in frameworks or "Django" in frameworks:
                detected_flows.append({
                    "name": "FastAPI/Django Web Request Pipeline",
                    "steps": [
                        "Browser / HTTP Client",
                        "FastAPI Router Endpoint",
                        "Service Action Controller",
                        "SQLAlchemy Model / ORM",
                        database_layer.split(' ')[0] if database_layer != "No database dependencies detected" else "Database Engine"
                    ]
                })
            else:
                detected_flows.append({
                    "name": "Software Execution Flow",
                    "steps": [
                        "Bootstrap / Main Executable",
                        "Service Controllers / Routines",
                        "System Storage / I/O Adapters"
                    ]
                })

        # 10. Generate Summary dictionary
        architecture_summary = {
            "project_type": project_type,
            "architecture_pattern": final_architecture_type,
            "primary_technologies": sorted(list(frameworks.union({primary_lang}))),
            "core_components": [c["name"] for c in components],
            "database_layer": database_layer,
            "authentication_layer": auth_layer,
            "deployment_model": deployment_model,
            
            # HARDENED FIELDS STORED IN SUMMARY JSON
            "confidence_score": primary_score,
            "evidence": evidence,
            "secondary_architecture": secondary_pattern,
            "technology_roles": technology_roles,
            "architectural_drift": architectural_drift,
            "health_signals": {
                "coupling_score": coupling_score,
                "circular_dependencies": circular_dependencies[:5],
                "god_classes": god_classes[:10],
                "dead_modules": dead_modules[:15],
                "separation_of_concerns_score": soc_score
            }
        }

        # 11. Store in Database
        arch = db.query(RepositoryArchitecture).filter(RepositoryArchitecture.repository_id == repository_id).first()
        if not arch:
            arch = RepositoryArchitecture(repository_id=repository_id)
            db.add(arch)
            
        arch.architecture_type = final_architecture_type
        arch.project_type = project_type
        arch.components = components
        arch.deployment_model = deployment_model
        arch.architecture_summary = architecture_summary
        arch.detected_flows = detected_flows
        
        db.commit()
        db.refresh(arch)
        logger.info(f"[Architecture Service] Hardened generation complete. Type: {final_architecture_type}, Confidence: {primary_score}%")
        return arch
