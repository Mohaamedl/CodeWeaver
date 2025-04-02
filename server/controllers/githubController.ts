import { GitHubTree } from '@shared/schema';
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import simpleGit from 'simple-git';
import githubService from '../services/githubService';
import { storage } from '../storage';

export class GitHubController {
  /**
   * Helper to get GitHub token from session or Auth header
   */
  private getGitHubToken(req: Request): string | null {
    // First try to get from session
    if (req.session?.githubAccessToken) {
      return req.session.githubAccessToken;
    }
    
    // Then try from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    return null;
  }

  /**
   * GitHub OAuth callback handler
   */
  async handleOAuthCallback(req: Request, res: Response) {
    try {
      const { code } = req.query;
      if (!code || typeof code !== 'string') {
        return res.redirect(`${process.env.APP_BASE_URL}?authError=true`);
      }

      // Exchange the code for an access token
      const { accessToken } = await githubService.getAccessToken(code);

      // Log token scopes but don't block on validation
      try {
        const tokenScopes = await githubService.getTokenScopes(accessToken);
        console.log('Detected token scopes:', tokenScopes);
      } catch (scopeError) {
        console.warn('Error checking token scopes (continuing anyway):', scopeError);
      }

      const githubUser = await githubService.getUserProfile(accessToken);

      let user = await storage.getUserByGithubId(githubUser.id);
      if (!user) {
        user = await storage.createUser({
          username: githubUser.login,
          githubId: githubUser.id,
          githubUsername: githubUser.login,
          githubAccessToken: accessToken,
          password: ''
        });
      }

      if (req.session) {
        req.session.userId = user?.id;
        req.session.githubAccessToken = accessToken;
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

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
      console.log('Access token being used:', accessToken); // Debug log
      const repositories = await githubService.getUserRepositories(accessToken);
      console.log('Fetched repositories:', repositories); // Debug log
      return res.status(200).json(repositories);
    } catch (error: any) {
      console.error('Error listing repositories:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
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
      console.log('Access token being used:', accessToken);
      const tree = await githubService.getRepositoryTree(accessToken, owner, repo);
      console.log('Fetched repository tree:', tree);
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
      console.log('Access token being used:', accessToken);
      const contents = await githubService.getFileContents(accessToken, owner, repo, path);
      console.log('Fetched file contents:', contents);
      return res.status(200).json({ contents });
    } catch (error: any) {
      console.error('Error getting file contents:', error.message);
      return res.status(500).json({ message: 'Failed to fetch file contents' });
    }
  }

  /**
   * Analyze repository before cloning
   */
  private async analyzeRepositoryMetadata(owner: string, repo: string, accessToken: string) {
    try {
      // Get repository metadata first
      const repoMetadata = await githubService.getRepositoryMetadata(accessToken, owner, repo);
      
      // Check if repository is too large (e.g., > 100MB)
      if (repoMetadata.size > 100000) { // size is in KB
        return {
          shouldClone: false,
          reason: 'Repository is too large',
          metadata: repoMetadata
        };
      }

      // Check if repository has too many files
      const tree = await githubService.getRepositoryTree(accessToken, owner, repo);
      if (tree.tree.length > 1000) {
        return {
          shouldClone: false,
          reason: 'Repository has too many files',
          metadata: repoMetadata
        };
      }

      // Check primary language
      const languages = await githubService.getRepositoryLanguages(accessToken, owner, repo);
      const supportedLanguages = ['JavaScript', 'TypeScript', 'Python'];
      const primaryLanguage = Object.entries(languages).sort((a, b) => b[1] - a[1])[0]?.[0];
      
      if (!supportedLanguages.includes(primaryLanguage)) {
        return {
          shouldClone: false,
          reason: 'Primary language not supported',
          metadata: repoMetadata
        };
      }

      return {
        shouldClone: true,
        metadata: repoMetadata,
        primaryLanguage
      };
    } catch (error) {
      console.error('Error analyzing repository metadata:', error);
      throw error;
    }
  }

  /**
   * Get repository path with smart cloning
   */
  async getRepositoryPath(req: Request, res: Response) {
    try {
      const { owner, repo } = req.params;
      const accessToken = this.getGitHubToken(req);
      if (!accessToken) {
        return res.status(401).json({ message: 'GitHub authentication required' });
      }

      // First analyze the repository
      const analysis = await githubService.analyzeRepository(accessToken, owner, repo);
      
      // Return early if repository is too large/complex
      if (analysis.metadata.fileCount > 5000 || analysis.metadata.size > 100000) {
        return res.status(400).json({
          message: 'Repository too large to analyze',
          analysis
        });
      }

      // Return status update with analysis
      const repoPath = path.join(process.cwd(), 'repositories', owner, repo);
      
      if (analysis.shouldClone) {
        // Check if already cloned
        if (!fs.existsSync(repoPath)) {
          await this.cloneRepository(owner, repo);
        } else {
          // Update existing clone
          const git = simpleGit(repoPath);
          await git.pull();
        }

        return res.json({
          path: repoPath,
          cloned: true,
          analysis
        });
      }

      // If not cloning, return analysis for API-based processing
      return res.json({
        cloned: false,
        analysis,
        apiPath: `${owner}/${repo}`
      });

    } catch (error) {
      console.error('Error analyzing repository:', error);
      return res.status(500).json({ error: 'Failed to analyze repository' });
    }
  }

  /**
   * Get repository data with analysis
   */
  async getRepositoryData(req: Request, res: Response) {
    try {
      const { owner, repo } = req.params;
      const accessToken = this.getGitHubToken(req);
      if (!accessToken) {
        return res.status(401).json({ message: 'GitHub authentication required' });
      }

      // First analyze the repository
      const analysis = await githubService.analyzeRepository(accessToken, owner, repo);
      
      if (analysis.shouldClone) {
        // Use cloning approach
        const repoPath = path.join(process.cwd(), 'repositories', owner, repo);
        await this.cloneRepository(owner, repo);
        return res.json({
          method: 'clone',
          path: repoPath,
          analysis
        });
      } else {
        // Use API approach
        const files = await githubService.getRepositoryContents(accessToken, owner, repo);
        return res.json({
          method: 'api',
          files,
          analysis
        });
      }
    } catch (error) {
      console.error('Error analyzing repository:', error);
      return res.status(500).json({ error: 'Failed to analyze repository' });
    }
  }

  /**
   * Optimize repository cloning
   */
  private async cloneRepository(owner: string, repo: string): Promise<string> {
    const repoPath = path.join(process.cwd(), "repositories", owner, repo);
    await fs.promises.mkdir(path.dirname(repoPath), { recursive: true });

    const git = simpleGit();
    if (await fs.promises.access(repoPath).then(() => true).catch(() => false)) {
      // Update existing clone
      await git.cwd(repoPath).pull(['--depth', '1', '--no-tags']);
    } else {
      // Shallow clone for efficiency
      await git.clone(`https://github.com/${owner}/${repo}.git`, repoPath, [
        '--depth', '1',
        '--no-tags',
        '--no-single-branch'
      ]);
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

      console.log('Access token being used:', accessToken);
      const branches = await githubService.getBranches(accessToken, owner as string, repo as string);
      console.log('Fetched branches:', branches);
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

      console.log('Access token being used:', accessToken);

      const { owner, repo, baseBranch, suggestionId } = req.body;
      if (!owner || !repo || !baseBranch || !suggestionId) {
        return res.status(400).json({ message: 'Missing required parameters' });
      }

      const branchName = `fix/${suggestionId}`;
      const branch = await githubService.createBranch(accessToken, owner, repo, baseBranch, branchName);
      console.log('Created branch:', branch);
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

      // Get the suggestion from database
      const db = SessionLocal();
      try {
        const suggestion = await db.query(Suggestion).get(suggestionId);
        if (!suggestion || !suggestion.patch) {
          return res.status(404).json({ message: 'Suggestion not found or has no changes' });
        }

        const branchName = `fix/${suggestionId}`;

        // Apenas use a API do GitHub - remova a lógica de clonagem
        const github = new GitHubService();

        // Verifique se o branch existe
        const branchExists = await github.checkBranchExists(
          accessToken,
          owner,
          repo,
          branchName
        );

        // Crie o branch se não existir
        if (!branchExists) {
          await github.createBranch(accessToken, owner, repo, baseBranch, branchName);
        }

        // Aplique as mudanças via API
        const filePath = suggestion.file_path;
        const currentContent = await github.getFileContents(accessToken, owner, repo, filePath);
        const patchedContent = await github.applyPatchToContent(currentContent, suggestion.patch);

        // Atualize o arquivo no branch
        await github.updateFile(
          accessToken,
          owner,
          repo,
          filePath,
          `Apply suggestion ${suggestionId}`,
          patchedContent,
          branchName
        );

        // Crie ou obtenha PR existente
        const pr = await github.createPullRequest(
          accessToken,
          owner,
          repo,
          baseBranch,
          branchName,
          `Fix: Suggestion ${suggestionId}`,
          `This PR implements the suggested changes from review suggestion ${suggestionId}\n\n${suggestion.message}`
        );

        return res.status(200).json({
          status: 'success',
          pr_url: pr.html_url,
          pr_number: pr.number
        });

      } finally {
        db.close();
      }

    } catch (error: any) {
      console.error('Error creating pull request:', error);
      console.error('Response data:', error.response?.data);
      return res.status(500).json({ 
        message: 'Failed to create pull request',
        error: error.response?.data?.message || error.message 
      });
    }
  }

  /**
   * Apply a patch from a suggestion
   */
  async applyPatch(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const accessToken = req.session?.githubAccessToken;
      if (!accessToken) {
        return res.status(401).json({ message: 'GitHub authentication required' });
      }

      const { suggestion_id } = req.body;
      if (!suggestion_id) {
        return res.status(400).json({ message: 'Missing suggestion_id parameter' });
      }

      console.log('Access token being used:', accessToken);
      // TODO: Get the suggestion from your database

      // For now, we'll return a success response
      return res.status(200).json({ status: 'applied' });
    } catch (error: any) {
      console.error('Error applying patch:', error.message);
      return res.status(500).json({ message: 'Failed to apply patch' });
    }
  }
}

export default new GitHubController();