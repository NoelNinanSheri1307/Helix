# c:\Users\VICTUS\helix\backend\chat_service.py

import os
import time
import json
import logging
from sqlalchemy.orm import Session
from google import genai
from google.genai import types
from pydantic import BaseModel
from context_assembly_service import ContextAssemblyService

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Pydantic model for structured output from LLM
class GroundedResponse(BaseModel):
    answer: str
    confidence: float
    referenced_files: list[str]
    referenced_components: list[str]
    referenced_flows: list[str]


class ChatService:
    @staticmethod
    def chat(db: Session, repository_id: int, query: str, email: str, mode: str = "explain") -> dict:
        """
        Accepts a user query, checks usage limits, checks cached answers, logs the query,
        assembles query-relevant context, queries the Gemini LLM, and returns the response.
        """
        # 1. Enforce length limit (500 characters)
        if len(query) > 500:
            raise HTTPException(
                status_code=400,
                detail={"error": "usage_limit_exceeded", "limit_type": "length", "detail": "Question length exceeds 500 characters limit."}
            )

        # 2. Daily limits tracking
        from datetime import datetime, timezone
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

        from models import ChatUsageLog

        # Check total daily queries across all repos (Max 50)
        global_count = db.query(ChatUsageLog).filter(
            ChatUsageLog.user_email == email,
            ChatUsageLog.created_at >= today_start
        ).count()

        if global_count >= 50:
            raise HTTPException(
                status_code=429,
                detail={"error": "usage_limit_exceeded", "limit_type": "global", "detail": "Global daily limit of 50 repository questions reached."}
            )

        # Check mode-specific counts
        if mode == "explain":
            explain_count = db.query(ChatUsageLog).filter(
                ChatUsageLog.user_email == email,
                ChatUsageLog.query_mode == "explain",
                ChatUsageLog.created_at >= today_start
            ).count()
            if explain_count >= 20:
                raise HTTPException(
                    status_code=429,
                    detail={"error": "usage_limit_exceeded", "limit_type": "explain", "detail": "Explain Mode limit of 20 questions reached for today."}
                )
        elif mode == "analyze":
            analyze_count = db.query(ChatUsageLog).filter(
                ChatUsageLog.user_email == email,
                ChatUsageLog.query_mode == "analyze",
                ChatUsageLog.created_at >= today_start
            ).count()
            if analyze_count >= 5:
                raise HTTPException(
                    status_code=429,
                    detail={"error": "usage_limit_exceeded", "limit_type": "analyze", "detail": "Deep Analysis Mode limit of 5 questions reached for today."}
                )

        # 3. Normalize Query
        normalized_query = ChatService._normalize_query(query)

        # 4. Intercept LLM/Gemini identity queries
        import re
        identity_keywords = [
            r"\b(who|what|which)\s+(model|llm|ai|assistant|system|bot|framework|creator|author|developer|company|team)\s+(are|is|powers|created|made|built|developed)\s+(you|this)\b",
            r"\bare\s+you\s+(gemini|gpt|claude|llama|deepseek|chatgpt|openai|google|anthropic|meta)\b",
            r"\bwhat\s+(model|llm)\s+(are\s+you|is\s+this|do\s+you\s+use|powers\s+you)\b",
            r"\b(who|what)\s+are\s+you\b",
            r"\bwhat\s+is\s+your\s+name\b",
            r"\b(who|what)\s+(created|made|built|developed)\s+you\b",
            r"\bwhich\s+llm\s+are\s+you\s+using\b"
        ]
        is_identity_query = False
        for pattern in identity_keywords:
            if re.search(pattern, normalized_query):
                is_identity_query = True
                break

        if is_identity_query:
            return {
                "answer": "I'm Helix, your repository intelligence assistant. My purpose is to help you understand repositories using Helix's analysis and intelligence engine.",
                "confidence": 1.0,
                "provider": "local",
                "model": "helix-intercept",
                "referenced_files": [],
                "referenced_components": [],
                "referenced_flows": [],
                "response_time_ms": 0
            }

        # 5. Intercept Unrelated Queries (Repository-Scoped Responses)
        words = set(re.findall(r'\b\w+\b', normalized_query))
        
        investigation_terms = {
            "architecture", "blueprint", "class", "classes", "struct", "structs", 
            "interface", "interfaces", "function", "functions", "method", "methods", 
            "variable", "variables", "flow", "flows", "step", "steps", "chain", "chains", 
            "endpoint", "endpoints", "route", "routes", "controller", "controllers", 
            "service", "services", "database", "databases", "db", "dbs", "table", "tables", 
            "query", "queries", "onboarding", "dependency", "dependencies", "package", 
            "packages", "config", "configs", "setting", "settings", "setup", "build", 
            "deploy", "docker", "pipeline", "pipelines", "import", "imports", "export", 
            "exports", "server", "servers", "client", "clients", "frontend", "frontends", 
            "backend", "backends", "auth", "authentication", "login", "signup", "register",
            "code", "program", "programming", "software", "develop", "implement", "logic", 
            "script", "scripts", "run", "execute", "test", "tests", "debug", "error", 
            "errors", "exception", "exceptions", "type", "types", "object", "objects", 
            "array", "arrays", "list", "lists", "map", "maps", "dictionary", "dictionaries", 
            "string", "strings", "int", "ints", "bool", "bools", "boolean", "booleans", 
            "model", "models", "view", "views", "template", "templates", "framework", 
            "frameworks", "library", "libraries", "api", "apis", "json", "xml", "html", 
            "css", "js", "ts", "py", "go", "rust", "cpp", "java", "c#", "php", "sql", 
            "nosql", "git", "commit", "commits", "push", "pull", "merge", "branch", 
            "branches", "clone", "create", "delete", "update", "read", "write", "call", 
            "calls", "invoke", "argument", "arguments", "parameter", "parameters", "return", 
            "returns", "value", "values", "key", "keys", "token", "tokens", "jwt", "jwts", 
            "session", "sessions", "cookie", "cookies", "request", "requests", "response", 
            "responses", "header", "headers", "body", "bodies", "param", "params", "url", 
            "urls", "path", "paths", "port", "ports", "host", "hosts", "ip", "address", 
            "connection", "connections", "pool", "pools", "async", "await", "promise", 
            "promises", "thread", "threads", "process", "processes", "memory", "storage", 
            "disk", "cpu", "ram", "network", "protocol", "protocols", "http", "https", 
            "ws", "wss", "tcp", "udp", "dns", "ssl", "tls", "cert", "certs", "security", 
            "encryption", "decryption", "hash", "hashes", "signature", "signatures", "user", 
            "users", "role", "roles", "permission", "permissions", "acl", "rbac", "abac", 
            "policy", "policies", "rule", "rules", "guard", "guards", "middleware", 
            "middlewares", "handler", "handlers", "router", "routers", "match", "regex", 
            "pattern", "patterns", "expression", "expressions", "language", "languages", 
            "tech", "technology", "technologies", "stack", "readme", "documentation", 
            "doc", "docs", "python", "javascript", "typescript", "cplusplus"
        }
        
        context_pronouns = {
            "this", "here", "it", "us", "we", "codebase", "repository", "project", 
            "repo", "app", "application", "file", "folder", "directory", "module", 
            "component", "system", "workspace"
        }
        
        is_related = False
        if not words:
            is_related = True
        elif words.intersection(investigation_terms) or words.intersection(context_pronouns):
            is_related = True
        else:
            from models import Repository, RepositoryStructure
            repo = db.query(Repository).filter(Repository.id == repository_id).first()
            repo_keywords = set()
            if repo:
                if repo.repository_name:
                    repo_keywords.update(re.findall(r'\b\w+\b', repo.repository_name.lower()))
                if repo.language:
                    repo_keywords.add(repo.language.lower())
                if repo.framework:
                    repo_keywords.add(repo.framework.lower())
                    
            structure = db.query(RepositoryStructure).filter(RepositoryStructure.repository_id == repository_id).first()
            if structure:
                for d in (structure.top_level_directories or []):
                    repo_keywords.update(re.findall(r'\b\w+\b', d.lower()))
                for f in (structure.files or [])[:100]:
                    base = os.path.basename(f)
                    name_only = os.path.splitext(base)[0]
                    repo_keywords.update(re.findall(r'\b\w+\b', name_only.lower()))
                    
            if words.intersection(repo_keywords):
                is_related = True

        if not is_related:
            return {
                "answer": "I am designed to answer questions about the selected repository and the intelligence generated by Helix. Please ask a repository-related question.",
                "confidence": 1.0,
                "provider": "local",
                "model": "helix-intercept",
                "referenced_files": [],
                "referenced_components": [],
                "referenced_flows": [],
                "response_time_ms": 0
            }

        # 6. Cache Check
        import hashlib
        query_clean = query.strip().lower()
        query_hash = hashlib.sha256(query_clean.encode("utf-8")).hexdigest()

        from models import ChatCache
        cached_entry = db.query(ChatCache).filter(
            ChatCache.repository_id == repository_id,
            ChatCache.question_hash == query_hash,
            ChatCache.mode == mode
        ).first()

        if cached_entry:
            logger.info(f"[Chat Service] Cache hit for repo {repository_id}, query: '{query}'")
            # Log usage for cached query to maintain usage limit tracking
            try:
                db.add(ChatUsageLog(
                    user_email=email,
                    repository_id=repository_id,
                    query_mode=mode
                ))
                db.commit()
            except Exception as log_exc:
                logger.error(f"[Chat Service] Failed to log cached chat usage: {log_exc}")
                db.rollback()
            return cached_entry.response_content

        start_time = time.perf_counter()
        logger.info(f"[Chat Service] Processing chat request for repo {repository_id} (Mode: {mode})")

        # 4. Invoke Context Assembly Engine
        context = ContextAssemblyService.assemble_context(db, repository_id, query)

        # 5. Format Context Package for LLM consumption
        context_str = ChatService._format_context_package(context)

        # 6. Setup Gemini API Client
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            # Try loading dotenv as fallback
            from dotenv import load_dotenv
            backend_path = os.path.dirname(os.path.abspath(__file__))
            load_dotenv(os.path.join(backend_path, ".env"))
            api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured in backend environment")

        client = genai.Client(api_key=api_key)

        # 7. Construct System Instruction based on Mode
        system_instruction = ChatService._get_system_instruction(mode)
        prompt = f"USER QUERY: {query}\n\nREPOSITORY CONTEXT:\n{context_str}"

        try:
            # 8. Call LLM
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=GroundedResponse,
                    system_instruction=system_instruction,
                    temperature=0.1
                )
            )

            # 9. Parse result
            result_data = json.loads(response.text)
            
            # Post-processing / safety formatting of the grounded answer
            answer = result_data.get("answer", "")
            ref_files = result_data.get("referenced_files", [])
            ref_components = result_data.get("referenced_components", [])
            ref_flows = result_data.get("referenced_flows", [])

        except Exception as exc:
            logger.error(f"[Chat Service] Failed to call/parse LLM response: {exc}")
            answer = "I could not find enough repository evidence."
            ref_files = []
            ref_components = []
            ref_flows = []

        response_time_ms = int((time.perf_counter() - start_time) * 1000)

        # Calculate confidence score dynamically based on evidence
        if "could not find enough repository evidence" in answer.lower():
            confidence = 0.0
        else:
            sem_score = len([sc for sc in context.get("semantic_chunks", []) if sc.get("similarity_score", 0.0) >= 0.65])
            flow_score = len([f for f in context.get("flows", []) if f.get("relevance") in ("HIGH", "MEDIUM")])
            comp_score = len([c for c in context.get("components", []) if c.get("relevance") in ("HIGH", "MEDIUM")])
            context_len = len(context_str.split())

            points = 0.0
            if sem_score >= 3:
                points += 0.4
            elif sem_score >= 1:
                points += 0.2
                
            if flow_score >= 1:
                points += 0.3
                
            if comp_score >= 1:
                points += 0.2
                
            if context_len > 1000:
                points += 0.1
            elif context_len > 300:
                points += 0.05
                
            confidence = min(max(points, 0.1), 1.0)

        # Deduplicate references from LLM with those from context assembly to ensure absolute verification
        context_files = {f["file_path"].replace("\\", "/") for f in context.get("files", []) if "file_path" in f}
        context_components = {c["name"] for c in context.get("components", []) if "name" in c}
        context_flows = {f["flow_name"] for f in context.get("flows", []) if "flow_name" in f}

        final_files = [f.replace("\\", "/") for f in ref_files if f.replace("\\", "/") in context_files]
        final_components = [c for c in ref_components if c in context_components]
        final_flows = [f for f in ref_flows if f in context_flows]

        # If LLM didn't return any but context assembly had high matches, let's supplement them
        if not final_files:
            final_files = [f["file_path"] for f in context.get("files", []) if f.get("relevance") == "HIGH"][:5]
        if not final_components:
            final_components = [c["name"] for c in context.get("components", []) if c.get("relevance") == "HIGH"][:5]
        if not final_flows:
            final_flows = [f["flow_name"] for f in context.get("flows", []) if f.get("relevance") == "HIGH"][:3]

        response_payload = {
            "answer": answer,
            "confidence": confidence,
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            "referenced_files": final_files,
            "referenced_components": final_components,
            "referenced_flows": final_flows,
            "response_time_ms": response_time_ms
        }

        # Log this query in usage logs
        try:
            db.add(ChatUsageLog(
                user_email=email,
                repository_id=repository_id,
                query_mode=mode
            ))
            db.commit()
        except Exception as log_exc:
            logger.error(f"[Chat Service] Failed to log chat usage: {log_exc}")
            db.rollback()

        # Save to DB cache
        try:
            db.add(ChatCache(
                repository_id=repository_id,
                question_hash=query_hash,
                mode=mode,
                response_content=response_payload
            ))
            db.commit()
        except Exception as cache_exc:
            logger.error(f"[Chat Service] Failed to write cache entry: {cache_exc}")
            db.rollback()

        return response_payload

    @staticmethod
    def _format_context_package(context: dict) -> str:
        lines = []

        # Metadata
        meta = context.get("metadata", {})
        lines.append("=== REPOSITORY OVERVIEW ===")
        lines.append(f"Name: {meta.get('name')}")
        lines.append(f"Description: {meta.get('description')}")
        lines.append(f"Language: {meta.get('language')}")
        lines.append(f"Framework: {meta.get('framework')}")

        # Architecture
        arch = context.get("architecture", {})
        if arch:
            lines.append("\n=== SYSTEM ARCHITECTURE ===")
            lines.append(f"Pattern Type: {arch.get('architecture_type')}")
            lines.append(f"Project Layout: {arch.get('project_type')}")
            lines.append(f"Deployment Model: {arch.get('deployment_model')}")
            summary = arch.get("summary", {})
            if isinstance(summary, dict):
                lines.append(f"Architecture summary details: {json.dumps(summary)}")
            if arch.get("components"):
                lines.append("System Components:")
                for c in arch.get("components", []):
                    lines.append(f"  * {c.get('name')} ({c.get('type')}): {c.get('description')} [Tech: {', '.join(c.get('technologies', []))}]")

        # Execution Flows
        flows = context.get("flows", [])
        if flows:
            lines.append("\n=== RELEVANT EXECUTION FLOWS ===")
            for f in flows:
                lines.append(f"- Flow: {f['flow_name']} (Type: {f['flow_type']}, Relevance: {f['relevance']})")
                lines.append(f"  Entry Point: {f['entry_point']}")
                lines.append(f"  Components Involved: {', '.join(f['components_used'])}")
                lines.append(f"  Database interactions: {', '.join(f['database_interactions'])}")
                lines.append(f"  External services: {', '.join(f['external_services'])}")
                lines.append(f"  Steps:")
                for s in f.get('steps', []):
                    lines.append(f"    Step {s.get('step_number')}: {s.get('step_name')} - {s.get('description')} (defined in {s.get('file_path')}:{s.get('line_number')})")

        # Components
        comps = context.get("components", [])
        if comps:
            lines.append("\n=== RELEVANT CODE COMPONENTS ===")
            for c in comps:
                lines.append(f"- Component: {c['name']} (Type: {c['type']}, File: {c['file']}, Line: {c['line']}, Relevance: {c['relevance']})")

        # Call Graph Chains
        cg = context.get("call_graph", [])
        if cg:
            lines.append("\n=== RELEVANT CALL CHAINS ===")
            for chain in cg:
                lines.append(f"  * {' -> '.join(chain)}")

        # Knowledge Graph
        kg = context.get("knowledge_graph", [])
        if kg:
            lines.append("\n=== RELATIONSHIPS & DEPENDENCIES ===")
            for rel in kg:
                lines.append(f"  * {rel['source']} ({rel['source_type']}) -{rel['relationship']}-> {rel['target']} ({rel['target_type']}) [in {rel['file_path']}]")

        # Onboarding
        onboard = context.get("onboarding", [])
        if onboard:
            lines.append("\n=== RELEVANT ONBOARDING DOCUMENTATION ===")
            for o in onboard:
                lines.append(f"Heading [{o['level']}]: {o['heading']}")
                lines.append(f"Content:\n{o['content']}\n")

        # Infrastructure
        infra = context.get("infrastructure", [])
        if infra:
            lines.append("\n=== INFRASTRUCTURE COMPONENTS ===")
            lines.append(", ".join([i["name"] for i in infra]))

        # Machine Learning
        ml = context.get("ml_components", [])
        if ml:
            lines.append("\n=== MACHINE LEARNING COMPONENTS ===")
            lines.append(", ".join([m["name"] for m in ml]))

        # Semantic chunks
        chunks = context.get("semantic_chunks", [])
        if chunks:
            lines.append("\n=== ADDITIONAL EVIDENCE CHUNKS ===")
            for sc in chunks:
                lines.append(f"- [{sc['section_type']} - {sc['section_key']}]: {sc['section_text']}")

        return "\n".join(lines)

    @staticmethod
    def _get_system_instruction(mode: str) -> str:
        instruction = (
            "You are Helix, a repository intelligence assistant.\n"
            "Your goal is to answer developer questions about this repository using ONLY the provided repository context.\n\n"
            "GROUNDING RULES:\n"
            "1. Every answer must originate strictly from the provided repository context.\n"
            "2. If the context does not contain enough information to formulate a correct and verified answer, you MUST set the 'answer' field to \"I could not find enough repository evidence.\" and the 'confidence' field to 0.0.\n"
            "3. Do not make assumptions or use model prior knowledge about libraries, files, classes, or code structure unless they are explicitly shown in the context.\n"
            "4. Never hallucinate files, functions, lines, database tables, API routes, or execution flows that are not present in the context.\n"
            "5. Provide precise, professional, and code-grounded answers.\n\n"
            "MODE SPECIFIC INSTRUCTIONS:\n"
        )
        if mode == "analyze":
            instruction += (
                "- Mode 'analyze' (Deep Analysis): Perform a deep architectural-review. Map components, analyze dependencies, evaluate call structures, circular calls, design patterns, health aspects, or deployment strategies based on the context. Offer a thorough and detailed review.\n"
            )
        else:
            instruction += (
                "- Mode 'explain' (Explain): Formulate a concise, clear, and direct explanation addressing the developer's question. Focus on telling them exactly what matches, how it works, and where it is located.\n"
            )

        instruction += (
            "\nOUTPUT FORMAT:\n"
            "You must output a JSON object matching this schema:\n"
            "{\n"
            "  \"answer\": \"Grounded answer text (in markdown format)\",\n"
            "  \"confidence\": 0.0 to 1.0,\n"
            "  \"referenced_files\": [\"list of relative file paths mentioned/used in the answer\"],\n"
            "  \"referenced_components\": [\"list of code entity/component names mentioned/used in the answer\"],\n"
            "  \"referenced_flows\": [\"list of execution flow names mentioned/used in the answer\"]\n"
            "}\n"
            "Only return valid JSON matching this schema. All keys are required."
        )
        return instruction

    @staticmethod
    def _normalize_query(query: str) -> str:
        # Convert to lowercase
        normalized = query.lower().strip()
        
        # Strip common punctuation (except slash or hyphen/underscore which might be in code names)
        import re
        normalized = re.sub(r'[?.!,;:]', '', normalized)
        
        # Remove filler words / prefixes
        fillers = [
            "please show me", "can you tell me", "tell me about", "how does", "how do i",
            "how can we", "what is", "what are", "explain how", "explain what", "explain",
            "give me details on", "find information about", "where is", "where do we",
            "how to", "show me", "can you explain", "could you explain"
        ]
        for filler in fillers:
            if normalized.startswith(filler):
                normalized = normalized[len(filler):].strip()
                break
                
        # Token replacement for abbreviations/synonyms
        words = normalized.split()
        synonyms = {
            "db": "database",
            "auth": "authentication",
            "config": "configuration",
            "repo": "repository",
            "repos": "repositories",
            "jwt": "jsonwebtoken",
            "middleware": "middlewares",
            "endpoint": "endpoints",
            "postgres": "postgresql",
            "pg": "postgresql",
            "doc": "documentation",
            "docs": "documentation",
            "deps": "dependencies",
            "lib": "library"
        }
        normalized_words = [synonyms.get(w, w) for w in words]
        return " ".join(normalized_words)
