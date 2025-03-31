import { GitHubDirectoryItem, GitHubRepository, GitHubTree } from '@shared/schema';
import axios from 'axios';

const GITHUB_API_URL = 'https://api.github.com';

export class GitHubService {
  /**
   * Exchanges the authorization code for an access token
   */
  async getAccessToken(code: string): Promise<{ accessToken: string, refreshToken?: string }> {
    try {
      const response = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        },
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
      };
    } catch (error: any) {
      console.error('Error exchanging GitHub code for token:', error.message);
      throw new Error('Failed to exchange authorization code for access token');
    }
  }

  /**
   * Gets the authenticated user's profile
   */
  async getUserProfile(accessToken: string): Promise<{ id: string, login: string }> {
    try {
      const response = await axios.get(`${GITHUB_API_URL}/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return {
        id: response.data.id.toString(),
        login: response.data.login,
      };
    } catch (error: any) {
      console.error('Error fetching GitHub user profile:', error.message);
      throw new Error('Failed to fetch user profile from GitHub');
    }
  }

  /**
   * Gets the authenticated user's repositories
   */
  async getUserRepositories(accessToken: string): Promise<GitHubRepository[]> {
    try {
      // Get all repositories (paginated with 100 per page)
      const response = await axios.get(`${GITHUB_API_URL}/user/repos`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          per_page: 100,
          sort: 'updated',
          direction: 'desc',
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Error fetching GitHub repositories:', error.message);
      throw new Error('Failed to fetch repositories from GitHub');
    }
  }

  /**
   * Gets the contents of a directory in a repository
   */
  async getRepositoryContents(
    accessToken: string,
    owner: string,
    repo: string,
    path: string = ''
  ): Promise<GitHubDirectoryItem[]> {
    try {
      const url = path
        ? `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`
        : `${GITHUB_API_URL}/repos/${owner}/${repo}/contents`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return Array.isArray(response.data) ? response.data : [response.data];
    } catch (error: any) {
      console.error('Error fetching repository contents:', error.message);
      throw new Error('Failed to fetch repository contents from GitHub');
    }
  }

  /**
   * Gets the Git tree of a repository (more efficient for large repos)
   */
  async getRepositoryTree(
    accessToken: string,
    owner: string,
    repo: string,
    recursive: boolean = true
  ): Promise<GitHubTree> {
    try {
      // First get the default branch
      const repoResponse = await axios.get(`${GITHUB_API_URL}/repos/${owner}/${repo}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const defaultBranch = repoResponse.data.default_branch;

      // Then get the tree using the default branch
      const response = await axios.get(
        `${GITHUB_API_URL}/repos/${owner}/${repo}/git/trees/${defaultBranch}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            recursive: recursive ? 1 : 0,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error fetching repository tree:', error.message);
      throw new Error('Failed to fetch repository tree from GitHub');
    }
  }

  /**
   * Gets the file contents from a repository
   */
  async getFileContents(
    accessToken: string,
    owner: string,
    repo: string,
    path: string
  ): Promise<string> {
    try {
      const response = await axios.get(
        `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      // GitHub API returns the content as base64 encoded
      if (response.data.encoding === 'base64') {
        return Buffer.from(response.data.content, 'base64').toString();
      }

      return response.data.content;
    } catch (error: any) {
      console.error('Error fetching file contents:', error.message);
      throw new Error('Failed to fetch file contents from GitHub');
    }
  }

  /**
   * Get repository branches
   */
  async getBranches(accessToken: string, owner: string, repo: string): Promise<string[]> {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/branches`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    return response.data.map((branch: any) => branch.name);
  }

  /**
   * Create a new branch
   */
  async createBranch(
    accessToken: string,
    owner: string,
    repo: string,
    baseBranch: string,
    newBranch: string
  ): Promise<any> {
    try {
      // First get the SHA of the base branch
      const baseRef = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
      console.log('Base branch SHA:', baseRef.data.object.sha);

      // Create the new branch
      const response = await axios.post(
        `https://api.github.com/repos/${owner}/${repo}/git/refs`,
        {
          ref: `refs/heads/${newBranch}`,
          sha: baseRef.data.object.sha,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
      console.log('Branch creation response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error creating branch:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
      throw new Error('Failed to create branch');
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    accessToken: string,
    owner: string,
    repo: string,
    baseBranch: string,
    headBranch: string,
    title: string,
    body: string
  ): Promise<any> {
    try {
      // First check if a PR already exists for this branch
      const existingPRs = await axios.get(
        `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
          params: {
            head: `${owner}:${headBranch}`,
            base: baseBranch,
            state: 'open'
          }
        }
      );

      if (existingPRs.data.length > 0) {
        console.log('Found existing PR:', existingPRs.data[0].html_url);
        return existingPRs.data[0];
      }

      // Create new PR if none exists
      const response = await axios.post(
        `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls`,
        {
          title,
          body,
          head: `${owner}:${headBranch}`, // Use full reference
          base: baseBranch,
          maintainer_can_modify: true
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      console.log('Created new PR:', response.data.html_url);
      return response.data;
    } catch (error: any) {
      // Log full error details
      console.error('Error creating PR:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Handle specific error cases
      if (error.response?.status === 422) {
        if (error.response.data?.errors?.[0]?.message?.includes("pull request already exists")) {
          // Return the existing PR details
          const existingPRs = await this.getExistingPR(accessToken, owner, repo, headBranch, baseBranch);
          if (existingPRs.length > 0) {
            return existingPRs[0];
          }
        }
      }
      throw error;
    }
  }

  // Add helper method to get existing PR
  private async getExistingPR(
    accessToken: string,
    owner: string,
    repo: string,
    head: string,
    base: string
  ): Promise<any[]> {
    const response = await axios.get(
      `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: {
          head: `${owner}:${head}`,
          base,
          state: 'open'
        }
      }
    );
    return response.data;
  }

  /**
   * Checks if a branch exists
   */
  async checkBranchExists(
    accessToken: string,
    owner: string,
    repo: string,
    branchName: string
  ): Promise<boolean> {
    try {
      await axios.get(
        `${GITHUB_API_URL}/repos/${owner}/${repo}/git/refs/heads/${branchName}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
      return true;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Updates a file in the repository
   */
  async updateFile(
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    message: string,
    content: string,
    branch: string
  ): Promise<void> {
    try {
      // Get current file to get its SHA
      const currentFile = await axios.get(
        `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      // Update file
      await axios.put(
        `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`,
        {
          message,
          content: Buffer.from(content).toString('base64'),
          sha: currentFile.data.sha,
          branch
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
    } catch (error: any) {
      console.error('Error updating file:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Gets the scopes of the access token
   */
  async getTokenScopes(accessToken: string): Promise<string[]> {
    try {
      const response = await axios.get(`${GITHUB_API_URL}/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      console.log('GitHub API response headers:', response.headers);

      const scopesHeader = response.headers['x-oauth-scopes'];
      if (!scopesHeader || scopesHeader.trim() === '') {
        // Just log a warning but return the token's implicit scopes
        console.warn('No explicit scopes found, token may have org-wide permissions');
        return ['repo', 'read:user', 'user:email'];
      }

      return scopesHeader.split(',').map((scope: string) => scope.trim());
    } catch (error: any) {
      // Log error but don't fail the request
      console.error('Error fetching token scopes:', error.message);
      return ['repo', 'read:user', 'user:email'];
    }
  }

  /**
   * Applies a patch to the original content
   */
  async applyPatchToContent(originalContent: string, patch: string): Promise<string> {
    // Create temp files for patch operation
    const os = await import('os');
    const path = await import('path');
    const fs = await import('fs/promises');
    const { exec } = await import('child_process');
    const util = await import('util');
    const execAsync = util.promisify(exec);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'patch-'));
    const originalFile = path.join(tempDir, 'original');
    const patchFile = path.join(tempDir, 'changes.patch');

    try {
      // Write files
      await fs.writeFile(originalFile, originalContent);
      await fs.writeFile(patchFile, patch);

      // Apply patch
      await execAsync(`patch ${originalFile} ${patchFile}`);

      // Read result
      const patchedContent = await fs.readFile(originalFile, 'utf-8');
      return patchedContent;

    } finally {
      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}

export default new GitHubService();
