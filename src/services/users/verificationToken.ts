import { sign, verify } from "hono/jwt";
import { prisma } from "../../lib/prisma";
import { hashSync } from "bcryptjs";

export class VerificationToken  {
private readonly JWT_SECRET: string;
  private readonly TOKEN_EXPIRY = 60 * 60 * 12
  private readonly VERIFICATION_TOKEN_EXPIRY = 60 * 60; 

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || "";
    if (!this.JWT_SECRET) {
      throw new Error("JWT_SECRET environment variable is required");
    }
  }
  /**
   * Create verification token for password reset, email verification, etc.
   */
  async createVerificationToken(identifier: string, purpose: 'password_reset' | 'email_verify' | 'otp'): Promise<string> {
    const token = this.generateRandomToken();
    const expires = new Date(Date.now() + this.VERIFICATION_TOKEN_EXPIRY * 1000);

    // Delete existing tokens for this identifier and purpose
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: `${identifier}_${purpose}`,
      },
    });

    // Create new verification token
    await prisma.verificationToken.create({
      data: {
        identifier: `${identifier}_${purpose}`,
        token,
        expires,
      },
    });

    return token;
  }

  /**
   * Verify verification token
   */
  async verifyVerificationToken(identifier: string, token: string, purpose: 'password_reset' | 'email_verify' | 'otp'): Promise<boolean> {
    const verificationToken = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: `${identifier}_${purpose}`,
          token,
        },
      },
    });

    if (!verificationToken) {
      return false;
    }

    // Check if token has expired
    if (new Date() > verificationToken.expires) {
      // Delete expired token
      await this.deleteVerificationToken(identifier, token, purpose);
      return false;
    }

    return true;
  }

  /**
   * Delete verification token after use
   */
  async deleteVerificationToken(identifier: string, token: string, purpose: 'password_reset' | 'email_verify' | 'otp'): Promise<void> {
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: `${identifier}_${purpose}`,
        token,
      },
    });
  }

  /**
   * Clean up expired verification tokens
   */
  async cleanupExpiredVerificationTokens(): Promise<number> {
    const result = await prisma.verificationToken.deleteMany({
      where: {
        expires: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Verify JWT token and Verification token combined
   */
  async verifyToken(token: string, type: 'jwt' | 'verification' = 'jwt'): Promise<{ userId: number; username: string; role: string } | boolean> {
    if (type === 'jwt') {
      try {
        const payload = await verify(token, this.JWT_SECRET);
        
        if (!payload.userId || !payload.username) {
          throw new Error("Invalid token payload");
        }

        return {
          userId: payload.userId as number,
          username: payload.username as string,
          role: payload.role as string,
        };
      } catch (error) {
        throw new Error("Invalid or expired JWT token");
      }
    } else {
      // For verification tokens, we need identifier and purpose
      // This method signature would need to be adjusted for verification tokens
      throw new Error("Use verifyVerificationToken method for verification tokens");
    }
  }

  /**
   * Generate JWT token
   */
  async generateToken(payload: {  username: string; sessionId: string,role : string }): Promise<string> {
    return await sign(
      {
        ...payload,
        exp: Math.floor(Date.now() / 1000) + this.TOKEN_EXPIRY,
      },
      this.JWT_SECRET
    );
  }

  /**
   * Generate random verification token
   */
  private generateRandomToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Reset password using verification token
   */
  async resetPassword(identifier: string, token: string, newPassword: string): Promise<void> {
    // Verify the reset token
    const isValidToken = await this.verifyVerificationToken(identifier, token, 'password_reset');
    if (!isValidToken) {
      throw new Error("Invalid or expired reset token");
    }

    // Find user by username or email (identifier)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { whatsapp: identifier }, // assuming whatsapp can be used as identifier
        ],
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Hash new password
    const hashedPassword = hashSync(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Delete used token
    await this.deleteVerificationToken(identifier, token, 'password_reset');
  }

  /**
   * Request password reset (creates verification token)
   */
  async requestPasswordReset(identifier: string): Promise<string> {
    // Check if user exists
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { whatsapp: identifier },
        ],
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Create verification token
    const token = await this.createVerificationToken(identifier, 'password_reset');
    
    return token;
  }
}