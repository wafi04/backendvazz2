import { Server as HttpServer } from 'http'
import { Server as IOServer, Socket } from 'socket.io'
import { prisma } from './prisma.js'
import { ClientToServerEvents, InterServerEvents, OnlineUser, ServerToClientEvents, SocketData, TypedIOServer, TypedSocket, UserJoinData, UserLeaveData, UserOfflineEvent, UserOnlineEvent, WebSocketStats } from '../types/websocket.js'
import { User } from '../types/user.js'


class WebSocketManager {
  private activeUsers: Map<string, number>
  private io: TypedIOServer | null
  private userSockets: Map<number, Set<string>>

  constructor() {
    this.io = null
    this.activeUsers = new Map<string, number>() 
    this.userSockets = new Map<number, Set<string>>() 
  }

  init(server: HttpServer): TypedIOServer {
    this.io = new IOServer<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >(server, {
      cors: { 
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    })

    this.setupEventHandlers()
    this.startHeartbeat()
    return this.io
  }

  private setupEventHandlers(): void {
    if (!this.io) return

    this.io.on('connection', (socket: TypedSocket) => {
      console.log('User connected:', socket.id)

      socket.on('user:join', (data: UserJoinData) => this.handleUserJoin(socket, data))
      socket.on('user:leave', (data: UserLeaveData) => this.handleUserLeave(socket, data))
      socket.on('heartbeat', () => this.handleHeartbeat(socket))
      socket.on('disconnect', () => this.handleDisconnect(socket))
      socket.on('error', (error: Error) => this.handleError(socket, error))
    })
  }

  private async handleUserJoin(socket: TypedSocket, { userId, token }: UserJoinData): Promise<void> {
    try {
      // Verify token/session
      const user = await this.verifyUser(userId, token)
      if (!user) {
        socket.emit('auth:error', { message: 'Authentication failed' })
        return
      }

      // Store user mapping
      this.activeUsers.set(socket.id, user.id)
      socket.data.userId = user.id
      socket.data.username = user.username
      socket.data.role = user.role

      // Handle multiple devices per user
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set<string>())
      }
      this.userSockets.get(user.id)!.add(socket.id)

      // Update database only if user wasn't online before
      const wasOffline = await this.isUserOffline(user.id)
      if (wasOffline) {
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            isOnline: true,
            lastActiveAt: new Date()
          }
        })

        // Broadcast to all clients
        this.broadcast('user:online', { 
          userId: user.id, 
          username: user.username,
          role: user.role 
        })
      }
      
      // Send current online users to new user
      const onlineUsers = await this.getOnlineUsers()
      socket.emit('users:online', onlineUsers)

      console.log(`User ${user.username} joined from socket ${socket.id}`)

    } catch (error) {
      console.error('User join error:', error)
      socket.emit('auth:error', { message: 'Server error' })
    }
  }

  private async handleUserLeave(socket: TypedSocket, { userId }: UserLeaveData): Promise<void> {
    try {
      const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId
      await this.removeUserSocket(socket.id, numericUserId)
    } catch (error) {
      console.error('User leave error:', error)
    }
  }

  private async handleDisconnect(socket: TypedSocket): Promise<void> {
    try {
      const userId = this.activeUsers.get(socket.id)
      if (userId) {
        await this.removeUserSocket(socket.id, userId)
        console.log(`User ${userId} disconnected from socket ${socket.id}`)
      }
    } catch (error) {
      console.error('Disconnect error:', error)
    }
  }

  private async handleHeartbeat(socket: TypedSocket): Promise<void> {
    const userId = this.activeUsers.get(socket.id)
    if (userId) {
      // Update last active time
      await prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() }
      }).catch(console.error)
      
      socket.emit('heartbeat:ack')
    }
  }

  private handleError(socket: TypedSocket, error: Error): void {
    console.error('Socket error:', error)
    socket.emit('error', { message: 'Socket error occurred' })
  }

  private async removeUserSocket(socketId: string, userId: number): Promise<void> {
    // Remove from active users
    this.activeUsers.delete(socketId)

    // Remove from user sockets
    if (this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(socketId)
      
      // If no more sockets for this user, mark as offline
      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId)
        await this.setUserOffline(userId)
      }
    }
  }

  private async setUserOffline(userId: number): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: false }
      })
      this.broadcast('user:offline', { userId })
    } catch (error) {
      console.error('Set user offline error:', error)
    }
  }

  private async isUserOffline(userId: number): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isOnline: true }
      })
      return !user?.isOnline
    } catch (error) {
      console.error('Check user offline error:', error)
      return true
    }
  }

  private async verifyUser(userId: string | number, token: string): Promise<User | null> {
    try {
      if (!userId || !token) return null
      
      const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId
      
      return await prisma.user.findFirst({
        where: { 
          id: numericUserId, 
          token: token 
        },
        select: { id: true, username: true, role: true }
      })
    } catch (error) {
      console.error('Verify user error:', error)
      return null
    }
  }

  private async getOnlineUsers(): Promise<OnlineUser[]> {
    try {
      return await prisma.user.findMany({
        where: { isOnline: true },
        select: { id: true, username: true, role: true, lastActiveAt: true },
        orderBy: { lastActiveAt: 'desc' }
      })
    } catch (error) {
      console.error('Get online users error:', error)
      return []
    }
  }

  // ===== UTILITY METHODS =====
  public broadcast<T extends keyof ServerToClientEvents>(
    event: T, 
    data: Parameters<ServerToClientEvents[T]>[0]
  ): void {
    if (this.io) {
      this.io.emit(event, data)
    }
  }

  public emitToUser<T extends keyof ServerToClientEvents>(
    userId: number, 
    event: T, 
    data: Parameters<ServerToClientEvents[T]>[0]
  ): void {
    const socketIds = this.userSockets.get(userId)
    if (socketIds && this.io) {
      socketIds.forEach(socketId => {
        this.io!.to(socketId).emit(event, data)
      })
    }
  }

  public async emitToRole<T extends keyof ServerToClientEvents>(
    role: string, 
    event: T, 
    data: Parameters<ServerToClientEvents[T]>[0]
  ): Promise<void> {
    if (!this.io) return

    const emitPromises = Array.from(this.activeUsers.entries()).map(async ([socketId, userId]) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true }
        })
        
        if (user?.role === role) {
          this.io!.to(socketId).emit(event, data)
        }
      } catch (error) {
        console.error(`Error emitting to role ${role}:`, error)
      }
    })

    await Promise.all(emitPromises)
  }

  // ===== ACTIVE USERS & STATS =====
  public getStats(): WebSocketStats {
    return {
      totalConnections: this.activeUsers.size,
      uniqueUsers: this.userSockets.size,
      userConnections: Array.from(this.userSockets.entries()).map(([userId, sockets]) => ({
        userId,
        socketCount: sockets.size
      }))
    }
  }

  public getActiveUsers(): number[] {
    return Array.from(this.userSockets.keys())
  }

  public getUserSocketCount(userId: number): number {
    return this.userSockets.get(userId)?.size || 0
  }

  public isUserConnected(userId: number): boolean {
    return this.userSockets.has(userId)
  }

  // ===== HEARTBEAT & LIFECYCLE =====
  private startHeartbeat(): void {
    setInterval(() => {
      this.broadcast('heartbeat:ping', undefined)
    }, 30000) 
  }

  public async shutdown(): Promise<void> {
    console.log('Shutting down WebSocket manager...')
    
    const userIds = Array.from(this.userSockets.keys())
    await Promise.all(userIds.map(userId => this.setUserOffline(userId)))
    
    // Close all connections
    if (this.io) {
      this.io.close()
    }
    
    // Clear maps
    this.activeUsers.clear()
    this.userSockets.clear()
    
    console.log('WebSocket manager shut down complete')
  }
}

export const wsManager = new WebSocketManager()