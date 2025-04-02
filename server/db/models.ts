import mongoose from 'mongoose';

const suggestionSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  agent: { type: String, required: true },
  message: { type: String, required: true },
  patch: { type: String },
  file_path: { type: String },
  status: { type: String, default: 'pending' }
});

const assistantMessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

export const Suggestion = mongoose.model('Suggestion', suggestionSchema);
export const AssistantMessage = mongoose.model('AssistantMessage', assistantMessageSchema);
