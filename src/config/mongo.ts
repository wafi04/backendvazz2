// config/mongo.js
import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = process.env.MONGO_URL;

class DatabaseConnection {
  client: MongoClient | null;
  isConnected: boolean;
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected && this.client) {
      return this.client;
    }

    try {
      this.client = new MongoClient(uri as string, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        connectTimeoutMS: 60000,
        socketTimeoutMS: 60000,
        serverSelectionTimeoutMS: 60000,
        maxPoolSize: 10,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        waitQueueTimeoutMS: 60000,
      });

      await this.client.connect();
      await this.client.db("admin").command({ ping: 1 });
      
      this.isConnected = true;
      console.log("✅ Successfully connected to MongoDB!");
      
      return this.client;
    } catch (error) {
      console.error("❌ MongoDB connection failed:", error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      console.log("🔌 MongoDB connection closed");
    }
  }

  getClient() {
    if (!this.isConnected || !this.client) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.client;
  }

  async getDatabase(dbName = 'myDatabase') {
    const client = await this.connect();
    return client.db(dbName);
  }
}

// Export singleton instance
const dbConnection = new DatabaseConnection();

// Test connection function
export async function testConnection() {
  try {
    await dbConnection.connect();
    console.log("🎯 MongoDB connection test successful!");
    return true;
  } catch (error) {
    console.error("💥 MongoDB connection test failed:", error);
    return false;
  }
}



// Graceful shutdown handler
export async function gracefulShutdown() {
  await dbConnection.disconnect();
}

export default dbConnection;