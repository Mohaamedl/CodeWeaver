import ast
import difflib
import os
import re
from backend.agents.base import BaseAgent
from backend.chat_memory import ChatMemory

class RefactoringAgent(BaseAgent):
    """Agent that suggests code refactorings (e.g., using modern syntax improvements)."""
    def run(self, repo_path: str, chat_memory: ChatMemory):
        suggestions = []
        for root, dirs, files in os.walk(repo_path):
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
                # Process each relevant AST node
                for node in ast.walk(tree):
                    # Suggest using f-string instead of '%' formatting
                    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod):
                        if isinstance(node.left, ast.Constant) and isinstance(node.left.value, str):
                            if isinstance(node.right, ast.Dict):
                                continue  # skip dictionary formatting cases
                            # Count placeholders vs values
                            left_str = node.left.value
                            if left_str.count('%') - left_str.count('%%') != (len(node.right.elts) if isinstance(node.right, ast.Tuple) else 1):
                                # placeholders count mismatch values count, skip
                                continue
                            if re.search(r'%\([A-Za-z0-9_]+\)', left_str):
                                continue  # skip named placeholders
                            # Build f-string content from left_str and values
                            values = list(node.right.elts) if isinstance(node.right, ast.Tuple) else [node.right]
                            result_str = ''
                            val_index = 0
                            i = 0
                            try:
                                while i < len(left_str):
                                    if left_str[i] == '%' and i+1 < len(left_str) and left_str[i+1] == '%':
                                        result_str += '%'
                                        i += 2
                                    elif left_str[i] == '%' and i+1 < len(left_str):
                                        # find specifier end
                                        j = i + 1
                                        while j < len(left_str) and not left_str[j].isalpha() and left_str[j] != '%':
                                            j += 1
                                        spec_char = left_str[j] if j < len(left_str) else ''
                                        if spec_char == '%':
                                            result_str += '%'
                                            i = j + 1
                                            continue
                                        format_spec = left_str[i+1:j]  # text between '%' and specifier char
                                        expr_code = '...'
                                        if val_index < len(values):
                                            expr_code = ast.unparse(values[val_index])
                                        val_index += 1
                                        # If format_spec contains width/precision, include it in f-string
                                        if spec_char:
                                            # remove positional $ if any
                                            format_spec = re.sub(r'\d+\$', '', format_spec)
                                            if format_spec or spec_char not in ('s', 'd', 'i'):
                                                expr_code = f"{expr_code}:{format_spec}{spec_char}"
                                        result_str += '{' + expr_code + '}'
                                        i = j + 1
                                    else:
                                        result_str += left_str[i]
                                        i += 1
                            except Exception as e:
                                # skip on any unexpected error in building f-string
                                continue
                            new_code = 'f' + repr(result_str)
                            # Generate unified diff patch
                            patch = self._generate_patch(file_text, original_lines, node.lineno, node.col_offset, node.end_lineno, node.end_col_offset, new_code, rel_path)
                            if patch:
                                suggestions.append({
                                    'message': f"Use f-string instead of '%' formatting in {rel_path}.",
                                    'patch': patch,
                                    'file_path': rel_path
                                })
                    # Suggest using f-string instead of .format()
                    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'format':
                        # Ensure it's a string literal calling format
                        if isinstance(node.func.value, ast.Constant) and isinstance(node.func.value.value, str):
                            fmt_str = node.func.value.value
                            # Skip if named placeholders present without matching keywords
                            if '{' in fmt_str:
                                # Quick check for unsupported features
                                if re.search(r'\{[^}]+\{', fmt_str):
                                    continue  # skip nested braces or complex
                            # Build f-string content by replacing placeholders with expressions
                            args = list(node.args)
                            kwargs = {kw.arg: kw.value for kw in node.keywords if kw.arg}
                            result_str = ''
                            arg_iter = iter(args)
                            i = 0
                            try:
                                while i < len(fmt_str):
                                    if fmt_str[i] == '{' and i+1 < len(fmt_str) and fmt_str[i+1] == '{':
                                        result_str += '{'
                                        i += 2
                                    elif fmt_str[i] == '}' and i+1 < len(fmt_str) and fmt_str[i+1] == '}':
                                        result_str += '}'
                                        i += 2
                                    elif fmt_str[i] == '{':
                                        end_brace = fmt_str.find('}', i)
                                        if end_brace == -1:
                                            break
                                        placeholder = fmt_str[i+1:end_brace]
                                        if placeholder == '':
                                            # sequential
                                            try:
                                                val_node = next(arg_iter)
                                            except StopIteration:
                                                val_node = None
                                            expr_code = ast.unparse(val_node) if val_node is not None else '...'
                                        else:
                                            # maybe with format spec or index
                                            name_part, fmt_part = (placeholder.split(':', 1) + [''])[:2]
                                            expr_code = '...'
                                            if name_part.isdigit():
                                                idx = int(name_part)
                                                if idx < len(args):
                                                    expr_code = ast.unparse(args[idx])
                                            elif name_part.isidentifier():
                                                if name_part in kwargs:
                                                    expr_code = ast.unparse(kwargs[name_part])
                                            else:
                                                # complex placeholder (attribute/index access) not handled
                                                expr_code = None
                                            if expr_code is None:
                                                # skip if cannot handle
                                                result_str = None
                                                break
                                            if fmt_part:
                                                expr_code = f"{expr_code}:{fmt_part}"
                                        if result_str is None:
                                            break
                                        result_str += '{' + expr_code + '}'
                                        i = end_brace + 1
                                    else:
                                        result_str += fmt_str[i]
                                        i += 1
                            except Exception as e:
                                continue
                            if result_str is None:
                                continue
                            new_code = 'f' + repr(result_str)
                            patch = self._generate_patch(file_text, original_lines, node.func.value.lineno, node.func.value.col_offset, node.lineno, node.end_col_offset, new_code, rel_path)
                            if patch:
                                suggestions.append({
                                    'message': f"Use f-string instead of .format() in {rel_path}.",
                                    'patch': patch,
                                    'file_path': rel_path
                                })
                    # Suggest using 'is' for None comparisons
                    if isinstance(node, ast.Compare) and len(node.ops) == 1 and isinstance(node.comparators[0], ast.Constant) and node.comparators[0].value is None:
                        if isinstance(node.ops[0], ast.Eq) or isinstance(node.ops[0], ast.NotEq):
                            # Only handle simple x == None or x != None (not if multiple comparators)
                            new_cmp = ast.Compare(left=node.left, ops=[ast.Is() if isinstance(node.ops[0], ast.Eq) else ast.IsNot()], comparators=node.comparators)
                            new_code = ast.unparse(new_cmp)
                            patch = self._generate_patch(file_text, original_lines, node.lineno, node.col_offset, node.end_lineno, node.end_col_offset, new_code, rel_path)
                            if patch:
                                suggestions.append({
                                    'message': f"Use 'is' / 'is not' for None comparison in {rel_path}.",
                                    'patch': patch,
                                    'file_path': rel_path
                                })
        return suggestions

def _generate_patch(self, file_text, original_lines, lineno, col_offset, end_lineno, end_col_offset, new_code, rel_path):
    """Generate unified diff patch for replacing text from (lineno,col_offset) to (end_lineno,end_col_offset) with new_code."""
    start_index = sum(len(line) for line in original_lines[:lineno - 1]) + col_offset
    end_index = sum(len(line) for line in original_lines[:end_lineno - 1]) + end_col_offset
    new_file_text = file_text[:start_index] + new_code + file_text[end_index:]

    original_lines = file_text.splitlines(keepends=True)
    new_lines = new_file_text.splitlines(keepends=True)

    diff_lines = list(difflib.unified_diff(
        original_lines,
        new_lines,
        fromfile=f"a/{rel_path}",
        tofile=f"b/{rel_path}",
        lineterm=''  # important: don't append extra newlines
    ))

    print("=== DIFF LINES ===")
    for line in diff_lines:
        print(repr(line))

    patch = '\n'.join(diff_lines) + '\n'
    return patch if patch else None

