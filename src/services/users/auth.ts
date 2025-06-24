import { hashSync, compareSync } from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { generateApiKey } from "../../utils/generate";
import { registerSchema } from "../../validation/user";
import { VerificationToken } from "./verificationToken";
import {
  AuthResponse,
  RegisterInput,
  LoginInput,
  UserResponse,
} from "../../types/user";
import { authHelpers } from "../../middleware/auth";

export class AuthService {
  private readonly JWT_SECRET: string;
  constructor(private readonly tokenService = new VerificationToken()) {
    this.JWT_SECRET = process.env.JWT_SECRET || "";
    if (!this.JWT_SECRET) {
      throw new Error("JWT_SECRET environment variable is required");
    }
  }

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const { name, username, whatsapp, password } = input;
    const validate = registerSchema.safeParse({
      ...input,
    });
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser || !validate.data) {
      throw new Error("User already exists");
    }

    // Hash password
    const hashedPassword = hashSync(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        balance: 0,
        lastPaymentAt: new Date(),
        role: "member",
        name,
        username,
        password: hashedPassword,
        apiKey: generateApiKey(),
        whatsapp: whatsapp?.toString(),
      },
      select: {
        id: true,
        name: true,
        username: true,
        createdAt: true,
        balance: true,
        role: true,
      },
    });

    return {
      message: "User registered successfully",
      user,
    };
  }

  /**
   * Login user
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const { username, password } = input;

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        password: true,
        role: true,
        balance: true,
      },
    });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    const isValidPassword = compareSync(password, user.password);
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    // Generate JWT token
    const token = await this.tokenService.generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    return {
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        balance: user.balance,
        createdAt: new Date(), // Will be populated from DB
      },
      token,
    };
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: number): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        createdAt: true,
        balance: true,
        role: true,
        apiKey: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<UserResponse | null> {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        createdAt: true,
        balance: true,
        role: true,
      },
    });

    return user;
  }

  /**
   * Update user password
   */
  async updatePassword(
    userId: number,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Verify old password
    const isValidPassword = compareSync(oldPassword, user.password);
    if (!isValidPassword) {
      throw new Error("Invalid current password");
    }

    // Hash new password
    const hashedNewPassword = hashSync(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });
  }

  /**
   * Regenerate API key for user
   */
  async regenerateApiKey(userId: number): Promise<string> {
    const newApiKey = generateApiKey();

    await prisma.user.update({
      where: { id: userId },
      data: { apiKey: newApiKey },
    });

    return newApiKey;
  }

  /**
   * Update user balance
   */
  async updateBalance(
    username: string,
    amount: number,
    operation: "add" | "subtract"
  ): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { balance: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const newBalance =
      operation === "add" ? user.balance + amount : user.balance - amount;

    if (newBalance < 0) {
      throw new Error("Insufficient balance");
    }

    const updatedUser = await prisma.user.update({
      where: { username },
      data: { balance: newBalance },
      select: { balance: true },
    });

    return updatedUser.balance;
  }

  /**
   * Soft delete user (deactivate)
   */
  async deactivateUser(userId: number): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: "inactive",
        updatedAt: new Date(),
      },
    });
  }
}
