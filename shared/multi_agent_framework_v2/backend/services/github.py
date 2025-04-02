import asyncio
import base64
import logging
import time
from functools import lru_cache
from typing import Any, Dict, List

from aiohttp import ClientSession, ClientTimeout, TCPConnector

logger = logging.getLogger(__name__)

class GitHubAPI:
    def __init__(self, access_token: str = None):
        """Initialize with optional access token from user session."""
        self.base_url = "https://api.github.com"
        self.headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': f'token {access_token}' if access_token else ''
        }
        self.semaphore = asyncio.Semaphore(20)  # Limit concurrent connections
        self.session = None
        self.cache = {}
        self.retry_delay = 1  # Initial retry delay in seconds

    async def _get_session(self) -> ClientSession:
        """Get or create aiohttp session with connection pooling."""
        if self.session is None or self.session.closed:
            timeout = ClientTimeout(total=30)
            connector = TCPConnector(limit=100, ttl_dns_cache=300)
            self.session = ClientSession(
                timeout=timeout,
                connector=connector,
                headers=self.headers
            )
        return self.session

    async def _make_request(self, url: str, method='get', **kwargs) -> Any:
        """Make HTTP request with retries and rate limit handling."""
        async with self.semaphore:  # Limit concurrent requests
            for attempt in range(3):  # Max 3 retries
                try:
                    session = await self._get_session()
                    async with getattr(session, method)(url, **kwargs) as response:
                        if response.status == 403 and 'rate limit exceeded' in await response.text():
                            reset_time = int(response.headers.get('X-RateLimit-Reset', 0))
                            wait_time = max(0, reset_time - time.time())
                            logger.warning(f"Rate limit hit, waiting {wait_time}s")
                            await asyncio.sleep(wait_time)
                            continue
                            
                        if response.status == 200:
                            if 'application/json' in response.headers.get('content-type', ''):
                                return await response.json()
                            return await response.text()
                            
                        if response.status != 429:  # Don't retry on non-rate-limit errors
                            return None
                            
                except Exception as e:
                    logger.error(f"Request failed: {str(e)}")
                    if attempt == 2:  # Last attempt
                        raise
                
                # Exponential backoff
                await asyncio.sleep(self.retry_delay * (2 ** attempt))
            
            return None

    @lru_cache(maxsize=100)
    async def get_repository_contents(self, owner: str, repo: str, path: str = "") -> List[Dict[str, Any]]:
        """Cached repository contents."""
        url = f"{self.base_url}/repos/{owner}/{repo}/contents/{path}"
        data = await self._make_request(url)
        return data if isinstance(data, list) else [data]

    async def analyze_repository(self, owner: str, repo: str) -> List[Dict[str, Any]]:
        """Analyze repository with optimized parallel processing."""
        logger.info(f"Starting analysis of {owner}/{repo}")
        analyzed_files = []
        seen_paths = set()
        
        async def process_path(path: str) -> List[str]:
            """Process a single path and return new paths to check."""
            if path in seen_paths:
                return []
            seen_paths.add(path)
            
            contents = await self.get_repository_contents(owner, repo, path)
            new_paths = []
            
            for item in contents:
                if item['type'] == 'dir':
                    new_paths.append(item['path'])
                elif (item['type'] == 'file' and 
                      item['path'].endswith(('.py', '.js', '.ts', '.tsx', '.jsx')) and
                      item.get('size', 0) <= 1024 * 1024):  # Skip files > 1MB
                    analyzed_files.append(item)
            
            return new_paths

        # Process all paths concurrently with worker pool
        paths_to_process = ['']
        while paths_to_process:
            # Process multiple paths concurrently
            tasks = [process_path(path) for path in paths_to_process]
            results = await asyncio.gather(*tasks)
            paths_to_process = [path for sublist in results for path in sublist]  # Flatten

        # Now fetch all file contents concurrently
        async def fetch_file_batch(files: List[Dict]) -> List[Dict[str, Any]]:
            tasks = []
            for file in files:
                url = file['url']
                tasks.append(self._make_request(url))
            
            results = await asyncio.gather(*tasks)
            processed_files = []
            
            for file, result in zip(files, results):
                if result and 'content' in result:
                    try:
                        content = base64.b64decode(result['content']).decode('utf-8')
                        processed_files.append({
                            'path': file['path'],
                            'content': content,
                            'type': 'file',
                            'size': file['size']
                        })
                    except Exception as e:
                        logger.error(f"Error processing {file['path']}: {e}")
            
            return processed_files

        # Process files in larger batches
        BATCH_SIZE = 30  # Increased batch size
        results = []
        for i in range(0, len(analyzed_files), BATCH_SIZE):
            batch = analyzed_files[i:i + BATCH_SIZE]
            batch_results = await fetch_file_batch(batch)
            results.extend(batch_results)

        logger.info(f"Completed analysis of {owner}/{repo}. Found {len(results)} files.")
        return results

    async def __aenter__(self):
        """Context manager support."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Clean up session on exit."""
        if self.session and not self.session.closed:
            await self.session.close()
