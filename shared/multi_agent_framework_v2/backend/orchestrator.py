import asyncio
import difflib
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple

from backend.agents.coder import CoderAgent
from backend.agents.dependency import DependencyAgent
from backend.agents.linting import LintingAgent
from backend.agents.llm_review import LLMReviewAgent
from backend.agents.meta_review import MetaReviewAgent
from backend.agents.refactoring import RefactoringAgent
from backend.chat_memory import ChatMemory
from backend.db.database import SessionLocal
from backend.db.models import ReviewSession, Suggestion
from backend.services.github import GitHubAPI

logger = logging.getLogger(__name__)

class AgentOrchestrator:
    def __init__(self):
        self.chat_memory = ChatMemory()
        self.agents = [
            LintingAgent(),
            RefactoringAgent(),
            DependencyAgent(),
            LLMReviewAgent()
        ]
        self.agent_stats = {}
        logger.info(f"Initialized {len(self.agents)} agents")

    def generate_code(self, prompt: str) -> str:
        """Generate code from a prompt using the CoderAgent."""
        return CoderAgent().run(prompt, self.chat_memory)

    async def run_review(
        self,
        files: Optional[List[Dict[str, Any]]] = None,
        structure: Optional[Dict[str, Any]] = None,
        github_info: Optional[Dict[str, str]] = None,
        repo_path: Optional[str] = None,
    ) -> Tuple[ReviewSession, List[Dict[str, Any]]]:
        """Run code review using all agents."""
        logger.info(f"Initialized {len(self.agents)} agents")
        
        db = SessionLocal()
        try:
            # If github_info is provided, use it to construct repo_path
            session_repo_path = repo_path
            if github_info:
                session_repo_path = f"{github_info['owner']}/{github_info['repo']}"
            
            session = ReviewSession(
                repo_path=session_repo_path,
                summary=""  # Initialize with empty summary
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            
            # If files not provided but github_info is, fetch files from GitHub
            if not files and github_info:
                github = GitHubAPI(github_info['token'])
                files = await github.analyze_repository(
                    github_info['owner'],
                    github_info['repo']
                )
            
            all_suggestions = []
            
            # Run agents in parallel when possible
            async def run_agent(agent):
                agent_name = agent.__class__.__name__
                logger.info(f"Running {agent_name}")
                try:
                    if asyncio.iscoroutinefunction(agent.run):
                        suggestions = await agent.run(
                            self.chat_memory,
                            structure=structure,
                            files=files,
                            github_info=github_info,
                            repo_path=repo_path
                        )
                    else:
                        # Run CPU-bound agents in a thread pool
                        with ThreadPoolExecutor() as executor:
                            suggestions = await asyncio.get_event_loop().run_in_executor(
                                executor,
                                agent.run,
                                self.chat_memory,
                                structure,
                                files,
                                github_info,
                                repo_path
                            )
                    
                    return agent_name, suggestions
                except Exception as e:
                    logger.error(f"Error running {agent_name}: {str(e)}", exc_info=True)
                    return agent_name, []

            # Run all agents concurrently
            agent_results = await asyncio.gather(*[run_agent(agent) for agent in self.agents])
            
            # Process results and store in database
            for agent_name, suggestions in agent_results:
                for suggestion in suggestions:
                    db_suggestion = Suggestion(
                        session_id=session.id,
                        agent=agent_name,
                        message=suggestion.get('message', ''),
                        patch=suggestion.get('patch'),
                        file_path=suggestion.get('file_path'),
                        status='pending'
                    )
                    db.add(db_suggestion)
                    db.commit()
                    db.refresh(db_suggestion)
                    
                    all_suggestions.append({
                        'id': db_suggestion.id,
                        'agent': agent_name,
                        'message': suggestion.get('message', ''),
                        'patch': suggestion.get('patch'),
                        'file_path': suggestion.get('file_path'),
                        'status': 'pending'
                    })

            # Generate summary using MetaReviewAgent
            meta_agent = next((a for a in self.agents if isinstance(a, MetaReviewAgent)), None)
            if meta_agent:
                try:
                    summary = meta_agent.run(all_suggestions, self.chat_memory)
                    session.summary = summary
                    db.commit()
                except Exception as e:
                    logger.error(f"Error generating summary: {str(e)}", exc_info=True)
            
            logger.info(f"Review completed. Found {len(all_suggestions)} total suggestions.")
            return session, all_suggestions
            
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
        if line.startswith('--- ') or line.startswith('+++ '):
            i += 1
            continue

        if line.startswith('@@'):
            import re
            m = re.match(r'^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@', line)
            if m:
                orig_start = int(m.group(1))
            else:
                orig_start = 1
            logging.debug("Found hunk header: %s -> original_start=%d", line, orig_start)

            orig_index = orig_start - 1
            if pointer < orig_index:
                logging.debug("Copying unchanged lines from pointer=%d to orig_index=%d", pointer, orig_index)
                new_lines.extend(original_lines[pointer:orig_index])
                pointer = orig_index

            i += 1
            while i < len(lines) and not lines[i].startswith('@@'):
                hunk_line = lines[i]
                if hunk_line.startswith(' '):
                    new_lines.append(hunk_line[1:] + "\n")
                    pointer += 1
                elif hunk_line.startswith('-'):
                    pointer += 1
                elif hunk_line.startswith('+'):
                    new_lines.append(hunk_line[1:] + "\n")
                i += 1
        else:
            i += 1

    if pointer < len(original_lines):
        logging.debug("Copying remaining lines from pointer=%d to end (total %d).",
                      pointer, len(original_lines))
        new_lines.extend(original_lines[pointer:])

    try:
        with open(file_path, 'w') as f:
            f.writelines(new_lines)
        logging.debug("Successfully wrote %d lines to %s", len(new_lines), file_path)
    except Exception as e:
        logging.debug("Exception writing patched file: %s", e)
        return False

    logging.debug("apply_patch_to_file completed successfully!")
    return True
