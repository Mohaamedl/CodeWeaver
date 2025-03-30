import ast
import difflib
import logging
import os
from typing import Any, Dict, List, Optional

from backend.agents.base import BaseAgent
from backend.chat_memory import ChatMemory

logger = logging.getLogger(__name__)

class LintingAgent(BaseAgent):
    """Agent that checks code for lint issues (e.g., print statements, style inconsistencies)."""

    async def analyze_files(
        self,
        files: List[Dict[str, Any]],
        chat_memory: ChatMemory,
        structure: Optional[Dict[str, Any]] = None,
        github_info: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        suggestions = []
        for file in files:
            if not file['path'].endswith('.py'):
                continue

            try:
                content = file['content']
                tree = ast.parse(content)
                
                # Check for print statements
                print_nodes = []
                content_lines = content.splitlines(keepends=True)
                
                for node in ast.walk(tree):
                    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'print':
                        print_nodes.append(node)
                
                if print_nodes:
                    # Create a patch to replace print statements with logging
                    new_lines = content_lines.copy()
                    
                    # Add logging import if not present
                    if 'import logging' not in content and 'from logging import' not in content:
                        new_lines.insert(0, 'import logging\n\n')
                    
                    # Add logger setup if not present
                    logger_setup = 'logger = logging.getLogger(__name__)\n\n'
                    if logger_setup not in content:
                        # Find the best place to insert logger setup (after imports)
                        insert_pos = 0
                        for i, line in enumerate(new_lines):
                            if line.startswith(('import ', 'from ')):
                                insert_pos = i + 1
                        new_lines.insert(insert_pos, logger_setup)
                    
                    # Replace print statements with logging
                    for node in print_nodes:
                        start_line = node.lineno - 1  # Convert to 0-based index
                        
                        # Get the original print statement
                        original_line = content_lines[start_line]
                        indent = len(original_line) - len(original_line.lstrip())
                        indentation = original_line[:indent]
                        
                        # Create the logging statement
                        args = []
                        for arg in node.args:
                            if isinstance(arg, ast.Constant):
                                args.append(repr(arg.value))
                            elif isinstance(arg, ast.Name):
                                args.append(arg.id)
                            else:
                                args.append(ast.unparse(arg))
                        
                        log_msg = ', '.join(args)
                        new_line = f"{indentation}logger.info({log_msg})\n"
                        new_lines[start_line] = new_line
                    
                    # Generate unified diff
                    diff = difflib.unified_diff(
                        content_lines,
                        new_lines,
                        fromfile=f"a/{file['path']}",
                        tofile=f"b/{file['path']}",
                        lineterm=''
                    )
                    
                    suggestions.append({
                        'message': f"Replace print statements with logging in {file['path']}",
                        'file_path': file['path'],
                        'patch': '\n'.join(diff)
                    })
                    
            except Exception as e:
                logger.error(f"Error analyzing {file['path']}: {e}")
                continue

        return suggestions

    async def analyze_local(
        self,
        repo_path: str,
        chat_memory: ChatMemory,
        structure: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        # Local analysis logic
        suggestions = []
        
        # Skip these directories entirely
        SKIP_DIRS = {'.venv', 'venv', '.env', 'node_modules', '__pycache__', 
                    'site-packages', 'dist-packages', '.git'}
        
        repo_path = os.path.realpath(repo_path)
        for root, dirs, files in os.walk(repo_path):
            # Remove excluded dirs from dirs list to prevent recursion into them
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            
            # Skip if we're in an excluded directory
            if any(skip_dir in root.split(os.sep) for skip_dir in SKIP_DIRS):
                continue
                
            # Check if we're inside the project directory
            if not os.path.realpath(root).startswith(repo_path):
                continue

            for file in files:
                if not file.endswith('.py'):
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, repo_path)
                try:
                    with open(file_path, 'r') as f:
                        content = f.read()
                    tree = ast.parse(content)
                    
                    # Check for print statements
                    print_nodes = []
                    content_lines = content.splitlines(keepends=True)
                    
                    for node in ast.walk(tree):
                        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'print':
                            print_nodes.append(node)
                    
                    if print_nodes:
                        # Create a patch to replace print statements with logging
                        new_lines = content_lines.copy()
                        
                        # Add logging import if not present
                        if 'import logging' not in content and 'from logging import' not in content:
                            new_lines.insert(0, 'import logging\n\n')
                        
                        # Add logger setup if not present
                        logger_setup = 'logger = logging.getLogger(__name__)\n\n'
                        if logger_setup not in content:
                            # Find the best place to insert logger setup (after imports)
                            insert_pos = 0
                            for i, line in enumerate(new_lines):
                                if line.startswith(('import ', 'from ')):
                                    insert_pos = i + 1
                            new_lines.insert(insert_pos, logger_setup)
                        
                        # Replace print statements with logging
                        for node in print_nodes:
                            start_line = node.lineno - 1  # Convert to 0-based index
                            
                            # Get the original print statement
                            original_line = content_lines[start_line]
                            indent = len(original_line) - len(original_line.lstrip())
                            indentation = original_line[:indent]
                            
                            # Create the logging statement
                            args = []
                            for arg in node.args:
                                if isinstance(arg, ast.Constant):
                                    args.append(repr(arg.value))
                                elif isinstance(arg, ast.Name):
                                    args.append(arg.id)
                                else:
                                    args.append(ast.unparse(arg))
                            
                            log_msg = ', '.join(args)
                            new_line = f"{indentation}logger.info({log_msg})\n"
                            new_lines[start_line] = new_line
                        
                        # Generate unified diff
                        diff = difflib.unified_diff(
                            content_lines,
                            new_lines,
                            fromfile=f"a/{rel_path}",
                            tofile=f"b/{rel_path}",
                            lineterm=''
                        )
                        
                        suggestions.append({
                            'message': f"Replace print statements with logging in {rel_path}",
                            'file_path': rel_path,
                            'patch': '\n'.join(diff)
                        })
                        
                except Exception as e:
                    logger.error(f"Error analyzing {rel_path}: {e}")
                    continue
                    
        return suggestions

    def _get_all_files(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        files = []
        for item in items:
            if item['type'] == 'file':
                files.append(item)
            elif item['type'] == 'directory' and item.get('children'):
                files.extend(self._get_all_files(item['children']))
        return files
