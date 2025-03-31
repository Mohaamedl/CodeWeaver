import logging
import os
from typing import Any, Dict, List, Optional

from backend.agents.base import BaseAgent
from backend.chat_memory import ChatMemory

logger = logging.getLogger(__name__)

class ArchitectureAssistant(BaseAgent):
    """AI Assistant for architecture analysis and suggestions."""
    
    def __init__(self):
        super().__init__()
        self.conversation_context = []  # Store conversation history
        self.last_structure = None      # Cache last analyzed structure
        
    async def analyze_structure(
        self,
        chat_memory: ChatMemory,
        structure: Dict[str, Any],
        files: List[Dict[str, Any]],
        query: str = None
    ) -> Dict[str, Any]:
        """Analyze project structure and provide architecture suggestions."""
        try:
            # Store structure for context
            self.last_structure = structure
            
            # Format the complete tree structure first
            tree_structure = self._format_structure(structure)
            
            if not tree_structure:
                return self._error_response("Could not parse repository structure")

            # Add to conversation context
            self.conversation_context.append({
                'role': 'system',
                'content': f"Project structure analyzed:\n{tree_structure}"
            })

            if query:
                self.conversation_context.append({
                    'role': 'user',
                    'content': query
                })

            try:
                import openai
                openai.api_key = os.environ.get('OPENAI_API_KEY')
                
                # Include full conversation context in the prompt
                messages = [
                    {"role": "system", "content": "You are an expert software architect specializing in analyzing and improving project structures. Maintain context of previous messages."},
                    *self.conversation_context,
                ]

                response = await openai.ChatCompletion.acreate(
                    model="gpt-4o-mini",
                    messages=messages
                )
                
                ai_response = response.choices[0].message.content
                
                # Add AI response to context
                self.conversation_context.append({
                    'role': 'assistant',
                    'content': ai_response
                })
                
                return {
                    'suggestions': ai_response,
                    'type': 'analysis',
                    'focus': query if query else 'general',
                    'has_context': True
                }
                
            except Exception as e:
                logger.warning(f"OpenAI API error: {str(e)}")
                return {
                    'suggestions': f"Error getting AI response: {str(e)}",
                    'type': 'error',
                    'focus': 'api',
                    'has_context': False
                }

        except Exception as e:
            logger.error(f"Error in architecture analysis: {str(e)}")
            return self._error_response(str(e))

    def _error_response(self, message: str) -> Dict[str, Any]:
        """Create standardized error response."""
        return {
            'suggestions': f"Error analyzing architecture: {message}",
            'type': 'error',
            'focus': 'general',
            'has_context': False
        }

    def clear_context(self):
        """Clear the conversation context."""
        self.conversation_context = []
        self.last_structure = None

    def _generate_initial_analysis(self, tree_structure: str, files: List[Dict[str, Any]]) -> str:
        """Generate initial analysis text."""
        return f"""# Project Structure Analysis

## Repository Tree:
```
{tree_structure}
```

## Files Overview:
{self._format_files_summary(files)}

## Initial Architecture Analysis:
Let me analyze your project structure and suggest potential improvements...

### Key Observations:
1. Project Organization
2. File Distribution
3. Module Dependencies
4. Design Patterns
5. Architectural Concerns

Please wait while I provide a detailed analysis...
"""

    async def _handle_follow_up_query(
        self, query: str, tree_structure: str, files: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Handle follow-up queries for architecture analysis."""
        initial_response = f"""Here's your project structure:

{tree_structure}

Analyzing the architecture... (This might take a moment due to API rate limits)
"""
        if query:
            initial_response += f"\nI'll analyze your specific query about: {query}"

        try:
            import openai
            openai.api_key = os.environ.get('OPENAI_API_KEY')

            # Try to get AI analysis
            files_context = self._format_files_summary(files)
            base_prompt = f"""As an AI architecture assistant, analyze this project:

Project Structure:
{tree_structure}

Files Overview:
{files_context}
"""
            if query:
                base_prompt += f"\nSpecific Question: {query}\n"
            else:
                base_prompt += "\nProvide suggestions for improving the project architecture, focusing on:\n- Code organization\n- Module dependencies\n- Design patterns\n- Scalability concerns\n"

            response = await openai.ChatCompletion.acreate(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert software architect specialized in analyzing and improving project structures."},
                    {"role": "user", "content": base_prompt}
                ]
            )
            
            ai_suggestions = response.choices[0].message.content
            
        except Exception as e:
            logger.warning(f"OpenAI API error: {str(e)}")
            ai_suggestions = initial_response

        return {
            'suggestions': ai_suggestions,
            'type': 'architecture_analysis',
            'focus': query if query else 'general'
        }

    def _format_structure(self, structure: Dict[str, Any]) -> str:
        """Format project structure focusing only on names and hierarchy."""
        formatted_tree = []
        
        def format_node(node: Dict[str, Any], prefix: str = "", is_last: bool = True) -> None:
            # Get basic node info
            name = node.get("path", "") or node.get("name", "")
            node_type = node.get("type", "")
            
            # Skip if no name
            if not name:
                return
                
            # Create the line prefix
            line_prefix = prefix + ("└── " if is_last else "├── ")
            
            # Add the node to the tree (just name, no metadata)
            formatted_tree.append(f"{line_prefix}{name}")
            
            # Process children if it's a directory
            if node_type == "directory" and "children" in node:
                children = node["children"]
                for i, child in enumerate(children):
                    is_last_child = i == len(children) - 1
                    child_prefix = prefix + ("    " if is_last else "│   ")
                    format_node(child, child_prefix, is_last_child)

        # Start formatting from root
        if isinstance(structure, dict):
            if "children" in structure:
                # If root has children, process them
                children = structure["children"]
                for i, child in enumerate(children):
                    format_node(child, "", i == len(children) - 1)
            else:
                # Single node
                format_node(structure)
        elif isinstance(structure, list):
            # If root is a list, process each item
            for i, item in enumerate(structure):
                format_node(item, "", i == len(structure) - 1)

        return "\n".join(formatted_tree)

    def _format_files_summary(self, files: List[Dict[str, Any]]) -> str:
        """Create a simplified summary of key files."""
        if not files:
            return "No files available for analysis."
            
        summary_lines = []
        for file in files:
            if file.get('path', '').endswith(('.py', '.js', '.ts', '.tsx')):
                summary_lines.append(f"- {file['path']}")
        
        return "\n".join(summary_lines) if summary_lines else "No relevant source files found."
