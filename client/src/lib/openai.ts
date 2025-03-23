import { AssistantMessage, ExperienceLevel } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

/**
 * Helper library for OpenAI-related operations
 */
export const openaiApi = {
  /**
   * Start a new assistant conversation
   */
  async startConversation(experienceLevel: ExperienceLevel): Promise<{
    conversationId: number;
    message: string;
  }> {
    try {
      const response = await apiRequest('POST', '/api/assistant/conversations', {
        experienceLevel,
      });

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Error starting conversation:', error.message);
      throw error;
    }
  },

  /**
   * Send a message to the assistant
   */
  async sendMessage(conversationId: number, message: string): Promise<{
    message: string;
  }> {
    try {
      const response = await apiRequest('POST', `/api/assistant/conversations/${conversationId}/messages`, {
        message,
      });

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Error sending message:', error.message);
      throw error;
    }
  },

  /**
   * Generate an architectural plan
   */
  async generatePlan(conversationId: number): Promise<{
    planId: number;
    architecturalPlan: string;
    starterKit: any;
  }> {
    try {
      const response = await apiRequest('POST', `/api/assistant/conversations/${conversationId}/generate-plan`, {});

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Error generating plan:', error.message);
      throw error;
    }
  },

  /**
   * Export the architectural plan
   */
  async exportPlan(conversationId: number, format: 'json' | 'markdown' | 'text'): Promise<Blob | any> {
    try {
      const response = await fetch(`/api/assistant/conversations/${conversationId}/export?format=${format}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to export plan: ${response.statusText}`);
      }

      if (format === 'json') {
        return response.json();
      }
      
      return response.blob();
    } catch (error: any) {
      console.error('Error exporting plan:', error.message);
      throw error;
    }
  },

  /**
   * Analyze a repository structure
   */
  async analyzeRepository(repositoryStructure: any, repositoryName: string, repositoryOwner: string): Promise<{
    analysisId: number;
    suggestions: any[];
  }> {
    try {
      const response = await apiRequest('POST', '/api/analyze', {
        repositoryStructure,
        repositoryName,
        repositoryOwner,
      });

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Error analyzing repository:', error.message);
      throw error;
    }
  }
};
