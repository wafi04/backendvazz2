import { Server, Socket } from 'socket.io';
import dbConnection from '../../config/mongo';

interface AdminUser {
  adminId: string;
  socketId: string;
  connectedAt: Date;
}

export class AdminSocketManager {
  private io: Server;
  private adminConnections: Map<string, AdminUser> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.setupAdminHandlers();
  }

  private setupAdminHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 New connection: ${socket.id}`);

      // ========== ADMIN LOGIN ==========
      socket.on('admin_authenticate', async (data) => {
        try {
          const { adminId } = data;

          // Sementara skip verification dulu, langsung accept
          this.adminConnections.set(socket.id, {
            adminId,
            socketId: socket.id,
            connectedAt: new Date(),
          });

          socket.join('admin_room');
          socket.emit('admin_authenticated', {
            adminId,
            socketId: socket.id,
            message: 'Admin connected successfully'
          });

          console.log(`✅ Admin authenticated: ${adminId}`);

        } catch (error) {
          socket.emit('admin_authentication_error', {
            error: 'Authentication failed'
          });
        }
      });

      // ========== GET TRANSACTION LOGS ==========
      socket.on('admin_get_logs', async (filter = {}) => {
        if (this.isAdminSocket(socket.id)) {
          await this.sendTransactionLogs(socket, filter);
        }
      });

      // ========== GET TRANSACTION DETAILS ==========
      socket.on('admin_get_transaction_details', async (data) => {
        if (this.isAdminSocket(socket.id)) {
          await this.sendTransactionDetails(socket, data.orderId);
        }
      });

      // ========== GET STATS ==========
      socket.on('admin_get_stats', async () => {
        if (this.isAdminSocket(socket.id)) {
          await this.sendStats(socket);
        }
      });

      // ========== DISCONNECT ==========
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private isAdminSocket(socketId: string): boolean {
    return this.adminConnections.has(socketId);
  }

  // ========== SEND TRANSACTION LOGS ==========
  private async sendTransactionLogs(socket: Socket, filter: any = {}) {
    try {
      const db = await dbConnection.getDatabase('vazz_logs');
      const collection = db.collection('transaction_logs');

      // Build query
      const query: any = {};
      if (filter.status) query.status = filter.status;
      if (filter.userId) query.userId = filter.userId;
      if (filter.orderId) query.orderId = filter.orderId;

      const logs = await collection
        .find(query)
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();

      socket.emit('admin_transaction_logs', {
        logs,
        count: logs.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      socket.emit('admin_error', {
        message: 'Failed to fetch logs'
      });
    }
  }

  // ========== SEND TRANSACTION DETAILS ==========
  private async sendTransactionDetails(socket: Socket, orderId: string) {
    try {
      const db = await dbConnection.getDatabase('vazz_logs');
      const collection = db.collection('transaction_logs');

      const logs = await collection
        .find({ orderId })
        .sort({ timestamp: -1 })
        .toArray();

      socket.emit('admin_transaction_details', {
        orderId,
        logs,
        count: logs.length
      });

    } catch (error) {
      socket.emit('admin_error', {
        message: 'Failed to fetch transaction details'
      });
    }
  }

  // ========== SEND SIMPLE STATS ==========
  private async sendStats(socket: Socket) {
    try {
      const db = await dbConnection.getDatabase('vazz_logs');
      const collection = db.collection('transaction_logs');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayCount = await collection.countDocuments({
        timestamp: { $gte: today }
      });

      const successCount = await collection.countDocuments({
        timestamp: { $gte: today },
        status: 'SUCCESS'
      });

      socket.emit('admin_stats', {
        todayTransactions: todayCount,
        successTransactions: successCount,
        connectedAdmins: this.adminConnections.size,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      socket.emit('admin_error', {
        message: 'Failed to fetch stats'
      });
    }
  }

  // ========== BROADCAST METHODS (UNTUK TRANSACTION LOGGER) ==========

  // Broadcast transaction log ke semua admin
  public broadcastTransactionLogToAdmins(logData: any) {
    this.io.to('admin_room').emit('admin_new_transaction', logData);
  }

  // Broadcast payment monitoring
  public broadcastPaymentMonitor(paymentData: any) {
    this.io.to('admin_room').emit('admin_payment_update', paymentData);
  }

  // Broadcast error monitoring  
  public broadcastErrorMonitor(errorData: any) {
    this.io.to('admin_room').emit('admin_error_alert', errorData);
  }

  // Broadcast user activity
  public broadcastUserActivity(userId: string, activity: any) {
    this.io.to('admin_room').emit('admin_user_activity', {
      userId,
      activity
    });
  }

  // ========== DISCONNECT HANDLER ==========
  private handleDisconnect(socket: Socket) {
    const admin = this.adminConnections.get(socket.id);
    if (admin) {
      console.log(`🔌 Admin disconnected: ${admin.adminId}`);
      this.adminConnections.delete(socket.id);
    }
  }

  // ========== GET ADMIN STATS ==========
  public getAdminStats() {
    return {
      totalAdmins: this.adminConnections.size,
      connectedAdmins: Array.from(this.adminConnections.values())
    };
  }
}