# c:\Users\VICTUS\helix\backend\analyzers\base_analyzer.py

class BaseAnalyzer:
    def analyze(self, file_path: str, code_bytes: bytes, language: str) -> dict:
        """
        Analyzes a source file.
        
        Returns a dict matching the schema:
        {
          "classes": [{"name": str, "line": int, "type": str}],
          "functions": [{"name": str, "line": int, "type": str}],
          "imports": [{"name": str, "line": int}],
          "endpoints": [{"name": str, "line": int, "type": str, "path": str, "method": str}],
          "frameworks": [str],
          "dependencies": [str],
          "calls": [{"caller": str | None, "callee": str, "line": int, "type": str}]
        }
        """
        return {
            "classes": [],
            "functions": [],
            "imports": [],
            "endpoints": [],
            "frameworks": [],
            "dependencies": [],
            "calls": []
        }

