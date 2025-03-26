import os
import re
from backend.agents.base import BaseAgent
from backend.chat_memory import ChatMemory

class LLMReviewAgent(BaseAgent):
    """Agent that uses an LLM (or heuristics) to review code for potential issues or improvements."""
    def run(self, repo_path: str, chat_memory: ChatMemory):
        suggestions = []
        # Loop through Python files in the repository
        for root, dirs, files in os.walk(repo_path):
            if '/.venv/' in root or root.endswith('/.venv'):
                continue
            for file in files:
                if not file.endswith('.py'):
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, repo_path)
                try:
                    with open(file_path, 'r') as f:
                        content = f.read()
                except Exception as e:
                    continue
                # Check for TODO comments
                if 'TODO' in content:
                    suggestions.append({
                        'message': f"Found TODO comments in {rel_path}. Consider addressing them.",
                        'patch': None,
                        'file_path': rel_path
                    })
                # Check for hardcoded password patterns
                if re.search(r'password\s*=\s*', content, flags=re.IGNORECASE):
                    suggestions.append({
                        'message': f"Possible hardcoded password or credentials in {rel_path}. Use secure storage or configuration.",
                        'patch': None,
                        'file_path': rel_path
                    })
                # Check for eval/exec usage
                if 'eval(' in content or 'exec(' in content:
                    suggestions.append({
                        'message': f"Use of eval/exec detected in {rel_path}. Consider safer alternatives.",
                        'patch': None,
                        'file_path': rel_path
                    })
                # Check for very large file
                if content.count('\n') > 300:
                    suggestions.append({
                        'message': f"{rel_path} exceeds 300 lines; consider refactoring into smaller modules or classes.",
                        'patch': None,
                        'file_path': rel_path
                    })
        return suggestions
