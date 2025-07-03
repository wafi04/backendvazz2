import dbConnection from '../config/mongo';
import { ObjectId } from 'mongodb';
import { SocketManager } from './socket/SocketManager';
import { AdminSocketManager } from './socket/AdminSocketManager';
import { TransactionLog } from '../types/transaction.logger';

export class TransactionLogger {
  private collectionName = 'transaction_logs';
  private socketManager: SocketManager;
  private adminSocketManager: AdminSocketManager | null = null;

  constructor(adminSocketManager?: AdminSocketManager) {
    this.socketManager = new SocketManager();
    if (adminSocketManager) {
      this.adminSocketManager = adminSocketManager;
    }
  }

  setAdminSocketManager(adminSocketManager: AdminSocketManager) {
    this.adminSocketManager = adminSocketManager;
  }

  async logTransaction(logData: TransactionLog) {
    try {
      const db = await dbConnection.getDatabase('vazz_logs');
      const collection = db.collection(this.collectionName);

      const logEntry = {
        ...logData,
        _id: new ObjectId(),
        createdAt: new Date(),
      };

      const result = await collection.insertOne(logEntry);
      this.emitToUser(logData);
      this.emitToAdmin(logData);

      return result;
    } catch (error) {
      console.error('❌ Failed to log transaction:', error);
    }
  }

  // ========== EMIT KE USER (DATA AMAN) ==========
  private emitToUser(logData: TransactionLog) {
    const userSafeData = {
      orderId: logData.orderId,
      type: logData.transactionType,
      status: logData.status,
      amount: logData.amount,
      message: this.getStatusMessage(logData),
      timestamp: logData.timestamp.toISOString(),
    };

    // Emit berdasarkan userId atau socketId
    if (logData.userId) {
      this.socketManager.emitToUser(logData.userId, 'transaction_update', userSafeData);
    }

    if (logData.socketId) {
      this.socketManager.emitToSocket(logData.socketId, 'transaction_update', userSafeData);
    }
  }

  // ========== EMIT KE ADMIN (DATA LENGKAP) ==========
  private emitToAdmin(logData: TransactionLog) {
    if (!this.adminSocketManager) return;

    const adminData = {
      orderId: logData.orderId,
      transactionType: logData.transactionType,
      status: logData.status,
      userId: logData.userId,
      amount: logData.amount,
      paymentMethod: logData.paymentMethod,
      data: logData.data,
      error: logData.error,
      timestamp: logData.timestamp.toISOString(),
      socketId: logData.socketId,
    };

    // Broadcast ke semua admin
    this.adminSocketManager.broadcastTransactionLogToAdmins(adminData);
  }

  // ========== GET LOGS - USER HANYA PUNYA MEREKA ==========
  async getUserLogs(userId: string, socketId?: string) {
    try {
      const db = await dbConnection.getDatabase('vazz_logs');
      const collection = db.collection(this.collectionName);

      const query: any = {
        $or: [
          { userId: userId },
          ...(socketId ? [{ socketId: socketId }] : [])
        ]
      };

      const logs = await collection
        .find(query)
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray();

      // Data aman untuk user
      const userLogs = logs.map(log => ({
        orderId: log.orderId,
        type: log.transactionType,
        status: log.status,
        amount: log.amount,
        message: this.getStatusMessage(log as unknown as TransactionLog),
        timestamp: log.timestamp,
      }));

      return userLogs;
    } catch (error) {
      console.error('❌ Failed to get user logs:', error);
      return [];
    }
  }

  // ========== GET LOGS - ADMIN LIHAT SEMUA ==========
  async getAdminLogs(limit: number = 100) {
    try {
      const db = await dbConnection.getDatabase('vazz_logs');
      const collection = db.collection(this.collectionName);

      const logs = await collection
        .find({})
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      return logs; // Admin dapat semua data
    } catch (error) {
      console.error('❌ Failed to get admin logs:', error);
      return [];
    }
  }

  // ========== QUICK LOG METHODS ==========

  // Untuk user yang sudah login
  async logForUser(userId: string, orderId: string, type: string, status: string, data?: any) {
    return this.logTransaction({
      orderId,
      transactionType: type as any,
      status,
      userId,
      data,
      timestamp: new Date(),
    });
  }

  // Untuk user yang belum login (pakai socketId)
  async logForSocket(socketId: string, orderId: string, type: string, status: string, data?: any) {
    return this.logTransaction({
      orderId,
      transactionType: type as any,
      status,
      socketId,
      data,
      timestamp: new Date(),
    });
  }

  // ========== UTILITY ==========
  private getStatusMessage(logData: TransactionLog): string {
    const messages = {
      CREATE: 'Transaction created',
      PAYMENT: logData.status === 'SUCCESS' ? 'Payment completed' : 'Payment processing',
      SUCCESS: 'Transaction completed',
      ERROR: 'Transaction failed'
    };

    return messages[logData.transactionType as 'CREATE'] || 'Transaction updated';
  }

  async getStats() {
    try {
      const db = await dbConnection.getDatabase('vazz_logs');
      const collection = db.collection(this.collectionName);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayCount = await collection.countDocuments({
        timestamp: { $gte: today }
      });

      const successCount = await collection.countDocuments({
        timestamp: { $gte: today },
        status: 'SUCCESS'
      });

      return {
        todayTransactions: todayCount,
        successTransactions: successCount,
        successRate: todayCount > 0 ? (successCount / todayCount * 100).toFixed(2) : 0
      };
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      return { todayTransactions: 0, successTransactions: 0, successRate: 0 };
    }
  }
}