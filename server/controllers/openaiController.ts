import { insertAssistantConversationSchema, insertAssistantMessageSchema } from '@shared/schema';
import * as archiver from 'archiver';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import openaiService from '../services/openaiService';
import { storage } from '../storage';

export class OpenAIController {
  createAssistantConversation: any;
  getUserConversations: any;
  getConversation: any;
  getMessages: any;
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

      const conversationId = parseInt(req.params.conversationId);
      if (isNaN(conversationId)) {
        return res.status(400).json({ message: 'Invalid conversation ID' });
      }

      // Get the conversation and verify ownership
      const conversation = await storage.getAssistantConversationById(conversationId);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      // Generate the plan using OpenAI
      const plan = await openaiService.generateArchitecturalPlan(conversation.messages);
      
      // Store the plan in the database
      const savedPlan = await storage.createArchitecturalPlan({
        userId,
        conversationId,
        content: plan.content,
        format: 'markdown',
        createdAt: new Date(),
        metadata: {
          projectType: plan.projectType,
          technologies: plan.technologies
        }
      });

      return res.status(200).json({
        planId: savedPlan.id,
        content: savedPlan.content
      });
    } catch (error: any) {
      console.error('Error generating plan:', error);
      return res.status(500).json({ message: `Failed to generate plan: ${error.message}` });
    }
  }

  /**
   * Export architectural plan as PDF
   */
  async exportArchiPlanPDF(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const conversationId = req.params.conversationId;
      console.log(`Exporting PDF for conversation ID: ${conversationId} (type: ${typeof conversationId})`);

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
      const plan = await storage.getArchitecturalPlanByConversationId(conversationId);
      console.log(`Retrieved plan for PDF export: ${!!plan}, plan ID: ${plan?.id}`);
      if (!plan) {
        return res.status(404).json({ message: 'No plan found for this conversation' });
      }

      // For now, we'll return markdown with PDF content type
      // In the future, implement actual PDF conversion using a library like puppeteer or pdfkit
      console.log('PDF export requested - returning markdown content for now');
      
      res.setHeader("Content-Type", "text/markdown");
      res.setHeader("Content-Disposition", `attachment; filename="architectural-plan-${conversationId}.pdf"`);
      
      // Send plan content
      return res.send(plan.content);
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      return res.status(500).json({ message: `Failed to export PDF: ${error.message}` });
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

      const conversationId = parseInt(req.params.conversationId);
      if (isNaN(conversationId)) {
        return res.status(400).json({ message: 'Invalid conversation ID' });
      }

      const format = req.query.format as string || 'markdown';
      console.log(`Exporting plan in format: ${format} for conversation: ${conversationId}`);

      // Get conversation and verify ownership
      const conversation = await storage.getAssistantConversationById(conversationId);
      if (!conversation) {
        console.log(`Conversation ${conversationId} not found`);
        return res.status(404).json({ message: 'Conversation not found' });
      }

      if (conversation.userId !== userId) {
        return res.status(403).json({ message: 'Unauthorized to access this conversation' });
      }

      // Get architectural plan
      const plan = await storage.getArchitecturalPlanByConversationId(conversationId);
      if (!plan) {
        console.log(`No plan found for conversation ${conversationId}`);
        return res.status(404).json({ message: 'No plan found for this conversation' });
      }

      // Handle different formats
      switch (format) {
        case 'json':
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename="architectural-plan.json"');
          return res.json({
            plan: plan.content,
            starterKit: plan.starterKit,
            createdAt: plan.createdAt,
            conversationId: plan.conversationId
          });
        
        case 'pdf':
          // Generate PDF from markdown
          const pdf = await markdownToPdf(plan.content);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="architectural-plan-${conversationId}.pdf"`);
          return res.send(pdf);
        
        case 'markdown':
        default:
          res.setHeader('Content-Type', 'text/markdown');
          res.setHeader('Content-Disposition', 'attachment; filename="architectural-plan.md"');
          return res.send(plan.content);
      }
    } catch (error: any) {
      console.error('Error exporting plan:', error);
      return res.status(500).json({ 
        message: `Failed to export plan: ${error.message}`,
        error: error.stack 
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

  async downloadStarterKit(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const conversationId = req.params.conversationId;
      console.log(`Downloading starter kit for conversation ID: ${conversationId} (type: ${typeof conversationId})`);

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
      const plan = await storage.getArchitecturalPlanByConversationId(conversationId);
      console.log(`Retrieved plan for starter kit download: ${!!plan}, plan ID: ${plan?.id}`);
      if (!plan) {
        return res.status(404).json({ message: 'No plan found for this conversation' });
      }

      // Check if starter kit exists
      if (!plan.starterKit) {
        return res.status(404).json({ message: 'No starter kit available for this plan' });
      }

      // Create temporary directory for files
      const tempDir = path.join(os.tmpdir(), `starter-kit-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        // Iterate through the files in the starter kit
        for (const file of plan.starterKit) {
          const filePath = path.join(tempDir, file.path);
          
          // Create directories if they don't exist
          const dirPath = path.dirname(filePath);
          fs.mkdirSync(dirPath, { recursive: true });
          
          // Write the file contents
          fs.writeFileSync(filePath, file.content);
        }

        // Create zip archive
        const zipPath = path.join(os.tmpdir(), `starter-kit-${Date.now()}.zip`);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        // Pipe archive to output file
        archive.pipe(output);
        
        // Add all files from the temp directory to the archive
        archive.directory(tempDir, false);
        
        // Finalize the archive
        await archive.finalize();

        // Set appropriate headers
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=starter-kit.zip');
        
        // Send the file
        return res.sendFile(zipPath, () => {
          // Clean up temporary files after sending
          fs.unlinkSync(zipPath);
          fs.rmSync(tempDir, { recursive: true, force: true });
        });
      } catch (err: any) {
        // Clean up if there's an error
        fs.rmSync(tempDir, { recursive: true, force: true });
        throw err;
      }
    } catch (error: any) {
      console.error('Error downloading starter kit:', error);
      return res.status(500).json({ message: `Failed to download starter kit: ${error.message}` });
    }
  }
}

export default new OpenAIController();
