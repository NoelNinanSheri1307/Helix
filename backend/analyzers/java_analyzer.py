# c:\Users\VICTUS\helix\backend\analyzers\java_analyzer.py

import re
from tree_sitter_languages import get_parser
from analyzers.base_analyzer import BaseAnalyzer

class JavaAnalyzer(BaseAnalyzer):
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
            parser = get_parser("java")
            tree = parser.parse(code_bytes)
        except Exception:
            self._fallback_regex(file_path, code_bytes, result)
            return result

        current_class = None
        class_annotations = {}

        def get_node_text(node):
            return node.text.decode('utf-8', errors='ignore').strip()

        def get_identifier(node):
            for child in node.children:
                if child.type in ("identifier", "type_identifier"):
                    return get_node_text(child)
            return None

        def extract_annotations(node):
            annotations = []
            # Annotations are typically inside a modifiers block
            modifiers_node = None
            for child in node.children:
                if child.type == "modifiers":
                    modifiers_node = child
                    break
            
            if modifiers_node:
                for ann in modifiers_node.children:
                    if ann.type in ("marker_annotation", "annotation"):
                        annotations.append(get_node_text(ann))
            else:
                # Sometime annotations are direct siblings/children in older tree-sitter versions
                for child in node.children:
                    if child.type in ("marker_annotation", "annotation"):
                        annotations.append(get_node_text(child))
            return annotations

        def parse_endpoint(ann_text):
            # Parse path from annotations like @GetMapping("/path") or @RequestMapping(value = "/path")
            match = re.search(r'@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*\(\s*(?:value\s*=\s*)?["\']([^"\']+)["\']', ann_text, re.IGNORECASE)
            if match:
                ann_name = match.group(1).upper()
                path = match.group(2)
                method = "GET"
                if "POST" in ann_name:
                    method = "POST"
                elif "PUT" in ann_name:
                    method = "PUT"
                elif "DELETE" in ann_name:
                    method = "DELETE"
                elif "PATCH" in ann_name:
                    method = "PATCH"
                elif "REQUEST" in ann_name:
                    method = "ALL"
                return method, path
            
            # Annotation without path
            match_no_args = re.search(r'@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)', ann_text, re.IGNORECASE)
            if match_no_args:
                ann_name = match_no_args.group(1).upper()
                method = "GET"
                if "POST" in ann_name:
                    method = "POST"
                elif "PUT" in ann_name:
                    method = "PUT"
                elif "DELETE" in ann_name:
                    method = "DELETE"
                elif "PATCH" in ann_name:
                    method = "PATCH"
                elif "REQUEST" in ann_name:
                    method = "ALL"
                return method, "/"
            return None

        def analyze_node(node):
            nonlocal current_class
            node_type = node.type
            line = node.start_point[0] + 1

            if node_type == "class_declaration":
                name = get_identifier(node) or "UnknownClass"
                annotations = extract_annotations(node)
                class_annotations[name] = annotations

                # Categorize class based on Spring annotations & name patterns
                ann_str_lower = " ".join(annotations).lower()
                
                etype = "CLASS"
                if "restcontroller" in ann_str_lower or "controller" in ann_str_lower:
                    etype = "CONTROLLER"
                    result["frameworks"].append("Spring Boot")
                elif "service" in ann_str_lower:
                    etype = "SERVICE"
                    result["frameworks"].append("Spring Boot")
                elif "repository" in ann_str_lower or "repository" in name.lower():
                    etype = "REPOSITORY"
                    result["frameworks"].append("Spring Boot")
                elif "entity" in ann_str_lower or "table" in ann_str_lower:
                    etype = "ENTITY"
                    result["frameworks"].append("Hibernate")
                elif "dto" in name.lower() or "request" in name.lower() or "response" in name.lower() or "payload" in name.lower():
                    etype = "DTO"

                result["classes"].append({"name": name, "line": line, "type": etype})

                old_class = current_class
                current_class = name
                for child in node.children:
                    analyze_node(child)
                current_class = old_class
                return

            elif node_type == "method_declaration":
                name = get_identifier(node) or "UnknownMethod"
                annotations = extract_annotations(node)

                # Check if this method maps to an endpoint
                is_endpoint = False
                for ann in annotations:
                    ep_info = parse_endpoint(ann)
                    if ep_info:
                        method, path = ep_info
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
                    result["functions"].append({
                        "name": name,
                        "line": line,
                        "type": "METHOD"
                    })

            elif node_type == "import_declaration":
                text = get_node_text(node)
                if text.endswith(";"):
                    text = text[:-1]
                result["imports"].append({"name": text, "line": line})
                self._detect_dependencies_from_import(text, result)

            for child in node.children:
                analyze_node(child)

        analyze_node(tree.root_node)
        return result

    def _detect_dependencies_from_import(self, text: str, result: dict):
        text_lower = text.lower()
        if "org.springframework.boot" in text_lower:
            result["frameworks"].append("Spring Boot")
            result["dependencies"].append("spring-boot-starter")
        if "org.springframework.security" in text_lower:
            result["frameworks"].append("Spring Security")
            result["dependencies"].append("spring-security")
        if "org.hibernate" in text_lower or "jakarta.persistence" in text_lower or "javax.persistence" in text_lower:
            result["frameworks"].append("Hibernate")
            result["dependencies"].append("hibernate-core")

    def _fallback_regex(self, file_path: str, code_bytes: bytes, result: dict):
        text = code_bytes.decode('utf-8', errors='ignore')
        lines = text.splitlines()
        current_class = None
        for idx, line in enumerate(lines, 1):
            line_strip = line.strip()
            if line_strip.startswith("import "):
                imp = line_strip.replace("import ", "").replace(";", "").strip()
                result["imports"].append({"name": imp, "line": idx})
                self._detect_dependencies_from_import(imp, result)
            elif "class " in line_strip and not line_strip.endswith(";"):
                match = re.search(r'class\s+(\w+)', line_strip)
                if match:
                    name = match.group(1)
                    etype = "CLASS"
                    if "controller" in line_strip.lower() or "controller" in lines[max(0, idx-3):idx]:
                        etype = "CONTROLLER"
                    elif "service" in line_strip.lower():
                        etype = "SERVICE"
                    elif "repository" in line_strip.lower():
                        etype = "REPOSITORY"
                    elif "entity" in line_strip.lower():
                        etype = "ENTITY"
                    elif "dto" in name.lower():
                        etype = "DTO"
                    result["classes"].append({"name": name, "line": idx, "type": etype})
            elif "public " in line_strip and "(" in line_strip and ")" in line_strip and not line_strip.endswith(";"):
                match = re.search(r'\s+(\w+)\s*\(', line_strip)
                if match:
                    name = match.group(1)
                    if name not in ("if", "for", "while", "switch", "catch"):
                        result["functions"].append({"name": name, "line": idx, "type": "METHOD"})
