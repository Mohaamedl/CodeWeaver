import ast
import difflib
import logging
import os
from typing import Any, Dict, List, Optional

from backend.agents.base import BaseAgent
from backend.chat_memory import ChatMemory

logger = logging.getLogger(__name__)

class LintingAgent(BaseAgent):
    def _create_patch(self, content: str, file_path: str) -> Optional[Dict[str, Any]]:
        """Create a clean patch to convert prints to logging."""
        try:
            tree = ast.parse(content)
            content_lines = content.splitlines(keepends=True)
            
            # Find imports and prints
            has_logging = False
            has_logger = False
            print_nodes = []
            logging_lines = set()
            
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    if any(n.name == 'logging' for n in node.names):
                        has_logging = True
                elif isinstance(node, ast.Assign):
                    if isinstance(node.targets[0], ast.Name) and node.targets[0].id == 'logger':
                        has_logger = True
                elif isinstance(node, ast.Call):
                    if isinstance(node.func, ast.Name):
                        if node.func.id == 'print':
                            print_nodes.append(node)
                            continue
                    if (isinstance(node.func, ast.Attribute) and
                        isinstance(node.func.value, ast.Name) and
                        node.func.value.id == 'logger'):
                        logging_lines.add(node.lineno)

            # Skip if no prints or if already logged
            if not print_nodes or all(node.lineno in logging_lines for node in print_nodes):
                return None

            # Create clean patch
            new_lines = content_lines.copy()
            offset = 0
            
            # Add imports if needed
            if not has_logging:
                new_lines.insert(0, 'import logging\n')
                offset += 1
            if not has_logger:
                new_lines.insert(offset, 'logger = logging.getLogger(__name__)\n')
                offset += 1
            
            # Replace prints not followed by logging
            for node in print_nodes:
                if node.lineno not in logging_lines:
                    line_no = node.lineno - 1 + offset
                    indent = len(content_lines[node.lineno - 1]) - len(content_lines[node.lineno - 1].lstrip())
                    args = [ast.unparse(arg) for arg in node.args]
                    log_msg = f"{' ' * indent}logger.info({', '.join(args)})\n"
                    new_lines[line_no] = log_msg

            # Generate minimal diff
            diff = list(difflib.unified_diff(
                content_lines,
                new_lines,
                fromfile=f"a/{file_path}",
                tofile=f"b/{file_path}",
                n=0  # No context lines
            ))

            if diff:
                return {
                    'message': f"Replace redundant print statements with logging in {file_path}",
                    'file_path': file_path,
                    'patch': '\n'.join(diff)
                }

        except Exception as e:
            logger.error(f"Error creating patch: {e}")
        return None

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
                content_lines = content.splitlines(keepends=True)
                tree = ast.parse(content)

                # Find all print statements
                print_nodes = []
                for node in ast.walk(tree):
                    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'print':
                        print_nodes.append(node)

                if print_nodes:
                    # Create a copy of lines for modification
                    new_lines = content_lines.copy()

                    # Check if logging is already imported
                    has_logging_import = False
                    has_logger_setup = False
                    for node in ast.walk(tree):
                        if isinstance(node, ast.Import) and any(n.name == 'logging' for n in node.names):
                            has_logging_import = True
                        elif isinstance(node, ast.ImportFrom) and node.module == 'logging':
                            has_logging_import = True
                        elif isinstance(node, ast.Assign):
                            if isinstance(node.targets[0], ast.Name) and node.targets[0].id == 'logger':
                                has_logger_setup = True

                    # Add logging import and setup if needed
                    if not has_logging_import:
                        new_lines.insert(0, 'import logging\n')
                    if not has_logger_setup:
                        new_lines.insert(1, 'logger = logging.getLogger(__name__)\n')
                        if not new_lines[2].strip():  # Add a blank line after if there isn't one
                            new_lines.insert(2, '\n')

                    # Replace print statements with logging
                    for node in print_nodes:
                        # Calculate the correct line number
                        start_line = node.lineno - 1  # Convert to 0-based index
                        if not has_logging_import and not has_logger_setup:
                            start_line += 2  # Adjust for added imports
                        elif not has_logging_import or not has_logger_setup:
                            start_line += 1  # Adjust for one added import

                        # Get the original print statement
                        original_line = content_lines[node.lineno - 1]
                        indent = len(original_line) - len(original_line.lstrip())
                        indentation = original_line[:indent]

                        # Create the logging statement
                        args = []
                        for arg in node.args:
                            if isinstance(arg, ast.Constant):
                                args.append(repr(arg.value))
                            elif isinstance(arg, ast.Name):
                                args.append(f"{{{arg.id}}}")
                            elif isinstance(arg, ast.JoinedStr):  # f-string
                                args.append(ast.unparse(arg))
                            else:
                                args.append(f"{{{ast.unparse(arg)}}}")

                        if len(args) == 1:
                            log_msg = args[0]
                        else:
                            # Join with spaces and wrap in f-string if needed
                            log_msg = 'f"' + ' '.join(args).replace('"', '\\"') + '"'

                        # Replace the print statement with logging
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
