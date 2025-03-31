import difflib
import logging
import os
import re
from typing import Any, Dict, List, Tuple, Optional
import asyncio

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
import asyncio
from backend.db.database import SessionLocal
from backend.db.models import ReviewSession, Suggestion
from backend.agents.arch_agent import ArchAgent
from backend.agents.coder import CoderAgent
from backend.agents.llm_review import LLMReviewAgent
from backend.agents.refactoring import RefactoringAgent
from backend.agents.linting import LintingAgent
from backend.agents.dependency import DependencyAgent
from backend.agents.meta_review import MetaReviewAgent
from backend.chat_memory import ChatMemory

class AgentOrchestrator:
    def __init__(self):
        self.chat_memory = ChatMemory()
        self.agents = [
            LintingAgent(),
            RefactoringAgent(),
            DependencyAgent(),
            LLMReviewAgent(),
            ArchAgent()
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
        
        # Create a new review session
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
            session_obj = ReviewSession(repo_path=repo_path)
            db.add(session_obj)
            # Instantiate shared chat memory and infer preferences
            chat_memory = ChatMemory()
            chat_memory.infer_preferences(repo_path)
            suggestions_all = []
            # Run each agent and collect suggestions
            for agent in self.review_agents:
                try:
                    if asyncio.iscoroutinefunction(agent.run):
                        agent_suggestions = asyncio.run(agent.run(repo_path, chat_memory))
                    else:
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
            db.refresh(session)
            
            # If files not provided but github_info is, fetch files from GitHub
            if not files and github_info:
                github = GitHubAPI(github_info['token'])
                files = await github.analyze_repository(
                    github_info['owner'],
                    github_info['repo']
                )
            
            all_suggestions = []
            
            # Run each agent
            for agent in self.agents:
                agent_name = agent.__class__.__name__
                logger.info(f"Running {agent_name}")
                
                try:
                    # Check if agent's run method is a coroutine
                    if asyncio.iscoroutinefunction(agent.run):
                        suggestions = await agent.run(
                            self.chat_memory,
                            structure=structure,
                            files=files,
                            github_info=github_info,
                            repo_path=repo_path
                        )
                    else:
                        suggestions = agent.run(
                            self.chat_memory,
                            structure=structure,
                            files=files,
                            github_info=github_info,
                            repo_path=repo_path
                        )
                    
                    logger.info(f"Received {len(suggestions)} suggestions from {agent_name}")
                    
                    # Store suggestions in database with proper agent name and IDs
                    for suggestion in suggestions:
                        db_suggestion = Suggestion(
                            session_id=session.id,
                            agent=agent_name,  # Use the actual agent class name
                            message=suggestion.get('message', ''),
                            patch=suggestion.get('patch'),
                            file_path=suggestion.get('file_path'),
                            status='pending'
                        )
                        db.add(db_suggestion)
                        db.commit()
                        db.refresh(db_suggestion)
                        
                        # Add the suggestion with its new ID to all_suggestions
                        all_suggestions.append({
                            'id': db_suggestion.id,  # Use the database-generated ID
                            'agent': agent_name,
                            'message': suggestion.get('message', ''),
                            'patch': suggestion.get('patch'),
                            'file_path': suggestion.get('file_path'),
                            'status': 'pending'
                        })
                        
                except Exception as e:
                    logger.error(f"Error running {agent_name}: {str(e)}", exc_info=True)
                    continue
            
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
