import mongoose, { Schema, Document } from 'mongoose';
import { ArchitecturalPlan as ArchitecturalPlanType } from '@shared/schema';

// Interface for ArchitecturalPlan Document
export interface IArchitecturalPlanDocument extends Omit<ArchitecturalPlanType, 'id'>, Document {
  // The Document interface already provides _id which we'll convert to id
}

// ArchitecturalPlan Schema
const ArchitecturalPlanSchema: Schema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'AssistantConversation', required: true },
  content: { type: String, required: true },
  starterKit: { type: Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now }
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

// Create and export the ArchitecturalPlan model
export default mongoose.model<IArchitecturalPlanDocument>('ArchitecturalPlan', ArchitecturalPlanSchema);