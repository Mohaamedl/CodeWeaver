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

      // Analyze the repository structure
      const suggestions = await openaiService.analyzeRepositoryStructure(repositoryStructure);

      // Save the analysis
      const analysis = await storage.createRepositoryAnalysis({
        userId,
        repositoryName,
        repositoryOwner,
        structure: repositoryStructure,
        suggestions,
      });

      return res.status(200).json({
        analysisId: analysis.id,
        suggestions,
      });
    } catch (error: any) {
      console.error('Error analyzing repository:', error.message);
      return res.status(500).json({ message: 'Failed to analyze repository' });
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

      // Validate experience level
      const experienceLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);
      const { experienceLevel } = req.body;

      try {
        experienceLevelSchema.parse(experienceLevel);
      } catch (error) {
        return res.status(400).json({ message: 'Invalid experience level' });
      }

      // Create a new conversation
      const conversation = await storage.createAssistantConversation({
        userId,
        experienceLevel,
        projectObjective: '',
        technologyStack: '',
      });

      // Add initial assistant message
      const welcomeMessage = 'Hello! I\'m your software architecture assistant. I\'ll help you plan your project by asking a series of questions. What is your level of experience in software development?';
      await storage.createAssistantMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: welcomeMessage,
      });

      return res.status(201).json({
        conversationId: conversation.id,
        message: welcomeMessage,
      });
    } catch (error: any) {
      console.error('Error starting conversation:', error.message);
      return res.status(500).json({ message: 'Failed to start conversation' });
    }
  }

  /**
   * Send a message to the assistant
   */
  async sendMessage(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { conversationId } = req.params;
      const { message } = req.body;

      if (!conversationId || !message) {
        return res.status(400).json({ message: 'Conversation ID and message are required' });
      }

      // Validate conversation exists and belongs to user
      const conversation = await storage.getAssistantConversationById(parseInt(conversationId));
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      // Store user message
      await storage.createAssistantMessage({
        conversationId: parseInt(conversationId),
        role: 'user',
        content: message,
      });

      // Get conversation history
      const messageHistory = await storage.getAssistantMessagesByConversationId(parseInt(conversationId));
      const formattedHistory = messageHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Process message with OpenAI
      const assistantResponse = await openaiService.processAssistantMessage(
        formattedHistory,
        conversation.experienceLevel as 'beginner' | 'intermediate' | 'advanced'
      );

      // Store assistant response
      await storage.createAssistantMessage({
        conversationId: parseInt(conversationId),
        role: 'assistant',
        content: assistantResponse,
      });

      // Check if we need to update project details based on answers
      this.updateConversationContext(conversation.id, message, assistantResponse);

      return res.status(200).json({
        message: assistantResponse,
      });
    } catch (error: any) {
      console.error('Error sending message:', error.message);
      return res.status(500).json({ message: 'Failed to process message' });
    }
  }

  /**
   * Generate an architectural plan based on the conversation
   */
  async generatePlan(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { conversationId } = req.params;

      if (!conversationId) {
        return res.status(400).json({ message: 'Conversation ID is required' });
      }

      // Validate conversation exists and belongs to user
      const conversation = await storage.getAssistantConversationById(parseInt(conversationId));
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      // Check if plan already exists
      const existingPlan = await storage.getArchitecturalPlanByConversationId(parseInt(conversationId));
      if (existingPlan) {
        return res.status(200).json({
          planId: existingPlan.id,
          architecturalPlan: existingPlan.content,
          starterKit: existingPlan.starterKit,
        });
      }

      // Get conversation history
      const messageHistory = await storage.getAssistantMessagesByConversationId(parseInt(conversationId));
      const formattedHistory = messageHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Generate plan
      const { architecturalPlan, starterKit } = await openaiService.generateArchitecturalPlan(formattedHistory);

      // Store plan
      const plan = await storage.createArchitecturalPlan({
        conversationId: parseInt(conversationId),
        content: architecturalPlan,
        starterKit,
      });

      // Mark conversation as completed
      await storage.updateAssistantConversation(parseInt(conversationId), {
        completed: true,
      });

      return res.status(201).json({
        planId: plan.id,
        architecturalPlan,
        starterKit,
      });
    } catch (error: any) {
      console.error('Error generating plan:', error.message);
      return res.status(500).json({ message: 'Failed to generate architectural plan' });
    }
  }

  /**
   * Export architectural plan in various formats
   */
  async exportPlan(req: Request, res: Response) {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { conversationId } = req.params;
      const { format } = req.query;

      if (!conversationId) {
        return res.status(400).json({ message: 'Conversation ID is required' });
      }

      if (!format || !['json', 'markdown', 'text'].includes(format as string)) {
        return res.status(400).json({ message: 'Valid format is required (json, markdown, or text)' });
      }

      // Validate conversation exists and belongs to user
      const conversation = await storage.getAssistantConversationById(parseInt(conversationId));
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      // Get the plan
      const plan = await storage.getArchitecturalPlanByConversationId(parseInt(conversationId));
      if (!plan) {
        return res.status(404).json({ message: 'Architectural plan not found' });
      }

      // Format the plan based on requested format
      if (format === 'json') {
        return res.status(200).json({
          architecturalPlan: plan.content,
          starterKit: plan.starterKit,
        });
      } else if (format === 'markdown') {
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="architectural-plan-${conversationId}.md"`);
        return res.send(plan.content);
      } else {
        // Plain text format
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="architectural-plan-${conversationId}.txt"`);
        return res.send(plan.content);
      }
    } catch (error: any) {
      console.error('Error exporting plan:', error.message);
      return res.status(500).json({ message: 'Failed to export architectural plan' });
    }
  }

  /**
   * Helper method to update conversation context based on messages
   */
  private async updateConversationContext(conversationId: number, userMessage: string, assistantResponse: string) {
    try {
      const conversation = await storage.getAssistantConversationById(conversationId);
      if (!conversation) return;

      // Very simple context extraction - could be enhanced with more sophisticated NLP
      if (assistantResponse.includes('main objective') || assistantResponse.includes('project goal')) {
        await storage.updateAssistantConversation(conversationId, {
          projectObjective: userMessage.substring(0, 255), // Limit to avoid extremely long objectives
        });
      } else if (assistantResponse.includes('technology stack') || assistantResponse.includes('tech stack')) {
        await storage.updateAssistantConversation(conversationId, {
          technologyStack: userMessage.substring(0, 255),
        });
      }
    } catch (error) {
      console.error('Error updating conversation context:', error);
      // Non-fatal error, don't throw
    }
  }
}

export default new OpenAIController();
