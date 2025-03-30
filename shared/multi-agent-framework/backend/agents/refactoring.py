import ast
import difflib
import logging
from typing import Any, Dict, List, Optional

from backend.agents.base import BaseAgent
from backend.chat_memory import ChatMemory

logger = logging.getLogger(__name__)


class RefactoringAgent(BaseAgent):
    """Agent that suggests code refactoring improvements."""
    
    async def analyze_files(
        self,
        files: List[Dict[str, Any]],
        chat_memory: ChatMemory,
        structure: Optional[Dict[str, Any]] = None,
        github_info: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """Analyze files from GitHub API."""
        suggestions = []
        
        for file in files:
            if not file['path'].endswith('.py'):
                continue

            try:
                content = file['content']
                tree = ast.parse(content)
                content_lines = content.splitlines(keepends=True)
                
                # Check for old-style string formatting
                for node in ast.walk(tree):
                    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod):
                        if isinstance(node.left, ast.Str):
                            # Create a patch to replace %-formatting with f-strings
                            new_lines = content_lines.copy()
                            start_line = node.lineno - 1
                            
                            # Get the original line and its indentation
                            original_line = content_lines[start_line]
                            indent = len(original_line) - len(original_line.lstrip())
                            indentation = original_line[:indent]
                            
                            # Convert %-formatting to f-string
                            format_str = ast.unparse(node.left)
                            format_args = ast.unparse(node.right)
                            
                            # Handle different cases of format args
                            if format_args.startswith('(') and format_args.endswith(')'):
                                format_args = format_args[1:-1]
                            
                            # Replace %s, %d etc with {}
                            import re
                            format_str = format_str.strip("'").strip('"')
                            format_str = re.sub(r'%[sdfr]', '{}', format_str)
                            
                            new_line = f"{indentation}f'{format_str}'.format({format_args})\n"
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
                                'message': f"Replace old-style string formatting with f-strings in {file['path']}",
                                'file_path': file['path'],
                                'patch': '\n'.join(diff)
                            })
                            break
                    
                    # Check for None comparisons
                    if isinstance(node, ast.Compare):
                        for op in node.ops:
                            if isinstance(op, ast.Is) and isinstance(node.comparators[0], ast.Constant) and node.comparators[0].value is None:
                                # Create a patch to fix None comparison
                                new_lines = content_lines.copy()
                                start_line = node.lineno - 1
                                
                                # Get the original line and its indentation
                                original_line = content_lines[start_line]
                                indent = len(original_line) - len(original_line.lstrip())
                                indentation = original_line[:indent]
                                
                                # Replace == None with is None
                                new_line = original_line.replace('== None', 'is None')
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
                                    'message': f"Use 'is None' instead of '== None' in {file['path']}",
                                    'file_path': file['path'],
                                    'patch': '\n'.join(diff)
                                })
                                break
                    
                    # Check for long functions
                    if isinstance(node, ast.FunctionDef) and len(node.body) > 50:
                        # For long functions, we'll just suggest splitting but won't generate a patch
                        # as this requires more complex refactoring
                        suggestions.append({
                            'message': f"Function '{node.name}' in {file['path']} is too long (over 50 lines). Consider breaking it down.",
                            'file_path': file['path'],
                            'patch': None
                        })
                        break
                        
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
        """Legacy method for local repository analysis."""
        return await self.run(chat_memory, repo_path=repo_path, structure=structure)

