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

    async def get_default_branch(self, owner: str, repo: str) -> str:
        """Get the default branch of a repository."""
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/repos/{owner}/{repo}"
            async with session.get(url, headers=self.headers) as response:
                if response.status != 200:
                    logger.error(f"Failed to get repository info: {response.status}")
                    return "main"  # Default fallback
                data = await response.json()
                return data.get('default_branch', 'main')

    async def get_ref_sha(self, owner: str, repo: str, ref: str) -> str | None:
        """Get the SHA of a reference (branch, tag, etc.)."""
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/repos/{owner}/{repo}/git/ref/heads/{ref}"
            async with session.get(url, headers=self.headers) as response:
                if response.status != 200:
                    logger.error(f"Failed to get ref SHA: {response.status}")
                    return None
                data = await response.json()
                return data.get('object', {}).get('sha')

    async def create_branch(self, owner: str, repo: str, base_branch: str, new_branch: str) -> bool:
        """Create a new branch from a base branch."""
        logger.info(f"Creating branch {new_branch} from {base_branch} in {owner}/{repo}")
        
        # Get the SHA of the base branch
        base_sha = await self.get_ref_sha(owner, repo, base_branch)
        if not base_sha:
            logger.error(f"Failed to get SHA for base branch {base_branch}")
            return False

        # Create the new branch
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/repos/{owner}/{repo}/git/refs"
            data = {
                "ref": f"refs/heads/{new_branch}",
                "sha": base_sha
            }
            try:
                async with session.post(url, headers=self.headers, json=data) as response:
                    response_text = await response.text()
                    logger.debug(f"Create branch response: {response.status}, {response_text[:200]}...")
                    
                    if response.status != 201:
                        logger.error(f"Failed to create branch: {response.status}, {response_text}")
                        return False
                    return True
            except Exception as e:
                logger.error(f"Exception creating branch: {str(e)}")
                return False

    async def create_pull_request(
        self,
        owner: str,
        repo: str,
        title: str,
        body: str,
        head: str,
        base: str
    ) -> str | None:
        """Create a pull request."""
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/repos/{owner}/{repo}/pulls"
            data = {
                "title": title,
                "body": body,
                "head": head,
                "base": base
            }
            async with session.post(url, headers=self.headers, json=data) as response:
                if response.status != 201:
                    logger.error(f"Failed to create PR: {response.status}")
                    return None
                pr_data = await response.json()
                return pr_data.get('html_url')

    async def update_file(
        self,
        owner: str,
        repo: str,
        path: str,
        message: str,
        content: str,
        branch: str
    ) -> bool:
        """Update a file in the repository."""
        logger.info(f"Updating file {path} in {owner}/{repo} on branch {branch}")
        
        # First get the current file to get its SHA
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/repos/{owner}/{repo}/contents/{path}"
            try:
                async with session.get(url, headers=self.headers, params={'ref': branch}) as response:
                    if response.status == 404:
                        logger.error(f"File {path} not found in {owner}/{repo}")
                        return False
                    
                    response_text = await response.text()
                    logger.debug(f"Get file response: {response.status}, {response_text[:200]}...")
                    
                    if response.status != 200:
                        logger.error(f"Failed to get file {path}: {response.status}, {response_text}")
                        return False
                    
                    data = await response.json()
                    if not isinstance(data, dict) or 'sha' not in data:
                        logger.error(f"Invalid response when getting file {path}: {data}")
                        return False
                    current_sha = data['sha']
            except Exception as e:
                logger.error(f"Exception getting file {path}: {str(e)}")
                return False

        # Now update the file
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/repos/{owner}/{repo}/contents/{path}"
            data = {
                "message": message,
                "content": base64.b64encode(content.encode()).decode(),
                "sha": current_sha,
                "branch": branch
            }
            try:
                async with session.put(url, headers=self.headers, json=data) as response:
                    response_text = await response.text()
                    logger.debug(f"Update file response: {response.status}, {response_text[:200]}...")
                    
                    if response.status != 200 and response.status != 201:
                        logger.error(f"Failed to update file: {response.status}, {response_text}")
                        return False
                    return True
            except Exception as e:
                logger.error(f"Exception updating file {path}: {str(e)}")
                return False
