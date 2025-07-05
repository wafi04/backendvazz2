import { hashSync, compareSync } from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { generateApiKey, GenerateRandomId } from "../../utils/generate";
import { registerSchema } from "../../validation/user";
import {
  AuthResponse,
  RegisterInput,
  LoginInput,
  UserResponse,
} from "../../types/user";
import { SessionService } from "./session";
import { TokenService } from "./verificationToken";

export class AuthService {
  private readonly JWT_SECRET: string;
  constructor(
    private readonly tokenService = new TokenService(),
    private readonly sessionService = new SessionService()
  ) {
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
        isOnline :  true,
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
      isOnline: true,
      password: true,
      role: true,
      whatsapp: true,
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

  const sessionId = GenerateRandomId(user.username);

  // ✅ Generate token pair
  const tokenPair = await this.tokenService.generateTokenPair({
    sessionId,
    username: user.username,
    role: user.role
  });

  // ✅ Create session dengan both tokens
  await this.sessionService.Create(prisma, {
    deviceInfo: input.deviceInfo,
    sessionId,
    ip: input.ip,
    token : tokenPair.accessToken,
    userAgent: input.userAgent,
    username: user.username
  });

  return {
    message: "Login successful",
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      isOnline: user.isOnline,
      balance: user.balance,
      whatsapp: user.whatsapp,
      createdAt: new Date(),
    },
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
  };
}

  /**
   * Get user profile by ID
   */
  async getUserProfile(sessionId: string) {
    const user = await this.sessionService.GetSession(sessionId)
    if(!user){
      throw new Error("invalid credentials")
    }
    return user.user
  }

  /**
   *  Refresh Token 
  */
  async RefreshToken(username : string, sessionId : string,role : string) {
  
    const token = await this.tokenService.generateTokenPair({
      sessionId,
      username,
      role
    });
    return {
      token
    }
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
        whatsapp : true,
        createdAt: true,
        isOnline : true,
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
