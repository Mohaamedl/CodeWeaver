import { GitHubRepository, GitHubDirectoryItem, GitHubTree } from '@shared/schema';

/**
 * Helper library for GitHub API operations on the client side
 */
export const githubApi = {
  /**
   * Get GitHub authentication URL
   */
  getAuthUrl(): string {
    return '/api/auth/github';
  },

  /**
   * Get user repositories
   */
  async getUserRepositories(): Promise<GitHubRepository[]> {
    try {
      const response = await fetch('/api/repositories', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch repositories: ${response.statusText}`);
      }

      return response.json();
    } catch (error: any) {
      console.error('Error fetching repositories:', error.message);
      throw error;
    }
  },

  /**
   * Get repository tree structure
   */
  async getRepositoryTree(owner: string, repo: string): Promise<GitHubTree> {
    try {
      const response = await fetch(`/api/repository/${owner}/${repo}/tree`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch repository tree: ${response.statusText}`);
      }

      return response.json();
    } catch (error: any) {
      console.error('Error fetching repository tree:', error.message);
      throw error;
    }
  },

  /**
   * Get file contents
   */
  async getFileContents(owner: string, repo: string, path: string): Promise<string> {
    try {
      const response = await fetch(`/api/repository/${owner}/${repo}/contents/${path}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch file contents: ${response.statusText}`);
      }

      const data = await response.json();
      return data.contents;
    } catch (error: any) {
      console.error('Error fetching file contents:', error.message);
      throw error;
    }
  },

  /**
   * Format repository size
   */
  formatFileSize(bytes?: number): string {
    if (bytes === undefined) return '';
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },

  /**
   * Get language color for badge styling
   */
  getLanguageColor(language: string | null): string {
    if (!language) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    
    const languageColors: Record<string, string> = {
      JavaScript: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      TypeScript: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      Python: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      Java: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'C#': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      PHP: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      Ruby: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      Go: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      Rust: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    };
    
    return languageColors[language] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};
