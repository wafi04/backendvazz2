// src/routes/auth.ts
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono/validator";
import { sign } from "hono/jwt";
import { prisma } from "../../lib/prisma";
import { loginSchema, registerSchema } from "../../validation/user";
import { hashSync } from "bcryptjs";

export const authRoutes = new Hono();

// POST /api/auth/register
authRoutes.post(
  "/register",
  validator("json", (value, c) => {
    const parsed = registerSchema.safeParse(value);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid input", details: parsed.error.errors },
        400
      );
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const { name, username, whatsapp, password } = c.req.valid("json");

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { username },
      });

      if (existingUser) {
        throw new HTTPException(409, { message: "User already exists" });
      }

      // In production, hash the password with bcrypt
      // const hashedPassword = await bcrypt.hash(password, 10)

      const user = await prisma.user.create({
        data: {
          name,
          username,
          balance: 0,
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      });

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET not configured");
      }

      const token = await sign(
        {
          userId: user.id,
          username: user.username,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
        },
        jwtSecret
      );

      return c.json(
        {
          message: "User registered successfully",
          user,
          token,
        },
        201
      );
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      console.error("Registration error:", error);
      throw new HTTPException(500, { message: "Registration failed" });
    }
  }
);

// POST /api/auth/login
authRoutes.post(
  "/login",
  validator("json", (value, c) => {
    const parsed = loginSchema.safeParse(value);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid input", details: parsed.error.errors },
        400
      );
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const { username, password } = c.req.valid("json");

      const user = await prisma.user.findUnique({
        where: { username },
        // select: { id: true, name: true, username: true, password: true }
      });

      if (!user) {
        throw new HTTPException(401, { message: "Invalid credentials" });
      }

      const isValidPassword = await hashSync.compare(password, user.password);
      if (!isValidPassword) {
        throw new HTTPException(401, { message: "Invalid credentials" });
      }

      // For demo purposes, skip password validation
      console.log("Demo login - password validation skipped");

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET not configured");
      }

      const token = await sign(
        {
          userId: user.id,
          username: user.username,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
        },
        jwtSecret
      );

      return c.json({
        message: "Login successful",
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
        },
        token,
      });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      console.error("Login error:", error);
      throw new HTTPException(500, { message: "Login failed" });
    }
  }
);

// GET /api/auth/me - Get current user
authRoutes.get("/me", async (c) => {
  try {
    const user = c.get("user") as any;

    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        name: true,
        username: true,
        createdAt: true,
      },
    });

    if (!userData) {
      throw new HTTPException(404, { message: "User not found" });
    }

    return c.json({ user: userData });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error("Get user error:", error);
    throw new HTTPException(500, { message: "Failed to get user data" });
  }
});
