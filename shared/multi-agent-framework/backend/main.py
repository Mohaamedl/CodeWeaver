from fastapi import FastAPI, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel as BaseModelV2
from pydantic import ConfigDict
from backend.orchestrator import AgentOrchestrator, apply_patch_to_file
from backend.db.database import SessionLocal
from backend.db.models import ReviewSession, Suggestion

from dotenv import load_dotenv
load_dotenv()

import logging
logging.basicConfig(level=logging.DEBUG)

# Pydantic v2 models
class GenerateRequest(BaseModelV2):
    prompt: str

class GenerateResponse(BaseModelV2):
    code: str

class ReviewRequest(BaseModelV2):
    path: str

class SuggestionOut(BaseModelV2):
    id: int
    agent: str
    message: str
    patch: Optional[str] = None
    file_path: Optional[str] = None
    status: str

    model_config = ConfigDict(from_attributes=True)  # replaces Config.orm_mode

class ReviewResponse(BaseModelV2):
    session_id: int
    suggestions: List[SuggestionOut]

class ApplyPatchRequest(BaseModelV2):
    suggestion_id: int

class ApplyPatchResponse(BaseModelV2):
    status: str

class SummaryResponse(BaseModelV2):
    session_id: int
    summary: str

app = FastAPI(title="Code Review Assistant API")

@app.post("/generate", response_model=GenerateResponse)
def generate_code(req: GenerateRequest):
    """Generate code from a natural language prompt."""
    orchestrator = AgentOrchestrator()
    code = orchestrator.generate_code(req.prompt)
    return GenerateResponse(code=code)

@app.post("/review", response_model=ReviewResponse)
def review_code(req: ReviewRequest):
    """Run code review on the repository at the given path."""
    orchestrator = AgentOrchestrator()
    session_obj, suggestions = orchestrator.run_review(req.path)
    return ReviewResponse(session_id=session_obj.id, suggestions=suggestions)

@app.post("/apply-patch", response_model=ApplyPatchResponse)
def apply_patch(req: ApplyPatchRequest):
    """Apply the code patch for the given suggestion ID."""
    db = SessionLocal()
    try:
        sugg = db.query(Suggestion).get(req.suggestion_id)
        if not sugg:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        if not sugg.patch:
            raise HTTPException(status_code=400, detail="No patch available for this suggestion")
        if sugg.status == "applied":
            return ApplyPatchResponse(status="already applied")

        session_obj = db.query(ReviewSession).get(sugg.session_id)
        if not session_obj:
            raise HTTPException(status_code=404, detail="Review session not found")

        success = apply_patch_to_file(sugg.patch, session_obj.repo_path)

        if success:
            sugg.status = "applied"
            db.commit()
            return ApplyPatchResponse(status="applied")
        else:
            raise HTTPException(status_code=500, detail="Failed to apply patch")
    except Exception as e:
        import traceback
        traceback.print_exc()
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
