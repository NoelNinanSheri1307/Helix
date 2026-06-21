import os
import time
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class RepositoryAnalysisConstraints:
    max_repository_size_kb: int = 100 * 1024
    max_files: int = 5000  # Reserved for a later enforcement stage.
    max_analysis_seconds: int = 5 * 60


@dataclass(frozen=True)
class StructureScanResult:
    directories: list[str]
    files: list[str]
    languages: list[str]
    top_level_directories: list[str]
    configuration_files: list[str]
    config_files: list[str]
    dev_config_files: list[str]
    app_config_files: list[str]
    documentation_files: list[str]
    entry_points: list[str]
    total_files: int
    total_directories: int
    repository_statistics: dict
    frameworks: list[str]
    dependencies: list[str]
    repository_summary: dict
    runtimes: list[str]
    build_tools: list[str]
    project_type: str


class RepositoryStructureScanner:
    LANGUAGE_EXTENSIONS = {
        ".c": "C",
        ".cpp": "C++",
        ".h": "C++",
        ".hpp": "C++",
        ".cs": "C#",
        ".css": "CSS",
        ".scss": "SCSS",
        ".dart": "Dart",
        ".ex": "Elixir",
        ".exs": "Elixir",
        ".go": "Go",
        ".html": "HTML",
        ".htm": "HTML",
        ".java": "Java",
        ".js": "JavaScript",
        ".jsx": "JavaScript",
        ".mjs": "JavaScript",
        ".cjs": "JavaScript",
        ".kt": "Kotlin",
        ".kts": "Kotlin",
        ".php": "PHP",
        ".py": "Python",
        ".rb": "Ruby",
        ".rs": "Rust",
        ".scala": "Scala",
        ".sh": "Shell",
        ".bash": "Shell",
        ".sol": "Solidity",
        ".swift": "Swift",
        ".ts": "TypeScript",
        ".tsx": "TypeScript",
        ".vue": "Vue",
        ".sql": "SQL",
        ".yaml": "YAML",
        ".yml": "YAML",
        ".json": "JSON",
        ".md": "Markdown",
    }
    CONFIGURATION_NAMES = {
        ".dockerignore", ".editorconfig", ".env.example", ".eslintrc",
        ".prettierrc", "Dockerfile", "Makefile", "Cargo.toml", "go.mod",
        "package.json", "pom.xml", "pyproject.toml", "requirements.txt",
        "vite.config.js", "vite.config.ts", "next.config.js",
        "next.config.mjs", "next.config.ts", "tsconfig.json", "makefile",
        "pubspec.yaml", "pubspec.yml", "build.gradle", "build.gradle.kts"
    }
    ENTRY_POINT_NAMES = {
        "main.py", "app.py", "__main__.py", "index.ts", "index.js", "main.ts",
        "server.ts", "server.js", "program.cs", "application.java",
        "manage.py", "server.py", "main.js", "main.go", "main.rs", "app.js", "app.ts",
        "main.dart"
    }

    @classmethod
    def is_config_file(cls, file_name: str) -> bool:
        name_lower = file_name.lower()
        exact_configs = {
            "package.json", "requirements.txt", "pyproject.toml",
            "cargo.toml", "pom.xml", "build.gradle", "docker-compose.yml",
            "dockerfile", ".dockerignore", ".editorconfig", ".env.example",
            "pubspec.yaml", "pubspec.yml",
            ".eslintrc", ".prettierrc", "go.mod", "tsconfig.json", "makefile"
        }
        if name_lower in exact_configs:
            return True
        if name_lower.startswith("vite.config.") or name_lower.startswith("next.config."):
            return True
        return False

    @classmethod
    def is_entry_point(cls, file_name: str) -> bool:
        return file_name.lower() in cls.ENTRY_POINT_NAMES

    def __init__(self, constraints: RepositoryAnalysisConstraints | None = None):
        self.constraints = constraints or RepositoryAnalysisConstraints()

    def scan(self, root: Path) -> StructureScanResult:
        root = root.resolve()
        started_at = time.monotonic()
        directories: list[str] = []
        files: list[str] = []
        languages: set[str] = set()
        configuration_files: list[str] = []
        dev_config_files: list[str] = []
        app_config_files: list[str] = []
        documentation_files: list[str] = []
        entry_points: list[str] = []
        extension_counts: dict[str, int] = {}
        has_spring_boot_annotation = False
        detected_frameworks = set()
        dependencies = []

        ignored_dirs = {
            "node_modules", ".git", "dist", "build", "target", "venv",
            "__pycache__", "coverage", "out", ".next"
        }

        for current_root, dir_names, file_names in os.walk(root, followlinks=False):
            if time.monotonic() - started_at > self.constraints.max_analysis_seconds:
                raise TimeoutError("Repository structure scan exceeded the analysis time limit")

            dir_names[:] = sorted(name for name in dir_names if name not in ignored_dirs)
            current_path = Path(current_root)

            for directory_name in dir_names:
                path = current_path / directory_name
                directories.append(path.relative_to(root).as_posix())

            for file_name in sorted(file_names):
                path = current_path / file_name
                relative_path = path.relative_to(root).as_posix()
                files.append(relative_path)

                suffix = path.suffix.lower()
                if suffix:
                    extension_counts[suffix] = extension_counts.get(suffix, 0) + 1

                language = self.LANGUAGE_EXTENSIONS.get(suffix)
                if language:
                    languages.add(language)

                if file_name in self.CONFIGURATION_NAMES:
                    configuration_files.append(relative_path)

                # Development Configuration
                if file_name in {".gitignore", ".gitattributes", ".editorconfig"}:
                    dev_config_files.append(relative_path)

                # Application Configuration
                if file_name in {
                    "pom.xml", "package.json", "requirements.txt", "application.properties",
                    "application.yml", "Dockerfile", "docker-compose.yml", "pyproject.toml",
                    "pubspec.yaml", "pubspec.yml", "build.gradle", "build.gradle.kts", "Cargo.toml",
                    "go.mod"
                } or file_name.startswith("next.config.") or file_name.startswith("vite.config."):
                    app_config_files.append(relative_path)

                path_parts = Path(relative_path).parts
                if file_name.lower() in {"readme.md", "contributing.md", "architecture.md"} or "docs" in path_parts:
                    documentation_files.append(relative_path)

                # Entry point checking
                is_ep = self.is_entry_point(file_name)
                # Next.js / React page layout patterns
                if relative_path in {
                    "app/layout.tsx", "app/page.tsx", "pages/_app.tsx", "src/main.tsx", "src/index.tsx",
                    "lib/main.dart", "src/index.js", "src/main.ts", "src/main.py", "app/main.py"
                } or relative_path.endswith((
                    "/app/layout.tsx", "/app/page.tsx", "/pages/_app.tsx", "/src/main.tsx", "/src/index.tsx",
                    "/lib/main.dart", "/src/index.js", "/src/main.ts", "/src/main.py", "/app/main.py"
                )):
                    is_ep = True

                # Content-based checks
                if suffix in {".java", ".py", ".js", ".ts", ".jsx", ".tsx", ".dart", ".rs", ".go"}:
                    try:
                        with open(path, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read(50000)
                        
                        if suffix == ".java":
                            if "@SpringBootApplication" in content or "public static void main" in content:
                                is_ep = True
                                if "@SpringBootApplication" in content:
                                    has_spring_boot_annotation = True
                                    detected_frameworks.add("Spring Boot")
                            if "org.springframework.web" in content or "@RestController" in content or "@Controller" in content:
                                detected_frameworks.add("Spring MVC")
                            if "org.hibernate" in content or "@Entity" in content:
                                detected_frameworks.add("Hibernate")
                        elif suffix == ".py":
                            if 'if __name__ == "__main__"' in content or "if __name__ == '__main__'" in content:
                                is_ep = True
                            elif "FastAPI(" in content or "Flask(" in content:
                                is_ep = True
                            
                            # Framework checks from imports/code
                            if "import fastapi" in content or "from fastapi" in content:
                                detected_frameworks.add("FastAPI")
                            if "import flask" in content or "from flask" in content:
                                detected_frameworks.add("Flask")
                            if "import django" in content or "from django" in content:
                                detected_frameworks.add("Django")
                            if "import streamlit" in content or "from streamlit" in content:
                                detected_frameworks.add("Streamlit")
                            if "import gradio" in content or "from gradio" in content:
                                detected_frameworks.add("Gradio")
                            if "import torch" in content or "from torch" in content:
                                detected_frameworks.add("PyTorch")
                            if "import tensorflow" in content or "from tensorflow" in content:
                                detected_frameworks.add("TensorFlow")
                            if "import keras" in content or "from keras" in content:
                                detected_frameworks.add("Keras")
                            if "sklearn" in content or "scikit-learn" in content:
                                detected_frameworks.add("Scikit-learn")
                            if "import xgboost" in content or "from xgboost" in content:
                                detected_frameworks.add("XGBoost")
                        elif suffix in {".js", ".ts", ".jsx", ".tsx"}:
                            if "app.listen(" in content or "server.listen(" in content:
                                is_ep = True
                            
                            # Framework checks from imports/requires
                            content_lower = content.lower()
                            if "from 'react'" in content_lower or 'from "react"' in content_lower or "import react" in content_lower:
                                detected_frameworks.add("React")
                            if "from 'next'" in content_lower or 'from "next"' in content_lower or "import next" in content_lower:
                                detected_frameworks.add("Next.js")
                            if "from 'vue'" in content_lower or 'from "vue"' in content_lower or "import vue" in content_lower:
                                detected_frameworks.add("Vue")
                            if "from 'nuxt'" in content_lower or 'from "nuxt"' in content_lower or "import nuxt" in content_lower:
                                detected_frameworks.add("Nuxt")
                            if "from '@angular" in content_lower or 'from "@angular' in content_lower:
                                detected_frameworks.add("Angular")
                            if "require('express')" in content_lower or 'require("express")' in content_lower or "from 'express'" in content_lower or 'from "express"' in content_lower:
                                detected_frameworks.add("Express")
                            if "from '@nestjs'" in content_lower or 'from "@nestjs"' in content_lower:
                                detected_frameworks.add("NestJS")
                            if "from 'vite'" in content_lower or 'from "vite"' in content_lower or "import vite" in content_lower:
                                detected_frameworks.add("Vite")
                            if "require('electron')" in content_lower or 'require("electron")' in content_lower or "from 'electron'" in content_lower or 'from "electron"' in content_lower:
                                detected_frameworks.add("Electron")
                        elif suffix == ".dart":
                            if "package:flutter/" in content:
                                detected_frameworks.add("Flutter")
                        elif suffix == ".rs":
                            if "use tokio::" in content:
                                detected_frameworks.add("Tokio")
                            if "use actix_web::" in content or "use actix::" in content:
                                detected_frameworks.add("Actix")
                        elif suffix == ".go":
                            if "github.com/gin-gonic/gin" in content:
                                detected_frameworks.add("Gin")
                            if "github.com/labstack/echo" in content:
                                detected_frameworks.add("Echo")
                    except Exception:
                        pass

                if is_ep:
                    if relative_path not in entry_points:
                        entry_points.append(relative_path)

        top_level_directories = sorted(
            path for path in directories if "/" not in path
        )

        # Build tools list, runtimes list, and dependencies extraction
        build_tools_detected = set()
        runtimes_detected = set()

        has_pom = any(f.endswith("pom.xml") for f in files)
        has_gradle = any(f.endswith("build.gradle") or f.endswith("build.gradle.kts") for f in files)
        has_package_json = any(f.endswith("package.json") for f in files)
        has_yarn_lock = any(f.endswith("yarn.lock") for f in files)
        has_pnpm_lock = any(f.endswith("pnpm-lock.yaml") for f in files)
        has_requirements = any(f.endswith("requirements.txt") for f in files)
        has_pyproject = any(f.endswith("pyproject.toml") for f in files)
        has_pubspec = any(f.endswith("pubspec.yaml") or f.endswith("pubspec.yml") for f in files)
        has_cargo = any(f.endswith("Cargo.toml") for f in files)
        has_go_mod = any(f.endswith("go.mod") for f in files)

        # 1. Dependency parser & build tool mappings
        for f in files:
            # POM.XML (Maven Java)
            if f.endswith("pom.xml"):
                build_tools_detected.add("Maven")
                runtimes_detected.add("Java")
                pom_path = root / f
                if pom_path.exists():
                    try:
                        pom_content = pom_path.read_text(encoding="utf-8", errors="ignore")
                        pom_content_lower = pom_content.lower()
                        if "spring-boot" in pom_content_lower:
                            detected_frameworks.add("Spring Boot")
                        if "spring-web" in pom_content_lower or "spring-mvc" in pom_content_lower or "spring-webmvc" in pom_content_lower:
                            detected_frameworks.add("Spring MVC")
                        if "hibernate" in pom_content_lower:
                            detected_frameworks.add("Hibernate")
                        
                        # Dependency extraction
                        import re
                        dep_blocks = re.findall(r'<dependency>([\s\S]*?)</dependency>', pom_content)
                        for block in dep_blocks:
                            art_match = re.search(r'<artifactId>(.*?)</artifactId>', block)
                            if art_match:
                                art = art_match.group(1).strip()
                                dependencies.append(art)
                    except Exception:
                        pass

            # Gradle (Java)
            elif f.endswith("build.gradle") or f.endswith("build.gradle.kts"):
                build_tools_detected.add("Gradle")
                runtimes_detected.add("Java")
                gradle_path = root / f
                if gradle_path.exists():
                    try:
                        gradle_content = gradle_path.read_text(encoding="utf-8", errors="ignore")
                        gradle_content_lower = gradle_content.lower()
                        if "spring-boot" in gradle_content_lower:
                            detected_frameworks.add("Spring Boot")
                        if "spring-web" in gradle_content_lower:
                            detected_frameworks.add("Spring MVC")
                        if "hibernate" in gradle_content_lower:
                            detected_frameworks.add("Hibernate")
                        
                        # Dependency extraction
                        import re
                        gradle_deps = re.findall(r'(?:implementation|compile|api|testImplementation)\(?\s*[\'"]([^\'"]+)[\'"]', gradle_content)
                        for dep in gradle_deps:
                            parts = dep.split(":")
                            if len(parts) >= 2:
                                dependencies.append(parts[1])
                            else:
                                dependencies.append(dep)
                    except Exception:
                        pass

            # package.json (Node JS)
            elif f.endswith("package.json"):
                runtimes_detected.add("Node.js")
                # Look at lock files in the same directory or project root
                parent_dir = Path(f).parent
                if (root / parent_dir / "yarn.lock").exists() or any(fl.endswith("yarn.lock") for fl in files):
                    build_tools_detected.add("yarn")
                elif (root / parent_dir / "pnpm-lock.yaml").exists() or any(fl.endswith("pnpm-lock.yaml") for fl in files):
                    build_tools_detected.add("pnpm")
                else:
                    build_tools_detected.add("npm")

                pkg_path = root / f
                if pkg_path.exists():
                    try:
                        import json
                        with open(pkg_path, "r", encoding="utf-8", errors="ignore") as pf:
                            pkg_data = json.load(pf)
                        deps = pkg_data.get("dependencies", {})
                        dev_deps = pkg_data.get("devDependencies", {})
                        all_deps = {**deps, **dev_deps}
                        
                        # Framework detection from dependencies
                        for dep_name in all_deps.keys():
                            dependencies.append(dep_name)
                            dep_name_lower = dep_name.lower()
                            if "next" in dep_name_lower:
                                detected_frameworks.add("Next.js")
                            elif "react" in dep_name_lower:
                                detected_frameworks.add("React")
                            elif "vue" in dep_name_lower:
                                detected_frameworks.add("Vue")
                            elif "nuxt" in dep_name_lower:
                                detected_frameworks.add("Nuxt")
                            elif "angular" in dep_name_lower:
                                detected_frameworks.add("Angular")
                            elif "express" in dep_name_lower:
                                detected_frameworks.add("Express")
                            elif "nestjs" in dep_name_lower or "nest" in dep_name_lower:
                                detected_frameworks.add("NestJS")
                            
                            if "vite" in dep_name_lower:
                                build_tools_detected.add("Vite")
                    except Exception:
                        pass

            # requirements.txt (Python)
            elif f.endswith("requirements.txt"):
                build_tools_detected.add("pip")
                runtimes_detected.add("Python")
                req_path = root / f
                if req_path.exists():
                    try:
                        req_content = req_path.read_text(encoding="utf-8", errors="ignore")
                        req_content_lower = req_content.lower()
                        if "fastapi" in req_content_lower:
                            detected_frameworks.add("FastAPI")
                        if "flask" in req_content_lower:
                            detected_frameworks.add("Flask")
                        if "django" in req_content_lower:
                            detected_frameworks.add("Django")
                        if "streamlit" in req_content_lower:
                            detected_frameworks.add("Streamlit")
                        if "gradio" in req_content_lower:
                            detected_frameworks.add("Gradio")
                        if "torch" in req_content_lower:
                            detected_frameworks.add("PyTorch")
                        if "tensorflow" in req_content_lower:
                            detected_frameworks.add("TensorFlow")
                        if "keras" in req_content_lower:
                            detected_frameworks.add("Keras")
                        if "scikit-learn" in req_content_lower or "sklearn" in req_content_lower:
                            detected_frameworks.add("Scikit-Learn")
                        if "opencv-python" in req_content_lower or "opencv" in req_content_lower:
                            detected_frameworks.add("OpenCV")
                        if "xgboost" in req_content_lower:
                            detected_frameworks.add("XGBoost")

                        # Dependency extraction
                        import re
                        for line in req_content.splitlines():
                            line = line.strip()
                            if line and not line.startswith("#") and not line.startswith("-"):
                                dep_name = re.split(r'[=><~!]', line)[0].strip()
                                if dep_name:
                                    dependencies.append(dep_name)
                    except Exception:
                        pass

            # pyproject.toml (Poetry/Pip Python)
            elif f.endswith("pyproject.toml"):
                runtimes_detected.add("Python")
                pyproj_path = root / f
                if pyproj_path.exists():
                    try:
                        pyproj_content = pyproj_path.read_text(encoding="utf-8", errors="ignore")
                        pyproj_content_lower = pyproj_content.lower()
                        
                        if "poetry" in pyproj_content_lower:
                            build_tools_detected.add("Poetry")
                        else:
                            build_tools_detected.add("pip")

                        if "fastapi" in pyproj_content_lower:
                            detected_frameworks.add("FastAPI")
                        if "flask" in pyproj_content_lower:
                            detected_frameworks.add("Flask")
                        if "django" in pyproj_content_lower:
                            detected_frameworks.add("Django")
                        if "streamlit" in pyproj_content_lower:
                            detected_frameworks.add("Streamlit")
                        if "gradio" in pyproj_content_lower:
                            detected_frameworks.add("Gradio")
                        if "torch" in pyproj_content_lower:
                            detected_frameworks.add("PyTorch")
                        if "tensorflow" in pyproj_content_lower:
                            detected_frameworks.add("TensorFlow")
                        if "keras" in pyproj_content_lower:
                            detected_frameworks.add("Keras")
                        if "scikit-learn" in pyproj_content_lower or "sklearn" in pyproj_content_lower:
                            detected_frameworks.add("Scikit-Learn")
                        if "opencv-python" in pyproj_content_lower or "opencv" in pyproj_content_lower:
                            detected_frameworks.add("OpenCV")
                        if "xgboost" in pyproj_content_lower:
                            detected_frameworks.add("XGBoost")
                        
                        # Dependency extraction
                        import re
                        in_deps_section = False
                        for line in pyproj_content.splitlines():
                            line_strip = line.strip()
                            if line_strip.startswith("[") and "dependencies" in line_strip.lower():
                                in_deps_section = True
                                continue
                            elif line_strip.startswith("["):
                                in_deps_section = False
                            
                            if in_deps_section and "=" in line_strip:
                                parts = line_strip.split("=")
                                dep_name = parts[0].strip().strip('"').strip("'")
                                if dep_name and dep_name.lower() != "python":
                                    dependencies.append(dep_name)
                    except Exception:
                        pass

            # setup.py (Python)
            elif f.endswith("setup.py"):
                runtimes_detected.add("Python")
                build_tools_detected.add("pip")
                setup_path = root / f
                if setup_path.exists():
                    try:
                        setup_content = setup_path.read_text(encoding="utf-8", errors="ignore")
                        setup_content_lower = setup_content.lower()
                        
                        if "fastapi" in setup_content_lower:
                            detected_frameworks.add("FastAPI")
                        if "flask" in setup_content_lower:
                            detected_frameworks.add("Flask")
                        if "django" in setup_content_lower:
                            detected_frameworks.add("Django")
                        if "streamlit" in setup_content_lower:
                            detected_frameworks.add("Streamlit")
                        if "gradio" in setup_content_lower:
                            detected_frameworks.add("Gradio")
                        if "torch" in setup_content_lower:
                            detected_frameworks.add("PyTorch")
                        if "tensorflow" in setup_content_lower:
                            detected_frameworks.add("TensorFlow")
                        if "scikit-learn" in setup_content_lower or "sklearn" in setup_content_lower:
                            detected_frameworks.add("Scikit-Learn")
                        if "opencv-python" in setup_content_lower or "opencv" in setup_content_lower:
                            detected_frameworks.add("OpenCV")
                        if "xgboost" in setup_content_lower:
                            detected_frameworks.add("XGBoost")

                        # Simple extraction of requirements in setup.py
                        import re
                        requires_match = re.search(r'install_requires\s*=\s*\[([\s\S]*?)\]', setup_content)
                        if requires_match:
                            req_block = requires_match.group(1)
                            reqs = re.findall(r'[\'"]([^\'"]+)[\'"]', req_block)
                            for req in reqs:
                                dep_name = re.split(r'[=><~!]', req)[0].strip()
                                if dep_name:
                                    dependencies.append(dep_name)
                    except Exception:
                        pass

            # pubspec.yaml (Dart/Flutter)
            elif f.endswith("pubspec.yaml") or f.endswith("pubspec.yml"):
                pub_path = root / f
                if pub_path.exists():
                    try:
                        pub_content = pub_path.read_text(encoding="utf-8", errors="ignore")
                        if "sdk: flutter" in pub_content or "flutter:" in pub_content:
                            detected_frameworks.add("Flutter")

                        # Dependency extraction from pubspec.yaml (dependencies + dev_dependencies)
                        in_deps = False
                        in_dev_deps = False
                        for line in pub_content.splitlines():
                            line_strip = line.strip()
                            if line_strip.startswith("#"):
                                continue
                            if line_strip == "dependencies:":
                                in_deps = True
                                in_dev_deps = False
                                continue
                            elif line_strip == "dev_dependencies:":
                                in_deps = False
                                in_dev_deps = True
                                continue
                            elif (in_deps or in_dev_deps) and line and not line.startswith(" "):
                                in_deps = False
                                in_dev_deps = False

                            if (in_deps or in_dev_deps) and line.startswith("  ") and not line.startswith("    "):
                                if ":" in line_strip:
                                    dep_name = line_strip.split(":")[0].strip()
                                    if dep_name:
                                        dependencies.append(dep_name)
                    except Exception:
                        pass

            # Cargo.toml (Rust)
            elif f.endswith("Cargo.toml"):
                cargo_path = root / f
                if cargo_path.exists():
                    try:
                        cargo_content = cargo_path.read_text(encoding="utf-8", errors="ignore")
                        cargo_content_lower = cargo_content.lower()
                        if "tokio" in cargo_content_lower:
                            detected_frameworks.add("Tokio")
                        if "actix" in cargo_content_lower:
                            detected_frameworks.add("Actix")
                        if "rocket" in cargo_content_lower:
                            detected_frameworks.add("Rocket")
                        
                        # Dependency extraction
                        in_deps = False
                        for line in cargo_content.splitlines():
                            line_strip = line.strip()
                            if line_strip.startswith("[dependencies]"):
                                in_deps = True
                                continue
                            elif line_strip.startswith("["):
                                in_deps = False
                            
                            if in_deps and "=" in line_strip:
                                parts = line_strip.split("=")
                                dep_name = parts[0].strip().strip('"').strip("'")
                                if dep_name:
                                    dependencies.append(dep_name)
                    except Exception:
                        pass

            # go.mod (Go)
            elif f.endswith("go.mod"):
                go_path = root / f
                if go_path.exists():
                    try:
                        go_content = go_path.read_text(encoding="utf-8", errors="ignore")
                        go_content_lower = go_content.lower()
                        if "github.com/gin-gonic/gin" in go_content_lower or "gin-gonic" in go_content_lower:
                            detected_frameworks.add("Gin")
                        if "github.com/labstack/echo" in go_content_lower or "labstack/echo" in go_content_lower:
                            detected_frameworks.add("Echo")
                        if "github.com/gofiber/fiber" in go_content_lower or "gofiber/fiber" in go_content_lower:
                            detected_frameworks.add("Fiber")
                        
                        # Dependency extraction
                        in_require = False
                        for line in go_content.splitlines():
                            line_strip = line.strip()
                            if line_strip.startswith("require ("):
                                in_require = True
                                continue
                            elif in_require and line_strip.startswith(")"):
                                in_require = False
                            
                            if line_strip.startswith("require ") and not line_strip.startswith("require ("):
                                parts = line_strip.split()
                                if len(parts) >= 2:
                                    dependencies.append(parts[1])
                            elif in_require and line_strip:
                                parts = line_strip.split()
                                if len(parts) >= 1:
                                    dependencies.append(parts[0])
                    except Exception:
                        pass

        # Authoritative overrides based on pubspec
        if has_pubspec:
            runtimes_detected = {"Dart"}
            build_tools_detected = {"pub"}
            detected_frameworks.add("Flutter")

        # Fallback Runtimes detection from files extensions if no config file was present
        if not runtimes_detected:
            if "Python" in languages: runtimes_detected.add("Python")
            if "Java" in languages or "Kotlin" in languages: runtimes_detected.add("Java")
            if "Dart" in languages: runtimes_detected.add("Dart")
            if "Go" in languages: runtimes_detected.add("Go")
            if "Rust" in languages: runtimes_detected.add("Rust")
            if "JavaScript" in languages or "TypeScript" in languages: runtimes_detected.add("Node.js")

        # Determine Primary Language (the language with the highest file count)
        primary_language = "Unknown"
        max_ext_count = -1
        for ext, count in extension_counts.items():
            lang = self.LANGUAGE_EXTENSIONS.get(ext)
            if lang and count > max_ext_count:
                max_ext_count = count
                primary_language = lang
        if primary_language == "Unknown" and languages:
            primary_language = sorted(list(languages))[0]

        # Determine Legacy Framework & Confidence columns (compat)
        framework = "Unknown"
        framework_confidence = 0.0
        frameworks_list = sorted(list(detected_frameworks))
        if "Spring Boot" in detected_frameworks:
            framework = "Spring Boot"
            framework_confidence = 1.0
        elif "Next.js" in detected_frameworks:
            framework = "Next.js"
            framework_confidence = 1.0
        elif "React" in detected_frameworks:
            framework = "React"
            framework_confidence = 0.95
        elif "FastAPI" in detected_frameworks:
            framework = "FastAPI"
            framework_confidence = 1.0
        elif "Flutter" in detected_frameworks:
            framework = "Flutter"
            framework_confidence = 1.0
        elif "Django" in detected_frameworks:
            framework = "Django"
            framework_confidence = 1.0
        elif frameworks_list:
            framework = frameworks_list[0]
            framework_confidence = 0.85

        # 2. Project Type Classification Matrix
        ml_frameworks = {"PyTorch", "TensorFlow", "Keras", "Scikit-Learn", "Scikit-learn", "XGBoost", "LightGBM", "OpenCV", "Transformers", "LangChain", "LlamaIndex"}
        web_frameworks = {"React", "Next.js", "Vue", "Nuxt", "Angular", "Express", "NestJS", "Vite", "Electron"}
        backend_api_frameworks = {"FastAPI", "Flask", "Django", "Spring Boot", "Spring MVC", "Express", "NestJS", "Gin", "Echo", "Actix", "Tokio"}
        
        has_ml = any(fw in ml_frameworks for fw in frameworks_list)
        has_web_frontend = any(fw in {"React", "Next.js", "Vue", "Nuxt", "Angular"} for fw in frameworks_list) or ("HTML" in languages and extension_counts.get(".html", 0) > 2)
        has_web_backend = any(fw in backend_api_frameworks for fw in frameworks_list)
        has_backend_language = any(lang in {"Python", "Java", "Go", "Rust", "C#"} for lang in languages)
        has_frontend_folder = any("frontend" in d.lower() or "client" in d.lower() for d in top_level_directories)
        has_backend_folder = any("backend" in d.lower() or "server" in d.lower() or "api" in d.lower() or "project" in d.lower() for d in top_level_directories)
        is_fullstack = (has_web_frontend and has_web_backend) or (has_web_frontend and has_backend_language and (has_frontend_folder or has_backend_folder))

        if "Flutter" in frameworks_list or has_pubspec:
            project_type = "Mobile Application"
        elif has_ml:
            project_type = "Machine Learning Project"
        elif is_fullstack:
            project_type = "Full Stack Application"
        elif "Spring Boot" in frameworks_list:
            project_type = "Backend API"
        elif has_web_frontend and not has_backend_language:
            project_type = "Frontend Web Application"
        elif has_web_backend:
            has_docker = any("dockerfile" in f.lower() or "docker-compose" in f.lower() for f in files)
            if has_docker and len(files) < 100:
                project_type = "Microservice"
            else:
                project_type = "Backend API"
        elif has_web_frontend:
            project_type = "Web Application"
        elif "Electron" in frameworks_list:
            project_type = "Desktop Application"
        elif "Cargo" in build_tools_detected and not frameworks_list and any(f.endswith("main.rs") for f in files):
            project_type = "CLI Tool"
        elif any(f.endswith("setup.py") or "library" in relative_path.lower() for f in files):
            project_type = "Library"
        else:
            project_type = "Web Application" if "HTML" in languages or "CSS" in languages else "Backend API"

        # Determine Architecture Hint
        if project_type == "Full Stack Application":
            architecture_hint = "Full-Stack Client-Server Architecture"
        elif "Spring Boot" in detected_frameworks or "Spring MVC" in detected_frameworks:
            architecture_hint = "Layered Architecture (Controller, Service, Repository)"
        elif "NestJS" in detected_frameworks:
            architecture_hint = "Module-based Layered Architecture"
        elif "Next.js" in detected_frameworks:
            architecture_hint = "Next.js App Router Architecture"
        elif "React" in detected_frameworks:
            architecture_hint = "Component-driven SPA Architecture"
        elif "FastAPI" in detected_frameworks or "Express" in detected_frameworks or "Flask" in detected_frameworks:
            architecture_hint = "API-first Microservice Architecture"
        elif "Django" in detected_frameworks:
            architecture_hint = "MTV (Model-Template-View) Architecture"
        elif project_type == "Mobile Application":
            architecture_hint = "Mobile Platform Architecture"
        else:
            architecture_hint = "Standard Directory Layout"

        # Create structured Repository Summary
        runtimes_list = sorted(list(runtimes_detected))
        build_tools_list = sorted(list(build_tools_detected))
        dependencies_list = sorted(list(set(dependencies)))

        repository_summary = {
            "repository_type": project_type,
            "primary_language": primary_language,
            "frameworks": frameworks_list,
            "entry_points": entry_points,
            "dependencies": dependencies_list,
            "architecture_hint": architecture_hint,
            "file_count": len(files),
            "directory_count": len(directories),
            "runtimes": runtimes_list,
            "build_tools": build_tools_list
        }

        config_files = dev_config_files + app_config_files

        repository_statistics = {
            "extension_counts": extension_counts,
            "total_files": len(files),
            "total_directories": len(directories),
            "framework": framework,
            "framework_confidence": framework_confidence,
        }

        return StructureScanResult(
            directories=directories,
            files=files,
            languages=sorted(list(languages)),
            top_level_directories=top_level_directories,
            configuration_files=configuration_files,
            config_files=config_files,
            dev_config_files=dev_config_files,
            app_config_files=app_config_files,
            documentation_files=documentation_files,
            entry_points=entry_points,
            total_files=len(files),
            total_directories=len(directories),
            repository_statistics=repository_statistics,
            frameworks=frameworks_list,
            dependencies=dependencies_list,
            repository_summary=repository_summary,
            runtimes=runtimes_list,
            build_tools=build_tools_list,
            project_type=project_type,
        )
