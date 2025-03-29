from typing import Any, Dict, Optional

from backend.chat_memory import ChatMemory
from backend.services.github import github_api


class BaseAgent:
    """Abstract base class for agent implementations."""
    async def get_file_content(self, file_path: str, github_info: Dict[str, str]) -> str:
        """Get file content from GitHub API."""
        if not github_info or 'owner' not in github_info or 'repo' not in github_info:
            return None
            
        return await github_api.get_file_content(
            github_info['owner'],
            github_info['repo'],
            file_path
        )

    def run(self, repo_path: str, chat_memory: ChatMemory, structure: dict = None, github_info: Dict[str, str] = None):
        raise NotImplementedError("Agent run() must be implemented by subclasses.")
