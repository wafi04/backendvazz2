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

      socket.on('admin_authenticate', async (data) => {
        try {
          console.log('🔐 Admin authentication attempt:', data);
          const { adminId } = data;

          // ✅ Add: Validation
          if (!adminId) {
            socket.emit('admin_authentication_error', {
              error: 'Admin ID is required'
            });
            return;
          }

          // Store admin connection
          this.adminConnections.set(socket.id, {
            adminId,
            socketId: socket.id,
            connectedAt: new Date(),
          });

          // Join admin room
          socket.join('admin_room');
          
          // ✅ Emit success response
          socket.emit('admin_authenticated', {
            adminId,
            socketId: socket.id,
            message: 'Admin connected successfully',
            timestamp: new Date().toISOString()
          });

          console.log(`✅ Admin authenticated: ${adminId} (${socket.id})`);

        } catch (error) {
          console.error('❌ Admin authentication error:', error);
          socket.emit('admin_authentication_error', {
            error: 'Authentication failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      // ========== PING/PONG ==========
      socket.on('ping', () => {
        console.log('🏓 Ping received from:', socket.id);
        socket.emit('pong', { 
          timestamp: new Date().toISOString(),
          socketId: socket.id
        });
      });

      // ========== GET TRANSACTION LOGS ==========
      socket.on('admin_get_logs', async (filter = {}) => {
        console.log('📋 Admin requesting logs:', socket.id, filter);
        if (this.isAdminSocket(socket.id)) {
          await this.sendTransactionLogs(socket, filter);
        } else {
          socket.emit('admin_error', {
            message: 'Admin not authenticated'
          });
        }
      });

      // ========== GET TRANSACTION DETAILS ==========
      socket.on('admin_get_transaction_details', async (data) => {
        console.log('📄 Admin requesting transaction details:', socket.id, data);
        if (this.isAdminSocket(socket.id)) {
          await this.sendTransactionDetails(socket, data.orderId);
        } else {
          socket.emit('admin_error', {
            message: 'Admin not authenticated'
          });
        }
      });

      // ========== GET STATS ==========
      socket.on('admin_get_stats', async () => {
        console.log('📊 Admin requesting stats:', socket.id);
        if (this.isAdminSocket(socket.id)) {
          await this.sendStats(socket);
        } else {
          socket.emit('admin_error', {
            message: 'Admin not authenticated'
          });
        }
      });

      // ========== DISCONNECT ==========
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private isAdminSocket(socketId: string): boolean {
    const isAdmin = this.adminConnections.has(socketId);
    console.log(`🔍 Checking if ${socketId} is admin: ${isAdmin}`);
    return isAdmin;
  }

  // ========== SEND TRANSACTION LOGS ==========
  private async sendTransactionLogs(socket: Socket, filter: any = {}) {
    try {
      console.log('📋 Fetching transaction logs with filter:', filter);
      
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

      console.log(`📋 Sending ${logs.length} transaction logs to admin`);

      socket.emit('admin_transaction_logs', {
        logs,
        count: logs.length,
        filter,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error fetching transaction logs:', error);
      socket.emit('admin_error', {
        message: 'Failed to fetch logs',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ========== SEND TRANSACTION DETAILS ==========
  private async sendTransactionDetails(socket: Socket, orderId: string) {
    try {
      console.log('📄 Fetching transaction details for:', orderId);
      
      if (!orderId) {
        socket.emit('admin_error', {
          message: 'Order ID is required'
        });
        return;
      }

      const db = await dbConnection.getDatabase('vazz_logs');
      const collection = db.collection('transaction_logs');

      const logs = await collection
        .find({ orderId })
        .sort({ timestamp: -1 })
        .toArray();

      console.log(`📄 Sending ${logs.length} transaction details for ${orderId}`);

      socket.emit('admin_transaction_details', {
        orderId,
        logs,
        count: logs.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error fetching transaction details:', error);
      socket.emit('admin_error', {
        message: 'Failed to fetch transaction details',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ========== SEND SIMPLE STATS ==========
  private async sendStats(socket: Socket) {
    try {
      console.log('📊 Fetching stats for admin');
      
      const db = await dbConnection.getDatabase('vazz_logs');
      const collection = db.collection('transaction_logs');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [todayCount, successCount, totalCount] = await Promise.all([
        collection.countDocuments({
          timestamp: { $gte: today }
        }),
        collection.countDocuments({
          timestamp: { $gte: today },
          status: 'SUCCESS'
        }),
        collection.countDocuments({})
      ]);

      const stats = {
        todayTransactions: todayCount,
        successTransactions: successCount,
        totalTransactions: totalCount,
        failedTransactions: todayCount - successCount,
        connectedAdmins: this.adminConnections.size,
        timestamp: new Date().toISOString()
      };

      console.log('📊 Sending stats:', stats);

      socket.emit('admin_stats', stats);

    } catch (error) {
      console.error('❌ Error fetching stats:', error);
      socket.emit('admin_error', {
        message: 'Failed to fetch stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ========== BROADCAST METHODS (UNTUK TRANSACTION LOGGER) ==========

  // Broadcast transaction log ke semua admin
  public broadcastTransactionLogToAdmins(logData: any) {
    console.log('📡 Broadcasting transaction log to admins:', logData);
    this.io.to('admin_room').emit('admin_new_transaction', logData);
  }

  // Broadcast payment monitoring
  public broadcastPaymentMonitor(paymentData: any) {
    console.log('📡 Broadcasting payment monitor to admins:', paymentData);
    this.io.to('admin_room').emit('admin_payment_update', paymentData);
  }

  // Broadcast error monitoring  
  public broadcastErrorMonitor(errorData: any) {
    console.log('📡 Broadcasting error monitor to admins:', errorData);
    this.io.to('admin_room').emit('admin_error_alert', errorData);
  }

  // Broadcast user activity
  public broadcastUserActivity(userId: string, activity: any) {
    console.log('📡 Broadcasting user activity to admins:', userId, activity);
    this.io.to('admin_room').emit('admin_user_activity', {
      userId,
      activity,
      timestamp: new Date().toISOString()
    });
  }

  // ========== DISCONNECT HANDLER ==========
  private handleDisconnect(socket: Socket) {
    const admin = this.adminConnections.get(socket.id);
    if (admin) {
      console.log(`🔌 Admin disconnected: ${admin.adminId} (${socket.id})`);
      this.adminConnections.delete(socket.id);
    } else {
      console.log(`🔌 Regular client disconnected: ${socket.id}`);
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