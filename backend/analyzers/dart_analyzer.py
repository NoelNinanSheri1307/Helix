# c:\Users\VICTUS\helix\backend\analyzers\dart_analyzer.py

import re
from analyzers.base_analyzer import BaseAnalyzer

class DartAnalyzer(BaseAnalyzer):
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

        text = code_bytes.decode('utf-8', errors='ignore')
        lines = text.splitlines()

        in_multiline_comment = False
        current_class = None
        current_function = None
        class_brace_depth = -1
        func_brace_depth = -1
        brace_depth = 0

        for idx, line in enumerate(lines, 1):
            line_strip = line.strip()

            # Handle comments
            if in_multiline_comment:
                if "*/" in line_strip:
                    in_multiline_comment = False
                continue
            if line_strip.startswith("/*"):
                if "*/" not in line_strip:
                    in_multiline_comment = True
                continue
            if line_strip.startswith("//"):
                continue

            # Parse calls inside function bodies
            if current_function and brace_depth > func_brace_depth:
                calls_found = re.findall(r'\b([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)\s*\(', line_strip)
                for callee in calls_found:
                    if callee in ("if", "for", "while", "switch", "catch", "super", "print", "Widget", "void", "dynamic", "await", "return"):
                        continue
                    
                    call_type = "CALLS"
                    if "." in callee:
                        call_type = "INVOKES"
                    
                    callee_base = callee.split(".")[-1]
                    if callee_base and callee_base[0].isupper() and callee_base != current_class:
                        call_type = "CREATES"
                        
                    caller_name = current_function
                    if current_class:
                        caller_name = f"{current_class}.{current_function}"
                        
                    result["calls"].append({
                        "caller": caller_name,
                        "callee": callee,
                        "line": idx,
                        "type": call_type
                    })

            # 1. Detect Imports
            if line_strip.startswith("import ") or line_strip.startswith("export "):
                match = re.match(r'(?:import|export)\s+[\'"]([^\'"]+)[\'"]', line_strip)
                if match:
                    imp_path = match.group(1)
                    result["imports"].append({"name": line_strip.replace(";", "").strip(), "line": idx})
                    self._detect_dependencies_from_import(imp_path, result)

            # 2. Detect Classes (Widgets, Screens, Providers, Models)
            elif "class " in line_strip and not line_strip.endswith(";"):
                match = re.search(r'class\s+(\w+)(?:\s+(?:extends|implements|with|on)\s+([\w\s,<>\?]+))?', line_strip)
                if match:
                    class_name = match.group(1)
                    extends_clause = match.group(2) or ""
                    extends_clause_clean = extends_clause.replace(" ", "")

                    etype = "CLASS"
                    
                    # Detect Flutter Widgets / Screens
                    if any(w in extends_clause_clean for w in ["StatelessWidget", "StatefulWidget", "ConsumerWidget", "HookWidget", "State"]):
                        result["frameworks"].append("Flutter")
                        if any(s in class_name.lower() for s in ["screen", "page", "view", "route", "tab"]):
                            etype = "SCREEN"
                        else:
                            etype = "WIDGET"
                    
                    # Detect State Managers / Providers
                    elif any(p in extends_clause_clean for p in ["ChangeNotifier", "Notifier", "StateNotifier", "Bloc", "Cubit", "GetxController", "Controller"]):
                        etype = "PROVIDER"
                        if "Bloc" in extends_clause_clean or "Cubit" in extends_clause_clean:
                            result["frameworks"].append("Bloc")
                        elif "Getx" in extends_clause_clean:
                            result["frameworks"].append("GetX")
                        elif "Notifier" in extends_clause_clean:
                            result["frameworks"].append("Riverpod")
                        else:
                            result["frameworks"].append("Provider")
                    
                    # Detect Models
                    elif "model" in class_name.lower() or "dto" in class_name.lower():
                        etype = "MODEL"

                    result["classes"].append({
                        "name": class_name,
                        "line": idx,
                        "type": etype
                    })

                    current_class = class_name
                    class_brace_depth = brace_depth

            # 3. Detect Functions / Methods
            elif "(" in line_strip and ")" in line_strip and "{" in line_strip and not any(k in line_strip for k in ["class ", "if ", "for ", "while ", "switch ", "catch "]):
                # Match method definition e.g. Widget build(BuildContext context) or void init()
                match = re.search(r'(?:\w+)?\s+(\w+)\s*\(', line_strip)
                if match:
                    func_name = match.group(1)
                    if func_name not in ("super", "print", "Widget", "void", "dynamic", "if", "for", "while", "switch", "catch"):
                        result["functions"].append({
                            "name": func_name,
                            "line": idx,
                            "type": "METHOD"
                        })
                        current_function = func_name
                        func_brace_depth = brace_depth

            # 4. Route / Endpoint Detection
            # Static routeName in widgets or mapping: e.g. static const String routeName = '/login';
            route_match = re.search(r'(?:routeName|route|path)\s*=\s*[\'"]([^\'"]+)[\'"]', line_strip, re.IGNORECASE)
            if route_match:
                route_path = route_match.group(1)
                if route_path.startswith("/"):
                    result["endpoints"].append({
                        "name": f"Route: {route_path}",
                        "line": idx,
                        "type": "ENDPOINT",
                        "path": route_path,
                        "method": "ROUTE"
                    })

            # Update brace depth
            brace_depth += line_strip.count("{") - line_strip.count("}")
            if brace_depth <= func_brace_depth:
                current_function = None
                func_brace_depth = -1
            if brace_depth <= class_brace_depth:
                current_class = None
                class_brace_depth = -1

        # Deduplicate frameworks
        result["frameworks"] = list(set(result["frameworks"]))
        result["dependencies"] = list(set(result["dependencies"]))
        return result

    def _detect_dependencies_from_import(self, imp_path: str, result: dict):
        if imp_path.startswith("package:flutter/"):
            result["frameworks"].append("Flutter")
        elif imp_path.startswith("package:flutter_riverpod/") or "riverpod" in imp_path:
            result["frameworks"].append("Riverpod")
            result["dependencies"].append("flutter_riverpod")
        elif imp_path.startswith("package:provider/") or "provider" in imp_path:
            result["frameworks"].append("Provider")
            result["dependencies"].append("provider")
        elif imp_path.startswith("package:flutter_bloc/") or "bloc" in imp_path:
            result["frameworks"].append("Bloc")
            result["dependencies"].append("flutter_bloc")
        elif imp_path.startswith("package:get/") or "get" in imp_path:
            result["frameworks"].append("GetX")
            result["dependencies"].append("get")
        elif imp_path.startswith("package:firebase_core/") or "firebase" in imp_path:
            result["frameworks"].append("Firebase")
            result["dependencies"].append("firebase_core")
