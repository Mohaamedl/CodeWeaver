import mongoose, { Schema, Document } from 'mongoose';
import { RepositoryAnalysis as RepositoryAnalysisType } from '@shared/schema';

// Interface for RepositoryAnalysis Document
export interface IRepositoryAnalysisDocument extends Omit<RepositoryAnalysisType, 'id'>, Document {
  // The Document interface already provides _id which we'll convert to id
}

// RepositoryAnalysis Schema
const RepositoryAnalysisSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  repositoryName: { type: String, required: true },
  repositoryOwner: { type: String, required: true },
  analyzedAt: { type: Date, default: Date.now },
  structure: { type: Schema.Types.Mixed, required: true },
  suggestions: { type: Schema.Types.Mixed, required: true }
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

// Create and export the RepositoryAnalysis model
export default mongoose.model<IRepositoryAnalysisDocument>('RepositoryAnalysis', RepositoryAnalysisSchema);