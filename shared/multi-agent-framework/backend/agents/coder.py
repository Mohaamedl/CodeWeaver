import os
import requests
import logging
from backend.chat_memory import ChatMemory

class CoderAgent:
    """Agent that generates code from a natural language prompt."""

    def run(self, prompt: str, chat_memory: ChatMemory) -> str:
        # Attempt OpenAI first
        openai_module = self._maybe_import_openai()
        if openai_module and os.environ.get('OPENAI_API_KEY'):
            logging.info("Using OpenAI as primary for code generation.")
            result = self._generate_with_openai(openai_module, prompt, chat_memory)
            if result is not None:
                return result
            logging.warning("OpenAI call failed, trying fallback...")

        # Fallback: Groq or final placeholder
        fallback_code = self.generate_with_fallback_model(prompt, chat_memory)
        if fallback_code:
            return fallback_code

        # Final fallback placeholder
        return (
            f"# [OpenAI + fallback failed for prompt: {prompt}]\n\n"
            f"def generated_function():\n"
            f"    print('This is a final placeholder implementation')\n"
        )

    def _maybe_import_openai(self):
        """Safely import openai, returning None if not installed."""
        try:
            import openai
            return openai
        except ImportError:
            logging.warning("`openai` library not installed, skipping.")
            return None

    def _generate_with_openai(self, openai, prompt: str, chat_memory: ChatMemory) -> str | None:
        """Use OpenAI's GPT model to generate code, or return None on failure."""
        try:
            openai.api_key = os.environ['OPENAI_API_KEY']
            system_msg = {"role": "system", "content": "You are a coding assistant AI."}
            user_content = prompt

            # Possibly append language if chat_memory has one
            if 'language' in chat_memory.inferred_prefs:
                lang = chat_memory.inferred_prefs['language']
                if lang and lang != 'Unknown' and lang not in user_content:
                    user_content += f"\nLanguage: {lang}"

            user_msg = {"role": "user", "content": user_content}

            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[system_msg, user_msg]
            )
            return response['choices'][0]['message']['content']
        except Exception as e:
            logging.warning(f"OpenAI API failed: {e}")
            return None

    def generate_with_fallback_model(self, prompt: str, chat_memory: ChatMemory) -> str | None:
        """Fallback: use Groq's chat completion, or return None on failure."""
        try:
            groq_api_key = os.environ.get("GROQ_API_KEY")
            if not groq_api_key:
                raise ValueError("GROQ_API_KEY not set in environment")

            payload = {
                "model": "mistral-saba-24b",  
                "messages": [
                    {"role": "system", "content": "You are a coding assistant AI."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7
            }

            groq_response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {groq_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=30
            )
            try:
                groq_response.raise_for_status()
            except requests.exceptions.HTTPError:
                print("Groq response text:", groq_response.text)
                raise


            data = groq_response.json()
            logging.info("Groq fallback succeeded.")
            return data['choices'][0]['message']['content']

        except requests.exceptions.RequestException as http_err:
            logging.warning(f"Groq fallback HTTP error: {http_err}")
            logging.warning(f"Groq response content: {getattr(http_err, 'response', None)}")
            return None
        except Exception as e:
            logging.warning(f"Groq fallback model failed: {e}")
            return None
