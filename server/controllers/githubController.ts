import { Request, Response } from 'express';
import githubService from '../services/githubService';
import { storage } from '../storage';
import { GitHubRepository, GitHubTree } from '@shared/schema';

export class GitHubController {
  /**
   * GitHub OAuth callback handler
   */
  async handleOAuthCallback(req: Request, res: Response) {
    try {
      const { code } = req.query;

      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: 'Authorization code is required' });
      }

      // Exchange code for access token
      const { accessToken, refreshToken } = await githubService.getAccessToken(code);

      // Get user profile
      const githubUser = await githubService.getUserProfile(accessToken);

      // Check if user exists
      let user = await storage.getUserByGithubId(githubUser.id);

      if (!user) {
        // Create new user
        user = await storage.createUser({
          username: githubUser.login,
          password: '', // No password for GitHub-authenticated users
          githubId: githubUser.id,
          githubUsername: githubUser.login,
          githubAccessToken: accessToken,
          githubRefreshToken: refreshToken,
        });
      } else {
        // Update GitHub tokens
        user = await storage.updateUserGithubTokens(user.id, accessToken, refreshToken);
      }

      // Create session
      if (req.session) {
        req.session.userId = user?.id;
        req.session.githubAccessToken = accessToken;
      }

      return res.status(200).json({
        message: 'GitHub authentication successful',
        user: {
          id: user?.id,
          username: user?.username,
          githubUsername: user?.githubUsername,
        }
      });
    } catch (error: any) {
      console.error('GitHub OAuth error:', error.message);
      // Provide more detailed error information to help debug
      console.error('GitHub OAuth config:', {
        clientId: process.env.GITHUB_CLIENT_ID,
        redirectUri: `${process.env.APP_BASE_URL}/api/auth/github/callback`,
        appBaseUrl: process.env.APP_BASE_URL
      });
      return res.status(500).json({ 
        message: 'GitHub authentication failed',
        details: 'Make sure your GitHub OAuth app settings match the callback URL in your application.',
        error: error.message
      });
    }
  }

  /**
   * List user's GitHub repositories
   */
  async listRepositories(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const accessToken = req.session?.githubAccessToken;
      if (!accessToken) {
        return res.status(401).json({ message: 'GitHub authentication required' });
      }

      const repositories = await githubService.getUserRepositories(accessToken);
      
      return res.status(200).json(repositories);
    } catch (error: any) {
      console.error('Error listing repositories:', error.message);
      return res.status(500).json({ message: 'Failed to fetch repositories' });
    }
  }

  /**
   * Get repository tree structure
   */
  async getRepositoryTree(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const accessToken = req.session?.githubAccessToken;
      if (!accessToken) {
        return res.status(401).json({ message: 'GitHub authentication required' });
      }

      const { owner, repo } = req.params;
      
      if (!owner || !repo) {
        return res.status(400).json({ message: 'Owner and repository name are required' });
      }

      const tree = await githubService.getRepositoryTree(accessToken, owner, repo);
      
      // Format the tree for easier consumption by the frontend
      const formattedTree = this.formatRepositoryTree(tree);
      
      return res.status(200).json(formattedTree);
    } catch (error: any) {
      console.error('Error getting repository tree:', error.message);
      return res.status(500).json({ message: 'Failed to fetch repository structure' });
    }
  }

  /**
   * Get file contents
   */
  async getFileContents(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const accessToken = req.session?.githubAccessToken;
      if (!accessToken) {
        return res.status(401).json({ message: 'GitHub authentication required' });
      }

      const { owner, repo, path } = req.params;
      
      if (!owner || !repo || !path) {
        return res.status(400).json({ message: 'Owner, repository name, and file path are required' });
      }

      const contents = await githubService.getFileContents(accessToken, owner, repo, path);
      
      return res.status(200).json({ contents });
    } catch (error: any) {
      console.error('Error getting file contents:', error.message);
      return res.status(500).json({ message: 'Failed to fetch file contents' });
    }
  }

  /**
   * Helper method to format repository tree for frontend consumption
   */
  private formatRepositoryTree(tree: GitHubTree) {
    // Convert flat tree to hierarchical structure
    const root: any = { name: '', children: [] };
    const pathMap: Record<string, any> = { '': root };

    tree.tree.forEach(item => {
      const pathParts = item.path.split('/');
      const fileName = pathParts.pop() || '';
      const parentPath = pathParts.join('/');
      
      // Get or create parent
      if (!pathMap[parentPath]) {
        this.createParentPath(pathMap, parentPath, pathParts, root);
      }
      
      const parent = pathMap[parentPath];
      
      if (item.type === 'blob') {
        // Add file
        parent.children.push({
          name: fileName,
          path: item.path,
          type: 'file',
          size: item.size,
          sha: item.sha
        });
      } else if (item.type === 'tree') {
        // Add directory if it doesn't exist
        if (!pathMap[item.path]) {
          const dir = {
            name: fileName,
            path: item.path,
            type: 'directory',
            children: [],
            sha: item.sha
          };
          parent.children.push(dir);
          pathMap[item.path] = dir;
        }
      }
    });

    return root;
  }

  /**
   * Helper method to create parent path in the tree
   */
  private createParentPath(pathMap: Record<string, any>, parentPath: string, pathParts: string[], root: any) {
    let currentPath = '';
    let currentParent = root;

    for (const part of pathParts) {
      const prevPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      if (!pathMap[currentPath]) {
        const newDir = {
          name: part,
          path: currentPath,
          type: 'directory',
          children: [],
        };
        pathMap[currentPath] = newDir;
        
        // Add to parent
        (pathMap[prevPath] || root).children.push(newDir);
      }
      
      currentParent = pathMap[currentPath];
    }
  }
}

export default new GitHubController();
