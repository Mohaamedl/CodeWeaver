
# Monorepo Code Review Project

This monorepo Python project provides both a CLI tool and a FastAPI backend service for AI-assisted code generation and automated code reviews. It uses multiple agent modules to generate suggestions (with code patches in unified diff format) for improving code quality.

## Project Structure

```
monorepo-project/
├── cli/
│   └── main.py  # CLI entry-point using Typer
├── backend/
│   ├── main.py  # FastAPI app defining API endpoints
│   ├── orchestrator.py  # AgentOrchestrator coordinating multiple agents
│   ├── chat_memory.py  # Shared ChatMemory for user preferences and context
│   ├── agents/  # Agent modules for different review aspects
│   │   ├── base.py  # BaseAgent class definition
│   │   ├── coder.py  # CoderAgent for code generation from prompts
│   │   ├── llm_review.py  # LLMReviewAgent for general code analysis
│   │   ├── refactoring.py  # RefactoringAgent for code refactoring suggestions
│   │   ├── linting.py  # LintingAgent for code style and lint suggestions
│   │   ├── dependency.py  # DependencyAgent for dependency update suggestions
│   │   └── meta_review.py  # MetaReviewAgent for summarizing all suggestions
│   └── db/  # Database models and migrations
│       ├── models.py  # SQLAlchemy models (ReviewSession, Suggestion)
│       ├── database.py  # Database engine and session setup
│       ├── migrations/
│       │   ├── env.py  # Alembic environment configuration
│       │   └── versions/
│       │       └── 20250326_initial.py  # Initial database migration script
├── alembic.ini  # Alembic configuration file
└── README.md  # Project documentation and usage instructions
```

## Installation

1. **Clone the repository** and navigate to the project root.
2. **Install dependencies** (Typer, FastAPI, SQLAlchemy, Alembic, etc.). For example, using Poetry:

   ```
   poetry install
   ```

   Or using pip:

   ```
   pip install -r requirements.txt
   ```

   (Ensure you have Python 3.9+.)

3. Apply database migrations (to create the SQLite database schema):

   ```
   alembic upgrade head
   ```

   This will create the `backend/db/database.db` SQLite database with the required tables.

## CLI Usage

The CLI tool (powered by Typer) provides commands for code generation and review. You can run the CLI via the `cli/main.py` module or install the package and use the console script.

- **Generate Code from Prompt**: Use the `generate` command with a prompt.

  ```
  python -m cli.main generate "write a Python function to calculate factorial"
  ```

  This will output generated code based on the prompt using the `CoderAgent`.

- **Review a Code Repository**: Use the `review` command with the path to the target project (e.g., current directory `.`).

  ```
  python -m cli.main review .
  ```

  The orchestrator will run multiple agents (linting, refactoring, dependency, LLM analysis) on the codebase. It creates a review session and stores suggestions in the database. The CLI will output the session ID and how many suggestions were found.

- **View Suggestions**: After running a review, use the `suggestions` command to list all suggestions (and any patches) from the latest session:

  ```
  python -m cli.main suggestions
  ```

  This will display each suggestion with its ID, agent source, message, and a unified diff patch if available. It also shows a summary at the end (provided by the `MetaReviewAgent`).

- **View Summary Only**: You can view just the summary of the review (an overview of all suggestions) with:

  ```
  python -m cli.main summary
  ```

  By default, it uses the latest session. You can specify a `--session-id` for an older session.

- **Apply a Patch**: To apply a suggested code patch to the codebase, use the `apply` command with the suggestion ID:

  ```
  python -m cli.main apply 5
  ```

  This will apply the code changes for suggestion ID 5 (using the unified diff patch) to the actual files and mark it as applied in the database. If the suggestion has no patch or was already applied, the CLI will report that.

- **Reject a Patch**: If you decide not to implement a suggestion, you can mark it as rejected:

  ```
  python -m cli.main reject 5
  ```

  This updates the suggestion's status to "rejected" in the database (for record-keeping, so it won't be repeatedly suggested).

**Note**: The CLI commands automatically interact with the SQLite database (`backend/db/database.db`) to store and retrieve suggestions. Each review invocation creates a new `ReviewSession` (with a unique session ID).

## API (FastAPI) Usage

The FastAPI backend (`backend/main.py`) exposes endpoints that mirror the CLI functionality, allowing integration with other tools or a web UI.

- **Run the API server**:

  ```
  uvicorn backend.main:app --reload
  ```

  This starts the FastAPI server on `http://127.0.0.1:8000`.

- **Generate Code (POST /generate)**: Send a JSON payload `{"prompt": "..."}` to the `/generate` endpoint to generate code. For example:

  ```
  curl -X POST "http://127.0.0.1:8000/generate" \
       -H "Content-Type: application/json" \
       -d '{"prompt": "write a Python function to calculate factorial"}'
  ```

  The response will contain the generated code in JSON, e.g.:

  ```json
  { "code": "def factorial(n): ..." }
  ```

- **Start Review (POST /review)**: Send `{"path": "<repo_path>"}` to initiate a multi-agent review of the repository at the given path. Example:

  ```
  curl -X POST "http://127.0.0.1:8000/review" -H "Content-Type: application/json" -d '{"path": "."}'
  ```

  The API will run all agents and respond with a JSON containing the `session_id` and a list of suggestions. Each suggestion includes its `id`, originating `agent`, descriptive `message`, `patch` (unified diff as a string, if applicable), and `file_path`. For example:

  ```json
  {
    "session_id": 3,
    "suggestions": [
      {
        "id": 10,
        "agent": "LintingAgent",
        "message": "Replace print statements with logging in utils.py.",
        "patch": "--- a/utils.py\n+++ b/utils.py\n@@ ...",
        "file_path": "utils.py",
        "status": "pending"
      },
      ...
    ]
  }
  ```

- **Apply Patch (POST /apply-patch)**: Apply a suggestion's patch by sending `{"suggestion_id": X}`. For example:

  ```
  curl -X POST "http://127.0.0.1:8000/apply-patch" -H "Content-Type: application/json" -d '{"suggestion_id": 10}'
  ```

  If successful, the code change is applied to the file and the response will be `{"status": "applied"}`. (If already applied or no patch, the status may indicate that or an error.)

- **Get Summary (GET /summary)**: Retrieve the summary of a review session. By default, it returns the latest session's summary:

  ```
  curl "http://127.0.0.1:8000/summary"
  ```

  You can provide a specific session ID as a query parameter (`/summary?session_id=3`). The response will contain the `session_id` and a human-readable summary of suggestions:

  ```json
  {
    "session_id": 3,
    "summary": "Primary language: Python. Code style suggestions include replacing print statements with proper logging; Refactoring suggestions include using f-strings for string formatting; Dependency suggestions include updating packages (e.g. requests, etc.)."
  }
  ```

The FastAPI automatically provides interactive API docs at `/docs`.

## How It Works

When a review is initiated (via CLI or API), the `AgentOrchestrator` will:

1. Create a new `ReviewSession` in the database.
2. Use `ChatMemory` to infer project preferences (such as language and indentation style).
3. Run each agent in sequence:
   - `LintingAgent` checks for style issues (like usage of `print` instead of logging, inconsistent indentation).
   - `RefactoringAgent` parses code AST to suggest modern Python improvements (e.g., converting old `%` formatting to f-strings, using `is` for `None`).
   - `DependencyAgent` reads dependency files to suggest version upgrades for pinned versions.
   - `LLMReviewAgent` (simulated) looks for general issues (e.g., TODO comments, `eval` usage, hardcoded secrets).
4. Each agent returns suggestions (with a message and optionally a code patch in unified diff format). These suggestions are saved in the database (`Suggestion` table).
5. Finally, the `MetaReviewAgent` aggregates all suggestions to produce a summary overview, which is saved with the review session.

All code modifications are represented as unified diff patches (contextual diffs), making it easy to review changes. The CLI and API allow applying these patches automatically to the codebase.

## Extensibility

This project is designed to be modular and easily extensible:

- **Agent Modules**: Each agent is defined in `backend/agents/`. New agents can be added following the `BaseAgent` interface (implementing a `run(repo_path, chat_memory)` method). For example, one could add a `SecurityAgent` for security-specific checks.
- **Multi-Language Support**: The current agents focus on Python (e.g., using Python AST for refactoring). However, the framework can be extended for other languages. The `ChatMemory` infers the primary language, so agents can choose to skip or handle files based on file extension. New agents can be created for other languages (for instance, a `JSLintAgent` for JavaScript), and the orchestrator can include them conditionally.
- **User Preferences**: The `ChatMemory` class can incorporate user-specified preferences (for example, coding style guidelines). Currently, it defaults to expecting PEP8 (spaces for indentation, etc.) and infers existing code style. This can be extended to respect configuration files or user input to customize the review (e.g., preferred max line length, naming conventions).

## Basic Example

After running a review on a sample Python repository, you might see suggestions like:

- **LintingAgent**: "Replace print statements with logging in app.py." (with a patch to add `import logging` and change `print()` to `logging.info()` calls)
- **RefactoringAgent**: "Use f-string instead of '%' formatting in utils.py." (with a patch converting an old string formatting to an f-string)
- **DependencyAgent**: "Update requests from 2.25.0 to 2.25.1 in requirements.txt." (with a patch for the requirements file)
- **LLMReviewAgent**: "Found TODO comments in models.py. Consider addressing them."

The `MetaReviewAgent` summary would combine these into a concise report, for example: "Primary language: Python. Code style suggestions include replacing print statements with proper logging; Refactoring suggestions include using f-strings for string formatting; Dependency suggestions include updating some packages (e.g. requests); General suggestions include addressing TODO comments in the code."

## Conclusion

This monorepo project integrates a CLI and REST API to assist developers in generating code and performing automated code reviews. By leveraging multiple specialized agents, it provides actionable suggestions (with unified diffs) that can be easily applied. The modular architecture allows adding new analysis capabilities and extending support to other programming languages in the future.
