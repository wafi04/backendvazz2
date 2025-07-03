import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import { AdminSocketManager } from './AdminSocketManager';

interface WebSocketWithUserId extends Socket {
  userId?: string;
  isGuest?: boolean;
}

const httpServer = createServer((req, res) => {
  console.log(`📡 HTTP Request: ${req.method} ${req.url}`);
  
  // Add basic health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'OK', timestamp: new Date().toISOString() }));
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  path: "/socket.io/",
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
});

// Simple connection tracking
export const connectionStats = {
  totalConnections: 0,
  userSockets: new Map<string, string>(),
  socketUsers: new Map<string, string>(), 
  guestSockets: new Set<string>(),
  activeTransactions: new Map<string, Set<string>>(), 
};

class SocketManager {

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
  public isUserOnline(username: string): boolean {
    const socketId = connectionStats.userSockets.get(username);
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
  console.log(`🔌 Client connected: ${socket.id} (Total: ${connectionStats.totalConnections})`);
  console.log(`📊 Connection details:`, {
    transport: socket.conn.transport.name,
    remoteAddress: socket.conn.remoteAddress,
    userAgent: socket.handshake.headers['user-agent']
  });

  // Default sebagai guest
  socket.isGuest = true;
  connectionStats.guestSockets.add(socket.id);

  // ========== USER LOGIN ==========
  socket.on('authenticate', (data) => {
    console.log(`🔐 Authentication attempt:`, data);
    const { userId } = data;

    if (!userId) {
      console.log(`❌ Authentication failed: userId required`);
      socket.emit('authentication_error', { message: 'userId required' });
      return;
    }

    // Remove from guest
    if (socket.isGuest) {
      connectionStats.guestSockets.delete(socket.id);
      socket.isGuest = false;
    }
    socket.userId = userId;
    connectionStats.userSockets.set(userId, socket.id);
    connectionStats.socketUsers.set(socket.id, userId);

    console.log(`✅ User authenticated: ${userId}`);

    socket.emit('authenticated', {
      success: true,
      userId,
      socketId: socket.id,
    });
  });

  // ========== SUBSCRIBE TO TRANSACTION ==========
  socket.on('subscribe_transaction', (data) => {
    console.log(`📡 Transaction subscription:`, data);
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

    console.log(`✅ Socket ${socket.id} subscribed to transaction ${orderId}`);

    socket.emit('subscribed', {
      orderId,
      message: `Subscribed to transaction ${orderId}`,
    });
  });

  // ========== UNSUBSCRIBE FROM TRANSACTION ==========
  socket.on('unsubscribe_transaction', (data) => {
    console.log(`📡 Transaction unsubscription:`, data);
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

    console.log(`✅ Socket ${socket.id} unsubscribed from transaction ${orderId}`);
  });

  // ========== PING PONG ==========
  socket.on('ping', () => {
    console.log(`🏓 Ping received from ${socket.id}`);
    socket.emit('pong', {
      timestamp: new Date().toISOString(),
      socketId: socket.id,
      userId: socket.userId,
    });
  });

  // ========== GET MY INFO ==========
  socket.on('get_my_info', () => {
    console.log(`ℹ️ Info request from ${socket.id}`);
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
    console.log(`🔌 Client disconnected: ${socket.id} (${reason}) (Total: ${connectionStats.totalConnections})`);

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

  // ========== ERROR HANDLING ==========
  socket.on('error', (error) => {
    console.error(`❌ Socket error from ${socket.id}:`, error);
  });
});

// ========== SERVER ERROR HANDLING ==========
io.engine.on('connection_error', (error) => {
  console.error('❌ Connection error:', error);
});

const SOCKET_PORT = 3005;

export const startSocketServer = () => {
  return new Promise<void>((resolve, reject) => {
    try {
      // Check if port is available
      const server = httpServer.listen(SOCKET_PORT, () => {
        console.log(`✅ Socket.IO server running on port ${SOCKET_PORT}`);
        console.log(`📡 Server URL: http://localhost:${SOCKET_PORT}`);
        console.log(`🔌 Socket.IO path: /socket.io/`);
        
        // Test health endpoint
        console.log(`🏥 Health check: http://localhost:${SOCKET_PORT}/health`);
        
        const socketManager = new SocketManager();
        const adminManager = new AdminSocketManager(io);
        
        // Log stats periodically
        setInterval(() => {
          const stats = socketManager.getConnectionStats();
          const adminStats = adminManager.getAdminStats();
          console.log(`📊 Stats - Connections: ${stats.connectedClients}, Users: ${stats.authenticatedUsers}, Guests: ${stats.guestUsers}, Admins: ${adminStats.totalAdmins}`);
        }, 30000);
        
        resolve();
      });

      server.on('error', (error: any) => {
        console.error('❌ HTTP server error:', error);
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ Port ${SOCKET_PORT} is already in use`);
          console.log('💡 Try using a different port or kill the process using this port');
        }
        reject(error);
      });

    } catch (error) {
      console.error('❌ Failed to start socket server:', error);
      reject(error);
    }
  });
};

export { io, SocketManager };