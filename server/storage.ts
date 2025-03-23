import { 
  users, type User, type InsertUser,
  repositoryAnalyses, type RepositoryAnalysis, type InsertRepositoryAnalysis,
  assistantConversations, type AssistantConversation, type InsertAssistantConversation,
  assistantMessages, type AssistantMessage, type InsertAssistantMessage,
  architecturalPlans, type ArchitecturalPlan, type InsertArchitecturalPlan
} from "@shared/schema";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByGithubId(githubId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserGithubTokens(userId: number, accessToken: string, refreshToken?: string): Promise<User | undefined>;

  // Repository analysis operations
  createRepositoryAnalysis(analysis: InsertRepositoryAnalysis): Promise<RepositoryAnalysis>;
  getRepositoryAnalyses(userId: number): Promise<RepositoryAnalysis[]>;
  getRepositoryAnalysisById(id: number): Promise<RepositoryAnalysis | undefined>;

  // Assistant conversation operations
  createAssistantConversation(conversation: InsertAssistantConversation): Promise<AssistantConversation>;
  getAssistantConversations(userId: number): Promise<AssistantConversation[]>;
  getAssistantConversationById(id: number | string): Promise<AssistantConversation | undefined>;
  updateAssistantConversation(id: number | string, data: Partial<InsertAssistantConversation>): Promise<AssistantConversation | undefined>;

  // Assistant message operations
  createAssistantMessage(message: InsertAssistantMessage): Promise<AssistantMessage>;
  getAssistantMessagesByConversationId(conversationId: number | string): Promise<AssistantMessage[]>;

  // Architectural plan operations
  createArchitecturalPlan(plan: InsertArchitecturalPlan): Promise<ArchitecturalPlan>;
  getArchitecturalPlanByConversationId(conversationId: number): Promise<ArchitecturalPlan | undefined>;
  
  // Database status operations
  isConnectedToMongo(): boolean;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private repositoryAnalyses: Map<number, RepositoryAnalysis>;
  private assistantConversations: Map<number, AssistantConversation>;
  private assistantMessages: Map<number, AssistantMessage>;
  private architecturalPlans: Map<number, ArchitecturalPlan>;
  
  private currentUserId: number;
  private currentRepositoryAnalysisId: number;
  private currentAssistantConversationId: number;
  private currentAssistantMessageId: number;
  private currentArchitecturalPlanId: number;

  constructor() {
    this.users = new Map();
    this.repositoryAnalyses = new Map();
    this.assistantConversations = new Map();
    this.assistantMessages = new Map();
    this.architecturalPlans = new Map();

    this.currentUserId = 1;
    this.currentRepositoryAnalysisId = 1;
    this.currentAssistantConversationId = 1;
    this.currentAssistantMessageId = 1;
    this.currentArchitecturalPlanId = 1;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByGithubId(githubId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.githubId === githubId,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    
    // Ensure all required fields are set with proper defaults
    const user: User = {
      id,
      username: insertUser.username,
      password: insertUser.password,
      githubId: insertUser.githubId || null,
      githubUsername: insertUser.githubUsername || null,
      githubAccessToken: insertUser.githubAccessToken || null, 
      githubRefreshToken: insertUser.githubRefreshToken || null
    };
    
    this.users.set(id, user);
    return user;
  }

  async updateUserGithubTokens(userId: number, accessToken: string, refreshToken?: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;

    const updatedUser: User = {
      ...user,
      githubAccessToken: accessToken,
      githubRefreshToken: refreshToken || user.githubRefreshToken,
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  // Repository analysis operations
  async createRepositoryAnalysis(analysis: InsertRepositoryAnalysis): Promise<RepositoryAnalysis> {
    const id = this.currentRepositoryAnalysisId++;
    const now = new Date();
    
    // Ensure all required fields are set with proper defaults
    const repositoryAnalysis: RepositoryAnalysis = {
      id,
      userId: analysis.userId !== undefined ? analysis.userId : null,
      repositoryName: analysis.repositoryName,
      repositoryOwner: analysis.repositoryOwner,
      analyzedAt: now,
      structure: analysis.structure || {},
      suggestions: analysis.suggestions || []
    };
    
    this.repositoryAnalyses.set(id, repositoryAnalysis);
    return repositoryAnalysis;
  }

  async getRepositoryAnalyses(userId: number): Promise<RepositoryAnalysis[]> {
    return Array.from(this.repositoryAnalyses.values()).filter(
      (analysis) => analysis.userId === userId,
    );
  }

  async getRepositoryAnalysisById(id: number): Promise<RepositoryAnalysis | undefined> {
    return this.repositoryAnalyses.get(id);
  }

  // Assistant conversation operations
  async createAssistantConversation(conversation: InsertAssistantConversation): Promise<AssistantConversation> {
    const id = this.currentAssistantConversationId++;
    const now = new Date();
    
    // Ensure all required fields are set with proper defaults
    const assistantConversation: AssistantConversation = {
      id,
      userId: conversation.userId !== undefined ? conversation.userId : null,
      startedAt: now,
      experienceLevel: conversation.experienceLevel || null,
      projectObjective: conversation.projectObjective || null,
      technologyStack: conversation.technologyStack || null,
      completed: false
    };
    
    this.assistantConversations.set(id, assistantConversation);
    return assistantConversation;
  }

  async getAssistantConversations(userId: number): Promise<AssistantConversation[]> {
    return Array.from(this.assistantConversations.values()).filter(
      (conversation) => conversation.userId === userId,
    );
  }

  async getAssistantConversationById(id: number | string): Promise<AssistantConversation | undefined> {
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    return this.assistantConversations.get(numericId);
  }

  async updateAssistantConversation(id: number | string, data: Partial<InsertAssistantConversation>): Promise<AssistantConversation | undefined> {
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    const conversation = this.assistantConversations.get(numericId);
    if (!conversation) return undefined;

    // Create updated conversation with safe type casting
    const updatedConversation: AssistantConversation = {
      ...conversation,
      experienceLevel: data.experienceLevel !== undefined ? data.experienceLevel : conversation.experienceLevel,
      projectObjective: data.projectObjective !== undefined ? data.projectObjective : conversation.projectObjective,
      technologyStack: data.technologyStack !== undefined ? data.technologyStack : conversation.technologyStack,
      // Handle the completed property from the data object 
      // Since it's coming from a Partial<InsertAssistantConversation> we need to cast it
      completed: (data as any).completed !== undefined ? (data as any).completed : conversation.completed,
    };

    this.assistantConversations.set(numericId, updatedConversation);
    return updatedConversation;
  }

  // Assistant message operations
  async createAssistantMessage(message: InsertAssistantMessage): Promise<AssistantMessage> {
    const id = this.currentAssistantMessageId++;
    const now = new Date();
    
    // Convert conversationId to number if it's a string
    const conversationId = typeof message.conversationId === 'string' 
      ? parseInt(message.conversationId) 
      : message.conversationId;
    
    // Ensure all required fields are set with proper defaults
    const assistantMessage: AssistantMessage = {
      id,
      conversationId: conversationId !== undefined ? conversationId : null,
      role: message.role,
      content: message.content,
      timestamp: now
    };
    
    this.assistantMessages.set(id, assistantMessage);
    return assistantMessage;
  }

  async getAssistantMessagesByConversationId(conversationId: number | string): Promise<AssistantMessage[]> {
    const numericId = typeof conversationId === 'string' ? parseInt(conversationId) : conversationId;
    return Array.from(this.assistantMessages.values())
      .filter((message) => message.conversationId === numericId)
      .sort((a, b) => {
        const timeA = a.timestamp ? a.timestamp.getTime() : 0;
        const timeB = b.timestamp ? b.timestamp.getTime() : 0;
        return timeA - timeB;
      });
  }

  // Architectural plan operations
  async createArchitecturalPlan(plan: InsertArchitecturalPlan): Promise<ArchitecturalPlan> {
    const id = this.currentArchitecturalPlanId++;
    const now = new Date();
    
    // Ensure all required fields are set with proper defaults
    const architecturalPlan: ArchitecturalPlan = {
      id,
      conversationId: plan.conversationId !== undefined ? plan.conversationId : null,
      content: plan.content,
      starterKit: plan.starterKit || null,
      createdAt: now
    };
    
    this.architecturalPlans.set(id, architecturalPlan);
    return architecturalPlan;
  }

  async getArchitecturalPlanByConversationId(conversationId: number): Promise<ArchitecturalPlan | undefined> {
    return Array.from(this.architecturalPlans.values()).find(
      (plan) => plan.conversationId === conversationId,
    );
  }
  
  // Database status operation
  isConnectedToMongo(): boolean {
    // MemStorage is always "connected" because it doesn't use MongoDB
    return true;
  }
}

// Factory function to create the appropriate storage instance
export function createStorage(type: 'memory' | 'mongo'): IStorage {
  if (type === 'mongo') {
    // We'll import and create MongoStorage dynamically to avoid circular dependencies
    const { MongoStorage } = require('./mongoStorage');
    return new MongoStorage();
  }
  return new MemStorage();
}

// Export the storage instance
// Default to memory storage unless MONGO_URI is specified in environment
const useMongoStorage = process.env.MONGO_URI ? true : false;
export const storage = createStorage(useMongoStorage ? 'mongo' : 'memory');
