import { GitHubTree } from '@shared/schema';
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import simpleGit from 'simple-git';
import githubService from '../services/githubService';
import { storage } from '../storage';

export class GitHubController {
  /**
   * GitHub OAuth callback handler
   */
  async handleOAuthCallback(req: Request, res: Response) {
    try {
      const { code } = req.query;
      if (!code || typeof code !== 'string') {
        return res.redirect(`${process.env.APP_BASE_URL}?authError=true`);
      }

      const { accessToken, refreshToken } = await githubService.getAccessToken(code);
      const githubUser = await githubService.getUserProfile(accessToken);

      let user = await storage.getUserByGithubId(githubUser.id);
      if (!user) {
        user = await storage.createUser({
          username: githubUser.login,
          githubId: githubUser.id,
          githubUsername: githubUser.login,
          githubAccessToken: accessToken,
          githubRefreshToken: refreshToken,
        });
      }

      if (req.session) {
        req.session.userId = user?.id;
        req.session.githubAccessToken = accessToken;
        // Save session before redirect
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Pass both token and user info
      const redirectUrl = new URL(`${process.env.APP_BASE_URL}/codebase`);
      redirectUrl.searchParams.set('token', accessToken);
      redirectUrl.searchParams.set('userId', user.id.toString());
      return res.redirect(redirectUrl.toString());

    } catch (error: any) {
      console.error('GitHub OAuth error:', error);
      return res.redirect(`${process.env.APP_BASE_URL}?authError=true`);
    }
  }

  /**
   * Get access token
   */
  async getAccessToken(req: Request, res: Response) {
    console.log("Session state:", req.session);
    console.log("Headers:", req.headers);

    if (!req.session?.githubAccessToken) {
      return res.status(401).json({ error: 'No access token found' });
    }
    return res.json({ 
      token: req.session.githubAccessToken,
      userId: req.session.userId
    });
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
   * Get repository path
   */
  async getRepositoryPath(req: Request, res: Response) {
    try {
      const { owner, repo } = req.params;
      const repoPath = path.join(process.cwd(), 'repositories', owner, repo);
      
      // Ensure repository is cloned first
      if (!fs.existsSync(repoPath)) {
        await this.cloneRepository(owner, repo);
      }
      
      res.json({ path: repoPath });
    } catch (error) {
      console.error('Error getting repository path:', error);
      res.status(500).json({ error: 'Failed to get repository path' });
    }
  }

  /**
   * Clone repository to local storage
   */
  async cloneRepository(owner: string, repo: string): Promise<string> {
    const repoPath = path.join(process.cwd(), "repositories", owner, repo);
    
    // Create directories if they don't exist
    await fs.promises.mkdir(path.dirname(repoPath), { recursive: true });
    
    // Clone or update repository
    if (await fs.promises.access(repoPath).then(() => true).catch(() => false)) {
      // Pull latest changes if repo exists
      const git = simpleGit(repoPath);
      await git.pull();
    } else {
      // Clone if repo doesn't exist
      const repoUrl = `https://github.com/${owner}/${repo}.git`;
      await simpleGit().clone(repoUrl, repoPath);
    }
    
    return repoPath;
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

  /**
   * List available branches
   */
  async listBranches(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const accessToken = req.session?.githubAccessToken;
      if (!accessToken) {
        return res.status(401).json({ message: 'GitHub authentication required' });
      }

      const { owner, repo } = req.query;
      if (!owner || !repo) {
        return res.status(400).json({ message: 'Owner and repository name are required' });
      }

      const branches = await githubService.getBranches(accessToken, owner as string, repo as string);
      return res.status(200).json(branches);
    } catch (error: any) {
      console.error('Error listing branches:', error.message);
      return res.status(500).json({ message: 'Failed to fetch branches' });
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const accessToken = req.session?.githubAccessToken;
      if (!accessToken) {
        return res.status(401).json({ message: 'GitHub authentication required' });
      }

      const { owner, repo, baseBranch, suggestionId } = req.body;
      if (!owner || !repo || !baseBranch || !suggestionId) {
        return res.status(400).json({ message: 'Missing required parameters' });
      }

      const branchName = `fix/${suggestionId}`;
      const branch = await githubService.createBranch(accessToken, owner, repo, baseBranch, branchName);
      return res.status(200).json(branch);
    } catch (error: any) {
      console.error('Error creating branch:', error.message);
      return res.status(500).json({ message: 'Failed to create branch' });
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const accessToken = req.session?.githubAccessToken;
      if (!accessToken) {
        return res.status(401).json({ message: 'GitHub authentication required' });
      }

      const { owner, repo, baseBranch, suggestionId } = req.body;
      if (!owner || !repo || !baseBranch || !suggestionId) {
        return res.status(400).json({ message: 'Missing required parameters' });
      }

      const branchName = `fix/${suggestionId}`;
      const pr = await githubService.createPullRequest(
        accessToken,
        owner,
        repo,
        baseBranch,
        branchName,
        `Fix: ${suggestionId}`,
        `This PR implements the suggested changes from review suggestion ${suggestionId}`
      );
      return res.status(200).json(pr);
    } catch (error: any) {
      console.error('Error creating pull request:', error.message);
      return res.status(500).json({ message: 'Failed to create pull request' });
    }
  }
}

export default new GitHubController();
