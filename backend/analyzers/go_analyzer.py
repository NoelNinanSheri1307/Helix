# c:\Users\VICTUS\helix\backend\analyzers\go_analyzer.py

import re
from tree_sitter_languages import get_parser
from analyzers.base_analyzer import BaseAnalyzer

class GoAnalyzer(BaseAnalyzer):
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
            parser = get_parser("go")
            tree = parser.parse(code_bytes)
        except Exception:
            self._fallback_regex(file_path, code_bytes, result)
            return result

        current_class = None
        current_function = None

        def get_node_text(node):
            return node.text.decode('utf-8', errors='ignore').strip()

        def get_identifier(node):
            for child in node.children:
                if child.type in ("identifier", "field_identifier", "type_identifier"):
                    return get_node_text(child)
            return None

        def analyze_node(node):
            nonlocal current_class, current_function
            node_type = node.type
            line = node.start_point[0] + 1

            if node_type == "type_spec":
                # e.g. type User struct { ... }
                name = get_identifier(node) or "UnknownStruct"
                
                # Check if it defines a struct
                is_struct = False
                is_gorm_model = False
                for child in node.children:
                    if child.type == "struct_type":
                        is_struct = True
                        struct_text = get_node_text(child).lower()
                        if "gorm" in struct_text or "db:" in struct_text or "json:" in struct_text:
                            is_gorm_model = True
                
                if is_struct:
                    etype = "MODEL" if is_gorm_model else "CLASS"
                    result["classes"].append({"name": name, "line": line, "type": etype})

            elif node_type in ("function_declaration", "method_declaration"):
                name = get_identifier(node) or "UnknownFunc"
                
                receiver_type = None
                if node_type == "method_declaration":
                    # receiver is the first parameter_list child
                    param_lists = [child for child in node.children if child.type == "parameter_list"]
                    if param_lists:
                        rec_list = param_lists[0]
                        rec_text = get_node_text(rec_list).strip("()")
                        # match pointer type or simple type
                        match_rec = re.search(r'(?:\*\s*)?(\w+)\s*$', rec_text)
                        if match_rec:
                            receiver_type = match_rec.group(1)
                
                # Check parameters (it will be the second parameter_list for methods, or first for functions)
                params_text = ""
                param_lists = [child for child in node.children if child.type == "parameter_list"]
                if param_lists:
                    if node_type == "method_declaration" and len(param_lists) > 1:
                        params_text = get_node_text(param_lists[1]).lower()
                    else:
                        params_text = get_node_text(param_lists[0]).lower()

                etype = "FUNCTION"
                if "gin.context" in params_text or "fiber.ctx" in params_text or "echo.context" in params_text or "http.responsewriter" in params_text:
                    etype = "HANDLER"
                    if "gin.context" in params_text:
                        result["frameworks"].append("Gin")
                    elif "fiber.ctx" in params_text:
                        result["frameworks"].append("Fiber")
                    elif "echo.context" in params_text:
                        result["frameworks"].append("Echo")
                elif node_type == "method_declaration":
                    etype = "METHOD"
                    
                result["functions"].append({"name": name, "line": line, "type": etype})

                old_class = current_class
                old_func = current_function
                current_class = receiver_type
                current_function = name

                for child in node.children:
                    analyze_node(child)

                current_function = old_func
                current_class = old_class
                return

            elif node_type == "import_spec":
                text = get_node_text(node)
                # Cleanup quotes
                text_clean = text.replace('"', '').strip()
                result["imports"].append({"name": text_clean, "line": line})
                self._detect_dependencies_from_import(text_clean, result)

            elif node_type == "call_expression":
                # Route registration/general calls
                text = get_node_text(node)
                match = re.search(r'\w+\.(GET|POST|PUT|DELETE|PATCH|Use|Group)\s*\(\s*["\']([^"\']+)["\']', text, re.IGNORECASE)
                if match:
                    method = match.group(1).upper()
                    path = match.group(2)
                    result["endpoints"].append({
                        "name": f"Go Route",
                        "line": line,
                        "type": "ENDPOINT",
                        "path": path,
                        "method": method
                    })
                else:
                    match_handle = re.search(r'\w+\.(Handle|HandleFunc)\s*\(\s*(?:["\'](GET|POST|PUT|DELETE|PATCH)["\']\s*,\s*)?["\']([^"\']+)["\']', text, re.IGNORECASE)
                    if match_handle:
                        method = match_handle.group(2) or "ALL"
                        path = match_handle.group(3)
                        result["endpoints"].append({
                            "name": f"Go Route",
                            "line": line,
                            "type": "ENDPOINT",
                            "path": path,
                            "method": method.upper()
                        })

                if len(node.children) > 0:
                    func_node = node.children[0]
                    func_text = get_node_text(func_node)
                    
                    caller_name = current_function
                    if current_class and current_function:
                        caller_name = f"{current_class}.{current_function}"
                        
                    call_type = "CALLS"
                    if "." in func_text:
                        call_type = "INVOKES"
                    
                    if caller_name:
                        result["calls"].append({
                            "caller": caller_name,
                            "callee": func_text,
                            "line": line,
                            "type": call_type
                        })

            for child in node.children:
                analyze_node(child)

        analyze_node(tree.root_node)
        return result

    def _detect_dependencies_from_import(self, text: str, result: dict):
        text_lower = text.lower()
        if "github.com/gin-gonic/gin" in text_lower:
            result["frameworks"].append("Gin")
            result["dependencies"].append("github.com/gin-gonic/gin")
        if "github.com/gofiber/fiber" in text_lower:
            result["frameworks"].append("Fiber")
            result["dependencies"].append("github.com/gofiber/fiber")
        if "github.com/labstack/echo" in text_lower:
            result["frameworks"].append("Echo")
            result["dependencies"].append("github.com/labstack/echo")
        if "gorm.io/gorm" in text_lower:
            result["frameworks"].append("Gorm")
            result["dependencies"].append("gorm.io/gorm")
        
        # Databases
        if "github.com/go-redis/redis" in text_lower:
            result["frameworks"].append("Redis")
        if "go.mongodb.org/mongo-driver" in text_lower:
            result["frameworks"].append("MongoDB")
        if "postgres" in text_lower or "pq" in text_lower:
            result["frameworks"].append("PostgreSQL")
        if "mysql" in text_lower:
            result["frameworks"].append("MySQL")
        if "sqlite" in text_lower:
            result["frameworks"].append("SQLite")

    def _fallback_regex(self, file_path: str, code_bytes: bytes, result: dict):
        text = code_bytes.decode('utf-8', errors='ignore')
        lines = text.splitlines()
        for idx, line in enumerate(lines, 1):
            line_strip = line.strip()
            if line_strip.startswith("import "):
                imp = line_strip.replace("import ", "").replace('"', '').strip()
                result["imports"].append({"name": imp, "line": idx})
                self._detect_dependencies_from_import(imp, result)
            elif line_strip.startswith("type ") and " struct {" in line_strip:
                match = re.search(r'type\s+(\w+)\s+struct', line_strip)
                if match:
                    name = match.group(1)
                    etype = "MODEL" if "model" in name.lower() or "db" in name.lower() else "CLASS"
                    result["classes"].append({"name": name, "line": idx, "type": etype})
            elif line_strip.startswith("func "):
                match = re.search(r'func\s+(?:\([^\)]+\)\s+)?(\w+)\s*\(', line_strip)
                if match:
                    name = match.group(1)
                    if name not in ("if", "for", "while", "switch", "catch"):
                        etype = "FUNCTION"
                        if "context" in line_strip.lower() or "ctx" in line_strip.lower() or "responsewriter" in line_strip.lower():
                            etype = "HANDLER"
                        result["functions"].append({"name": name, "line": idx, "type": etype})
