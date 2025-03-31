import os
import ast
import json
import subprocess
import requests
import asyncio
from typing import List, Dict, Any, Optional

# Assume BaseAgent and ChatMemory are defined in the code review system.
from backend.agents.base import BaseAgent  
from backend.chat_memory import ChatMemory

class ArchAgent(BaseAgent):
    """
    An agent that analyzes a Python codebase for architectural issues such as 
    god classes, high complexity, poor modularity, etc., and suggests improvements.
    """

    def __init__(self):
        # Configuration: thresholds and tool settings can be adjusted here for extensibility.
        self.max_class_attributes = 7    # Pylint default for R0902 (too-many-instance-attributes)
        self.max_class_methods = 20      # Pylint default for R0904 (too-many-public-methods)
        self.max_inheritance_depth = 7   # Pylint default for R0901 (too-many-ancestors)
        self.max_function_length = 50    # custom threshold for long function (lines of code)
        self.max_complexity = 10         # Cyclomatic complexity threshold where refactoring is suggested
        self.min_maintainability_index = 10  # MI below this indicates poor maintainability (Radon MI scale)

    async def run(self, repo_path: str, chat_memory: Optional[ChatMemory] = None) -> List[Dict[str, Any]]:
        """
        Asynchronously run all checks in parallel, then combine their findings
        into one final architectural report. Returns a list of suggestions (dicts).
        """
        # 1) Basic existence check
        if not os.path.isdir(repo_path):
            return [{
                "message": f"Repository path {repo_path} not found.",
                "patch": None,
                "file_path": None
            }]

        loop = asyncio.get_event_loop()

        # 2) Prepare tasks for each analysis function (each running in an Executor).
        tasks = [
            loop.run_in_executor(None, self._run_pylint_analysis, repo_path),
            loop.run_in_executor(None, self._run_pyflakes, repo_path),
            loop.run_in_executor(None, self._run_bandit, repo_path),
            loop.run_in_executor(None, self._run_mypy, repo_path),
            loop.run_in_executor(None, self._run_radon_metrics, repo_path),
            loop.run_in_executor(None, self._run_ast_inspection, repo_path),
        ]

        # 3) Await all tasks concurrently.
        # results is a list of lists of string findings from each function.
        partial_results = await asyncio.gather(*tasks)

        # 4) Flatten all findings into a single list.
        findings = []
        for result_list in partial_results:
            findings.extend(result_list)

        # 5) If configured, run your LLM commentary asynchronously (assuming it’s also an async method).
        #    If _run_llm_commentary is synchronous, also do run_in_executor or rewrite it to async.
        llm_commentary = self._run_llm_commentary(findings, chat_memory)
        if llm_commentary:
            findings.append("**Additional AI Commentary:**\n" + llm_commentary.strip())

        # 6) Build final summary as a single Markdown string
        report = self._format_report(findings)

        # 7) Return it as a single suggestion in the standard format
        return [{
            "message": report,
            "patch": None,
            "file_path": None
        }]


    def _run_pylint_analysis(self, repo_path: str) -> List[str]:
        """Run Pylint on the repo and collect relevant architectural warnings."""
        results = []
        try:
            # Run pylint with JSON output for easier parsing
            # Only enable relevant categories: design, complexity, refactor (R), warnings (W) 
            # (including global usage, etc.), and errors (E) for any fatal issues.
            cmd = [
                "pylint", repo_path,
                "-j", "0",  # use all CPUs
                "--output-format=json",
                "--enable=R,C,W,E"
            ]
            completed = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if completed.stdout:
                pylint_msgs = json.loads(completed.stdout)
            else:
                pylint_msgs = []
        except Exception as e:
            # If pylint fails (not installed or error), return empty findings with a notice.
            return [f"*Pylint analysis skipped due to error: {e}*"]

        # Filter messages for design and complexity related ones
        for msg in pylint_msgs:
            msg_id = msg.get("symbol") or msg.get("message-id")
            message = msg.get("message", "")
            obj = msg.get("obj", "")
            path = msg.get("path", "")
            line = msg.get("line")
            if not msg_id:
                continue

            # Check for specific Pylint codes indicating architectural issues
            if msg_id in ("too-many-instance-attributes", "too-many-public-methods",
                          "too-many-ancestors", "too-many-locals", "too-many-branches",
                          "too-many-statements", "too-many-arguments"):
                # These indicate god class or overly complex function
                results.append(f"- **Pylint:** {message} in `{obj}` at {path}:{line}")
            elif msg_id == "global-statement":  # W0603: using "global" keyword
                results.append(f"- **Pylint:** Global keyword used in {path}:{line} – consider avoiding global state")
            elif msg_id == "global-variable-not-assigned":  # W0602: global var modified without global decl
                results.append(f"- **Pylint:** Possible global variable modification in {path}:{line} – global state detected")
            # We could include more messages or more granular filtering as needed.

        return results

    def _run_pyflakes(self, repo_path: str) -> List[str]:
        """Run Pyflakes (via flake8 or directly) to catch unused imports/variables."""
        results = []
        try:
            # Using flake8 as a convenient way to run pyflakes + pycodestyle
            cmd = ["flake8", "--select=F", repo_path]  # 'F' selects Pyflakes messages in flake8
            completed = subprocess.run(cmd, capture_output=True, text=True, check=False)
            output = completed.stdout.strip().splitlines()
        except Exception as e:
            return [f"*Pyflakes analysis skipped due to error: {e}*"]

        for line in output:
            # Flake8 output format: path:line:col: code message
            # e.g., "module.py:10:1: F401 'os' imported but unused"
            parts = line.split(":", 3)
            if len(parts) == 4:
                file_path, line_no, _col, message = parts
                # Only focus on unused imports or variables (F401, F841 etc.)
                if "imported but unused" in message or "assigned to but never used" in message:
                    # Suggest removing the unused import/variable
                    if "imported but unused" in message:
                        suggestion = f"- **Pyflakes:** {message} at {file_path}:{line_no}. Suggest removing the import."
                    else:
                        suggestion = f"- **Pyflakes:** {message} at {file_path}:{line_no}. Consider removing the variable or using it."
                    results.append(suggestion)
        return results

    def _run_bandit(self, repo_path: str) -> List[str]:
        """Run Bandit security analysis and capture any high-severity issues (which might hint at design flaws)."""
        results = []
        try:
            cmd = ["bandit", "-q", "-r", repo_path, "-f", "json"]  # -q to suppress output except JSON
            completed = subprocess.run(cmd, capture_output=True, text=True, check=False)
            data = json.loads(completed.stdout) if completed.stdout else {}
        except Exception as e:
            return [f"*Bandit analysis skipped due to error: {e}*"]

        # Bandit JSON has 'results' list with issues
        for issue in data.get("results", []):
            severity = issue.get("issue_severity")
            conf = issue.get("issue_confidence")
            issue_text = issue.get("issue_text", "")
            loc = issue.get("filename", "") + f":{issue.get('line_number', '')}"
            if severity in ("HIGH", "MEDIUM"):
                # Only include more significant issues
                results.append(f"- **Bandit:** {issue_text} (severity {severity}) at {loc}")
        return results

    def _run_mypy(self, repo_path: str) -> List[str]:
        """Run mypy type checking to find type inconsistency issues."""
        results = []
        try:
            cmd = ["mypy", "--ignore-missing-imports", "--hide-error-context", "--no-color-output", repo_path]
            completed = subprocess.run(cmd, capture_output=True, text=True, check=False)
            output_lines = completed.stdout.strip().splitlines()
        except Exception as e:
            return [f"*Mypy analysis skipped due to error: {e}*"]

        # Each mypy error line: "file.py:line: error: Message [code]"
        for line in output_lines:
            if line.endswith("error:") or " error: " in line:
                # Simplify the message, ignore codes in [] for brevity
                msg = line
                # Optionally, filter only design-relevant type issues (but we'll include all for completeness)
                results.append(f"- **Mypy:** {msg}")
        return results

    def _run_radon_metrics(self, repo_path: str) -> List[str]:
        """Compute complexity and maintainability metrics using Radon."""
        from radon.complexity import cc_visit, cc_rank
        from radon.metrics import mi_visit, mi_rank

        results = []
        # Walk through repository files
        for root, _, files in os.walk(repo_path):
            for file in files:
                if file.endswith(".py"):
                    file_path = os.path.join(root, file)
                    try:
                        code = open(file_path, "r").read()
                    except Exception:
                        continue  # skip unreadable files
                    # Cyclomatic Complexity analysis
                    try:
                        functions = cc_visit(code)  # list of Function or Class objects with complexity
                    except Exception:
                        functions = []
                    for func in functions:
                        # If complexity exceeds threshold, report it
                        if func.complexity > self.max_complexity:
                            name = func.name
                            results.append(f"- **Complexity:** `{name}` in `{file_path}` has cyclomatic complexity {func.complexity} (high).")
                    # Maintainability Index analysis (on a per-file basis)
                    try:
                        mi_score = mi_visit(code, False)  # compute maintainability index for this file
                        # mi_visit returns an MI score (possibly in the 0-100 range or Radon’s scale)
                        if mi_score is not None:
                            # Radon's mi_rank gives A/B/C, where C is lowest maintainability&#8203;:contentReference[oaicite:5]{index=5}.
                            rank = mi_rank(mi_score)
                            if rank == "C" or (isinstance(mi_score, (int, float)) and mi_score < self.min_maintainability_index):
                                results.append(f"- **Maintainability:** `{file_path}` has low maintainability index (MI={mi_score:.1f}, rank {rank}).")
                    except Exception:
                        # ignore files that Radon fails to parse (e.g., syntax errors)
                        continue
        return results

    def _run_ast_inspection(self, repo_path: str) -> List[str]:
        """Custom AST analysis for global mutable state, circular dependencies, etc."""
        results = []
        # Track import dependencies and global assignments
        import_graph: Dict[str, List[str]] = {}  # module -> list of modules it imports
        global_mutations: List[str] = []         # descriptions of global state usage

        for root, _, files in os.walk(repo_path):
            for file in files:
                if file.endswith(".py"):
                    file_path = os.path.join(root, file)
                    module_name = os.path.relpath(file_path, repo_path).replace(os.sep, ".")[:-3]  # rough module name
                    import_graph[module_name] = []
                    try:
                        with open(file_path, "r") as f:
                            source = f.read()
                        tree = ast.parse(source, filename=file_path)
                    except Exception:
                        continue
                    # Find imports and global assignments
                    for node in ast.walk(tree):
                        # Imports
                        if isinstance(node, ast.Import):
                            for alias in node.names:
                                imported = alias.name  # module being imported
                                import_graph[module_name].append(imported)
                        if isinstance(node, ast.ImportFrom):
                            if node.module:
                                # relative imports to absolute module name (approximate)
                                imported = node.module
                                import_graph[module_name].append(imported)
                        # Global assignments detection
                        if isinstance(node, ast.Global):
                            # A global statement inside a function signals global mutable usage
                            for var in node.names:
                                global_mutations.append(f"Global variable `{var}` declared in {file_path} at line {node.lineno}.")
                        # Look for module-level mutable definitions and usage
                        if isinstance(node, ast.Assign):
                            if isinstance(node.targets[0], ast.Name) and isinstance(node.value, (ast.List, ast.Dict, ast.Set)):
                                # Mutable object assigned at module level
                                var_name = node.targets[0].id
                                # Check if this var is later mutated (by appearance in ast.Call or ast.Attribute)
                                # Simple heuristic: if the name is used anywhere as an object in the code
                                # (Full data flow analysis is complex; we'll flag the existence of global mutable declarations)
                                global_mutations.append(f"Global mutable `{var_name}` defined in {file_path} at line {node.lineno} (could indicate global state).")

        # Detect circular dependencies in import graph (very simple cycle detection)
        visited = set()
        def dfs(mod, stack):
            visited.add(mod)
            stack.append(mod)
            for dep in import_graph.get(mod, []):
                if dep in stack:
                    # Found a cycle
                    cycle = stack[stack.index(dep):] + [dep]
                    results.append(f"- **Dependency:** Circular import detected: {' -> '.join(cycle)}")
                elif dep not in visited:
                    dfs(dep, stack)
            stack.pop()
        for module in import_graph:
            if module not in visited:
                dfs(module, [])

        # Summarize global mutable state findings
        for gm in set(global_mutations):
            results.append(f"- **Global State:** {gm}")

        return results

    def _run_llm_commentary(self, findings: List[str], chat_memory: Optional[ChatMemory]) -> str:
        summary = "\n".join(findings)
        prompt = (
            "You are an expert software architect. "
            "The following issues were detected in the code:\n"
            f"{summary}\n"
            "Provide a brief architectural review, addressing these issues and suggesting improvements."
        )
        if chat_memory is None or len(findings) == 0:
            return ""
        try:
            groq_api_key = os.environ.get("GROQ_API_KEY")
            if not groq_api_key:
                raise ValueError("GROQ_API_KEY not set in environment")

            payload = {
                "model": "mistral-saba-24b",
                "messages": [
                    {"role": "system", "content": "You are a coding assistant AI."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7
            }

            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {groq_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            return response.json()['choices'][0]['message']['content']
        except Exception as e:
            return f"(LLM commentary unavailable: {e})"

    def _format_report(self, findings: List[str]) -> str:
        """Format the collected findings into a human-readable Markdown report."""
        if not findings:
            return "✅ **Architectural Review**: No major architectural issues detected. The code structure looks good."

        report_lines = ["## Architectural Review Findings"]
        # Group findings by category (prefix before the colon, e.g., Pylint, Complexity, Global State)
        categorized: Dict[str, List[str]] = {}
        for item in findings:
            if item.startswith("- **"):
                # category is within ** ** at start of item
                end_idx = item.find(":**")
                if end_idx != -1:
                    category = item[3:end_idx]  # text after "- **" and before "**"
                else:
                    category = "Other"
            else:
                category = "Other"
            categorized.setdefault(category, []).append(item)

        # Construct sections for each category
        for category, items in categorized.items():
            # Skip category title if we used the ** prefix already in bullet (to avoid repetition)
            # We'll just list them under a general section if needed
            if category.lower() in {"pylint", "pyflakes", "bandit", "mypy", "complexity", "maintainability", "global state", "dependency"}:
                # Use category as subheading
                report_lines.append(f"**{category} Issues:**")
            else:
                report_lines.append(f"**{category}:**")
            for it in items:
                report_lines.append(it)
            report_lines.append("")  # blank line after each category group

        # Provide refactoring suggestions section
        report_lines.append("## Suggested Refactorings")
        # For simplicity, echo the findings as suggestions (in a real scenario we would refine these into specific actions)
        for item in findings:
            # Convert each finding into a suggestion sentence (if not already phrased as suggestion)
            suggestion = item
            # Minor tweaks: if suggestion contains 'consider' or 'suggest', it's already advisory.
            # Otherwise, add a generic recommendation phrasing.
            if "consider" not in suggestion.lower() and "suggest" not in suggestion.lower():
                suggestion = suggestion.rstrip('.')
                suggestion += ". Consider addressing this issue."
            # Remove the bullet prefix for suggestion list if present
            if suggestion.startswith("- "):
                suggestion = suggestion[2:]
            report_lines.append(f"- {suggestion}")
        report_lines.append("")  # end with a blank line
        return "\n".join(report_lines)
