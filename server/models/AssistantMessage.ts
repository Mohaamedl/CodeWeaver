import mongoose, { Schema, Document } from 'mongoose';
import { AssistantMessage as AssistantMessageType } from '@shared/schema';

// Interface for AssistantMessage Document
export interface IAssistantMessageDocument extends Omit<AssistantMessageType, 'id'>, Document {
  // The Document interface already provides _id which we'll convert to id
}

// AssistantMessage Schema
const AssistantMessageSchema: Schema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'AssistantConversation', required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: false,
  toJSON: {
    virtuals: true,
    transform: (_, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Create an index on conversationId for faster lookups
AssistantMessageSchema.index({ conversationId: 1 });

// Create and export the AssistantMessage model
export default mongoose.model<IAssistantMessageDocument>('AssistantMessage', AssistantMessageSchema);