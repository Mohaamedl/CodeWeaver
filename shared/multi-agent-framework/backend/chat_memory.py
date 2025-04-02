import os

class ChatMemory:
    """Shared context for user preferences (expected and inferred)."""
    def __init__(self):
        # expected (user-specified) preferences
        self.user_prefs = {
            'indent_style': 'spaces'
        }
        # inferred preferences from existing code
        self.inferred_prefs = {}

    def infer_preferences(self, repo_path: str):
        """Infer coding style preferences from the repository (e.g., language, indentation style)."""
        # Determine primary language by file extension frequency
        ext_counts = {}
        for root, dirs, files in os.walk(repo_path):
            for file in files:
                ext = os.path.splitext(file)[1]
                if not ext:
                    continue
                ext_counts[ext] = ext_counts.get(ext, 0) + 1
        if ext_counts:
            main_ext = max(ext_counts, key=ext_counts.get)
            lang_map = {
                '.py': 'Python',
                '.js': 'JavaScript',
                '.java': 'Java',
                '.cpp': 'C++',
                '.c': 'C'
            }
            language = lang_map.get(main_ext, main_ext.lstrip('.').capitalize())
        else:
            language = 'Unknown'
        self.inferred_prefs['language'] = language

        # Determine indentation style (tabs or spaces or mixed) for main language files
        indent_style = 'spaces'
        tabs_found = False
        spaces_found = False
        target_ext = None
        if language != 'Unknown':
            # invert lang_map for lookup
            rev_map = {v: k for k, v in locals().get('lang_map', {}).items()}
            target_ext = rev_map.get(language, None)
        for root, dirs, files in os.walk(repo_path):
            for file in files:
                if target_ext:
                    if not file.endswith(target_ext):
                        continue
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r') as f:
                        for line in f:
                            if line.strip() == '':
                                continue
                            # Identify leading whitespace (tabs or spaces)
                            indent = ''
                            for ch in line:
                                if ch == ' ' or ch == '\t':
                                    indent += ch
                                else:
                                    break
                            if '\t' in indent:
                                tabs_found = True
                            if indent.replace('\t', '') != '':
                                # if indent (with tabs removed) still has spaces, then spaces were used
                                spaces_found = True
                            if tabs_found and spaces_found:
                                break
                except:
                    continue
            if tabs_found and spaces_found:
                indent_style = 'mixed'
                break
        if indent_style != 'mixed':
            if tabs_found and not spaces_found:
                indent_style = 'tabs'
            elif spaces_found and not tabs_found:
                indent_style = 'spaces'
        self.inferred_prefs['indent_style'] = indent_style
