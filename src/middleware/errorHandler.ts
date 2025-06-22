import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";

export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof HTTPException) {
    return c.json({
      success: false,
      error: err.message,
      status: err.status
    }, err.status);
  }

  // Log unexpected errors
  console.error("Unexpected error:", err);

  return c.json({
    success: false,
    error: "Internal server error",
    status: 500
  }, 500);
};