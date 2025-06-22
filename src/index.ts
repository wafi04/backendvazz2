import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { prisma } from "./lib/prisma";
import routes from "./route/index";

const app = new Hono();

// Environment variables
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = parseInt(process.env.PORT || "8080");
// Middleware
app.use("*", logger());
app.use("*", prettyJSON());

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (NODE_ENV === "development" && origin?.includes("localhost")) {
        return origin;
      }
      
      // Production: strict origin checking
      return FRONTEND_URL === origin ? origin : null;
    },
    credentials: true,
    allowHeaders: [
      "Origin",
      "Content-Type", 
      "Accept",
      "Authorization",
      "X-Requested-With",
      "Cookie"
    ],
    exposeHeaders: ["Set-Cookie"], 
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

// Routes
app.route("/api/v1", routes);

// Health check endpoint
app.get("/health", async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(
      {
        status: "error",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
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



// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down server...");
  await prisma.$disconnect();
  console.log("✅ Database disconnected");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received SIGTERM, shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});




export default {
  port: PORT,
  fetch: app.fetch
}