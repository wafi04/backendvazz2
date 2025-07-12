import { MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { prisma } from "../lib/prisma";
import { TokenService } from "../services/users/verificationToken";
  
const NODE_ENV = process.env.NODE_ENV || "development";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    let accessToken = getCookie(c, "vazzaccess");
    let refreshToken = getCookie(c, "vazzrefresh");
    
    console.log("Access token:", accessToken ? "exists" : "missing");
    console.log("Refresh token:", refreshToken ? "exists" : "missing");

    // Check for Authorization header if no cookie
    if (!accessToken) {
      const authHeader = c.req.header("Authorization");
      if (authHeader) {
        accessToken = authHeader.replace("Bearer ", "");
      }
    }

    if (!accessToken) {
      throw new HTTPException(401, { message: "Access token missing" });
    }

    const tokenService = new TokenService();

    try {
      // Try to verify access token
      const payload = await tokenService.verifyAccessToken(accessToken);

      if (!payload.sessionId || !payload.username || payload.type !== 'access') {
        throw new HTTPException(401, { message: "Invalid access token" });
      }

      // Validate session
      const session = await prisma.session.findUnique({
        where: { id: payload.sessionId as string }
      });

      if (!session || session.expires < new Date()) {
        throw new HTTPException(401, { message: "Session expired" });
      }

      // Set user data for the request
      c.set("jwtPayload", {
        sessionId: payload.sessionId as string,
        username: payload.username as string,
        role: payload.role as string,
      });

      await next();

    } catch (jwtError) {
      console.log("Access token verification failed:", jwtError);
      
      // If access token is invalid/expired, try refresh token
      if (refreshToken) {
        try {
          console.log("Attempting token refresh...");
          
          // Verify refresh token
          const refreshPayload = await tokenService.verifyRefreshToken(refreshToken);
          
          if (!refreshPayload.sessionId || refreshPayload.type !== 'refresh') {
            throw new Error("Invalid refresh token payload");
          }

          // Check if session exists and is valid
          const session = await prisma.session.findUnique({
            where: { id: refreshPayload.sessionId as string },
            include: { user: true }
          });

          if (!session || session.expires < new Date()) {
            throw new Error("Session expired");
          }

          // Generate new access token
          const newAccessToken = await tokenService.generateTokenPair({
            sessionId: session.id,
            username: session.user.username,
            role: session.user.role
          });


          // Update session expiry
          await prisma.session.update({
            where: { id: session.id },
            data: { expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } // 7 days
          });

          // Set new cookies
          authHelpers.setAuthCookies(c, newAccessToken.accessToken, newAccessToken.refreshToken);

          // Set user data for the request
          c.set("jwtPayload", {
            sessionId: session.id,
            username: session.user.username,
            role: session.user.role,
          });

          // Add refresh indicator to response headers
          c.header("X-Token-Refreshed", "true");

          console.log("Token refresh successful");
          await next();

        } catch (refreshError) {
          console.log("Token refresh failed:", refreshError);
          
          // Clear invalid cookies
          authHelpers.clearAuthCookies(c);
          
          throw new HTTPException(401, { 
            message: "Authentication failed. Please login again." 
          });
        }
      } else {
        // No refresh token available
        throw new HTTPException(401, { 
          message: "Access token expired and no refresh token available" 
        });
      }
    }
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error("Auth middleware error:", error);
    throw new HTTPException(500, { message: "Authentication failed" });
  }
};

// Enhanced auth helpers
export const authHelpers = {
  setAuthCookies: (c: any, accessToken: string, refreshToken: string) => {
    setCookie(c, "vazzaccess", accessToken, {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 30 * 60, // 30 minutes
      path: "/",
    });

    setCookie(c, "vazzrefresh", refreshToken, {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });
  },

  setAccessTokenCookie: (c: any, accessToken: string) => {
    setCookie(c, "vazzaccess", accessToken, {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 30 * 60, // 30 minutes
      path: "/",
    });
  },

  clearAuthCookies: (c: any) => {
    deleteCookie(c, "vazzaccess", { path: "/" });
    deleteCookie(c, "vazzrefresh", { path: "/" });
  },

  // Helper to check if token was refreshed
  wasTokenRefreshed: (c: any) => {
    return c.res.headers.get("X-Token-Refreshed") === "true";
  }
};

// Optional: Middleware specifically for refresh endpoint
export const refreshMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    const refreshToken = getCookie(c, "vazzrefresh");
    
    if (!refreshToken) {
      throw new HTTPException(401, { message: "Refresh token missing" });
    }

    const tokenService = new TokenService();
    
    try {
      // Verify refresh token
      const payload = await tokenService.verifyRefreshToken(refreshToken);
      
      if (!payload.sessionId || payload.type !== 'refresh') {
        throw new HTTPException(401, { message: "Invalid refresh token" });
      }

      // Check if session exists and is valid
      const session = await prisma.session.findUnique({
        where: { id: payload.sessionId as string },
        include: { user: true }
      });

      if (!session || session.expires < new Date()) {
        authHelpers.clearAuthCookies(c);
        throw new HTTPException(401, { message: "Session expired" });
      }

      // Set session data for the refresh endpoint
      c.set("sessionData", {
        sessionId: session.id,
        user: session.user
      });

      await next();

    } catch (tokenError) {
      console.log("Refresh token verification failed:", tokenError);
      authHelpers.clearAuthCookies(c);
      throw new HTTPException(401, { message: "Invalid refresh token" });
    }

  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: "Token refresh failed" });
  }
};

export const cleanupExpiredSessions = async () => {
  try {
    const expiredSessions = await prisma.session.deleteMany({
      where: {
        expires: { lt: new Date() }
      }
    });

    console.log(`Cleaned up ${expiredSessions.count} expired sessions`);
  } catch (error) {
    console.error("Session cleanup error:", error);
  }
};

export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get("jwtPayload") as {
    sessionId: string;
    username: string;
    role: string;
  };

  if (!user || user.role !== "admin") {
    throw new HTTPException(403, { message: "Admin access required" });
  }

  await next();
};

// Optional: Middleware to log token refresh events
export const tokenRefreshLogger: MiddlewareHandler = async (c, next) => {
  await next();
  
  if (authHelpers.wasTokenRefreshed(c)) {
    const user = c.get("jwtPayload") as any;
    console.log(`Token refreshed for user: ${user?.username} at ${new Date().toISOString()}`);
  }
};