import logging
from typing import Any, Dict, Optional

from backend.chat_memory import ChatMemory

logger = logging.getLogger(__name__)


class BaseAgent:
    """Abstract base class for agent implementations."""
    async def get_file_content(self, file_path: str, github_info: Dict[str, str]) -> str:
        """Get file content, prioritizing GitHub API."""
        if not github_info or not github_info.get('token'):
            logger.warning(f"No GitHub info available for {file_path}, falling back to local file")
            return None

        try:
            from backend.services.github import GitHubAPI
            github_api = GitHubAPI(github_info['token'])
            logger.info(f"Fetching {file_path} via GitHub API")
            content = await github_api.get_file_content(
                github_info['owner'],
                github_info['repo'],
                file_path
            )
            if content:
                logger.info(f"Successfully fetched {file_path} from GitHub API")
                return content
        except Exception as e:
            logger.error(f"Failed to fetch {file_path} from GitHub API: {e}")

        logger.warning(f"Falling back to local file for {file_path}")
        return None

    def run(self, repo_path: str, chat_memory: ChatMemory, structure: dict = None, github_info: Dict[str, str] = None):
        raise NotImplementedError("Agent run() must be implemented by subclasses.")
