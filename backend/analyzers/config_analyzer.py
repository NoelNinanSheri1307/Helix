# c:\Users\VICTUS\helix\backend\analyzers\config_analyzer.py

import re
from analyzers.base_analyzer import BaseAnalyzer

class ConfigAnalyzer(BaseAnalyzer):
    def analyze(self, file_path: str, code_bytes: bytes, language: str) -> dict:
        result = {
            "classes": [],
            "functions": [],
            "imports": [],
            "endpoints": [],
            "frameworks": [],
            "dependencies": []
        }

        filename = file_path.split("/")[-1].split("\\")[-1]
        text = code_bytes.decode('utf-8', errors='ignore')
        lines = text.splitlines()

        # 1. Docker Detection
        if filename.lower() == "dockerfile" or filename.lower().endswith(".dockerfile"):
            result["frameworks"].append("Docker")
            for idx, line in enumerate(lines, 1):
                line_strip = line.strip()
                if line_strip.startswith("FROM "):
                    container = line_strip.replace("FROM ", "").strip()
                    result["classes"].append({"name": container, "line": idx, "type": "CONTAINER"})
                elif line_strip.startswith("EXPOSE "):
                    port = line_strip.replace("EXPOSE ", "").strip()
                    result["classes"].append({"name": port, "line": idx, "type": "PORT"})
                elif line_strip.startswith("VOLUME "):
                    volume = line_strip.replace("VOLUME ", "").strip()
                    result["classes"].append({"name": volume, "line": idx, "type": "VOLUME"})

        elif filename.lower() in ("docker-compose.yml", "docker-compose.yaml", "compose.yaml", "compose.yml"):
            result["frameworks"].append("Docker Compose")
            in_services = False
            current_service = None
            for idx, line in enumerate(lines, 1):
                line_strip = line.strip()
                # Check indentation level (approximate via spaces)
                leading_spaces = len(line) - len(line.lstrip(' '))
                
                if line_strip.startswith("services:"):
                    in_services = True
                    continue
                elif leading_spaces == 0 and line_strip and not line_strip.startswith("#"):
                    in_services = False
                
                if in_services:
                    if leading_spaces == 2 and line_strip.endswith(":"):
                        current_service = line_strip[:-1].strip()
                        result["classes"].append({"name": current_service, "line": idx, "type": "SERVICE"})
                    elif leading_spaces >= 4:
                        if line_strip.startswith("image:"):
                            img = line_strip.replace("image:", "").strip()
                            result["classes"].append({"name": f"{current_service or 'service'} image: {img}", "line": idx, "type": "CONTAINER"})
                        elif line_strip.startswith("- ") and current_service:
                            if ":" in line_strip:
                                # Could be port or volume mapping
                                if re.search(r'\d+:\d+', line_strip):
                                    result["classes"].append({"name": f"{current_service} port: {line_strip[2:].strip()}", "line": idx, "type": "PORT"})
                                else:
                                    result["classes"].append({"name": f"{current_service} volume: {line_strip[2:].strip()}", "line": idx, "type": "VOLUME"})

        # 2. Kubernetes Detection
        elif filename.lower().endswith(".yaml") or filename.lower().endswith(".yml"):
            # Check for K8s keys
            content_lower = text.lower()
            if "apiversion:" in content_lower and "kind:" in content_lower:
                result["frameworks"].append("Kubernetes")
                current_kind = "K8s"
                for idx, line in enumerate(lines, 1):
                    line_strip = line.strip()
                    if line_strip.startswith("kind:"):
                        current_kind = line_strip.replace("kind:", "").strip()
                    elif line_strip.startswith("name:"):
                        name = line_strip.replace("name:", "").strip()
                        etype = "KUBERNETES"
                        kind_upper = current_kind.upper()
                        if "DEPLOYMENT" in kind_upper:
                            etype = "DEPLOYMENT"
                        elif "SERVICE" in kind_upper:
                            etype = "SERVICE"
                        elif "INGRESS" in kind_upper:
                            etype = "INGRESS"
                        elif "POD" in kind_upper:
                            etype = "POD"
                        result["classes"].append({"name": f"{current_kind}: {name}", "line": idx, "type": etype})

        # 3. Terraform Detection
        elif filename.lower().endswith(".tf"):
            result["frameworks"].append("Terraform")
            for idx, line in enumerate(lines, 1):
                line_strip = line.strip()
                match = re.match(r'resource\s+"([^"]+)"\s+"([^"]+)"', line_strip)
                if match:
                    res_type, res_name = match.groups()
                    result["classes"].append({"name": f"{res_type}.{res_name}", "line": idx, "type": "INFRASTRUCTURE"})
                provider_match = re.match(r'provider\s+"([^"]+)"', line_strip)
                if provider_match:
                    prov = provider_match.group(1)
                    if prov.lower() == "aws":
                        result["frameworks"].append("AWS")
                    elif prov.lower() == "google":
                        result["frameworks"].append("GCP")
                    elif prov.lower() == "azurerm":
                        result["frameworks"].append("Azure")

        # 4. Ansible Playbook Detection
        elif "hosts:" in text and ("tasks:" in text or "roles:" in text) and (filename.lower().endswith(".yml") or filename.lower().endswith(".yaml")):
            result["frameworks"].append("Ansible")
            for idx, line in enumerate(lines, 1):
                line_strip = line.strip()
                if line_strip.startswith("- name:") or line_strip.startswith("name:"):
                    name = line_strip.replace("- name:", "").replace("name:", "").strip()
                    result["classes"].append({"name": name, "line": idx, "type": "PLAYBOOK"})

        # 5. Database Connection String Detection
        self._detect_databases(text, result)

        return result

    def _detect_databases(self, text: str, result: dict):
        text_lower = text.lower()
        if "postgres://" in text_lower or "postgresql://" in text_lower:
            result["frameworks"].append("PostgreSQL")
        if "mongodb://" in text_lower or "mongodb+srv://" in text_lower:
            result["frameworks"].append("MongoDB")
        if "redis://" in text_lower or "redis_host" in text_lower:
            result["frameworks"].append("Redis")
        if "mysql://" in text_lower or "jdbc:mysql" in text_lower:
            result["frameworks"].append("MySQL")
        if "sqlite:" in text_lower or "sqlite3" in text_lower:
            result["frameworks"].append("SQLite")
        if "firestore" in text_lower:
            result["frameworks"].append("Firestore")
        if "dynamodb" in text_lower:
            result["frameworks"].append("DynamoDB")
        if "neo4j://" in text_lower:
            result["frameworks"].append("Neo4j")
