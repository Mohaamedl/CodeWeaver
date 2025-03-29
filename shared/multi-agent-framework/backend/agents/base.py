from backend.chat_memory import ChatMemory


class BaseAgent:
    """Abstract base class for agent implementations."""
    def run(self, repo_path: str, chat_memory: ChatMemory, structure: dict = None):
        raise NotImplementedError("Agent run() must be implemented by subclasses.")
