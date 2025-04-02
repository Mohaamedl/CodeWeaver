from typing import Any, Dict, List, Optional
import os
import tempfile
from backend.agents.architecture_assistant import ArchitectureAssistant
from backend.chat_memory import ChatMemory  # Add this import
from backend.db.database import SessionLocal
from backend.db.models import ReviewSession, Suggestion
from backend.orchestrator import AgentOrchestrator, apply_patch_to_file
from backend.services.github import GitHubAPI
from dotenv import load_dotenv
from fastapi import (FastAPI, HTTPException, Query, WebSocket,
                     WebSocketDisconnect)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel as BaseModelV2
from pydantic import ConfigDict

load_dotenv()

import logging
import os

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Pydantic v2 models
class GenerateRequest(BaseModelV2):
    prompt: str

class GenerateResponse(BaseModelV2):
    code: str

class ReviewRequest(BaseModelV2):
    owner: str
    repo: str
    structure: Optional[Dict[str, Any]] = None
    github_token: str
    model_config = ConfigDict(arbitrary_types_allowed=True)

class ReviewSuggestion(BaseModelV2):
    id: int
    agent: str
    message: str
    patch: Optional[str]
    file_path: Optional[str]
    status: str = 'pending'

class ReviewResponse(BaseModelV2):
    session_id: int
    suggestions: List[ReviewSuggestion]
    files: List[Dict[str, Any]]  # Add files to response

class ApplyPatchRequest(BaseModelV2):
    suggestion_id: int
    github_token: str

class ApplyPatchResponse(BaseModelV2):
    status: str

class SummaryResponse(BaseModelV2):
    session_id: int
    summary: str

class CreateBranchRequest(BaseModelV2):
    base_branch: str
    github_token: str
    suggestion_id: int

class CreateBranchResponse(BaseModelV2):
    branch_name: str
    status: str

class CreatePRRequest(BaseModelV2):
    suggestion_id: int

class CreatePRResponse(BaseModelV2):
    pr_url: str
    status: str

class ArchitectureAnalysisRequest(BaseModelV2):
    query: Optional[str] = None
    structure: Dict[str, Any]
    files: List[Dict[str, Any]]

class ArchitectureAnalysisResponse(BaseModelV2):
    suggestions: str
    type: str
    focus: str

app = FastAPI(title="Code Review Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.assistant = ArchitectureAssistant()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def handle_message(self, websocket: WebSocket, data: Dict[str, Any]):
        chat_memory = ChatMemory()
        if data.get('type') == 'init':
            result = await self.assistant.analyze_structure(
                chat_memory=chat_memory,
                structure=data.get('structure', {}),
                files=data.get('files', [])
            )
        elif data.get('type') == 'query':
            result = await self.assistant.analyze_structure(
                chat_memory=chat_memory,
                structure=self.assistant.last_structure or {},
                files=data.get('files', []),
                query=data.get('query')
            )
        await websocket.send_json(result)

manager = ConnectionManager()

# Add WebSocket endpoint
@app.websocket("/ws/architect")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.handle_message(websocket, data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await websocket.close()

@app.post("/generate", response_model=GenerateResponse)
def generate_code(req: GenerateRequest):
    """Generate code from a natural language prompt."""
    orchestrator = AgentOrchestrator()
    code = orchestrator.generate_code(req.prompt)
    return GenerateResponse(code=code)

@app.post("/review", response_model=ReviewResponse)
async def review_code(req: ReviewRequest) -> ReviewResponse:
    """Run code review on the repository."""
    logger.debug(f"Starting review for {req.owner}/{req.repo}")
    
    try:
        orchestrator = AgentOrchestrator()
        session, suggestions = await orchestrator.run_review(
            files=None,  # Will be fetched by orchestrator
            structure=req.structure,  # Pass structure for agent use
            github_info={
                'owner': req.owner,
                'repo': req.repo,
                'token': req.github_token
            },
            repo_path=f"{req.owner}/{req.repo}"  # Provide repo_path
        )
        
        formatted_suggestions = [
            ReviewSuggestion(
                id=s.get('id', 0),
                agent=s.get('agent', 'Unknown'),
                message=s.get('message', ''),
                patch=s.get('patch'),
                file_path=s.get('file_path'),
                status=s.get('status', 'pending')
            ) for s in suggestions
        ]
        
        files = None  # Fetch files if needed
        
        return ReviewResponse(
            session_id=session.id,
            suggestions=formatted_suggestions,
            files=files if files else []  # Include files in response
        )
        
    except Exception as e:
        logger.error(f"Error during review: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/apply-patch", response_model=ApplyPatchResponse)
async def apply_patch(req: ApplyPatchRequest):
    """Apply the code patch for the given suggestion ID."""
    db = SessionLocal()
    try:
        # Get the suggestion and its session
        suggestion = db.query(Suggestion).get(req.suggestion_id)
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        if not suggestion.patch:
            raise HTTPException(status_code=400, detail="No patch available for this suggestion")
        if suggestion.status == "applied":
            return ApplyPatchResponse(status="already applied")

        session = db.query(ReviewSession).get(suggestion.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Review session not found")

        # Parse owner/repo from session.repo_path
        try:
            owner, repo = session.repo_path.split('/')
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid repository path format")

        # Create GitHub API client
        github = GitHubAPI(req.github_token)

        # Get the file content
        file_content = await github.get_file_content(owner, repo, suggestion.file_path)
        if not file_content:
            raise HTTPException(status_code=404, detail=f"File {suggestion.file_path} not found")

        # Apply the patch using a temporary file
        # Create temporary files for the patch process
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as original_file, \
             tempfile.NamedTemporaryFile(mode='w', delete=False) as patch_file:
            
            # Write original content
            original_file.write(file_content)
            original_file.flush()
            original_file_path = original_file.name
            
            # Write patch content
            patch_file.write(suggestion.patch)
            patch_file.flush()
            patch_file_path = patch_file.name
        
        try:
            # Apply patch using our custom function instead of subprocess
            with open(original_file_path, 'r') as f:
                original_content = f.read()
                
            # Apply the patch to the content
            from backend.orchestrator import apply_patch_to_file
            
            with tempfile.TemporaryDirectory() as temp_dir:
                # Create a temporary file structure similar to the repo
                os.makedirs(os.path.dirname(os.path.join(temp_dir, suggestion.file_path)), exist_ok=True)
                with open(os.path.join(temp_dir, suggestion.file_path), 'w') as f:
                    f.write(original_content)
                
                # Apply the patch
                success = apply_patch_to_file(suggestion.patch, temp_dir)
                if not success:
                    raise HTTPException(status_code=500, detail="Failed to apply patch")
                
                # Read the patched content
                with open(os.path.join(temp_dir, suggestion.file_path), 'r') as f:
                    patched_content = f.read()
        
        except Exception as e:
            logger.error(f"Failed to apply patch: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to apply patch: {str(e)}")
        finally:
            # Clean up temp files
            try:
                os.unlink(original_file_path)
                os.unlink(patch_file_path)
            except Exception as e:
                logger.warning(f"Error cleaning up temp files: {str(e)}")

        # Create a commit with the changes
        try:
            await github.update_file(
                owner=owner,
                repo=repo,
                path=suggestion.file_path,
                message=f"Apply suggestion: {suggestion.message}",
                content=patched_content,
                branch="main"  # You might want to make this configurable
            )
        except Exception as e:
            logger.error(f"Failed to commit changes: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to commit changes: {str(e)}")

        # Update suggestion status
        suggestion.status = "applied"
        db.commit()

        return ApplyPatchResponse(status="applied")
    except Exception as e:
        logger.error(f"Error applying patch: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.get("/summary", response_model=SummaryResponse)
def get_summary(session_id: Optional[int] = Query(None)):
    """Get the summary of suggestions for a review session."""
    db = SessionLocal()
    try:
        if session_id is None:
            session_obj = db.query(ReviewSession).order_by(ReviewSession.id.desc()).first()
            if not session_obj:
                raise HTTPException(status_code=404, detail="No review sessions found")
        else:
            session_obj = db.query(ReviewSession).get(session_id)
            if not session_obj:
                raise HTTPException(status_code=404, detail="Review session not found")
        return SummaryResponse(session_id=session_obj.id, summary=session_obj.summary or "")
    finally:
        db.close()

@app.post("/github/create-branch", response_model=CreateBranchResponse)
async def create_branch(req: CreateBranchRequest):
    """Create a new branch for a suggestion."""
    db = SessionLocal()
    try:
        # Get the suggestion and its session
        suggestion = db.query(Suggestion).get(req.suggestion_id)
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        
        session = db.query(ReviewSession).get(suggestion.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Review session not found")
        
        # Parse owner/repo from session.repo_path
        try:
            owner, repo = session.repo_path.split('/')
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid repository path format")
        
        # Get GitHub token from environment or request
        github_token = req.github_token
        if not github_token:
            raise HTTPException(status_code=401, detail="GitHub token not found")
        
        # Create GitHub API client
        github = GitHubAPI(github_token)
        
        # Generate a unique branch name
        branch_name = f"fix/{suggestion.agent.lower()}-{suggestion.id}"
        
        # Create branch
        success = await github.create_branch(
            owner=owner,
            repo=repo,
            base_branch=req.base_branch,
            new_branch=branch_name
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to create branch")
        
        return CreateBranchResponse(
            branch_name=branch_name,
            status="created"
        )
        
    except Exception as e:
        logger.error(f"Error creating branch: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.post("/github/create-pr", response_model=CreatePRResponse)
async def create_pr(req: CreatePRRequest):
    """Create a pull request for a suggestion."""
    db = SessionLocal()
    try:
        # Get the suggestion and its session
        suggestion = db.query(Suggestion).get(req.suggestion_id)
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        
        session = db.query(ReviewSession).get(suggestion.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Review session not found")
        
        # Parse owner/repo from session.repo_path
        try:
            owner, repo = session.repo_path.split('/')
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid repository path format")
        
        # Get GitHub token from environment or request
        github_token = os.environ.get('GITHUB_TOKEN')
        if not github_token:
            raise HTTPException(status_code=401, detail="GitHub token not found")
        
        # Create GitHub API client
        github = GitHubAPI(github_token)
        
        # Generate branch name (should match the one created earlier)
        branch_name = f"fix/{suggestion.agent.lower()}-{suggestion.id}"
        
        # Create PR
        pr_url = await github.create_pull_request(
            owner=owner,
            repo=repo,
            title=f"Fix: {suggestion.message}",
            body=f"Automated PR for suggestion #{suggestion.id}\n\n{suggestion.message}",
            head=branch_name,
            base="main"  # You might want to make this configurable
        )
        
        if not pr_url:
            raise HTTPException(status_code=500, detail="Failed to create pull request")
        
        return CreatePRResponse(
            pr_url=pr_url,
            status="created"
        )
        
    except Exception as e:
        logger.error(f"Error creating PR: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.post("/architecture/analyze", response_model=ArchitectureAnalysisResponse)
async def analyze_architecture(req: ArchitectureAnalysisRequest):
    """Get AI suggestions for architecture improvements."""
    try:
        assistant = ArchitectureAssistant()
        chat_memory = ChatMemory()  # You might want to persist this
        
        result = await assistant.analyze_structure(
            chat_memory=chat_memory,
            structure=req.structure,
            files=req.files,
            query=req.query
        )
        
        return result
    except Exception as e:
        logger.error(f"Error in architecture analysis: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
