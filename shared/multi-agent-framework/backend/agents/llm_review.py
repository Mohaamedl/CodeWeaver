import logging
import os
import re
from typing import Any, Dict, List, Optional

from backend.agents.base import BaseAgent
from backend.chat_memory import ChatMemory

logger = logging.getLogger(__name__)

class LLMReviewAgent(BaseAgent):
    """Agent that reviews code using LLM or heuristics."""
    
    async def analyze_files(
        self,
        files: List[Dict[str, Any]],
        chat_memory: ChatMemory,
        structure: Optional[Dict[str, Any]] = None,
        github_info: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """Analyze files from GitHub API."""
        suggestions = []
        
        for file in files:
            if not file['path'].endswith(('.py', '.js', '.ts')):
                continue

            content = file['content']
            
            # Check for TODO comments
            if 'TODO' in content:
                suggestions.append({
                    'message': f"Found TODO comments in {file['path']}. Consider addressing them.",
                    'file_path': file['path'],
                    'patch': None
                })

            # Check for hardcoded password patterns
            if re.search(r'password\s*=\s*', content, flags=re.IGNORECASE):
                suggestions.append({
                    'message': f"Possible hardcoded password or credentials in {file['path']}. Use secure storage or configuration.",
                    'patch': None,
                    'file_path': file['path']
                })

            # Check for eval/exec usage
            if 'eval(' in content or 'exec(' in content:
                suggestions.append({
                    'message': f"Use of eval/exec detected in {file['path']}. Consider safer alternatives.",
                    'patch': None,
                    'file_path': file['path']
                })

            # Check for very large file
            if content.count('\n') > 300:
                suggestions.append({
                    'message': f"{file['path']} exceeds 300 lines; consider refactoring into smaller modules or classes.",
                    'patch': None,
                    'file_path': file['path']
                })
        
        return suggestions

    async def analyze_local(
        self,
        repo_path: str,
        chat_memory: ChatMemory,
        structure: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Legacy method for local repository analysis."""
        return await self.run(chat_memory, repo_path=repo_path, structure=structure)
