import difflib
import logging
import os
import re
from typing import Any, Dict, List, Tuple

from backend.agents.coder import CoderAgent
from backend.agents.dependency import DependencyAgent
from backend.agents.linting import LintingAgent
from backend.agents.llm_review import LLMReviewAgent
from backend.agents.meta_review import MetaReviewAgent
from backend.agents.refactoring import RefactoringAgent
from backend.chat_memory import ChatMemory
from backend.db.database import SessionLocal
from backend.db.models import ReviewSession, Suggestion

logger = logging.getLogger(__name__)

class AgentOrchestrator:
    def __init__(self):
        self.chat_memory = ChatMemory()
        self.agent_stats = {}  # Track suggestions per agent
        # Initialize all agents
        self.agents = [
            LintingAgent(),
            RefactoringAgent(),
            DependencyAgent(),
            LLMReviewAgent()
        ]
        logger.info(f"Initialized {len(self.agents)} agents")

    def generate_code(self, prompt: str) -> str:
        """Generate code from a prompt using the CoderAgent."""
        # We can optionally use user preferences (language, style) from chat_memory
        return CoderAgent().run(prompt, self.chat_memory)

    def get_agent_stats(self):
        return self.agent_stats

    def run_review(self, repo_path: str, structure: Dict[str, Any] | None = None, github_info: Dict[str, Any] | None = None) -> Tuple[ReviewSession, List[dict]]:
        """Run all agents on the repository."""
        logger.info(f"Starting review for repository: {repo_path}")
        logger.info(f"GitHub info available: {bool(github_info)}")
        self.agent_stats = {}  # Reset stats

        try:
            if github_info and github_info.get('token'):
                logger.info("Using GitHub API for direct access")
                from backend.services.github import GitHubAPI
                github_api = GitHubAPI(github_info['token'])
            else:
                logger.warning("No GitHub token provided, will need to use local repository")

            if not os.path.exists(repo_path):
                if github_info and github_info.get('token'):
                    logger.info(f"Attempting to use GitHub API for {github_info['owner']}/{github_info['repo']}")
                    try:
                        # Get repository info from GitHub API
                        repo_info = github_api.get_repo_info(github_info['owner'], github_info['repo'])
                        logger.info(f"Successfully got repo info from GitHub API: {repo_info['full_name']}")
                    except Exception as e:
                        logger.error(f"Failed to access repository via GitHub API: {e}")
                        raise ValueError(f"Cannot access repository: {str(e)}")
                else:
                    logger.error("No GitHub info provided and repository path doesn't exist")
                    raise ValueError("Repository not accessible")

            # Extract owner/repo from path if it's in that format
            try:
                owner, repo = os.path.basename(os.path.dirname(repo_path)), os.path.basename(repo_path)
            except:
                owner, repo = None, None
            
            db = SessionLocal()
            session = ReviewSession(repo_path=repo_path)
            db.add(session)
            db.commit()
            
            github_info = {
                'owner': owner,
                'repo': repo,
                'structure': structure
            } if owner and repo else None
            
            all_suggestions = []
            
            for agent in self.agents:
                logger.info(f"Running agent: {agent.__class__.__name__}")
                try:
                    agent_suggestions = agent.run(
                        repo_path=repo_path,
                        chat_memory=self.chat_memory,
                        structure=structure,
                        github_info=github_info
                    )
                    
                    if agent_suggestions:
                        self.agent_stats[agent.__class__.__name__] = len(agent_suggestions)
                        logger.info(f"Got {len(agent_suggestions)} suggestions from {agent.__class__.__name__}")
                    else:
                        self.agent_stats[agent.__class__.__name__] = 0
                        logger.info(f"No suggestions from {agent.__class__.__name__}")
                        
                    for sugg in agent_suggestions:
                        # Remove id from suggestion dict since it's auto-generated
                        suggestion = {
                            'agent': agent.__class__.__name__,
                            'message': sugg['message'],
                            'patch': sugg.get('patch'),
                            'file_path': sugg.get('file_path'),
                            'status': 'pending'
                        }
                        all_suggestions.append(suggestion)
                        
                        # Store in database
                        db_sugg = Suggestion(
                            session_id=session.id,
                            **suggestion
                        )
                        db.add(db_sugg)
                
                except Exception as e:
                    logger.error(f"Error in agent {agent.__class__.__name__}: {str(e)}", exc_info=True)
                    
            # Generate summary using MetaReviewAgent
            try:
                meta_agent = MetaReviewAgent()
                summary = meta_agent.run(all_suggestions, self.chat_memory)
                session.summary = summary
            except Exception as e:
                logger.error(f"Error generating summary: {str(e)}", exc_info=True)
                
            db.commit()
            return session, all_suggestions
            
        except Exception as e:
            logger.error(f"Error during review: {str(e)}", exc_info=True)
            raise
        finally:
            db.close()

def apply_patch_to_file(patch: str, repo_path: str) -> bool:
    """
    Apply a unified diff patch string to the file in the given repository path.
    Returns True if successful, or False if something fails (file not found, etc.).
    """
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