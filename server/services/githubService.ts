import axios from 'axios';
import { GitHubRepository, GitHubDirectoryItem, GitHubTree } from '@shared/schema';

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

    return response.data;
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
    const response = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        title,
        body,
        head: headBranch,
        base: baseBranch,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    return response.data;
  }
}

export default new GitHubService();
