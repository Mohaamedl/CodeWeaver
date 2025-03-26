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
import mongoose from 'mongoose';

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

  async getAssistantConversationById(id: number | string): Promise<AssistantConversation | undefined> {
    try {
      // Convert string ID to MongoDB ObjectId if needed
      const objectId = typeof id === 'string' ? id : id.toString();
      const conversation = await AssistantConversationModel.findById(objectId);
      if (!conversation) return undefined;
      
      return this.convertToAssistantConversation(conversation);
    } catch (error: any) {
      log(`Error fetching assistant conversation by ID: ${error.message}`, 'mongo-storage');
      return undefined;
    }
  }

  async updateAssistantConversation(id: number | string, data: Partial<InsertAssistantConversation>): Promise<AssistantConversation | undefined> {
    try {
      // Convert number ID to MongoDB ObjectId if needed
      const objectId = typeof id === 'string' ? id : id.toString();
      const conversation = await AssistantConversationModel.findByIdAndUpdate(objectId, data, { new: true });
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
      // Ensure conversationId is handled correctly for MongoDB
      const messageData = {
        ...message,
        conversationId: typeof message.conversationId === 'number' ? message.conversationId.toString() : message.conversationId
      };
      
      const newMessage = await AssistantMessageModel.create(messageData);
      return this.convertToAssistantMessage(newMessage);
    } catch (error: any) {
      log(`Error creating assistant message: ${error.message}`, 'mongo-storage');
      throw new Error(`Failed to create assistant message: ${error.message}`);
    }
  }

  async getAssistantMessagesByConversationId(conversationId: number | string): Promise<AssistantMessage[]> {
    try {
      // Convert number ID to MongoDB ObjectId if needed
      const objectId = typeof conversationId === 'string' ? conversationId : conversationId.toString();
      const messages = await AssistantMessageModel.find({ conversationId: objectId }).sort({ timestamp: 1 });
      return messages.map(this.convertToAssistantMessage);
    } catch (error: any) {
      log(`Error fetching assistant messages: ${error.message}`, 'mongo-storage');
      return [];
    }
  }

  // Architectural plan operations
  async createArchitecturalPlan(plan: InsertArchitecturalPlan): Promise<ArchitecturalPlan> {
    try {
      console.log(`Creating architectural plan for conversationId: ${plan.conversationId} (type: ${typeof plan.conversationId})`);
      
      // Store both the original and converted ID to make retrieval easier
      let planToSave: any = { 
        ...plan,
        // Store the original string form of the ID for easier retrieval
        originalConversationId: plan.conversationId ? plan.conversationId.toString() : ''
      };
      
      // Try to convert to ObjectId if valid
      if (plan.conversationId && mongoose.Types.ObjectId.isValid(plan.conversationId.toString())) {
        console.log(`Converting conversationId ${plan.conversationId} to ObjectId`);
        planToSave.conversationId = new mongoose.Types.ObjectId(plan.conversationId.toString());
      } else {
        console.log(`Using conversationId ${plan.conversationId} as-is (not a valid ObjectId)`);
      }
      
      // Just for debugging - check if we can find the conversation this relates to
      try {
        const AssistantConversationModel = mongoose.model('AssistantConversation');
        
        // Log all conversations for debugging
        const allConversations = await AssistantConversationModel.find({});
        console.log(`Found ${allConversations.length} conversations in the database`);
        allConversations.forEach(conv => {
          console.log(`Conversation ID: ${conv._id}, created at: ${conv.startedAt}`);
        });
        
        // Try to find the relevant conversation by _id
        if (plan.conversationId) {
          const conversation = await AssistantConversationModel.findOne({
            _id: mongoose.Types.ObjectId.isValid(plan.conversationId.toString()) 
              ? new mongoose.Types.ObjectId(plan.conversationId.toString()) 
              : plan.conversationId
          });
          
          if (conversation) {
            console.log(`Found conversation with ID ${conversation._id} - using this as conversationId reference`);
            planToSave.conversationId = conversation._id;
          } else {
            console.log(`No conversation found with ID ${plan.conversationId}`);
          }
        } else {
          console.log('No conversationId provided to link with');
        }
      } catch (idError: any) {
        console.error(`Error looking up conversation: ${idError.message}`);
      }
      
      console.log(`Saving plan with final conversationId: ${planToSave.conversationId}`);
      console.log(`Full plan data being saved:`, JSON.stringify(planToSave, null, 2));
      
      const newPlan = await ArchitecturalPlanModel.create(planToSave);
      console.log(`Successfully created plan with ID: ${newPlan._id} for conversation: ${newPlan.conversationId}`);
      
      return this.convertToArchitecturalPlan(newPlan);
    } catch (error: any) {
      console.error(`Error creating architectural plan: ${error.message}`, error);
      throw new Error(`Failed to create architectural plan: ${error.message}`);
    }
  }

  async getArchitecturalPlanByConversationId(conversationId: number | string): Promise<ArchitecturalPlan | undefined> {
    try {
      console.log(`Looking for architectural plan with conversationId: ${conversationId} (type: ${typeof conversationId})`);
      
      // First try a direct lookup by ID just to verify if something's working
      const allPlans = await ArchitecturalPlanModel.find({});
      console.log(`Found ${allPlans.length} total plans in the database`);
      
      // Log all plans for debugging
      if (allPlans.length > 0) {
        allPlans.forEach(plan => {
          console.log(`Plan ID: ${plan._id}, for conversation: ${plan.conversationId}`);
        });
      } else {
        console.log('No plans found in the database at all.');
        return undefined;
      }
      
      // Try different approaches to find the plan
      
      // 1. Try direct match on conversationId
      let plan = await ArchitecturalPlanModel.findOne({ conversationId: conversationId });
      if (plan) {
        console.log(`Found plan with direct match on conversationId: ${conversationId}`);
        return this.convertToArchitecturalPlan(plan);
      }
      
      // 2. Try with ObjectId conversion if it's a valid one
      if (typeof conversationId === 'string' && mongoose.Types.ObjectId.isValid(conversationId)) {
        plan = await ArchitecturalPlanModel.findOne({ 
          conversationId: new mongoose.Types.ObjectId(conversationId) 
        });
        if (plan) {
          console.log(`Found plan with ObjectId conversion of: ${conversationId}`);
          return this.convertToArchitecturalPlan(plan);
        }
      }
      
      // 3. Try string comparison (this is more expensive but may catch edge cases)
      console.log(`Trying string comparison for conversationId: ${conversationId}`);
      const matchingPlan = allPlans.find(p => {
        if (!p.conversationId) return false;
        const planIdStr = p.conversationId.toString();
        const searchIdStr = conversationId.toString();
        const matches = planIdStr === searchIdStr;
        console.log(`Comparing ${planIdStr} with ${searchIdStr}: ${matches ? 'MATCH' : 'no match'}`);
        return matches;
      });
      
      if (matchingPlan) {
        console.log(`Found plan with string comparison: ${matchingPlan._id}`);
        return this.convertToArchitecturalPlan(matchingPlan);
      }

      // 4. Desperate approach: Try to find a conv ID that matches the MongoDB _id field
      plan = await ArchitecturalPlanModel.findOne({ 
        _id: mongoose.Types.ObjectId.isValid(conversationId.toString()) 
          ? new mongoose.Types.ObjectId(conversationId.toString()) 
          : null 
      });
      
      if (plan) {
        console.log(`Found plan with _id matching conversationId: ${conversationId}`);
        return this.convertToArchitecturalPlan(plan);
      }
      
      console.log(`No plan found for conversationId: ${conversationId} after trying multiple methods`);
      return undefined;
    } catch (error: any) {
      console.error(`Error fetching architectural plan: ${error.message}`, error);
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