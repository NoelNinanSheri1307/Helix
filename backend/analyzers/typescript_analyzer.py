# c:\Users\VICTUS\helix\backend\analyzers\typescript_analyzer.py

from analyzers.javascript_analyzer import JavascriptAnalyzer

class TypescriptAnalyzer(JavascriptAnalyzer):
    def analyze(self, file_path: str, code_bytes: bytes, language: str) -> dict:
        # Standardize language to typescript
        return super().analyze(file_path, code_bytes, "typescript")
