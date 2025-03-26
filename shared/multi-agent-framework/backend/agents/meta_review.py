import re
from backend.agents.base import BaseAgent
from backend.chat_memory import ChatMemory

class MetaReviewAgent(BaseAgent):
    """Agent that aggregates suggestions and produces an overall summary."""
    def run(self, suggestions_list, chat_memory: ChatMemory):
        if not suggestions_list:
            return "No significant issues were found in the code."
        # Categorize suggestions by agent
        agent_categories = {s.agent for s in suggestions_list}
        parts = []
        # Code style (LintingAgent)
        if 'LintingAgent' in agent_categories:
            has_print = any('print' in s.message for s in suggestions_list if s.agent == 'LintingAgent')
            has_indent = any('indentation' in s.message or 'indent' in s.message for s in suggestions_list if s.agent == 'LintingAgent')
            style_issues = []
            if has_print:
                style_issues.append("replacing print statements with proper logging")
            if has_indent:
                style_issues.append("consistent indentation style")
            if style_issues:
                parts.append(f"Code style suggestions include {', '.join(style_issues)}")
        # Refactoring (RefactoringAgent)
        if 'RefactoringAgent' in agent_categories:
            has_fstring = any('f-string' in s.message for s in suggestions_list if s.agent == 'RefactoringAgent')
            has_none = any('None' in s.message and 'is' in s.message for s in suggestions_list if s.agent == 'RefactoringAgent')
            ref_issues = []
            if has_fstring:
                ref_issues.append("using f-strings for string formatting")
            if has_none:
                ref_issues.append("using 'is' for None comparisons")
            if ref_issues:
                parts.append(f"Refactoring suggestions include {', '.join(ref_issues)}")
        # Dependencies (DependencyAgent)
        if 'DependencyAgent' in agent_categories:
            dep_msgs = [s.message for s in suggestions_list if s.agent == 'DependencyAgent']
            dep_names = []
            for msg in dep_msgs:
                m = re.match(r'Update ([^ ]+)', msg)
                if m:
                    dep_names.append(m.group(1))
            dep_names = list(dict.fromkeys(dep_names))
            if dep_names:
                example_deps = ', '.join(dep_names[:2])
                if len(dep_names) > 2:
                    example_deps += ', etc.'
                parts.append(f"Dependency suggestions include updating packages (e.g. {example_deps})")
        # General issues (LLMReviewAgent)
        if 'LLMReviewAgent' in agent_categories:
            general_msgs = [s.message for s in suggestions_list if s.agent == 'LLMReviewAgent']
            gen_issues = []
            if any('TODO' in msg for msg in general_msgs):
                gen_issues.append("addressing TODO comments left in code")
            if any('password' in msg.lower() for msg in general_msgs):
                gen_issues.append("removing hardcoded credentials")
            if any('eval' in msg or 'exec' in msg for msg in general_msgs):
                gen_issues.append("avoiding use of eval/exec")
            if gen_issues:
                parts.append(f"General suggestions include {', '.join(gen_issues)}")
        # Construct summary
        summary = "; ".join(parts) + '.'
        # Mention primary language
        lang = chat_memory.inferred_prefs.get('language')
        if lang and lang != 'Unknown':
            summary = f"Primary language: {lang}. " + summary
        return summary
