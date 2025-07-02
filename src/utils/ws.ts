export class TransactionWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  connect(userId?: string) {
    const wsUrl = `ws://localhost:3000/ws${userId ? `?userId=${userId}` : ''}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('🔌 WebSocket connected');
      this.reconnectAttempts = 0;
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      this.reconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
  }
  
  private handleMessage(message: any) {
    switch (message.type) {
      case 'transaction_update':
        this.onTransactionUpdate?.(message.orderId, message.data);
        break;
      case 'ping':
        this.ws?.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }
  
  subscribeToTransaction(orderId: string) {
    this.ws?.send(JSON.stringify({
      type: 'subscribe_transaction',
      orderId,
    }));
  }
  
  onTransactionUpdate?: (orderId: string, data: any) => void;
  
  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`🔄 Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, 1000 * this.reconnectAttempts);
    }
  }
}