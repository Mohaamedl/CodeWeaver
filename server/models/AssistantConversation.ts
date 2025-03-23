import mongoose, { Schema, Document } from 'mongoose';
import { AssistantConversation as AssistantConversationType } from '@shared/schema';

// Interface for AssistantConversation Document
export interface IAssistantConversationDocument extends Omit<AssistantConversationType, 'id'>, Document {
  // The Document interface already provides _id which we'll convert to id
}

// AssistantConversation Schema
const AssistantConversationSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  startedAt: { type: Date, default: Date.now },
  experienceLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  projectObjective: { type: String, default: null },
  technologyStack: { type: String, default: null },
  completed: { type: Boolean, default: false }
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

// Create and export the AssistantConversation model
export default mongoose.model<IAssistantConversationDocument>('AssistantConversation', AssistantConversationSchema);