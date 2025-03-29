import ast
import logging
import os
from typing import Any, Dict, List

from backend.agents.base import BaseAgent
from backend.chat_memory import ChatMemory

logger = logging.getLogger(__name__)

class LintingAgent(BaseAgent):
    """Agent that checks code for lint issues (e.g., print statements, style inconsistencies)."""
    def run(self, repo_path: str, chat_memory: Any, structure: Dict[str, Any] = None) -> List[dict]:
        logger.info(f"LintingAgent starting with repo_path: {repo_path}")
        logger.debug(f"Structure: {structure}")
        
        if not os.path.exists(repo_path):
            logger.error(f"Repository path does not exist: {repo_path}")
            return []
            
        suggestions = []
        
        # Skip these directories entirely
        SKIP_DIRS = {'.venv', 'venv', '.env', 'node_modules', '__pycache__', 
                    'site-packages', 'dist-packages', '.git'}
        
        # First handle TypeScript/JavaScript files from structure
        if structure and structure.get('children'):
            for file in self._get_all_files(structure['children']):
                if file['path'].endswith(('.ts', '.tsx', '.js', '.jsx')):
                    suggestions.append({
                        'message': f"Consider adding ESLint and Prettier configuration for {file['path']}",
                        'file_path': file['path'],
                        'patch': None
                    })
        
        # Then analyze Python files
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
                        original_lines = f.readlines()
                        file_text = ''.join(original_lines)
                except Exception as e:
                    continue
                try:
                    tree = ast.parse(file_text)
                except Exception as e:
                    continue
                print_nodes = []
                for node in ast.walk(tree):
                    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'print':
                        # skip print calls with keywords that we can't handle well (e.g., file=)
                        if any(k.arg and k.arg != 'end' and k.arg != 'sep' for k in node.keywords):
                            continue
                        print_nodes.append(node)
                if not print_nodes:
                    continue
                # Prepare modified file with logging
                new_file_text = file_text
                # Insert import logging if not present
                import_snippet = None
                if 'import logging' not in file_text:
                    # Determine insertion point (after shebang or module docstring if any)
                    insert_line = 0
                    if original_lines and original_lines[0].startswith('#!'):
                        insert_line = 1
                    # Check for module docstring
                    if len(tree.body) > 0 and isinstance(tree.body[0], ast.Expr) and isinstance(tree.body[0].value, ast.Constant) and isinstance(tree.body[0].value.value, str):
                        doc_node = tree.body[0].value
                        insert_line = doc_node.end_lineno or insert_line
                    insert_pos = sum(len(line) for line in original_lines[:insert_line])
                    import_snippet = 'import logging\n'
                    # Will insert later as part of replacements
                    # Actually insert now in text for subsequent char offsets to be correct
                    new_file_text = new_file_text[:insert_pos] + import_snippet + new_file_text[insert_pos:]
                # Sort print nodes by start position (lineno, col)
                print_nodes.sort(key=lambda n: (n.lineno, n.col_offset))
                # Apply replacements for print nodes from bottom to top (reverse order)
                for node in sorted(print_nodes, key=lambda n: (n.lineno, n.col_offset), reverse=True):
                    # Build logging call code
                    log_call = self._build_logging_call(node)
                    if log_call is None:
                        continue
                    # Compute char offsets for this print call in current new_file_text (which may include previous insert)
                    # We need to recalc using new_file_text content because if import was inserted, offsets shifted
                    # But easier: we adjust node.lineno if import was inserted at top
                    if import_snippet and ( (insert_line == 0) or (insert_line <= node.lineno - 1) ):
                        # If import inserted before this print's line, node's line offset needs to shift by 1
                        offset_lines = import_snippet.count('\n')
                        node_line = node.lineno + offset_lines
                        start_index = sum(len(line) for line in original_lines[:node.lineno-1]) + node.col_offset + len(import_snippet) if insert_line <= node.lineno - 1 else sum(len(line) for line in original_lines[:node.lineno-1]) + node.col_offset
                    else:
                        node_line = node.lineno
                        start_index = sum(len(line) for line in original_lines[:node_line-1]) + node.col_offset
                    end_index = sum(len(line) for line in original_lines[:node.end_lineno-1]) + node.end_col_offset
                    new_file_text = new_file_text[:start_index] + log_call + new_file_text[end_index:]
                # Generate diff patch
                import difflib
                new_lines = new_file_text.splitlines(True)
                diff_lines = difflib.unified_diff(original_lines, new_lines, fromfile=f"a/{rel_path}", tofile=f"b/{rel_path}", lineterm='')
                patch = ''.join(diff_lines)
                if patch:
                    suggestions.append({
                        'message': f"Replace print statements with logging in {rel_path}.",
                        'patch': patch,
                        'file_path': rel_path
                    })
        # Suggest indentation style fix if needed
        indent_style = chat_memory.inferred_prefs.get('indent_style')
        expected = chat_memory.user_prefs.get('indent_style')
        if expected and indent_style and indent_style != expected:
            if indent_style == 'mixed':
                msg = "Inconsistent indentation (mix of tabs and spaces) detected. Consider using spaces consistently."
            elif indent_style == 'tabs':
                msg = "Tabs are used for indentation, but spaces are recommended (PEP 8). Consider converting tabs to spaces."
            else:
                msg = f"Indentation style is {indent_style}, but expected {expected}. Consider standardizing the style."
            suggestions.append({'message': msg, 'patch': None, 'file_path': None})
        return suggestions

    def _build_logging_call(self, print_node):
        """Generate the code string for a logging.info call equivalent to the given print() call."""
        # Determine logging function (use info by default)
        func_call = "logging.info"
        # Build logging arguments
        args = print_node.args
        if len(args) == 0:
            # print() with no arguments -> logging.info('') to just print a blank line
            return f"{func_call}('')"
        if len(args) == 1:
            arg = args[0]
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                # single string
                return f"{func_call}({repr(arg.value)})"
            else:
                # single non-string -> use %r or just cast to str
                return f"{func_call}(f'{{{ast.unparse(arg)}}}')"
        # multiple args -> combine into one string
        parts = []
        for i, arg in enumerate(args):
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                parts.append(arg.value)
            else:
                parts.append('{' + ast.unparse(arg) + '}')
            if i < len(args) - 1:
                parts.append(' ')  # add space separator
        combined = ''.join(parts)
        return f"{func_call}(f'{combined}')"

    def _get_all_files(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        files = []
        for item in items:
            if item['type'] == 'file':
                files.append(item)
            elif item['type'] == 'directory' and item.get('children'):
                files.extend(self._get_all_files(item['children']))
        return files
