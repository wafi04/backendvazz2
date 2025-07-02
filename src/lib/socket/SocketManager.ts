
import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import { AdminSocketManager } from './AdminSocketManager';

interface WebSocketWithUserId extends Socket {
  userId?: string;
  isGuest?: boolean;
}

const httpServer = createServer((req, res) => {
  res.writeHead(404);
  res.end('Not Found');
});

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Simple connection tracking
export const connectionStats = {
  totalConnections: 0,
  userSockets: new Map<string, string>(), // userId -> socketId
  socketUsers: new Map<string, string>(), // socketId -> userId
  guestSockets: new Set<string>(), // guest socketIds
  activeTransactions: new Map<string, Set<string>>(), // orderId -> socketIds
};

export class SocketManager {

  // ========== EMIT TO USER ==========
  public emitToUser(userId: string, event: string, data: any): boolean {
    const socketId = connectionStats.userSockets.get(userId);
    if (socketId) {
      io.to(socketId).emit(event, data);
      console.log(`📤 Emitted ${event} to user ${userId}`);
      return true;
    }
    console.log(`⚠️ User ${userId} not connected`);
    return false;
  }

  // ========== EMIT TO SOCKET ==========
  public emitToSocket(socketId: string, event: string, data: any): boolean {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.connected) {
      socket.emit(event, data);
      console.log(`📤 Emitted ${event} to socket ${socketId}`);
      return true;
    }
    console.log(`⚠️ Socket ${socketId} not connected`);
    return false;
  }

  // ========== EMIT TO TRANSACTION ==========
  public emitToTransaction(orderId: string, event: string, data: any): void {
    io.to(`transaction:${orderId}`).emit(event, data);
    console.log(`📤 Emitted ${event} to transaction ${orderId}`);
  }

  // ========== USER MANAGEMENT ==========
  public isUserOnline(userId: string): boolean {
    const socketId = connectionStats.userSockets.get(userId);
    if (!socketId) return false;
    const socket = io.sockets.sockets.get(socketId);
    return socket?.connected || false;
  }

  // ========== STATS ==========
  public getConnectionStats() {
    return {
      totalConnections: connectionStats.totalConnections,
      authenticatedUsers: connectionStats.userSockets.size,
      guestUsers: connectionStats.guestSockets.size,
      activeTransactions: Array.from(connectionStats.activeTransactions.keys()),
      connectedClients: io.engine.clientsCount,
    };
  }
}

// ========== SOCKET EVENT HANDLERS ==========
io.on('connection', (socket: WebSocketWithUserId) => {
  connectionStats.totalConnections++;
  console.log(`🔌 Client connected: ${socket.id}`);

  // Default sebagai guest
  socket.isGuest = true;
  connectionStats.guestSockets.add(socket.id);

  // ========== USER LOGIN ==========
  socket.on('authenticate', (data) => {
    const { userId } = data;

    if (!userId) {
      socket.emit('authentication_error', { message: 'userId required' });
      return;
    }

    // Remove from guest
    if (socket.isGuest) {
      connectionStats.guestSockets.delete(socket.id);
      socket.isGuest = false;
    }

    // Set as authenticated user
    socket.userId = userId;
    connectionStats.userSockets.set(userId, socket.id);
    connectionStats.socketUsers.set(socket.id, userId);

    console.log(`👤 User authenticated: ${userId}`);

    socket.emit('authenticated', {
      success: true,
      userId,
      socketId: socket.id,
    });
  });

  // ========== SUBSCRIBE TO TRANSACTION ==========
  socket.on('subscribe_transaction', (data) => {
    const { orderId } = data;
    if (!orderId) {
      socket.emit('error', { message: 'orderId required' });
      return;
    }

    socket.join(`transaction:${orderId}`);

    // Track subscription
    if (!connectionStats.activeTransactions.has(orderId)) {
      connectionStats.activeTransactions.set(orderId, new Set());
    }
    connectionStats.activeTransactions.get(orderId)!.add(socket.id);

    console.log(`📡 Socket ${socket.id} subscribed to transaction ${orderId}`);

    socket.emit('subscribed', {
      orderId,
      message: `Subscribed to transaction ${orderId}`,
    });
  });

  // ========== UNSUBSCRIBE FROM TRANSACTION ==========
  socket.on('unsubscribe_transaction', (data) => {
    const { orderId } = data;
    if (!orderId) return;

    socket.leave(`transaction:${orderId}`);

    // Remove from tracking
    const subscribers = connectionStats.activeTransactions.get(orderId);
    if (subscribers) {
      subscribers.delete(socket.id);
      if (subscribers.size === 0) {
        connectionStats.activeTransactions.delete(orderId);
      }
    }

    console.log(`📡 Socket ${socket.id} unsubscribed from transaction ${orderId}`);
  });

  // ========== PING PONG ==========
  socket.on('ping', () => {
    socket.emit('pong', {
      timestamp: new Date().toISOString(),
      socketId: socket.id,
      userId: socket.userId,
    });
  });

  // ========== GET MY INFO ==========
  socket.on('get_my_info', () => {
    socket.emit('my_info', {
      socketId: socket.id,
      userId: socket.userId,
      isGuest: socket.isGuest,
      isAuthenticated: !!socket.userId,
    });
  });

  // ========== DISCONNECT ==========
  socket.on('disconnect', (reason) => {
    connectionStats.totalConnections--;
    console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);

    // Clean up user mappings
    if (socket.userId) {
      connectionStats.userSockets.delete(socket.userId);
      connectionStats.socketUsers.delete(socket.id);
      console.log(`👤 User ${socket.userId} disconnected`);
    }

    // Clean up guest
    if (socket.isGuest) {
      connectionStats.guestSockets.delete(socket.id);
    }

    // Clean up transaction subscriptions
    for (const [orderId, subscribers] of Array.from(connectionStats.activeTransactions.entries())) {
      subscribers.delete(socket.id);
      if (subscribers.size === 0) {
        connectionStats.activeTransactions.delete(orderId);
      }
    }
  });
});

// ========== SERVER STARTUP ==========
const SOCKET_PORT = 3003;

export const startSocketServer = () => {
  return new Promise<void>((resolve, reject) => {
    try {
      httpServer.listen(SOCKET_PORT, () => {
        console.log(`🔌 Socket.IO server running on port ${SOCKET_PORT}`);
        const socketManager = new SocketManager();
        const adminManager = new AdminSocketManager(io);

        resolve();
      });

      httpServer.on('error', (error) => {
        console.error('❌ HTTP server error:', error);
        reject(error);
      });

    } catch (error) {
      console.error('❌ Failed to start socket server:', error);
      reject(error);
    }
  });
};

export { io };