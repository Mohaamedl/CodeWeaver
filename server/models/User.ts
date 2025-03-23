import mongoose, { Schema, Document } from 'mongoose';
import { User as UserType } from '@shared/schema';

// Interface for User Document (MongoDB document with UserType fields)
export interface IUserDocument extends Omit<UserType, 'id'>, Document {
  // The Document interface already provides _id which we'll convert to id
}

// User Schema
const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  githubId: { type: String, default: null },
  githubUsername: { type: String, default: null },
  githubAccessToken: { type: String, default: null },
  githubRefreshToken: { type: String, default: null }
}, {
  timestamps: false, // We don't need createdAt and updatedAt for users
  // Convert _id to id when converting to JSON
  toJSON: {
    virtuals: true,
    transform: (_, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      // Don't expose password in JSON responses
      delete ret.password;
      return ret;
    }
  }
});

// Create and export the User model
export default mongoose.model<IUserDocument>('User', UserSchema);