import { MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { prisma } from "../lib/prisma";
import { TokenService } from "../services/users/verificationToken";
  
const NODE_ENV = process.env.NODE_ENV || "development";
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    let accessToken = getCookie(c, "vazzaccess");

    if (!accessToken) {
      const authHeader = c.req.header("Authorization");
      if (authHeader) {
        accessToken = authHeader.replace("Bearer ", "");
      }
    }

    if (!accessToken) {
      throw new HTTPException(401, { message: "Access token missing" });
    }

    try {
      const tokenService = new TokenService();
      const payload = await tokenService.verifyAccessToken(accessToken);

      if (!payload.sessionId || !payload.username || payload.type !== 'access') {
        throw new HTTPException(401, { message: "Invalid access token" });
      }

      // ✅ Validasi session (session tidak berubah)
      const session = await prisma.session.findUnique({
        where: { id: payload.sessionId as string }
      });

      if (!session || session.expires < new Date()) {
        throw new HTTPException(401, { message: "Session expired" });
      }      

      c.set("jwtPayload", {
        sessionId: payload.sessionId as string,
        username: payload.username as string,
        role: payload.role as string,
      });

      await next();
    } catch (jwtError) {
      throw new HTTPException(401, { message: "Invalid or expired access token" });
    }
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: "Authentication failed" });
  }
};

// 3. Perbaiki cookie settings
export const authHelpers = {
  setAuthCookies: (c: any, accessToken: string, refreshToken: string) => {
    setCookie(c, "vazzaccess", accessToken, {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 30 * 60, // 30 menit
      path: "/",
    });

    setCookie(c, "vazzrefresh", refreshToken, {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60, // 7 hari
      path: "/",
    });
  },

  setAccessTokenCookie: (c: any, accessToken: string) => {
    setCookie(c, "vazzaccess", accessToken, {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 30 * 60, // 30 menit
      path: "/",
    });
  },

  clearAuthCookies: (c: any) => {
    deleteCookie(c, "vazzaccess", { path: "/" });
    deleteCookie(c, "vazzrefresh", { path: "/" });
  },
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
    sessionId: number;
    username: string;
    role: string;
  };

  if (!user || user.role !== "admin") {
    throw new HTTPException(403, { message: "Admin access required" });
  }

  await next();
};
