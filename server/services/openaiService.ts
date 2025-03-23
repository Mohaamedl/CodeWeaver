import OpenAI from 'openai';
import { ArchitecturalSuggestion } from '@shared/schema';
import { ChatCompletionMessageParam } from 'openai/resources';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = 'gpt-4o-mini';

// DEVELOPMENT ONLY: Fallback API key for testing purposes
// In production, always use environment variables and proper key management
const FALLBACK_API_KEY = 'sk-abcdefghijklmnopqrstuvwxyz123456789';

/**
 * OpenAI service class that handles all OpenAI API interactions
 * Using a proper initialization pattern to ensure environment variables are loaded
 */
export class OpenAIService {
  private openaiClient: OpenAI | null = null;
  private initialized = false;
  
  /**
   * Initialize the OpenAI client with the API key from environment variables
   * This method should be called after environment variables are fully loaded
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }
    
    console.log("OpenAIService - Initializing with environment variables");
    console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);
    console.log("OPENAI_API_KEY length:", process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
    console.log("OPENAI_API_KEY prefix:", process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 8) : "N/A");
    
    const apiKey = process.env.OPENAI_API_KEY || FALLBACK_API_KEY;
    
    try {
      // Initialize OpenAI client with proper configuration
      this.openaiClient = new OpenAI({ 
        apiKey,
        organization: process.env.OPENAI_ORG_ID, // Optional organization ID
        maxRetries: 2,
        timeout: 30 * 1000, // 30 second timeout
      });
      
      console.log(`Initializing OpenAI client with API key: ${apiKey.substring(0, 5)}...`);
      this.initialized = true;
    } catch (error) {
      console.error("Error initializing OpenAI client:", error);
      this.openaiClient = null;
    }
  }
  
  /**
   * Get the OpenAI client, initializing it if necessary
   */
  private getClient(): OpenAI | null {
    if (!this.initialized) {
      this.initialize();
    }
    return this.openaiClient;
  }
  
  /**
   * Check if we're in development mode (using fallback key)
   */
  private isDevelopmentMode(): boolean {
    // We're in development mode if:
    // 1. No OpenAI API key is set in environment variables, or
    // 2. The OpenAI client failed to initialize
    return !process.env.OPENAI_API_KEY || !this.openaiClient;
  }

  /**
   * Analyzes repository structure and suggests architectural improvements
   * @param repositoryStructure Structure of the repository to analyze
   * @returns List of architectural suggestions
   */
  async analyzeRepositoryStructure(repositoryStructure: any): Promise<ArchitecturalSuggestion[]> {
    try {
      // For development mode, return mock data
      if (this.isDevelopmentMode()) {
        console.log('Using DEVELOPMENT mode with mock data for OpenAI');
        return [
          {
            type: 'improvement',
            title: 'Mock Improvement Suggestion',
            description: 'This is a mock suggestion because the system is running in development mode without a valid OpenAI API key.'
          },
          {
            type: 'info',
            title: 'File Organization',
            description: 'Consider organizing related files into feature-based directories for better maintainability.'
          },
          {
            type: 'warning',
            title: 'Missing Documentation',
            description: 'Add more documentation to key components to improve code maintainability and onboarding.'
          }
        ];
      }

      const prompt = `
        As a software architecture expert, analyze the following repository structure and provide suggestions for improving the architecture:
        
        ${JSON.stringify(repositoryStructure, null, 2)}
        
        Focus on:
        1. Separation of concerns
        2. Code organization
        3. Missing architectural components
        4. Best practices for the detected technology stack
        
        Provide your analysis as a JSON array with the following structure:
        [
          {
            "type": "info" | "warning" | "improvement",
            "title": "Short descriptive title",
            "description": "Detailed explanation of the suggestion"
          }
        ]
        
        Limit your response to 5 most important architectural suggestions.
      `;

      const openai = this.getClient();
      if (!openai) {
        throw new Error('OpenAI client not initialized');
      }
      
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are a software architecture expert who analyzes codebases and provides actionable suggestions for improvement.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const suggestions = JSON.parse(content);
      return Array.isArray(suggestions) ? suggestions : suggestions.suggestions;
    } catch (error: any) {
      console.error('Error analyzing repository structure:', error.message);
      // Return mock data on error
      return [
        {
          type: 'info',
          title: 'Development Mode Active',
          description: 'This is a fallback response due to an error connecting to the OpenAI API.'
        }
      ];
    }
  }

  /**
   * Process a message for the assistant and return a response
   * @param conversationHistory History of the conversation
   * @param experienceLevel Experience level of the user
   * @returns Response from the assistant
   */
  async processAssistantMessage(
    conversationHistory: { role: 'user' | 'assistant', content: string }[],
    experienceLevel: 'beginner' | 'intermediate' | 'advanced'
  ): Promise<string> {
    if (this.isDevelopmentMode()) {
      console.log(`Development mode: returning mock response for assistant message`);
      
      // Return different responses based on experience level for better testing
      const userMessage = conversationHistory.find(msg => msg.role === 'user')?.content.toLowerCase() || '';
      
      if (userMessage.includes('database') || userMessage.includes('sql') || userMessage.includes('mongodb')) {
        return `Here's some information about databases for ${experienceLevel} developers...`;
      } else if (userMessage.includes('react') || userMessage.includes('frontend') || userMessage.includes('ui')) {
        return `I can help you with React frontend development for ${experienceLevel} developers...`;
      } else if (userMessage.includes('nodejs') || userMessage.includes('backend') || userMessage.includes('express')) {
        return `Let's discuss Node.js backend development for ${experienceLevel} level...`;
      }
      
      return `I'm CodeWeaver AI, your coding assistant. I'm currently running in development mode. How can I help with your project?`;
    }
    
    try {
      console.log(`Processing message for conversation with ${conversationHistory.length} messages in history`);
      
      const client = this.getClient();
      if (!client) {
        throw new Error('OpenAI client is not initialized');
      }
      
      // Log the first few messages for debugging
      console.log(`Conversation history sample: ${JSON.stringify(conversationHistory.slice(0, 3))}`);
      
      console.log(`Sending message to OpenAI`);
      
      // Format messages properly with OpenAI expected format
      const messages: ChatCompletionMessageParam[] = [
        // System message to provide context
        {
          role: 'system',
          content: `You are CodeWeaver AI, a helpful coding assistant that guides users through creating software projects. 
          The user's experience level is: ${experienceLevel}. Provide guidance tailored to this level.
          
          IMPORTANT: You must follow this structured conversation flow to collect information:
          
          1. After greeting the user, proactively ask specific questions about their project:
             - What type of application they want to build (web, mobile, desktop, etc.)
             - What problem the application will solve
             - Target audience and basic feature requirements
          
          2. If the user mentions having no experience or being new, explain that's okay and still
             lead the conversation by asking structured questions about their project goals.
          
          3. After each user response, ask a follow-up question to gather more detailed information.
             Don't wait for them to provide all information. Be specific in your questions.
          
          4. In early exchanges, focus on collecting functional requirements. Later, ask about:
             - Technology preferences (if they have any)
             - Design considerations
             - Must-have features vs. nice-to-have features
          
          5. After collecting sufficient information, summarize what you've learned and recommend
             an architectural approach.
          
          Your main goal is to extract project requirements through an interactive, guided conversation
          rather than responding passively to user inquiries.`
        }
      ];
      
      // Add all conversation history with proper role mapping
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
      
      // Create message request with the full conversation history
      const response = await client.chat.completions.create({
        model: MODEL,
        store: true,
        messages: messages,
      });
      
      console.log(`Received response from OpenAI: ${response.choices[0].message.content?.substring(0, 50)}...`);
      
      return response.choices[0].message.content || 'I apologize, but I couldn\'t generate a response. Please try again.';
    } catch (error: any) {
      console.error(`Error processing assistant message: ${error.message}`);
      
      // If we're in production, provide a more helpful error
      if (!this.isDevelopmentMode()) {
        console.error(`OpenAI API error: Failed to process assistant message`);
      }
      
      // Return a fallback response
      return "I'm sorry, but I'm having trouble connecting to my knowledge base right now. This is a temporary issue. Please try again in a moment.";
    }
  }

  /**
   * Generate an architectural plan based on conversation history
   * @param conversationHistory History of the conversation
   * @returns Architectural plan and starter kit
   */
  async generateArchitecturalPlan(
    conversationHistory: { role: 'user' | 'assistant', content: string }[]
  ): Promise<{ architecturalPlan: string, starterKit: any }> {
    try {
      // For development mode, return mock data
      if (this.isDevelopmentMode()) {
        console.log('Using DEVELOPMENT mode with mock data for OpenAI plan generation');
        return {
          architecturalPlan: `# Architecture Plan

## System Overview
This architecture follows a modern application structure with clear separation of concerns.

## Components
1. **Frontend**: React with TypeScript and Tailwind CSS
2. **Backend**: Express.js API with structured controllers and services
3. **Database**: MongoDB for flexible data storage
4. **Authentication**: JWT-based authentication

## Design Principles
- Single Responsibility Principle
- Dependency Injection
- Separation of Concerns
- API-First Design`,
          starterKit: {
            folderStructure: [
              {
                name: 'frontend',
                type: 'directory',
                children: [
                  {
                    name: 'src',
                    type: 'directory',
                    children: [
                      { name: 'components', type: 'directory', children: [] },
                      { name: 'pages', type: 'directory', children: [] },
                      { name: 'hooks', type: 'directory', children: [] },
                      { name: 'utils', type: 'directory', children: [] },
                      { name: 'App.tsx', type: 'file', description: 'Main application component' },
                      { name: 'index.tsx', type: 'file', description: 'Entry point' }
                    ]
                  },
                  { name: 'package.json', type: 'file', description: 'Frontend dependencies' }
                ]
              },
              {
                name: 'backend',
                type: 'directory',
                children: [
                  {
                    name: 'src', 
                    type: 'directory',
                    children: [
                      { name: 'controllers', type: 'directory', children: [] },
                      { name: 'services', type: 'directory', children: [] },
                      { name: 'models', type: 'directory', children: [] },
                      { name: 'routes', type: 'directory', children: [] },
                      { name: 'middleware', type: 'directory', children: [] },
                      { name: 'index.js', type: 'file', description: 'Server entry point' }
                    ]
                  },
                  { name: 'package.json', type: 'file', description: 'Backend dependencies' }
                ]
              },
              { name: 'README.md', type: 'file', description: 'Project documentation' },
              { name: 'docker-compose.yml', type: 'file', description: 'Docker configuration' }
            ]
          }
        };
      }

      const prompt = `
        Based on our conversation, generate a comprehensive architectural plan and an initial codebase kit.
        
        The architectural plan should include:
        1. Overall architecture (monolith, microservices, etc.)
        2. Core components
        3. Technology stack for each component
        4. Data flow between components
        5. Scalability considerations
        6. Security measures
        
        The starter kit should include a folder structure in JSON format like this:
        {
          "folderStructure": [
            {
              "name": "directory-name",
              "type": "directory",
              "children": [
                {
                  "name": "file-name.ext",
                  "type": "file",
                  "description": "Description of the file's purpose"
                },
                {
                  "name": "nested-directory",
                  "type": "directory",
                  "children": []
                }
              ]
            }
          ]
        }
        
        Return your response as a JSON object with two properties:
        1. "architecturalPlan": A markdown-formatted string
        2. "starterKit": The folder structure object
      `;

      const messages = [
        { role: 'system', content: 'You are a software architecture expert who creates detailed architectural plans and starter kits based on client requirements.' },
        ...conversationHistory,
        { role: 'user', content: prompt }
      ];

      const openai = this.getClient();
      if (!openai) {
        throw new Error('OpenAI client not initialized');
      }
      
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: messages as any[],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const result = JSON.parse(content);
      return {
        architecturalPlan: result.architecturalPlan,
        starterKit: result.starterKit
      };
    } catch (error: any) {
      console.error('Error generating architectural plan:', error.message);
      // Return mock data on error for graceful fallback
      return {
        architecturalPlan: "# Development Mode Plan\n\nThis is a placeholder architectural plan because the system encountered an error connecting to the OpenAI API.",
        starterKit: {
          folderStructure: [
            {
              name: 'src',
              type: 'directory',
              children: [
                { name: 'index.js', type: 'file', description: 'Main entry point' }
              ]
            }
          ]
        }
      };
    }
  }
}

// Export a singleton instance of the service
// NOTE: This will not initialize the client until initialize() is called
const openaiService = new OpenAIService();
export default openaiService;
