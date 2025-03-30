from typing import Any, Dict, List, Optional

from backend.chat_memory import ChatMemory


class BaseAgent:
    """Base agent interface."""
    
    async def run(
        self,
        chat_memory: ChatMemory,
        structure: Optional[Dict[str, Any]] = None,
        files: Optional[List[Dict[str, Any]]] = None,
        github_info: Optional[Dict[str, str]] = None,
        repo_path: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Run analysis using either GitHub API files or local repository."""
        if files is not None:
            return await self.analyze_files(files, chat_memory, structure, github_info)
        elif repo_path is not None:
            return await self.analyze_local(repo_path, chat_memory, structure)
        raise ValueError("Either files or repo_path must be provided")

    async def analyze_files(self, *args, **kwargs) -> List[Dict[str, Any]]:
        """Analyze files from GitHub API."""
        raise NotImplementedError()

    async def analyze_local(self, *args, **kwargs) -> List[Dict[str, Any]]:
        """Analyze local repository."""
        raise NotImplementedError()
