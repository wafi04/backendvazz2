import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { createServer } from "http";
import { prisma } from "./lib/prisma";
import routes from "./route/index";
import { wsManager } from "./lib/websocketManager";

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
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    websocket: wsManager.getStats()
  });
});



// Root endpoint
app.get("/", (c) => {
  return c.json({
    message: "API Server is running",
    version: "1.0.0",
    port: PORT,
    environment: NODE_ENV,
    websocket: {
      enabled: true,
      stats: wsManager.getStats()
    }
  });
});

// Create HTTP server
const server = createServer();

// Initialize WebSocket
const io = wsManager.init(server);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);
  console.log(`📡 Environment: ${NODE_ENV}`);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    server.close(() => {
      console.log("✅ HTTP server closed");
    });
    
    await prisma.$disconnect();
    console.log("✅ Database disconnected");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
});

export default {
  port: PORT,
  fetch: app.fetch,
  server,
  io,
};