import { MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { verify } from "hono/jwt";

const NODE_ENV = process.env.NODE_ENV || "development";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    let token = getCookie(c, "auth_token");

    if (!token) {
      const authHeader = c.req.header("Authorization");
      if (authHeader) {
        token = authHeader.replace("Bearer ", "");
      }
    }

    if (!token) {
      throw new HTTPException(401, { message: "Token missing" });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new HTTPException(500, { message: "JWT_SECRET not configured" });
    }

    try {
      const payload = await verify(token, jwtSecret);

      if (!payload.userId || !payload.username) {
        throw new HTTPException(401, { message: "Invalid token payload" });
      }

      c.set("jwtPayload", {
        userId: payload.userId as number,
        username: payload.username as string,
        role: payload.role as string,
      });

      await next();
    } catch (jwtError) {
      // Clear invalid cookie
      deleteCookie(c, "auth_token", { path: "/" });
      throw new HTTPException(401, { message: "Invalid or expired token" });
    }
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error("Auth middleware error:", error);
    throw new HTTPException(500, { message: "Authentication failed" });
  }
};

// Optional: Admin-only middleware
export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get("jwtPayload") as {
    userId: number;
    username: string;
    role: string;
  };

  if (!user || user.role !== "admin") {
    throw new HTTPException(403, { message: "Admin access required" });
  }

  await next();
};

export const authHelpers = {
  setAuthCookie: (c: any, token: string) => {
    setCookie(c, "auth_token", token, {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });
  },

  getAuthToken: (c: any): string | undefined => {
    return getCookie(c, "auth_token");
  },

  clearAuthCookie: (c: any) => {
    deleteCookie(c, "auth_token", {
      path: "/",
      secure: NODE_ENV === "production",
      sameSite: NODE_ENV === "production" ? "None" : "Lax",
    });
  },
};
