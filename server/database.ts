import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { log } from './vite';

// Load environment variables
dotenv.config();

// Singleton Database class
class Database {
  private static instance: Database;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      log('Already connected to MongoDB', 'database');
      return;
    }

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      log('MONGO_URI environment variable is not set', 'database');
      throw new Error('MONGO_URI environment variable is not set');
    }

    try {
      // Configure mongoose connection
      mongoose.set('strictQuery', true);
      
      // Set connection options for better reliability
      const connectionOptions = {
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
        socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
        family: 4 // Use IPv4, skip trying IPv6
      };
      
      // Connect to MongoDB
      await mongoose.connect(mongoUri, connectionOptions);
      
      this.isConnected = true;
      log('Successfully connected to MongoDB', 'database');
    } catch (error: any) {
      this.isConnected = false;
      log(`MongoDB connection error: ${error.message}`, 'database');
      log('Check your MongoDB URI or network connection', 'database');
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      log('Disconnected from MongoDB', 'database');
    } catch (error: any) {
      log(`MongoDB disconnect error: ${error.message}`, 'database');
      throw error;
    }
  }

  public get connection(): typeof mongoose {
    return mongoose;
  }

  public get isConnectedToDatabase(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export default Database.getInstance();