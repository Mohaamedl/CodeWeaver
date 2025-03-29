import express, { type Express } from "express";
import session from "express-session";
import { createServer, type Server } from "http";
import githubController from "./controllers/githubController";
import openaiController from "./controllers/openaiController";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId: number;
    githubAccessToken: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration with proper settings
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "very-secret-key",
      resave: true,
      saveUninitialized: true,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24, // 24 hours,
        httpOnly: true,
        sameSite: "lax"
      },
      name: "codeweaver.sid"
    })
  );

  // GitHub OAuth routes
  app.get("/api/auth/github/callback", githubController.handleOAuthCallback.bind(githubController));

  // Authentication middleware
  const checkAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  // GitHub repository routes
  app.get("/api/repositories", checkAuth, githubController.listRepositories.bind(githubController));
  app.get("/api/repository/:owner/:repo/tree", checkAuth, githubController.getRepositoryTree.bind(githubController));
  app.get("/api/repository/:owner/:repo/path", checkAuth, githubController.getRepositoryPath.bind(githubController));
  app.get("/api/repository/:owner/:repo/contents/:path(*)", checkAuth, githubController.getFileContents.bind(githubController));

  // OpenAI analysis routes
  app.post("/api/analyze", checkAuth, openaiController.analyzeRepository.bind(openaiController));

  // Assistant routes
  app.post("/api/assistant/conversations", checkAuth, openaiController.startConversation.bind(openaiController));
  app.post("/api/assistant/conversations/:conversationId/messages", checkAuth, openaiController.sendMessage.bind(openaiController));
  app.post("/api/assistant/conversations/:conversationId/generate-plan", checkAuth, openaiController.generatePlan.bind(openaiController));
  app.get("/api/assistant/conversations/:conversationId/export", checkAuth, openaiController.exportPlan.bind(openaiController));

  // Authentication status route - update to include all necessary info
  app.get("/api/auth/status", (req, res) => {
    if (req.session?.userId && req.session?.githubAccessToken) {
      res.json({ 
        authenticated: true, 
        userId: req.session.userId,
        githubAccessToken: req.session.githubAccessToken,
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Add a route to get the token
  app.get("/api/auth/token", checkAuth, githubController.getAccessToken.bind(githubController));

  // GitHub OAuth initiation route
  app.get("/api/auth/github", (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    // Use APP_BASE_URL for the callback URL to match GitHub OAuth settings
    const redirectUri = `${process.env.APP_BASE_URL}/api/auth/github/callback`;
    const scope = "repo,user";
    
    res.redirect(`https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`);
  });

  // Logout route
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
  
  // Database status route
  app.get("/api/db/status", (req, res) => {
    const usingMongo = process.env.MONGO_URI ? true : false;
    const isConnected = usingMongo ? storage.isConnectedToMongo() : true;
    
    res.status(200).json({ 
      status: isConnected ? 'ok' : 'error',
      storage: usingMongo ? 'MongoDB' : 'In-Memory',
      connected: isConnected,
      timestamp: new Date().toISOString()
    });
  });

  // GitHub routes
  app.get("/api/github/branches", githubController.listBranches);
  app.post("/api/github/create-branch", githubController.createBranch);
  app.post("/api/github/create-pr", githubController.createPullRequest);

  const httpServer = createServer(app);

  return httpServer;
}
