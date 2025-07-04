import dbConnection from '../config/mongo';
import { ObjectId } from 'mongodb';
import { TransactionLog } from '../types/transaction.logger';

// Interface untuk filter options
export interface FilterOptions {
  orderId?: string;
  transactionType?: 'CREATE' | 'UPDATE' | 'PAYMENT' | 'PROCESS' | 'CALLBACK' | 'ERROR';
  status?: string;
  userId?: string;
  productCode?: string;
  paymentMethod?: string;
  position?: string;
  sessionId?: string;
  socketId?: string;
  reference?: string;
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  ip?: string;
  userAgent?: string;
}

export class AdminTransactionLogger {
  private collectionName = 'transaction_logs';
  
  constructor() {}

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
      return result;
    } catch (error) {
      console.error('❌ Failed to log transaction:', error);
    }
  }

  // Method untuk get logs dengan filter
  async getFilteredLogs(filters: FilterOptions = {}, limit: number = 100, skip: number = 0) {
    try {
      const db = await dbConnection.getDatabase('vazz_logs');
      const collection = db.collection(this.collectionName);

      // Build query object berdasarkan filter
      const query: any = {};

      // Filter berdasarkan field string exact match
      if (filters.orderId) query.orderId = filters.orderId;
      if (filters.transactionType) query.transactionType = filters.transactionType;
      if (filters.status) query.status = filters.status;
      if (filters.userId) query.userId = filters.userId;
      if (filters.productCode) query.productCode = filters.productCode;
      if (filters.paymentMethod) query.paymentMethod = filters.paymentMethod;
      if (filters.position) query.position = filters.position;
      if (filters.sessionId) query.sessionId = filters.sessionId;
      if (filters.socketId) query.socketId = filters.socketId;
      if (filters.reference) query.reference = filters.reference;
      if (filters.ip) query.ip = filters.ip;
      if (filters.dateFrom || filters.dateTo) {
        query.timestamp = {};
        if (filters.dateFrom) query.timestamp.$gte = filters.dateFrom;
        if (filters.dateTo) query.timestamp.$lte = filters.dateTo;
      }
      if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
        query.amount = {};
        if (filters.amountMin !== undefined) query.amount.$gte = filters.amountMin;
        if (filters.amountMax !== undefined) query.amount.$lte = filters.amountMax;
      }
      if (filters.userAgent) {
        query.userAgent = { $regex: filters.userAgent, $options: 'i' };
      }

      const logs = await collection
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      // Get total count untuk pagination
      const totalCount = await collection.countDocuments(query);

      return {
        logs,
        totalCount,
        hasMore: skip + limit < totalCount
      };
    } catch (error) {
      console.error('❌ Failed to get filtered logs:', error);
      return { logs: [], totalCount: 0, hasMore: false };
    }
  }

  // Method untuk search logs berdasarkan text
  async searchLogs(searchTerm: string, limit: number = 100, skip: number = 0) {
    try {
      const db = await dbConnection.getDatabase('vazz_logs');
      const collection = db.collection(this.collectionName);

      const query = {
        $or: [
          { orderId: { $regex: searchTerm, $options: 'i' } },
          { userId: { $regex: searchTerm, $options: 'i' } },
          { productCode: { $regex: searchTerm, $options: 'i' } },
          { reference: { $regex: searchTerm, $options: 'i' } },
          { paymentMethod: { $regex: searchTerm, $options: 'i' } },
          { position: { $regex: searchTerm, $options: 'i' } },
          { status: { $regex: searchTerm, $options: 'i' } },
          { error: { $regex: searchTerm, $options: 'i' } }
        ]
      };

      const logs = await collection
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const totalCount = await collection.countDocuments(query);

      return {
        logs,
        totalCount,
        hasMore: skip + limit < totalCount
      };
    } catch (error) {
      console.error('❌ Failed to search logs:', error);
      return { logs: [], totalCount: 0, hasMore: false };
    }
  }

  // Method original dengan tambahan filter sederhana
  async getAdminLogs(limit: number = 100, filters: Partial<FilterOptions> = {}) {
    try {
      const db = await dbConnection.getDatabase('vazz_logs');
      const collection = db.collection(this.collectionName);

      // Build simple query
      const query: any = {};
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof FilterOptions] !== undefined) {
          query[key] = filters[key as keyof FilterOptions];
        }
      });

      const logs = await collection
        .find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      return logs;
    } catch (error) {
      console.error('❌ Failed to get admin logs:', error);
      return [];
    }
  }

  // Method untuk get logs berdasarkan user ID
  async getLogsByUserId(userId: string, limit: number = 100) {
    return this.getFilteredLogs({ userId }, limit);
  }

  // Method untuk get logs berdasarkan transaction type
  async getLogsByTransactionType(transactionType: 'CREATE' | 'UPDATE' | 'PAYMENT' | 'PROCESS' | 'CALLBACK' | 'ERROR', limit: number = 100) {
    return this.getFilteredLogs({ transactionType }, limit);
  }

  // Method untuk get logs berdasarkan status
  async getLogsByStatus(status: string, limit: number = 100) {
    return this.getFilteredLogs({ status }, limit);
  }

  // Method untuk get logs berdasarkan range tanggal
  async getLogsByDateRange(dateFrom: Date, dateTo: Date, limit: number = 100) {
    return this.getFilteredLogs({ dateFrom, dateTo }, limit);
  }

  // Method untuk get logs hari ini
  async getTodayLogs(limit: number = 100) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getFilteredLogs({ 
      dateFrom: today, 
      dateTo: tomorrow 
    }, limit);
  }

  // Method untuk get error logs
  async getErrorLogs(limit: number = 100) {
    return this.getFilteredLogs({ transactionType: 'ERROR' }, limit);
  }

  async getStats(filters: FilterOptions = {}) {
    try {
      const db = await dbConnection.getDatabase('vazz_logs');
      const collection = db.collection(this.collectionName);

      // Build query untuk stats
      const query: any = {};
      
      // Default filter untuk hari ini jika tidak ada filter tanggal
      if (!filters.dateFrom && !filters.dateTo) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query.timestamp = { $gte: today };
      } else {
        if (filters.dateFrom || filters.dateTo) {
          query.timestamp = {};
          if (filters.dateFrom) query.timestamp.$gte = filters.dateFrom;
          if (filters.dateTo) query.timestamp.$lte = filters.dateTo;
        }
      }

      // Apply other filters
      Object.keys(filters).forEach(key => {
        if (key !== 'dateFrom' && key !== 'dateTo' && filters[key as keyof FilterOptions] !== undefined) {
          query[key] = filters[key as keyof FilterOptions];
        }
      });

      const totalCount = await collection.countDocuments(query);
      const successCount = await collection.countDocuments({
        ...query,
        status: 'SUCCESS'
      });

      const errorCount = await collection.countDocuments({
        ...query,
        transactionType: 'ERROR'
      });

      return {
        totalTransactions: totalCount,
        successTransactions: successCount,
        errorTransactions: errorCount,
        successRate: totalCount > 0 ? (successCount / totalCount * 100).toFixed(2) : 0,
        errorRate: totalCount > 0 ? (errorCount / totalCount * 100).toFixed(2) : 0
      };
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      return { 
        totalTransactions: 0, 
        successTransactions: 0, 
        errorTransactions: 0,
        successRate: 0,
        errorRate: 0
      };
    }
  }
}