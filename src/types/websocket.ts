import { Server as IOServer, Socket } from 'socket.io'

// Type definitions
export interface UserJoinData {
  userId: string | number
  token: string
}

export interface UserLeaveData {
  userId: string | number
}

export interface User {
  id: number
  username: string
  role: string
}

export interface OnlineUser extends User {
  lastActiveAt: Date | null
}

export interface UserConnectionStat {
  userId: number
  socketCount: number
}

export interface WebSocketStats {
  totalConnections: number
  uniqueUsers: number
  userConnections: UserConnectionStat[]
}

export interface AuthError {
  message: string
}

export interface UserOnlineEvent {
  userId: number
  username: string
  role: string
}

export interface UserOfflineEvent {
  userId: number
}

// Extend Socket export interface to include userId
export interface CustomSocket extends Socket {
  userId?: number
}

// Server-to-client events
export interface ServerToClientEvents {
  'auth:error': (data: AuthError) => void
  'user:online': (data: UserOnlineEvent) => void
  'user:offline': (data: UserOfflineEvent) => void
  'users:online': (users: OnlineUser[]) => void
  'heartbeat:ack': () => void
  'heartbeat:ping': () => void
  'error': (data: AuthError) => void
}

// Client-to-server events
export interface ClientToServerEvents {
  'user:join': (data: UserJoinData) => void
  'user:leave': (data: UserLeaveData) => void
  'heartbeat': () => void
}

// Inter-server events (for clustering)
export interface InterServerEvents {
  ping: () => void
}

// Socket data
export interface SocketData {
  userId?: number
  username?: string
  role?: string
}

export type TypedIOServer = IOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>