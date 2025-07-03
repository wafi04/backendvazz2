import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { prisma } from "./lib/prisma";
import routes from "./route/index";
import { AdminSocketManager } from "./lib/socket/AdminSocketManager";
import { SocketManager, startSocketServer } from "./lib/socket/SocketManager";
import { TransactionLogger } from "./lib/logger";

const app = new Hono();

// Environment variables
const FRONTEND_URL = "http://localhost:3000";
const NODE_ENV = "development";
const PORT = parseInt("3002");

// Middleware
app.use("*", logger());
app.use("*", prettyJSON());

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (NODE_ENV === "development") {
        if (
          !origin ||
          origin.includes("localhost") ||
          origin.includes("127.0.0.1")
        ) {
          return origin || "*";
        }
      }

      if (origin === FRONTEND_URL) {
        return origin;
      }

      return null;
    },
    credentials: true,
    allowHeaders: [
      "Origin",
      "Content-Type",
      "Accept",
      "Authorization",
      "X-Requested-With",
      "Cookie",
    ],
    exposeHeaders: ["Set-Cookie"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

// Routes
app.route("/api/v1", routes);

// Health check endpoint
const transactionLogger = new TransactionLogger();


// Health check endpoint
app.get('/health', (c) => {
  const stats = transactionLogger.getStats();
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    websocket: {
      server: 'running',
      port: 3003,
      stats
    }
  });
});


// Socket stats endpoint
app.get("/socket/stats", (c) => {
  const socket = new SocketManager() 
  return c.json(socket.getConnectionStats());
});

// Root endpoint
app.get("/", (c) => {
  return c.json({
    message: "API Server is running",
    version: "1.0.0",
    port: PORT,
    environment: NODE_ENV,
  });
});

// Start both servers
const startServers = async () => {
  try {
    // Start Socket.IO server first
    await startSocketServer();
    
    // Start main HTTP server
    console.log(`🚀 Starting HTTP server on port ${PORT}`);
    
  } catch (error) {
    console.error('❌ Failed to start servers:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down servers...");
  await prisma.$disconnect();
  console.log("✅ Database disconnected");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received SIGTERM, shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

startServers();

export default {
  port: PORT,
  fetch: app.fetch,
};

export { SocketManager,AdminSocketManager };