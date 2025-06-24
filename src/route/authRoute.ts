import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono/validator";
import {
  registerSchema,
  loginSchema,
  updatePasswordSchema,
} from "../validation/user";
import { authHelpers, authMiddleware } from "../middleware/auth";
import { AuthService } from "../services/users/auth";
import { createErrorResponse } from "../utils/response";

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
      console.error("Registration error:", error);
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
      const input = c.req.valid("json");
      const result = await authService.login(input);

      // Set authentication cookie
      authHelpers.setAuthCookie(c, result.token!);

      return c.json({
        success: true,
        message: "Login successful",
        user: result.user,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";

      if (message === "Invalid credentials") {
        throw new HTTPException(401, { message });
      }

      throw new HTTPException(500, { message });
    }
  }
);

// Clean /me route
authRoutes.get("/me", authMiddleware, async (c) => {
  try {
    const user = c.get("jwtPayload") as { userId: number };
    const userData = await authService.getUserProfile(user.userId);

    return c.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get user profile";

    if (message === "User not found") {
      throw new HTTPException(404, { message });
    }

    throw new HTTPException(500, { message });
  }
});

// Logout route
authRoutes.post("/logout", authMiddleware, async (c) => {
  try {
    // Clear authentication cookie
    authHelpers.clearAuthCookie(c);

    return c.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    throw new HTTPException(500, { message: "Logout failed" });
  }
});
// GET /api/auth/user/:username - Get user by username
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

// PUT /api/auth/password - Update password
authRoutes.put(
  "/password",
  authMiddleware,
  validator("json", (value, c) => {
    const parsed = updatePasswordSchema.safeParse(value);
    if (!parsed.success) {
      return createErrorResponse("Invalid input", 400, parsed.error.errors);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const user = c.get("jwtPayload") as { userId: number };
      const { oldPassword, newPassword } = c.req.valid("json");

      await authService.updatePassword(user.userId, oldPassword, newPassword);

      return c.json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (error) {
      console.error("Update password error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to update password";

      if (message === "Invalid current password") {
        throw new HTTPException(400, { message });
      }

      if (message === "User not found") {
        throw new HTTPException(404, { message });
      }

      throw new HTTPException(500, { message });
    }
  }
);

// PUT /api/auth/balance - Update user balance
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

// DELETE /api/auth/deactivate/:userId - Deactivate user (admin only)
authRoutes.delete("/deactivate/:userId", authMiddleware, async (c) => {
  try {
    const user = c.get("jwtPayload") as { userId: number; role: string };

    // Check if current user is admin
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

// POST /api/auth/logout - Logout (optional, for token blacklisting)
authRoutes.post("/logout", authMiddleware, async (c) => {
  try {
    // In a real app, you might want to blacklist the token
    // For now, we'll just return success
    return c.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    throw new HTTPException(500, { message: "Failed to logout" });
  }
});

export default authRoutes;
