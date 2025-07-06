import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono/validator";
import { registerSchema,loginSchema} from "../validation/user";
import { authHelpers, authMiddleware } from "../middleware/auth";
import { AuthService } from "../services/users/auth";
import { createErrorResponse } from "../utils/response";
import { getUserAgent } from "../utils/cleintInfo";
import { prisma } from "../lib/prisma";
import { loginLimiter } from "../constants";
import { getRealIP } from "../middleware/rateLimiter";

const authRoutes = new Hono();
const authService = new AuthService();

// POST /api/auth/register
authRoutes.post(
  "/register",
  validator("json", (value, c) => {
    const parsed = registerSchema.safeParse(value);
    if (!parsed.success) {
      return createErrorResponse("Invalid input", 400, parsed.error.errors);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const input = c.req.valid("json");
      const result = await authService.register(input);

      return c.json(
        {
          success: true,
          ...result,
        },
        201
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Registration failed";

      if (message === "User already exists") {
        throw new HTTPException(409, { message });
      }

      throw new HTTPException(500, { message });
    }
  }
);

 authRoutes.post(
  "/login",
  validator("json", (value, c) => {
    const parsed = loginSchema.safeParse(value);
    if (!parsed.success) {
      return createErrorResponse("Invalid input", 400, parsed.error.errors);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const ip = getRealIP(c);
      const userAgent = getUserAgent(c);
      
      const input = c.req.valid("json");
      
      const result = await authService.login({
        ...input,
        deviceInfo: userAgent,
        ip,
        userAgent
      });

      if (!result.user) {        
        return c.json({
          success: false,
          message: "Invalid credentials"
        }, 401);
      }

      // Set auth cookies
      authHelpers.setAuthCookies(c, result.accessToken!, result.refreshToken!);

      return c.json({
        success: true,
        message: "Login successful",
        data: result.user
      });
      
    } catch (error) {
      console.error("Login error:", error);
      
      if (error instanceof Error) {
        switch (error.message) {
          case "Invalid credentials":
          case "User not found":
          case "Incorrect password":
            return c.json({
              success: false,
              message: "Invalid credentials"
            }, 401);
          
          case "Account locked":
          case "Account disabled":
            return c.json({
              success: false,
              message: "Account is temporarily locked"
            }, 403);
          
          case "Email not verified":
            return c.json({
              success: false,
              message: "Please verify your email before logging in"
            }, 403);
          
          default:
            console.error("Unexpected login error:", error);
            return c.json({
              success: false,
              message: "Internal server error"
            }, 500);
        }
      }
      
      // Fallback for unknown errors
      return c.json({
        success: false,
        message: "Internal server error"
      }, 500);
    }
  }
);


authRoutes.get("/me", authMiddleware, async (c) => {
  try {
    const user = c.get("jwtPayload") as { sessionId : string };
    const userData = await authService.getUserProfile(user.sessionId);

    if (!userData) {
      throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    }

    return c.json({
      success: true,
      message: "User profile retrieved successfully",
      status : true,
      data: userData
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get user profile";
    if (message === "User not found") {
      throw new HTTPException(404, { message });
    }

    throw new HTTPException(500, { message });
  }
});

authRoutes.get("/user/:username", authMiddleware, async (c) => {
  try {
    const username = c.req.param("username");
    const userData = await authService.getUserByUsername(username);

    if (!userData) {
      throw new HTTPException(404, { message: "User not found" });
    }

    return c.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;

    console.error("Get user by username error:", error);
    throw new HTTPException(500, { message: "Failed to get user data" });
  }
});


authRoutes.put(
  "/balance",
  authMiddleware,
  validator("json", (value, c) => {
    // Simple validation
    if (!value.username || !value.amount || !value.operation) {
      return createErrorResponse(
        "Missing required fields: username, amount, operation",
        400
      );
    }

    if (!["add", "subtract"].includes(value.operation)) {
      return createErrorResponse("Operation must be 'add' or 'subtract'", 400);
    }

    if (typeof value.amount !== "number" || value.amount < 1) {
      return createErrorResponse("Amount must be a positive number", 400);
    }

    return value;
  }),
  async (c) => {
    try {
      const { username, amount, operation } = c.req.valid("json");
      const newBalance = await authService.updateBalance(
        username,
        amount,
        operation
      );

      return c.json({
        success: true,
        message: "Balance updated successfully",
        newBalance,
      });
    } catch (error) {
      console.error("Update balance error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to update balance";

      if (message === "User not found") {
        throw new HTTPException(404, { message });
      }

      if (message === "Insufficient balance") {
        throw new HTTPException(400, { message });
      }

      throw new HTTPException(500, { message });
    }
  }
);

authRoutes.delete("/deactivate/:userId", authMiddleware, async (c) => {
  try {
    const user = c.get("jwtPayload") as { username: number; role: string };

    if (user.role !== "admin") {
      throw new HTTPException(403, { message: "Insufficient permissions" });
    }

    const userIdToDeactivate = parseInt(c.req.param("userId"));

    if (isNaN(userIdToDeactivate)) {
      throw new HTTPException(400, { message: "Invalid user ID" });
    }

    await authService.deactivateUser(userIdToDeactivate);

    return c.json({
      success: true,
      message: "User deactivated successfully",
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;

    console.error("Deactivate user error:", error);
    throw new HTTPException(500, { message: "Failed to deactivate user" });
  }
});

authRoutes.post("/logout", authMiddleware, async (c) => {
  try {
    const { sessionId } = c.get("jwtPayload");
    
    await prisma.session.delete({
      where: { id: sessionId }
    });

    const remainingSessions = await prisma.session.count({
      where: { 
        username: c.get("jwtPayload").username,
        expires: { gt: new Date() }
      }
    });

    if (remainingSessions === 0) {
      await prisma.user.update({
        where: { username: c.get("jwtPayload").username },
        data: { isOnline: false }
      });
    }

    authHelpers.clearAuthCookies(c);

    return c.json({
      success: true,
      message: "Logout successful"
    });
  } catch (error) {
    console.error("Logout error:", error);
    throw new HTTPException(500, { message: "Logout failed" });
  }
});

// 5. Tambahkan endpoint untuk refresh token (optional)
authRoutes.post("/refresh", authMiddleware, async (c) => {
  try {
    const user = c.get("jwtPayload") as { username: string; role: string, sessionId: string }

    const token = await authService.RefreshToken(user.username, user.role, user.sessionId);
    authHelpers.setAccessTokenCookie(c, token.token.accessToken);

    return c.json({
      success: true,
      message: "Token refreshed"
    });
  } catch (error) {
    console.error("Refresh error:", error);
    throw new HTTPException(500, { message: "Token refresh failed" });
  }
});


export default authRoutes;
