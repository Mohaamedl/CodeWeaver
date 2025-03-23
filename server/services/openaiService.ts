import OpenAI from 'openai';
import { ArchitecturalSuggestion } from '@shared/schema';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = 'gpt-4o';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export class OpenAIService {
  /**
   * Analyzes repository structure and suggests architectural improvements
   * 
   * @param repositoryStructure The structure of the repository to analyze
   * @returns Suggestions for architectural improvements
   */
  async analyzeRepositoryStructure(repositoryStructure: any): Promise<ArchitecturalSuggestion[]> {
    try {
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
      throw new Error('Failed to analyze repository structure');
    }
  }

  /**
   * Processes a message in an assistant conversation and returns a response
   * 
   * @param conversationHistory Array of previous messages in the conversation
   * @param experienceLevel User's experience level
   * @returns AI assistant's response
   */
  async processAssistantMessage(
    conversationHistory: { role: 'user' | 'assistant', content: string }[],
    experienceLevel: 'beginner' | 'intermediate' | 'advanced'
  ): Promise<string> {
    try {
      // Prepare system message based on experience level
      let systemContent = 'You are an AI assistant helping with software architecture and project planning.';
      
      if (experienceLevel === 'beginner') {
        systemContent += ' Explain concepts in simple terms, avoiding technical jargon, and provide more guidance.';
      } else if (experienceLevel === 'intermediate') {
        systemContent += ' Provide balanced explanations with some technical details while keeping explanations accessible.';
      } else if (experienceLevel === 'advanced') {
        systemContent += ' Use technical terminology and detailed explanations appropriate for experienced developers.';
      }

      const messages = [
        { role: 'system', content: systemContent },
        ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content }))
      ];

      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: messages as any[],
        temperature: 0.7,
        max_tokens: 1000
      });

      return response.choices[0].message.content || 'I apologize, but I couldn\'t generate a response.';
    } catch (error: any) {
      console.error('Error processing assistant message:', error.message);
      throw new Error('Failed to process assistant message');
    }
  }

  /**
   * Generates an architectural plan based on the conversation history
   * 
   * @param conversationHistory Array of all messages in the conversation
   * @returns Generated architectural plan and starter kit structure
   */
  async generateArchitecturalPlan(
    conversationHistory: { role: 'user' | 'assistant', content: string }[]
  ): Promise<{ architecturalPlan: string, starterKit: any }> {
    try {
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
        ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: prompt }
      ];

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
      throw new Error('Failed to generate architectural plan');
    }
  }
}

export default new OpenAIService();
