# c:\Users\VICTUS\helix\backend\analyzers\javascript_analyzer.py

import re
from tree_sitter_languages import get_parser
from analyzers.base_analyzer import BaseAnalyzer

class JavascriptAnalyzer(BaseAnalyzer):
    def analyze(self, file_path: str, code_bytes: bytes, language: str) -> dict:
        result = {
            "classes": [],
            "functions": [],
            "imports": [],
            "endpoints": [],
            "frameworks": [],
            "dependencies": []
        }

        try:
            parser = get_parser(language)
            tree = parser.parse(code_bytes)
        except Exception:
            self._fallback_regex(file_path, code_bytes, result)
            return result

        current_class = None

        def get_node_text(node):
            return node.text.decode('utf-8', errors='ignore').strip()

        def get_identifier(node):
            for child in node.children:
                if child.type in ("identifier", "property_identifier", "type_identifier"):
                    return get_node_text(child)
            return None

        # Next.js API route detection based on file path
        normalized_path = file_path.replace("\\", "/").lower()
        is_next_api = "/pages/api/" in normalized_path or "/app/api/" in normalized_path

        def analyze_node(node):
            nonlocal current_class
            node_type = node.type
            line = node.start_point[0] + 1

            if node_type in ("class_declaration", "class"):
                name = get_identifier(node) or "UnknownClass"
                etype = "CLASS"
                
                # Check decorators (NestJS)
                # In TS/JS decorators might appear before class
                text_before = ""
                if node.prev_sibling and node.prev_sibling.type == "decorator":
                    text_before = get_node_text(node.prev_sibling)
                
                if "@Controller" in text_before or "controller" in name.lower():
                    etype = "CONTROLLER"
                    result["frameworks"].append("NestJS")
                elif "@Injectable" in text_before or "service" in name.lower():
                    etype = "SERVICE"
                    result["frameworks"].append("NestJS")
                elif "repository" in name.lower():
                    etype = "REPOSITORY"

                result["classes"].append({"name": name, "line": line, "type": etype})

                old_class = current_class
                current_class = name
                for child in node.children:
                    analyze_node(child)
                current_class = old_class
                return

            elif node_type in ("function_declaration", "function"):
                name = get_identifier(node) or "UnknownFunction"
                
                # Categorize function
                etype = "FUNCTION"
                if name.startswith("use") and len(name) > 3 and name[3].isupper():
                    etype = "HOOK"
                    result["frameworks"].append("React")
                elif name[0].isupper() and (language == "typescript" or ".jsx" in file_path or ".tsx" in file_path or "react" in "".join([x["name"] for x in result["imports"]]).lower()):
                    etype = "COMPONENT"
                    result["frameworks"].append("React")

                result["functions"].append({"name": name, "line": line, "type": etype})

            elif node_type == "variable_declarator":
                # Check for arrow function components/hooks: const MyComponent = () => {}
                name = get_identifier(node)
                if name:
                    is_arrow_fn = False
                    for child in node.children:
                        if child.type in ("arrow_function", "function_expression"):
                            is_arrow_fn = True
                            break
                    if is_arrow_fn:
                        etype = "FUNCTION"
                        if name.startswith("use") and len(name) > 3 and name[3].isupper():
                            etype = "HOOK"
                            result["frameworks"].append("React")
                        elif name[0].isupper() and (".jsx" in file_path or ".tsx" in file_path or "react" in "".join([x["name"] for x in result["imports"]]).lower()):
                            etype = "COMPONENT"
                            result["frameworks"].append("React")
                        
                        result["functions"].append({"name": name, "line": line, "type": etype})

            elif node_type == "import_statement":
                text = get_node_text(node)
                result["imports"].append({"name": text, "line": line})
                self._detect_dependencies_from_import(text, result)

            elif node_type == "call_expression":
                # Express route detection: app.get('/path', ...), router.post(...)
                text = get_node_text(node)
                match = re.match(r'(?:app|router|server)\.(get|post|put|delete|patch|use)\s*\(\s*["\']([^"\']+)["\']', text, re.IGNORECASE)
                if match:
                    method = match.group(1).upper()
                    path = match.group(2)
                    result["endpoints"].append({
                        "name": f"Express Route",
                        "line": line,
                        "type": "ENDPOINT",
                        "path": path,
                        "method": method
                    })
                    result["frameworks"].append("Express")

            # NestJS method decorators for endpoints
            elif node_type == "method_definition":
                name = get_identifier(node) or "UnknownMethod"
                # Check decorators
                decorators = []
                for child in node.children:
                    if child.type == "decorator":
                        decorators.append(get_node_text(child))
                
                is_endpoint = False
                for dec in decorators:
                    match = re.match(r'@(Get|Post|Put|Delete|Patch)\s*\(\s*(?:["\']([^"\']+)["\'])?', dec, re.IGNORECASE)
                    if match:
                        method = match.group(1).upper()
                        path = match.group(2) or "/"
                        result["endpoints"].append({
                            "name": name,
                            "line": line,
                            "type": "ENDPOINT",
                            "path": path,
                            "method": method
                        })
                        is_endpoint = True
                        result["frameworks"].append("NestJS")
                        break
                
                if not is_endpoint:
                    result["functions"].append({
                        "name": name,
                        "line": line,
                        "type": "METHOD"
                    })

            for child in node.children:
                analyze_node(child)

        analyze_node(tree.root_node)

        # Handle Next.js page exports as entry points / endpoints
        if is_next_api and not result["endpoints"]:
            # Default fallback Next.js handler
            result["endpoints"].append({
                "name": "Handler",
                "line": 1,
                "type": "ENDPOINT",
                "path": file_path.replace("\\", "/").split("/pages")[-1].split("/app")[-1].replace("route.js", "").replace("route.ts", "").replace(".js", "").replace(".ts", ""),
                "method": "ALL"
            })
            result["frameworks"].append("Next.js")

        return result

    def _detect_dependencies_from_import(self, text: str, result: dict):
        text_lower = text.lower()
        if "react" in text_lower:
            result["frameworks"].append("React")
            result["dependencies"].append("react")
        if "next" in text_lower:
            result["frameworks"].append("Next.js")
            result["dependencies"].append("next")
        if "express" in text_lower:
            result["frameworks"].append("Express")
            result["dependencies"].append("express")
        if "nestjs" in text_lower:
            result["frameworks"].append("NestJS")
            result["dependencies"].append("@nestjs/core")
        if "vue" in text_lower:
            result["frameworks"].append("Vue")
            result["dependencies"].append("vue")
        if "nuxt" in text_lower:
            result["frameworks"].append("Nuxt")
            result["dependencies"].append("nuxt")
        if "angular" in text_lower:
            result["frameworks"].append("Angular")
            result["dependencies"].append("@angular/core")
        if "svelte" in text_lower:
            result["frameworks"].append("Svelte")
            result["dependencies"].append("svelte")
        if "electron" in text_lower:
            result["frameworks"].append("Electron")
            result["dependencies"].append("electron")
        
        # Cloud / DB specialties
        if "firebase" in text_lower:
            result["frameworks"].append("Firebase")
            result["dependencies"].append("firebase")
        if "aws-sdk" in text_lower or "@aws-sdk" in text_lower:
            result["frameworks"].append("AWS")
            result["dependencies"].append("@aws-sdk/client-s3")

    def _fallback_regex(self, file_path: str, code_bytes: bytes, result: dict):
        text = code_bytes.decode('utf-8', errors='ignore')
        lines = text.splitlines()
        for idx, line in enumerate(lines, 1):
            line_strip = line.strip()
            if line_strip.startswith("import ") or "require(" in line_strip:
                result["imports"].append({"name": line_strip, "line": idx})
                self._detect_dependencies_from_import(line_strip, result)
            elif "class " in line_strip:
                match = re.search(r'class\s+(\w+)', line_strip)
                if match:
                    name = match.group(1)
                    etype = "CLASS"
                    if "controller" in name.lower() or "controller" in line_strip.lower():
                        etype = "CONTROLLER"
                    elif "service" in name.lower():
                        etype = "SERVICE"
                    result["classes"].append({"name": name, "line": idx, "type": etype})
            elif "function " in line_strip or "=>" in line_strip:
                match = re.search(r'function\s+(\w+)', line_strip)
                if not match and "=" in line_strip:
                    match = re.search(r'(?:const|let|var)\s+(\w+)\s*=\s*', line_strip)
                
                if match:
                    name = match.group(1)
                    if name not in ("if", "for", "while", "switch", "catch"):
                        etype = "FUNCTION"
                        if name.startswith("use") and len(name) > 3 and name[3].isupper():
                            etype = "HOOK"
                        elif name[0].isupper() and (".jsx" in file_path or ".tsx" in file_path):
                            etype = "COMPONENT"
                        result["functions"].append({"name": name, "line": idx, "type": etype})
