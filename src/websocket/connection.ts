import { WSContext } from 'hono/ws';


interface ClientConnection {
  ws: WSContext;
  userId?: string;
  connectedAt: Date;
  lastPing?: Date;
}

export class WebSocketManager {
  private clients = new Map<string, ClientConnection>();
  private transactionSockets = new Map<string, Set<string>>(); 

  addClient(clientId: string, ws: WSContext, userId?: string) {
    this.clients.set(clientId, {
      ws,
      userId,
      connectedAt: new Date(),
      lastPing: new Date(),
    });

    console.log(`🔌 Client connected: ${clientId} (User: ${userId || 'Anonymous'})`);
  }

  removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      
      // Remove from all transaction subscriptions
      for (const [orderId, clientIds] of this.transactionSockets.entries()) {
        clientIds.delete(clientId);
        if (clientIds.size === 0) {
          this.transactionSockets.delete(orderId);
        }
      }
      
      console.log(`🔌 Client disconnected: ${clientId}`);
    }
  }

  subscribeToTransaction(clientId: string, orderId: string) {
    if (!this.transactionSockets.has(orderId)) {
      this.transactionSockets.set(orderId, new Set());
    }
    
    this.transactionSockets.get(orderId)!.add(clientId);
    console.log(`📡 Client ${clientId} subscribed to transaction ${orderId}`);
  }

  unsubscribeFromTransaction(clientId: string, orderId: string) {
    const clients = this.transactionSockets.get(orderId);
    if (clients) {
      clients.delete(clientId);
      if (clients.size === 0) {
        this.transactionSockets.delete(orderId);
      }
    }
  }

  broadcastToTransaction(orderId: string, data: any) {
    const clientIds = this.transactionSockets.get(orderId);
    if (!clientIds || clientIds.size === 0) {
      console.log(`📡 No clients subscribed to transaction ${orderId}`);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          client.ws.send(JSON.stringify({
            type: 'transaction_update',
            orderId,
            data,
            timestamp: new Date().toISOString(),
          }));
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to send to client ${clientId}:`, error);
          this.removeClient(clientId);
          failCount++;
        }
      }
    }

    console.log(`📡 Broadcasted to transaction ${orderId}: ${successCount} success, ${failCount} failed`);
  }

  pingClients() {
    const now = new Date();
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.ws.send(JSON.stringify({ type: 'ping', timestamp: now.toISOString() }));
        client.lastPing = now;
      } catch (error) {
        console.error(`❌ Failed to ping client ${clientId}:`, error);
        this.removeClient(clientId);
      }
    }
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      activeTransactions: this.transactionSockets.size,
      subscriptions: Array.from(this.transactionSockets.entries()).map(([orderId, clients]) => ({
        orderId,
        clientCount: clients.size,
      })),
    };
  }
}
