import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import dotenv from "dotenv";
import database from "./database";
import { storage, createStorage } from "./storage";
import path from "path";
import fs from "fs";
import openaiService from "./services/openaiService";

// Load environment variables from .env
console.log("Current working directory:", process.cwd());
const envPath = path.resolve(process.cwd(), '.env');
console.log("Looking for .env file at:", envPath);
console.log(".env file exists:", fs.existsSync(envPath));

// Try to load the .env file directly
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log(".env file content preview (first 100 chars):", envContent.substring(0, 100));
}

// Load environment variables before any other imports that might use them
const result = dotenv.config();
if (result.error) {
  console.error("Error loading .env file:", result.error);
} else {
  console.log("Successfully loaded .env file");
}

// Debug environment variables
console.log("Environment Variables Check:");
console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);
console.log("OPENAI_API_KEY length:", process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
console.log("OPENAI_API_KEY prefix:", process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 8) : "N/A");
console.log("PORT:", process.env.PORT);
console.log("APP_BASE_URL:", process.env.APP_BASE_URL);
console.log("MONGO_URI exists:", !!process.env.MONGO_URI);

// Initialize the OpenAI service with loaded environment variables
openaiService.initialize();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Variable to track if we're using MongoDB or in-memory storage
  let usingMongoDb = false;
  
  // Connect to MongoDB if MONGO_URI is provided
  if (process.env.MONGO_URI) {
    try {
      await database.connect();
      log("MongoDB connected successfully", "database");
      usingMongoDb = true;
    } catch (error: any) {
      log(`MongoDB connection error: ${error.message}`, "database");
      log("Falling back to in-memory storage", "database");
      // Ensure we use in-memory storage by setting the MONGO_URI to undefined
      process.env.MONGO_URI = undefined;
    }
  } else {
    log("MONGO_URI not provided, using in-memory storage", "database");
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000 in Replit
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  // NOTE: GitHub OAuth is configured to use http://localhost:3000 for the callback URL
  // Make sure your GitHub OAuth app settings match APP_BASE_URL in .env
  const port = process.env.PORT;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    log(`GitHub OAuth is configured to use: ${process.env.APP_BASE_URL || 'http://localhost:3000'}`);
    log(`Make sure your GitHub OAuth app settings match this URL for the callback`);
    
    // Log storage mode
    if (usingMongoDb) {
      log(`Using MongoDB storage for persistence`, "storage");
    } else {
      log(`Using in-memory storage (data will be lost on restart)`, "storage");
    }
  });
})();
