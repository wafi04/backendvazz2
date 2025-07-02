import { Hono } from 'hono';
import { upgradeWebSocket } from 'hono/cloudflare-workers';
import { WebSocketManager } from '../websocket/connection';
import { v4 as uuidv4 } from 'uuid';

const wsManager = new WebSocketManager();

setInterval(() => {
  wsManager.pingClients();
}, 30000);

export const websocketRoutes = new Hono()
  .get('/', upgradeWebSocket((c) => {
    const clientId = uuidv4();
    const userId = c.req.query('userId');
    
    return {
      onOpen: (evt, ws ) => {
        wsManager.addClient(clientId, ws, userId);
        
        ws.send(JSON.stringify({
          type: 'connected',
          clientId,
          message: 'WebSocket connection established',
        }));
      },
      
      onMessage: (evt, ws) => {
        try {
          const message = JSON.parse(evt.data.toString());
          
          switch (message.type) {
            case 'subscribe_transaction':
              if (message.orderId) {
                wsManager.subscribeToTransaction(clientId, message.orderId);
                ws.send(JSON.stringify({
                  type: 'subscribed',
                  orderId: message.orderId,
                }));
              }
              break;
              
            case 'unsubscribe_transaction':
              if (message.orderId) {
                wsManager.unsubscribeFromTransaction(clientId, message.orderId);
                ws.send(JSON.stringify({
                  type: 'unsubscribed',
                  orderId: message.orderId,
                }));
              }
              break;
              
            case 'pong':
               ws.send(JSON.stringify({
                type: 'hello',
                message: 'hello wafi',
              }));
              break;
              
            default:
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Unknown message type',
              }));
          }
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
          }));
        }
      },
      
      onClose: () => {
        wsManager.removeClient(clientId);
      },
      
      onError: (evt, ws) => {
        console.error(`❌ WebSocket error for client ${clientId}:`, evt);
        wsManager.removeClient(clientId);
      },
    };
  }))
  .get('/stats', (c) => {
    return c.json(wsManager.getStats());
  });

export { wsManager };