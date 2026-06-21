# c:\Users\VICTUS\helix\backend\analyzers\csharp_analyzer.py

import re
from tree_sitter_languages import get_parser
from analyzers.base_analyzer import BaseAnalyzer

class CsharpAnalyzer(BaseAnalyzer):
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
            parser = get_parser("c_sharp")
            tree = parser.parse(code_bytes)
        except Exception:
            self._fallback_regex(file_path, code_bytes, result)
            return result

        current_class = None

        def get_node_text(node):
            return node.text.decode('utf-8', errors='ignore').strip()

        def get_identifier(node):
            for child in node.children:
                if child.type in ("identifier", "type_identifier"):
                    return get_node_text(child)
            return None

        def extract_attributes(node):
            attributes = []
            for child in node.children:
                if child.type == "attribute_list":
                    # Parse attributes inside [HttpGet("/path")] or [ApiController]
                    for attr in child.children:
                        if attr.type == "attribute":
                            attributes.append(get_node_text(attr))
            return attributes

        def parse_endpoint(attr_text):
            # Parse path from attributes like HttpGet("users"), Route("api/users")
            match = re.search(r'(HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch|Route)\s*\(\s*["\']([^"\']+)["\']', attr_text, re.IGNORECASE)
            if match:
                attr_name = match.group(1).upper()
                path = match.group(2)
                method = "GET"
                if "POST" in attr_name:
                    method = "POST"
                elif "PUT" in attr_name:
                    method = "PUT"
                elif "DELETE" in attr_name:
                    method = "DELETE"
                elif "PATCH" in attr_name:
                    method = "PATCH"
                elif "ROUTE" in attr_name:
                    method = "ALL"
                return method, path
            
            # Match HttpGet/HttpPost/etc. without parenthesis
            match_no_args = re.search(r'(HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch|Route)', attr_text, re.IGNORECASE)
            if match_no_args:
                attr_name = match_no_args.group(1).upper()
                method = "GET"
                if "POST" in attr_name:
                    method = "POST"
                elif "PUT" in attr_name:
                    method = "PUT"
                elif "DELETE" in attr_name:
                    method = "DELETE"
                elif "PATCH" in attr_name:
                    method = "PATCH"
                elif "ROUTE" in attr_name:
                    method = "ALL"
                return method, "/"
            return None

        def analyze_node(node):
            nonlocal current_class
            node_type = node.type
            line = node.start_point[0] + 1

            if node_type == "class_declaration":
                name = get_identifier(node) or "UnknownClass"
                attributes = extract_attributes(node)
                
                # Check base types/inheritance
                base_types = ""
                for child in node.children:
                    if child.type == "base_list":
                        base_types = get_node_text(child).lower()

                attr_str_lower = " ".join(attributes).lower()
                etype = "CLASS"
                
                if "controller" in base_types or "controller" in name.lower() or "apicontroller" in attr_str_lower:
                    etype = "CONTROLLER"
                    result["frameworks"].append("ASP.NET Core")
                elif "dbcontext" in base_types:
                    etype = "REPOSITORY"
                    result["frameworks"].append("Entity Framework")
                elif "repository" in base_types or "repository" in name.lower():
                    etype = "REPOSITORY"
                elif "entity" in name.lower() or "model" in name.lower() or "table" in attr_str_lower:
                    etype = "MODEL"
                elif "dto" in name.lower() or "request" in name.lower() or "response" in name.lower():
                    etype = "DTO"

                result["classes"].append({"name": name, "line": line, "type": etype})

                old_class = current_class
                current_class = name
                for child in node.children:
                    analyze_node(child)
                current_class = old_class
                return

            elif node_type == "interface_declaration":
                name = get_identifier(node) or "UnknownInterface"
                result["classes"].append({"name": name, "line": line, "type": "INTERFACE"})
                for child in node.children:
                    analyze_node(child)
                return

            elif node_type == "method_declaration":
                name = get_identifier(node) or "UnknownMethod"
                attributes = extract_attributes(node)

                # Check HttpGet / Route endpoints
                is_endpoint = False
                for attr in attributes:
                    ep_info = parse_endpoint(attr)
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

            elif node_type == "using_directive":
                text = get_node_text(node)
                # e.g. using Microsoft.AspNetCore.Mvc;
                match = re.match(r'using\s+([\w\.]+);', text)
                if match:
                    namespace = match.group(1)
                    result["imports"].append({"name": namespace, "line": line})
                    self._detect_dependencies_from_import(namespace, result)

            for child in node.children:
                analyze_node(child)

        analyze_node(tree.root_node)
        return result

    def _detect_dependencies_from_import(self, text: str, result: dict):
        text_lower = text.lower()
        if "microsoft.aspnetcore" in text_lower:
            result["frameworks"].append("ASP.NET Core")
            result["dependencies"].append("Microsoft.AspNetCore")
        if "entityframeworkcore" in text_lower:
            result["frameworks"].append("Entity Framework")
            result["dependencies"].append("Microsoft.EntityFrameworkCore")
        if "components" in text_lower and "web" in text_lower:
            result["frameworks"].append("Blazor")

    def _fallback_regex(self, file_path: str, code_bytes: bytes, result: dict):
        text = code_bytes.decode('utf-8', errors='ignore')
        lines = text.splitlines()
        for idx, line in enumerate(lines, 1):
            line_strip = line.strip()
            if line_strip.startswith("using ") and line_strip.endswith(";"):
                ns = line_strip.replace("using ", "").replace(";", "").strip()
                result["imports"].append({"name": ns, "line": idx})
                self._detect_dependencies_from_import(ns, result)
            elif "class " in line_strip:
                match = re.search(r'class\s+(\w+)', line_strip)
                if match:
                    name = match.group(1)
                    etype = "CLASS"
                    if "controller" in name.lower() or "controller" in line_strip.lower():
                        etype = "CONTROLLER"
                    elif "repository" in name.lower():
                        etype = "REPOSITORY"
                    elif "entity" in name.lower():
                        etype = "MODEL"
                    result["classes"].append({"name": name, "line": idx, "type": etype})
            elif "(" in line_strip and ")" in line_strip and not line_strip.endswith(";"):
                # Method declaration heuristic
                match = re.search(r'(?:public|private|protected|internal)\s+(?:\w+)\s+(\w+)\s*\(', line_strip)
                if match:
                    name = match.group(1)
                    if name not in ("if", "for", "while", "switch", "catch"):
                        result["functions"].append({"name": name, "line": idx, "type": "METHOD"})
