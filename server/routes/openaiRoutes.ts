import { Router } from 'express';
import { OpenAIController } from '../controllers/openaiController';

export const openaiRoutes = Router();
const controller = new OpenAIController();

// Conversation routes
openaiRoutes.post('/assistant/conversations', controller.createAssistantConversation.bind(controller));
openaiRoutes.get('/assistant/conversations', controller.getUserConversations.bind(controller));
openaiRoutes.get('/assistant/conversations/:conversationId', controller.getConversation.bind(controller));

// Message routes
openaiRoutes.post('/assistant/conversations/:conversationId/messages', controller.sendMessage.bind(controller));
openaiRoutes.get('/assistant/conversations/:conversationId/messages', controller.getMessages.bind(controller));

// Plan routes
openaiRoutes.post('/assistant/conversations/:conversationId/generate-plan', controller.generatePlan.bind(controller));
openaiRoutes.get('/assistant/conversations/:conversationId/export-pdf', controller.exportArchiPlanPDF.bind(controller));
openaiRoutes.get('/assistant/conversations/:conversationId/export', controller.exportPlan.bind(controller));
openaiRoutes.get('/assistant/conversations/:conversationId/starter-kit', controller.downloadStarterKit.bind(controller));