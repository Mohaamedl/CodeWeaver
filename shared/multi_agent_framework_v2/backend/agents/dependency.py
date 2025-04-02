import difflib
import logging
import os
from typing import Any, Dict, List, Optional

from backend.agents.base import BaseAgent
from backend.chat_memory import ChatMemory

logger = logging.getLogger(__name__)

class DependencyAgent(BaseAgent):
    """Agent that checks for dependency updates."""
    
    async def analyze_files(
        self,
        files: List[Dict[str, Any]],
        chat_memory: ChatMemory,
        structure: Optional[Dict[str, Any]] = None,
        github_info: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """Analyze files from GitHub API."""
        suggestions = []
        
        # Check for requirements.txt
        req_file = next((f for f in files if f['path'].endswith('requirements.txt')), None)
        if req_file:
            try:
                req_lines = req_file['content'].splitlines()
            except Exception as e:
                logger.error(f"Error reading requirements.txt: {e}")
                req_lines = []
            seen_deps = set()
            for line in req_lines:
                stripped = line.strip()
                if not stripped or stripped.startswith('#'):
                    continue
                if '==' in stripped:
                    pkg, ver = stripped.split('==', 1)
                    pkg = pkg.strip()
                    ver = ver.strip()
                    if pkg in seen_deps:  # Skip if already suggested
                        continue
                    seen_deps.add(pkg)
                    if not ver or not ver[0].isdigit():
                        continue
                    ver_parts = ver.split('.')
                    try:
                        ver_parts[-1] = str(int(ver_parts[-1]) + 1)
                    except:
                        ver_parts.append('1')
                    new_ver = '.'.join(ver_parts)
                    old_line = line if line.endswith('\n') else line + '\n'
                    new_line = f"{pkg}=={new_ver}\n"
                    diff_lines = difflib.unified_diff([old_line], [new_line], fromfile="a/requirements.txt", tofile="b/requirements.txt", lineterm='')
                    patch = ''.join(diff_lines)
                    if patch:
                        suggestions.append({
                            'message': f"Update {pkg} from {ver} to {new_ver} in requirements.txt.",
                            'patch': patch,
                            'file_path': 'requirements.txt'
                        })

        # Check for pyproject.toml
        pyproject_file = next((f for f in files if f['path'].endswith('pyproject.toml')), None)
        if pyproject_file:
            try:
                toml_lines = pyproject_file['content'].splitlines()
            except Exception as e:
                logger.error(f"Error reading pyproject.toml: {e}")
                toml_lines = []
            seen_deps = set()
            in_deps = False
            for line in toml_lines:
                if line.strip() == '[tool.poetry.dependencies]':
                    in_deps = True
                    continue
                if in_deps:
                    if line.strip().startswith('['):
                        break
                    stripped = line.strip()
                    if not stripped or stripped.startswith('#'):
                        continue
                    if '=' in line:
                        name_part, ver_part = line.split('=', 1)
                        dep_name = name_part.strip().strip('"')
                        dep_version = ver_part.strip().strip('"')
                        if dep_name in seen_deps:  # Skip if already suggested
                            continue
                        seen_deps.add(dep_name)
                        if not dep_version or not dep_version[0].isdigit():
                            continue
                        # Only suggest for exact versions (no ^ or ~)
                        if dep_version.replace('.', '').isdigit():
                            ver_parts = dep_version.split('.')
                            try:
                                ver_parts[-1] = str(int(ver_parts[-1]) + 1)
                            except:
                                ver_parts.append('1')
                            new_ver = '.'.join(ver_parts)
                            old_line = line if line.endswith('\n') else line + '\n'
                            new_line = f"{dep_name} = \"{new_ver}\"\n"
                            diff_lines = difflib.unified_diff([old_line], [new_line], fromfile="a/pyproject.toml", tofile="b/pyproject.toml", lineterm='')
                            patch = ''.join(diff_lines)
                            if patch:
                                suggestions.append({
                                    'message': f"Update {dep_name} from {dep_version} to {new_ver} in pyproject.toml.",
                                    'patch': patch,
                                    'file_path': 'pyproject.toml'
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
