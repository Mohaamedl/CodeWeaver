import base64
import logging
import os
from typing import Any, Dict

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

    async def get_repo_info(self, owner: str, repo: str) -> Dict[str, Any]:
        """Get repository information including default branch."""
        logger.info(f"Fetching repo info for {owner}/{repo} via GitHub API")
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/repos/{owner}/{repo}"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 404:
                    logger.error(f"Repository {owner}/{repo} not found")
                    raise ValueError(f"Repository {owner}/{repo} not found")
                logger.info(f"Successfully fetched repo info for {owner}/{repo}")
                return await response.json()

    async def get_tree_recursive(self, owner: str, repo: str, sha: str) -> Dict[str, Any]:
        """Get complete tree of repository contents."""
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/repos/{owner}/{repo}/git/trees/{sha}?recursive=1"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 404:
                    raise ValueError(f"Repository tree not found")
                return await response.json()

    async def get_file_content(self, owner: str, repo: str, path: str, ref: str = None) -> str:
        """Get file content directly from GitHub API."""
        logger.info(f"Fetching file content for {owner}/{repo}/{path} via GitHub API")
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/repos/{owner}/{repo}/contents/{path}"
            if ref:
                url += f"?ref={ref}"
            async with session.get(url, headers=self.headers) as response:
                if response.status == 404:
                    logger.warning(f"File {path} not found in {owner}/{repo}")
                    return None
                data = await response.json()
                if isinstance(data, dict) and 'content' in data:
                    logger.info(f"Successfully fetched content for {path}")
                    return base64.b64decode(data['content']).decode('utf-8')
                logger.warning(f"Unexpected response format for {path}")
                return None

    async def update_repository(self, owner: str, repo: str) -> str:
        """Update an existing repository using git pull."""
        repo_path = os.path.join(os.getcwd(), "repositories", owner, repo)
        
        if not os.path.exists(repo_path):
            raise ValueError(f"Repository directory does not exist: {repo_path}")
            
        try:
            from git import Repo
            git_repo = Repo(repo_path)
            # Configure remote with token if not already set
            remote_url = f"https://x-access-token:{self.headers['Authorization'].split(' ')[1]}@github.com/{owner}/{repo}.git"
            if 'origin' not in git_repo.remotes:
                git_repo.create_remote('origin', remote_url)
            else:
                git_repo.remotes.origin.set_url(remote_url)
            
            git_repo.remotes.origin.pull()
            return repo_path
        except Exception as e:
            raise ValueError(f"Failed to update repository: {str(e)}")

    async def clone_repository(self, owner: str, repo: str) -> str:
        """Clone a repository to local storage."""
        repo_path = os.path.join(os.getcwd(), "repositories", owner, repo)
        os.makedirs(os.path.dirname(repo_path), exist_ok=True)

        try:
            from git import Repo
            remote_url = f"https://x-access-token:{self.headers['Authorization'].split(' ')[1]}@github.com/{owner}/{repo}.git"
            Repo.clone_from(remote_url, repo_path)
            return repo_path
        except Exception as e:
            raise ValueError(f"Failed to clone repository: {str(e)}")
