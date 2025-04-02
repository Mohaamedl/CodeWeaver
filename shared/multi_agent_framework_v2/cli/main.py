import typer
from backend.orchestrator import AgentOrchestrator, apply_patch_to_file
from backend.db.database import SessionLocal
from backend.db.models import ReviewSession, Suggestion
from dotenv import load_dotenv
load_dotenv()

app = typer.Typer(help="CLI tool for code generation and review")

@app.command()
def generate(prompt: str):
    """Generate code from a prompt using AI (CoderAgent)."""
    orchestrator = AgentOrchestrator()
    code = orchestrator.generate_code(prompt)
    print(code)

@app.command()
def review(path: str):
    """Review code in the given repository path using multiple agents."""
    orchestrator = AgentOrchestrator()
    session, suggestions = orchestrator.run_review(path)
    print(f"Review session {session.id} complete. Found {len(suggestions)} suggestions.")
    print("Use 'suggestions' to view details, 'summary' for an overview.")

@app.command()
def suggestions(session_id: int = typer.Option(None, help="Review session ID (defaults to latest session)")):
    """View suggestions from a review session."""
    db = SessionLocal()
    try:
        if session_id is None:
            session_obj = db.query(ReviewSession).order_by(ReviewSession.id.desc()).first()
            if not session_obj:
                print("No review sessions found.")
                return
        else:
            session_obj = db.query(ReviewSession).get(session_id)
            if not session_obj:
                print(f"Session {session_id} not found.")
                return
        session_id_val = session_obj.id
        suggs = db.query(Suggestion).filter(Suggestion.session_id == session_id_val).all()
        if not suggs:
            print("No suggestions found for session.")
            return
        for sugg in suggs:
            print(f"\nSuggestion {sugg.id} by {sugg.agent} [status: {sugg.status}]")
            print(f"Message: {sugg.message}")
            if sugg.patch:
                print("Patch:\n" + sugg.patch)
        if session_obj.summary:
            print("\nSummary:\n" + session_obj.summary)
    finally:
        db.close()

@app.command()
def summary(session_id: int = typer.Option(None, help="Review session ID (defaults to latest session)")):
    """View the summary from a review session."""
    db = SessionLocal()
    try:
        if session_id is None:
            session_obj = db.query(ReviewSession).order_by(ReviewSession.id.desc()).first()
            if not session_obj:
                print("No review sessions found.")
                return
        else:
            session_obj = db.query(ReviewSession).get(session_id)
            if not session_obj:
                print(f"Session {session_id} not found.")
                return
        if session_obj.summary:
            print(session_obj.summary)
        else:
            print("No summary available for this session.")
    finally:
        db.close()

@app.command()
def apply(suggestion_id: int):
    """Apply a patch suggestion to the codebase."""
    db = SessionLocal()
    try:
        sugg = db.query(Suggestion).get(suggestion_id)
        if not sugg:
            print(f"Suggestion {suggestion_id} not found.")
            return
        if not sugg.patch:
            print("Suggestion has no patch to apply.")
            return
        if sugg.status == "applied":
            print("Suggestion has already been applied.")
            return
        session_obj = db.query(ReviewSession).get(sugg.session_id)
        if not session_obj:
            print("Associated review session not found.")
            return
        success = apply_patch_to_file(sugg.patch, session_obj.repo_path)
        if success:
            sugg.status = "applied"
            db.commit()
            print(f"Applied suggestion {suggestion_id} to file {sugg.file_path}.")
        else:
            print("Failed to apply patch.")
    finally:
        db.close()

@app.command()
def reject(suggestion_id: int):
    """Reject a patch suggestion (mark as rejected)."""
    db = SessionLocal()
    try:
        sugg = db.query(Suggestion).get(suggestion_id)
        if not sugg:
            print(f"Suggestion {suggestion_id} not found.")
            return
        if sugg.status == "rejected":
            print("Suggestion already rejected.")
            return
        sugg.status = "rejected"
        db.commit()
        print(f"Suggestion {suggestion_id} marked as rejected.")
    finally:
        db.close()

if __name__ == "__main__":
    app()
