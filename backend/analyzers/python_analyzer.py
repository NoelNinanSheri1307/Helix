# c:\Users\VICTUS\helix\backend\analyzers\python_analyzer.py

import re
from tree_sitter_languages import get_parser
from analyzers.base_analyzer import BaseAnalyzer

class PythonAnalyzer(BaseAnalyzer):
    def analyze(self, file_path: str, code_bytes: bytes, language: str) -> dict:
        result = {
            "classes": [],
            "functions": [],
            "imports": [],
            "endpoints": [],
            "frameworks": [],
            "dependencies": [],
            "calls": []
        }

        try:
            parser = get_parser("python")
            tree = parser.parse(code_bytes)
        except Exception:
            # Fallback to regex in case of parse errors
            self._fallback_regex(file_path, code_bytes, result)
            return result

        current_class = None
        current_function = None

        def get_node_text(node):
            return node.text.decode('utf-8', errors='ignore').strip()

        def get_identifier(node):
            for child in node.children:
                if child.type == "identifier":
                    return get_node_text(child)
            return None

        def parse_decorator_route(decorator_node):
            text = get_node_text(decorator_node)
            # Match @app.get("/path") or @router.post("/path", ...)
            pattern = r'@(?:[a-zA-Z0-9_]+\.)*(get|post|put|delete|patch|route|options|head)\s*\(\s*(?:path\s*=\s*)?f?["\']([^"\']+)["\']'
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                method = match.group(1).upper()
                path = match.group(2)
                if method == "ROUTE":
                    methods_match = re.search(r'methods\s*=\s*\[([^\]]+)\]', text, re.IGNORECASE)
                    if methods_match:
                        methods_found = re.findall(r'["\']([^"\']+)["\']', methods_match.group(1))
                        if methods_found:
                            return [m.upper() for m in methods_found], path
                    return ["GET"], path
                return [method], path
            return None

        def analyze_node(node, decorators=None):
            nonlocal current_class, current_function
            node_type = node.type
            line = node.start_point[0] + 1

            if node_type == "decorated_definition":
                decs = []
                body_node = None
                for child in node.children:
                    if child.type == "decorator":
                        decs.append(child)
                    elif child.type in ("function_definition", "class_definition"):
                        body_node = child
                if body_node:
                    analyze_node(body_node, decs)
                return

            elif node_type == "class_definition":
                name = get_identifier(node) or "UnknownClass"
                
                # Check base classes / decorators to classify Model
                is_db_model = False
                for child in node.children:
                    if child.type == "argument_list":
                        arg_text = get_node_text(child).lower()
                        if any(x in arg_text for x in ["model", "base", "document", "declarative"]):
                            is_db_model = True
                
                if decorators:
                    for dec in decorators:
                        dec_text = get_node_text(dec).lower()
                        if "dataclass" in dec_text or "entity" in dec_text:
                            is_db_model = True

                entity_type = "MODEL" if is_db_model else "CLASS"
                result["classes"].append({"name": name, "line": line, "type": entity_type})
                
                # Recurse with current class context
                old_class = current_class
                current_class = name
                for child in node.children:
                    analyze_node(child)
                current_class = old_class
                return

            elif node_type == "function_definition":
                name = get_identifier(node) or "UnknownFunction"
                
                # Check if this function is an API route via decorators
                is_endpoint = False
                if decorators:
                    for dec in decorators:
                        route_info = parse_decorator_route(dec)
                        if route_info:
                            methods, path = route_info
                            for method in methods:
                                result["endpoints"].append({
                                    "name": name,
                                    "line": line,
                                    "type": "ENDPOINT",
                                    "path": path,
                                    "method": method
                                })
                            is_endpoint = True
                            break
                
                if not is_endpoint:
                    etype = "METHOD" if current_class else "FUNCTION"
                    # Celery / other task special type check
                    if decorators:
                        for dec in decorators:
                            dec_text = get_node_text(dec).lower()
                            if "task" in dec_text:
                                etype = "HANDLER"
                    
                    result["functions"].append({"name": name, "line": line, "type": etype})

                # Recursively parse with function context
                old_func = current_function
                current_function = name
                for child in node.children:
                    analyze_node(child)
                current_function = old_func
                return

            elif node_type in ("call_expression", "call"):
                if len(node.children) > 0:
                    func_node = node.children[0]
                    func_text = get_node_text(func_node)
                    
                    caller_name = current_function
                    if current_class and current_function:
                        caller_name = f"{current_class}.{current_function}"
                    
                    call_type = "CALLS"
                    if "." in func_text:
                        call_type = "INVOKES"
                    
                    # Heuristic for class creation in Python: Callee name starts with uppercase
                    callee_base = func_text.split(".")[-1]
                    if callee_base and callee_base[0].isupper():
                        call_type = "CREATES"
                        
                    result["calls"].append({
                        "caller": caller_name,
                        "callee": func_text,
                        "line": line,
                        "type": call_type
                    })

                # Check for django path/re_path/url
                if len(node.children) > 1:
                    func_text = get_node_text(node.children[0])
                    if func_text in ("path", "re_path", "url"):
                        arg_list = node.children[1]
                        if arg_list.type == "argument_list" and len(arg_list.children) > 1:
                            first_arg = arg_list.children[1]
                            first_arg_text = get_node_text(first_arg)
                            if (first_arg_text.startswith("'") and first_arg_text.endswith("'")) or \
                               (first_arg_text.startswith('"') and first_arg_text.endswith('"')):
                                path = first_arg_text[1:-1]
                                view_name = "Django Route"
                                if len(arg_list.children) > 3:
                                    view_name = get_node_text(arg_list.children[3])
                                result["endpoints"].append({
                                    "name": view_name,
                                    "line": line,
                                    "type": "ENDPOINT",
                                    "path": path,
                                    "method": "ALL"
                                })
                                if "Django" not in result["frameworks"]:
                                    result["frameworks"].append("Django")

            elif node_type in ("import_statement", "import_from_statement"):
                text = get_node_text(node)
                result["imports"].append({"name": text, "line": line})
                self._detect_dependencies_from_import(text, result)

            for child in node.children:
                analyze_node(child)

        analyze_node(tree.root_node)
        return result

    def _detect_dependencies_from_import(self, text: str, result: dict):
        text_lower = text.lower()
        # FastAPI
        if "fastapi" in text_lower:
            result["frameworks"].append("FastAPI")
            result["dependencies"].append("fastapi")
        # Flask
        if "flask" in text_lower:
            result["frameworks"].append("Flask")
            result["dependencies"].append("flask")
        # Django
        if "django" in text_lower:
            result["frameworks"].append("Django")
            result["dependencies"].append("django")
        # Celery
        if "celery" in text_lower:
            result["frameworks"].append("Celery")
            result["dependencies"].append("celery")
        # SQLAlchemy
        if "sqlalchemy" in text_lower:
            result["frameworks"].append("SQLAlchemy")
            result["dependencies"].append("sqlalchemy")
        # MongoEngine
        if "mongoengine" in text_lower:
            result["frameworks"].append("MongoEngine")
            result["dependencies"].append("mongoengine")
        
        # ML Specialties
        if "torch" in text_lower:
            result["frameworks"].append("PyTorch")
            result["dependencies"].append("torch")
        if "tensorflow" in text_lower:
            result["frameworks"].append("TensorFlow")
            result["dependencies"].append("tensorflow")
        if "sklearn" in text_lower or "scikit" in text_lower:
            result["frameworks"].append("Scikit-learn")
            result["dependencies"].append("scikit-learn")
        if "langchain" in text_lower:
            result["frameworks"].append("LangChain")
            result["dependencies"].append("langchain")
        if "llama_index" in text_lower or "llamaindex" in text_lower:
            result["frameworks"].append("LlamaIndex")
            result["dependencies"].append("llama-index")
        if "ultralytics" in text_lower or "yolo" in text_lower:
            result["frameworks"].append("YOLO")
            result["dependencies"].append("ultralytics")

        # Cloud
        if "boto3" in text_lower or "botocore" in text_lower:
            result["frameworks"].append("AWS")
            result["dependencies"].append("boto3")
        if "azure" in text_lower:
            result["frameworks"].append("Azure")
            result["dependencies"].append("azure-core")
        if "google.cloud" in text_lower or "google-cloud" in text_lower:
            result["frameworks"].append("GCP")
            result["dependencies"].append("google-cloud-storage")
        if "firebase" in text_lower:
            result["frameworks"].append("Firebase")
            result["dependencies"].append("firebase-admin")

    def _fallback_regex(self, file_path: str, code_bytes: bytes, result: dict):
        text = code_bytes.decode('utf-8', errors='ignore')
        lines = text.splitlines()
        for idx, line in enumerate(lines, 1):
            line_strip = line.strip()
            # Imports
            if line_strip.startswith("import ") or line_strip.startswith("from "):
                result["imports"].append({"name": line_strip, "line": idx})
                self._detect_dependencies_from_import(line_strip, result)
            # Classes
            elif line_strip.startswith("class "):
                match = re.match(r'class\s+(\w+)', line_strip)
                if match:
                    name = match.group(1)
                    etype = "MODEL" if "model" in line_strip.lower() or "base" in line_strip.lower() else "CLASS"
                    result["classes"].append({"name": name, "line": idx, "type": etype})
            # Functions
            elif line_strip.startswith("def "):
                match = re.match(r'def\s+(\w+)', line_strip)
                if match:
                    name = match.group(1)
                    result["functions"].append({"name": name, "line": idx, "type": "FUNCTION"})
            # Fallback routes
            elif line_strip.startswith("@") and ("get(" in line_strip or "post(" in line_strip or "put(" in line_strip or "delete(" in line_strip or "patch(" in line_strip or "route(" in line_strip):
                match = re.search(r'@(?:[a-zA-Z0-9_]+\.)*(get|post|put|delete|patch|route)\s*\(\s*["\']([^"\']+)["\']', line_strip, re.IGNORECASE)
                if match:
                    method = match.group(1).upper()
                    path = match.group(2)
                    result["endpoints"].append({
                        "name": f"Route",
                        "line": idx,
                        "type": "ENDPOINT",
                        "path": path,
                        "method": method if method != "ROUTE" else "GET"
                    })
