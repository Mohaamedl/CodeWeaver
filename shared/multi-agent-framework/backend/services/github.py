import base64
import logging
from typing import Any, Dict, List

import aiohttp

logger = logging.getLogger(__name__)

class GitHubAPI:
    def __init__(self, access_token: str = None):
        """Initialize with optional access token from user session."""
        self.base_url = "https://api.github.com"
        self.headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': f'token {access_token}' if access_token else ''
        }

    async def get_repository_contents(self, owner: str, repo: str, path: str = "") -> List[Dict[str, Any]]:
        """Get repository contents at a given path."""
        logger.info(f"Fetching contents for {owner}/{repo} at path: {path}")
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/repos/{owner}/{repo}/contents/{path}"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 404:
                    logger.error(f"Path {path} not found in {owner}/{repo}")
                    return []
                data = await response.json()
                return data if isinstance(data, list) else [data]

    async def get_file_content(self, owner: str, repo: str, path: str) -> str | None:
        """Get file content directly from GitHub API."""
        logger.info(f"Fetching file content for {owner}/{repo}/{path}")
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/repos/{owner}/{repo}/contents/{path}"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 404:
                    logger.warning(f"File {path} not found in {owner}/{repo}")
                    return None
                data = await response.json()
                if isinstance(data, dict) and 'content' in data:
                    return base64.b64decode(data['content']).decode('utf-8')
                return None

    async def analyze_repository(self, owner: str, repo: str) -> List[Dict[str, Any]]:
        """Analyze repository contents recursively from GitHub API."""
        logger.info(f"Starting analysis of {owner}/{repo}")
        analyzed_files = []
        paths_to_check = ['']  # Start with root

        while paths_to_check:
            current_path = paths_to_check.pop(0)
            contents = await self.get_repository_contents(owner, repo, current_path)

            for item in contents:
                if item['type'] == 'dir':
                    paths_to_check.append(item['path'])
                elif item['type'] == 'file':
                    if item['path'].endswith(('.py', '.js', '.ts', '.tsx', '.jsx')):
                        content = await self.get_file_content(owner, repo, item['path'])
                        if content:
                            analyzed_files.append({
                                'path': item['path'],
                                'content': content,
                                'type': 'file',
                                'size': item.get('size', 0)
                            })

        logger.info(f"Completed analysis of {owner}/{repo}. Found {len(analyzed_files)} files.")
        return analyzed_files
