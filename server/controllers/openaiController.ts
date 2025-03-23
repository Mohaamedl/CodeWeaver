import { Request, Response } from 'express';
import openaiService from '../services/openaiService';
import { storage } from '../storage';
import { z } from 'zod';
import { insertAssistantConversationSchema, insertAssistantMessageSchema } from '@shared/schema';

export class OpenAIController {
  /**
   * Analyze repository structure and provide suggestions
   */
  async analyzeRepository(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { repositoryStructure, repositoryName, repositoryOwner } = req.body;

      if (!repositoryStructure || !repositoryName || !repositoryOwner) {
        return res.status(400).json({ message: 'Repository structure, name, and owner are required' });
      }

      const suggestions = await openaiService.analyzeRepositoryStructure(repositoryStructure);

      // Save analysis to storage
      const analysis = await storage.createRepositoryAnalysis({
        userId,
        repositoryName,
        repositoryOwner,
        analyzedAt: new Date(),
        structure: repositoryStructure,
        suggestions,
      });

      return res.status(201).json({ suggestions, analysisId: analysis.id });
    } catch (error: any) {
      console.error('Error analyzing repository:', error.message);
      return res.status(500).json({ 
        message: 'Failed to analyze repository', 
        error: error.message,
        devOnly: 'See server logs for more details' 
      });
    }
  }

  /**
   * Start a new assistant conversation
   */
  async startConversation(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      try {
        // Validate request body
        const validatedData = insertAssistantConversationSchema.parse(req.body);

        // Create conversation
        const conversation = await storage.createAssistantConversation({
          userId,
          startedAt: new Date(),
          experienceLevel: validatedData.experienceLevel || 'beginner',
          projectObjective: validatedData.projectObjective,
          technologyStack: validatedData.technologyStack,
          completed: false,
        });

        // Prepare initial welcome message based on experience level
        let welcomeMessage = 'Welcome to CodeWeaver! ';
        
        switch (validatedData.experienceLevel) {
          case 'beginner':
            welcomeMessage += "I'll help you get started with your project. I'll explain things in simple terms and guide you through the process step by step.";
            break;
          case 'intermediate':
            welcomeMessage += "I'll help you design your project architecture. I'll provide balanced explanations with technical details while keeping things accessible.";
            break;
          case 'advanced':
            welcomeMessage += "I'll assist you with your project using technical terminology and detailed explanations appropriate for your experience level.";
            break;
          default:
            welcomeMessage += "I'll help you with your project. Let me know what you're looking to build.";
        }

        // Save the welcome message
        await storage.createAssistantMessage({
          conversationId: conversation.id,
          role: 'assistant',
          content: welcomeMessage,
          timestamp: new Date(),
        });

        return res.status(201).json({ 
          conversationId: conversation.id, 
          message: welcomeMessage 
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ 
            message: 'Invalid request data', 
            errors: error.errors
          });
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Error starting conversation:', error.message);
      return res.status(500).json({ 
        message: 'Failed to start conversation',
        error: error.message 
      });
    }
  }

  /**
   * Send a message to the assistant
   */
  async sendMessage(req: Request, res: Response) {
    try {
      // Get user ID from session
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get conversation ID from params
      const conversationId = req.params.conversationId;
      if (!conversationId) {
        return res.status(400).json({ message: 'Conversation ID is required' });
      }

      // Get conversation
      const conversation = await storage.getAssistantConversationById(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      // Check if user owns the conversation
      if (conversation.userId !== userId) {
        return res.status(403).json({ message: 'Unauthorized to access this conversation' });
      }

      try {
        // Validate request body
        const validatedData = insertAssistantMessageSchema.parse(req.body);

        // Save user message
        const message = await storage.createAssistantMessage({
          conversationId,
          role: 'user',
          content: validatedData.content,
          timestamp: new Date(),
        });

        // Get conversation history
        const messages = await storage.getAssistantMessagesByConversationId(conversationId);
        
        // Make sure messages are sorted by timestamp to maintain proper conversation flow
        const sortedMessages = messages.sort((a, b) => {
          const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return aTime - bTime;
        });
        
        const conversationHistory = sortedMessages.map(m => ({
          role: m.role,
          content: m.content,
        }));

        // Log conversation history for debugging
        console.log(`Processing message for conversation ${conversationId} with ${conversationHistory.length} messages in history`);
        
        // Debug first and last messages in conversation to verify context
        if (conversationHistory.length > 0) {
          console.log(`First message: ${JSON.stringify(conversationHistory[0])}`);
          console.log(`Latest message: ${JSON.stringify(conversationHistory[conversationHistory.length - 1])}`);
        }
        
        try {
          // Process message with OpenAI
          const response = await openaiService.processAssistantMessage(
            conversationHistory,
            conversation.experienceLevel
          );

          // Save assistant response
          const assistantMessage = await storage.createAssistantMessage({
            conversationId,
            role: 'assistant',
            content: response,
            timestamp: new Date(),
          });

          // Update conversation context
          await this.updateConversationContext(conversation.id, validatedData.content, response);

          return res.status(200).json({ 
            message: assistantMessage,
            conversationId
          });
        } catch (openAiError: any) {
          console.error('OpenAI API error:', openAiError.message);
          
          // Use a friendly response in development mode
          const developmentResponse = "I'm sorry, but I'm currently experiencing connectivity issues with my AI service. This is a development mode response. In production, you would receive an actual AI-generated response.";
          
          // Save development response
          const assistantMessage = await storage.createAssistantMessage({
            conversationId,
            role: 'assistant',
            content: developmentResponse,
            timestamp: new Date(),
          });
          
          return res.status(200).json({
            message: assistantMessage,
            conversationId,
            devMode: true
          });
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ 
            message: 'Invalid request data', 
            errors: error.errors 
          });
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Error sending message:', error.message);
      return res.status(500).json({ 
        message: 'Failed to send message', 
        error: error.message,
        devOnly: 'See server logs for more details'
      });
    }
  }

  /**
   * Generate architectural plan based on conversation
   */
  async generatePlan(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const conversationId = req.params.conversationId;
      if (!conversationId) {
        return res.status(400).json({ message: 'Conversation ID is required' });
      }

      // Get conversation
      const conversation = await storage.getAssistantConversationById(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      // Check if user owns the conversation
      if (conversation.userId !== userId) {
        return res.status(403).json({ message: 'Unauthorized to access this conversation' });
      }

      // Get conversation history
      const messages = await storage.getAssistantMessagesByConversationId(conversationId);
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      try {
        // Generate architectural plan
        const { architecturalPlan, starterKit } = await openaiService.generateArchitecturalPlan(
          conversationHistory
        );

        // Save plan to storage
        const plan = await storage.createArchitecturalPlan({
          conversationId,
          content: architecturalPlan,
          starterKit,
          createdAt: new Date(),
        });

        // Mark conversation as completed
        await storage.updateAssistantConversation(conversationId, { completed: true });

        return res.status(200).json({ 
          planId: plan.id, 
          architecturalPlan, 
          starterKit 
        });
      } catch (openAiError: any) {
        console.error('OpenAI API error during plan generation:', openAiError.message);
        
        // Use a friendly response in development mode
        const developmentPlan = {
          architecturalPlan: "# Development Mode Plan\n\nThis is a placeholder architectural plan created during development mode without connecting to the OpenAI API.",
          starterKit: {
            folderStructure: [
              {
                name: 'src',
                type: 'directory',
                children: [
                  { name: 'index.js', type: 'file', description: 'Main entry point' },
                  { name: 'config.js', type: 'file', description: 'Configuration settings' },
                  { 
                    name: 'components', 
                    type: 'directory',
                    children: [
                      { name: 'App.js', type: 'file', description: 'Main application component' }
                    ]
                  }
                ]
              },
              { name: 'package.json', type: 'file', description: 'Dependencies and scripts' },
              { name: 'README.md', type: 'file', description: 'Project documentation' }
            ]
          }
        };
        
        // Save development plan
        const plan = await storage.createArchitecturalPlan({
          conversationId,
          content: developmentPlan.architecturalPlan,
          starterKit: developmentPlan.starterKit,
          createdAt: new Date(),
        });
        
        // Mark conversation as completed
        await storage.updateAssistantConversation(conversationId, { completed: true });
        
        return res.status(200).json({
          planId: plan.id,
          ...developmentPlan,
          devMode: true
        });
      }
    } catch (error: any) {
      console.error('Error generating plan:', error.message);
      return res.status(500).json({ 
        message: 'Failed to generate architectural plan', 
        error: error.message 
      });
    }
  }

  /**
   * Export architectural plan as markdown file
   */
  async exportPlan(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const conversationId = req.params.conversationId;
      if (!conversationId) {
        return res.status(400).json({ message: 'Conversation ID is required' });
      }

      // Get conversation
      const conversation = await storage.getAssistantConversationById(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      // Check if user owns the conversation
      if (conversation.userId !== userId) {
        return res.status(403).json({ message: 'Unauthorized to access this conversation' });
      }

      // Get architectural plan
      const plan = await storage.getArchitecturalPlanByConversationId(Number(conversationId));
      if (!plan) {
        return res.status(404).json({ message: 'No plan found for this conversation' });
      }

      // Set response headers for file download
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', 'attachment; filename="architectural-plan.md"');

      // Send plan content
      return res.send(plan.content);
    } catch (error: any) {
      console.error('Error exporting plan:', error.message);
      return res.status(500).json({ 
        message: 'Failed to export architectural plan', 
        error: error.message 
      });
    }
  }

  /**
   * Update conversation context with new information
   */
  private async updateConversationContext(conversationId: number | string, userMessage: string, assistantResponse: string) {
    try {
      // Get current conversation
      const conversation = await storage.getAssistantConversationById(conversationId);
      if (!conversation) return;

      // Extract project objective if not yet defined
      if (!conversation.projectObjective) {
        const objectiveMatch = userMessage.match(/project|app|application|build|create|develop|making|system/i);
        if (objectiveMatch) {
          await storage.updateAssistantConversation(conversationId, { 
            projectObjective: userMessage.substring(0, 255) 
          });
        }
      }

      // Extract technology stack if mentioned
      const techMatch = userMessage.match(/technology|stack|react|vue|angular|node|express|django|flask|spring|rails|go|java|typescript|javascript|python|rust|c#|php/i);
      if (techMatch) {
        await storage.updateAssistantConversation(conversationId, { 
          technologyStack: userMessage.substring(0, 255) 
        });
      }

    } catch (error: any) {
      console.error(`Error updating conversation context: ${error.message}`);
      // Non-critical error, don't throw
    }
  }
}

export default new OpenAIController();
