import { IStorage } from './storage';
import { 
  User, InsertUser,
  RepositoryAnalysis, InsertRepositoryAnalysis,
  AssistantConversation, InsertAssistantConversation,
  AssistantMessage, InsertAssistantMessage,
  ArchitecturalPlan, InsertArchitecturalPlan
} from '@shared/schema';

// Import MongoDB models
import UserModel from './models/User';
import RepositoryAnalysisModel from './models/RepositoryAnalysis';
import AssistantConversationModel from './models/AssistantConversation';
import AssistantMessageModel from './models/AssistantMessage';
import ArchitecturalPlanModel from './models/ArchitecturalPlan';
import database from './database';
import { log } from './vite';

export class MongoStorage implements IStorage {

  constructor() {
    // Connect to MongoDB when the storage is initialized
    this.connectToDatabase();
  }

  private async connectToDatabase(): Promise<void> {
    try {
      await database.connect();
    } catch (error: any) {
      log(`Error connecting to MongoDB: ${error.message}`, 'mongo-storage');
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    try {
      const user = await UserModel.findById(id);
      if (!user) return undefined;
      
      return this.convertToUser(user);
    } catch (error: any) {
      log(`Error fetching user by ID: ${error.message}`, 'mongo-storage');
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const user = await UserModel.findOne({ username });
      if (!user) return undefined;
      
      return this.convertToUser(user);
    } catch (error: any) {
      log(`Error fetching user by username: ${error.message}`, 'mongo-storage');
      return undefined;
    }
  }

  async getUserByGithubId(githubId: string): Promise<User | undefined> {
    try {
      const user = await UserModel.findOne({ githubId });
      if (!user) return undefined;
      
      return this.convertToUser(user);
    } catch (error: any) {
      log(`Error fetching user by GitHub ID: ${error.message}`, 'mongo-storage');
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const newUser = await UserModel.create(user);
      return this.convertToUser(newUser);
    } catch (error: any) {
      log(`Error creating user: ${error.message}`, 'mongo-storage');
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async updateUserGithubTokens(userId: number, accessToken: string, refreshToken?: string): Promise<User | undefined> {
    try {
      const user = await UserModel.findByIdAndUpdate(
        userId,
        { 
          githubAccessToken: accessToken,
          ...(refreshToken && { githubRefreshToken: refreshToken })
        },
        { new: true }
      );
      
      if (!user) return undefined;
      
      return this.convertToUser(user);
    } catch (error: any) {
      log(`Error updating user GitHub tokens: ${error.message}`, 'mongo-storage');
      return undefined;
    }
  }

  // Repository analysis operations
  async createRepositoryAnalysis(analysis: InsertRepositoryAnalysis): Promise<RepositoryAnalysis> {
    try {
      const newAnalysis = await RepositoryAnalysisModel.create(analysis);
      return this.convertToRepositoryAnalysis(newAnalysis);
    } catch (error: any) {
      log(`Error creating repository analysis: ${error.message}`, 'mongo-storage');
      throw new Error(`Failed to create repository analysis: ${error.message}`);
    }
  }

  async getRepositoryAnalyses(userId: number): Promise<RepositoryAnalysis[]> {
    try {
      const analyses = await RepositoryAnalysisModel.find({ userId }).sort({ analyzedAt: -1 });
      return analyses.map(this.convertToRepositoryAnalysis);
    } catch (error: any) {
      log(`Error fetching repository analyses: ${error.message}`, 'mongo-storage');
      return [];
    }
  }

  async getRepositoryAnalysisById(id: number): Promise<RepositoryAnalysis | undefined> {
    try {
      const analysis = await RepositoryAnalysisModel.findById(id);
      if (!analysis) return undefined;
      
      return this.convertToRepositoryAnalysis(analysis);
    } catch (error: any) {
      log(`Error fetching repository analysis by ID: ${error.message}`, 'mongo-storage');
      return undefined;
    }
  }

  // Assistant conversation operations
  async createAssistantConversation(conversation: InsertAssistantConversation): Promise<AssistantConversation> {
    try {
      const newConversation = await AssistantConversationModel.create(conversation);
      return this.convertToAssistantConversation(newConversation);
    } catch (error: any) {
      log(`Error creating assistant conversation: ${error.message}`, 'mongo-storage');
      throw new Error(`Failed to create assistant conversation: ${error.message}`);
    }
  }

  async getAssistantConversations(userId: number): Promise<AssistantConversation[]> {
    try {
      const conversations = await AssistantConversationModel.find({ userId }).sort({ startedAt: -1 });
      return conversations.map(this.convertToAssistantConversation);
    } catch (error: any) {
      log(`Error fetching assistant conversations: ${error.message}`, 'mongo-storage');
      return [];
    }
  }

  async getAssistantConversationById(id: number): Promise<AssistantConversation | undefined> {
    try {
      const conversation = await AssistantConversationModel.findById(id);
      if (!conversation) return undefined;
      
      return this.convertToAssistantConversation(conversation);
    } catch (error: any) {
      log(`Error fetching assistant conversation by ID: ${error.message}`, 'mongo-storage');
      return undefined;
    }
  }

  async updateAssistantConversation(id: number, data: Partial<InsertAssistantConversation>): Promise<AssistantConversation | undefined> {
    try {
      const conversation = await AssistantConversationModel.findByIdAndUpdate(id, data, { new: true });
      if (!conversation) return undefined;
      
      return this.convertToAssistantConversation(conversation);
    } catch (error: any) {
      log(`Error updating assistant conversation: ${error.message}`, 'mongo-storage');
      return undefined;
    }
  }

  // Assistant message operations
  async createAssistantMessage(message: InsertAssistantMessage): Promise<AssistantMessage> {
    try {
      const newMessage = await AssistantMessageModel.create(message);
      return this.convertToAssistantMessage(newMessage);
    } catch (error: any) {
      log(`Error creating assistant message: ${error.message}`, 'mongo-storage');
      throw new Error(`Failed to create assistant message: ${error.message}`);
    }
  }

  async getAssistantMessagesByConversationId(conversationId: number): Promise<AssistantMessage[]> {
    try {
      const messages = await AssistantMessageModel.find({ conversationId }).sort({ timestamp: 1 });
      return messages.map(this.convertToAssistantMessage);
    } catch (error: any) {
      log(`Error fetching assistant messages: ${error.message}`, 'mongo-storage');
      return [];
    }
  }

  // Architectural plan operations
  async createArchitecturalPlan(plan: InsertArchitecturalPlan): Promise<ArchitecturalPlan> {
    try {
      const newPlan = await ArchitecturalPlanModel.create(plan);
      return this.convertToArchitecturalPlan(newPlan);
    } catch (error: any) {
      log(`Error creating architectural plan: ${error.message}`, 'mongo-storage');
      throw new Error(`Failed to create architectural plan: ${error.message}`);
    }
  }

  async getArchitecturalPlanByConversationId(conversationId: number): Promise<ArchitecturalPlan | undefined> {
    try {
      const plan = await ArchitecturalPlanModel.findOne({ conversationId });
      if (!plan) return undefined;
      
      return this.convertToArchitecturalPlan(plan);
    } catch (error: any) {
      log(`Error fetching architectural plan: ${error.message}`, 'mongo-storage');
      return undefined;
    }
  }

  // Helper conversion methods to ensure consistent data structure
  private convertToUser(document: any): User {
    return {
      id: document._id.toString(),
      username: document.username,
      password: document.password,
      githubId: document.githubId,
      githubUsername: document.githubUsername,
      githubAccessToken: document.githubAccessToken,
      githubRefreshToken: document.githubRefreshToken
    };
  }

  private convertToRepositoryAnalysis(document: any): RepositoryAnalysis {
    return {
      id: document._id.toString(),
      userId: document.userId.toString(),
      repositoryName: document.repositoryName,
      repositoryOwner: document.repositoryOwner,
      analyzedAt: document.analyzedAt,
      structure: document.structure,
      suggestions: document.suggestions
    };
  }

  private convertToAssistantConversation(document: any): AssistantConversation {
    return {
      id: document._id.toString(),
      userId: document.userId.toString(),
      startedAt: document.startedAt,
      experienceLevel: document.experienceLevel,
      projectObjective: document.projectObjective,
      technologyStack: document.technologyStack,
      completed: document.completed
    };
  }

  private convertToAssistantMessage(document: any): AssistantMessage {
    return {
      id: document._id.toString(),
      conversationId: document.conversationId.toString(),
      role: document.role,
      content: document.content,
      timestamp: document.timestamp
    };
  }

  private convertToArchitecturalPlan(document: any): ArchitecturalPlan {
    return {
      id: document._id.toString(),
      conversationId: document.conversationId.toString(),
      content: document.content,
      createdAt: document.createdAt,
      starterKit: document.starterKit
    };
  }
  
  // Database status operation
  isConnectedToMongo(): boolean {
    // Check if MongoDB is connected by using mongoose connection state
    return database.isConnectedToDatabase;
  }
}