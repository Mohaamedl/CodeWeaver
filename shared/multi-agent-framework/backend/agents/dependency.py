import os
import difflib
from backend.agents.base import BaseAgent
from backend.chat_memory import ChatMemory

class DependencyAgent(BaseAgent):
    """Agent that checks for dependency updates (in requirements.txt or pyproject.toml)."""
    def run(self, repo_path: str, chat_memory: ChatMemory):
        suggestions = []
        # Check requirements.txt for pinned versions
        req_path = os.path.join(repo_path, 'requirements.txt')
        if os.path.isfile(req_path):
            try:
                with open(req_path, 'r') as f:
                    req_lines = f.readlines()
            except Exception as e:
                req_lines = []
            for line in req_lines:
                stripped = line.strip()
                if not stripped or stripped.startswith('#'):
                    continue
                if '==' in stripped:
                    pkg, ver = stripped.split('==', 1)
                    pkg = pkg.strip()
                    ver = ver.strip()
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
        # Check pyproject.toml for fixed versions
        pyproj_path = os.path.join(repo_path, 'pyproject.toml')
        if os.path.isfile(pyproj_path):
            try:
                with open(pyproj_path, 'r') as f:
                    toml_lines = f.readlines()
            except Exception as e:
                toml_lines = []
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
