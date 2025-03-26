import os
import re
import difflib
from backend.db.database import SessionLocal
from backend.db.models import ReviewSession, Suggestion
from backend.agents.coder import CoderAgent
from backend.agents.llm_review import LLMReviewAgent
from backend.agents.refactoring import RefactoringAgent
from backend.agents.linting import LintingAgent
from backend.agents.dependency import DependencyAgent
from backend.agents.meta_review import MetaReviewAgent
from backend.chat_memory import ChatMemory

class AgentOrchestrator:
    def __init__(self):
        # Initialize agents
        self.coder_agent = CoderAgent()
        self.review_agents = [
            LintingAgent(),
            RefactoringAgent(),
            DependencyAgent(),
            LLMReviewAgent()
        ]
        self.meta_agent = MetaReviewAgent()

    def generate_code(self, prompt: str) -> str:
        """Generate code from a prompt using the CoderAgent."""
        # We can optionally use user preferences (language, style) from chat_memory
        chat_memory = ChatMemory()
        return self.coder_agent.run(prompt, chat_memory)

    def run_review(self, repo_path: str):
        """Run a multi-agent review on the given repository path."""
        db = SessionLocal()
        try:
            session_obj = ReviewSession(repo_path=repo_path)
            db.add(session_obj)
            # Instantiate shared chat memory and infer preferences
            chat_memory = ChatMemory()
            chat_memory.infer_preferences(repo_path)
            suggestions_all = []
            # Run each agent and collect suggestions
            for agent in self.review_agents:
                try:
                    agent_suggestions = agent.run(repo_path, chat_memory)
                except Exception as e:
                    # If an agent fails, skip it
                    print(f"Agent {agent.__class__.__name__} failed: {e}")
                    agent_suggestions = []
                for sugg in agent_suggestions:
                    # sugg is expected to be a dict with keys 'message', 'patch', 'file_path'
                    suggestion_model = Suggestion(
                        session=session_obj,
                        agent=agent.__class__.__name__,
                        message=sugg.get('message', ''),
                        patch=sugg.get('patch'),
                        file_path=sugg.get('file_path'),
                        status='pending'
                    )
                    db.add(suggestion_model)
                    suggestions_all.append(suggestion_model)
            # Flush to assign IDs to session and suggestions
            db.flush()
            # Run meta review agent to generate summary
            summary_text = self.meta_agent.run(suggestions_all, chat_memory)
            session_obj.summary = summary_text
            # Commit all changes
            db.commit()
            return session_obj, suggestions_all
        finally:
            db.close()

def apply_patch_to_file(patch: str, repo_path: str) -> bool:
    """
    Apply a unified diff patch string to the file in the given repository path.
    Returns True if successful, or False if something fails (file not found, etc.).
    """
    import logging
    logging.basicConfig(level=logging.DEBUG)

    logging.debug("=== apply_patch_to_file called ===")
    logging.debug("Repo path: %s", repo_path)
    logging.debug("Patch:\n%s", patch)

    lines = patch.splitlines()
    if not lines:
        logging.debug("Patch is empty.")
        return False

    target_file = None
    for line in lines:
        if line.startswith('+++ '):
            # Extract file path after '+++ b/' or '+++ '
            if line.startswith('+++ b/'):
                target_file = line[6:]
            else:
                target_file = line[4:]
            logging.debug("Discovered target file from diff: %s", target_file)
            break

    if target_file is None:
        logging.debug("Could not parse target file from patch. No '+++ ' line found.")
        return False

    file_path = os.path.join(repo_path, target_file)
    logging.debug("Full file path to patch: %s", file_path)

    try:
        with open(file_path, 'r') as f:
            original_lines = f.readlines()
        logging.debug("Successfully read original file: %d lines", len(original_lines))
    except FileNotFoundError:
        logging.debug("File not found: %s", file_path)
        return False
    except Exception as e:
        logging.debug("Exception reading file %s: %s", file_path, e)
        return False

    new_lines = []
    pointer = 0
    i = 0

    while i < len(lines):
        line = lines[i]
        # Skip lines that start with '--- ' or '+++ '
        if line.startswith('--- ') or line.startswith('+++ '):
            i += 1
            continue

        if line.startswith('@@'):
            # Hunk header
            import re
            m = re.match(r'^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@', line)
            if m:
                orig_start = int(m.group(1))
            else:
                orig_start = 1
            logging.debug("Found hunk header: %s -> original_start=%d", line, orig_start)

            orig_index = orig_start - 1
            # copy unchanged lines from pointer up to start of hunk
            if pointer < orig_index:
                logging.debug("Copying unchanged lines from pointer=%d to orig_index=%d", pointer, orig_index)
                new_lines.extend(original_lines[pointer:orig_index])
                pointer = orig_index

            i += 1
            # process hunk lines
            while i < len(lines) and not lines[i].startswith('@@'):
                hunk_line = lines[i]
                if hunk_line.startswith(' '):
                    # context line
                    new_lines.append(hunk_line[1:] + "\n")
                    pointer += 1
                elif hunk_line.startswith('-'):
                    # removed line
                    pointer += 1
                elif hunk_line.startswith('+'):
                    # added line
                    new_lines.append(hunk_line[1:] + "\n")
                i += 1
        else:
            # If we don't see '@@', '+++', or '---', skip
            i += 1

    # copy remaining lines after last hunk
    if pointer < len(original_lines):
        logging.debug("Copying remaining lines from pointer=%d to end (total %d).",
                      pointer, len(original_lines))
        new_lines.extend(original_lines[pointer:])

    # Write new content to file
    try:
        with open(file_path, 'w') as f:
            f.writelines(new_lines)
        logging.debug("Successfully wrote %d lines to %s", len(new_lines), file_path)
    except Exception as e:
        logging.debug("Exception writing patched file: %s", e)
        return False

    logging.debug("apply_patch_to_file completed successfully!")
    return True
