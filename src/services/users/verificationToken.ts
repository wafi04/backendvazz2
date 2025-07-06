import { sign, verify } from "hono/jwt";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class TokenService {
  private jwtSecret = process.env.JWT_SECRET!;
  private refreshSecret = process.env.REFRESH_TOKEN_SECRET!; 
  
  async generateTokenPair(payload: {
    sessionId: string;
    username: string;
    role: string;
  }): Promise<TokenPair> {
    
    // Access Token - Short lived (15-30 menit)
    const accessToken = await sign(
      {
        ...payload,
        type: 'access',
        exp: Math.floor(Date.now() / 1000) + (30 * 60), 
      },
      this.jwtSecret
    );
    
    // Refresh Token - Long lived (7-30 hari)
    const refreshToken = await sign(
      {
        sessionId: payload.sessionId,
        username: payload.username,
        type: 'refresh',
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), 
      },
      this.refreshSecret
    );
    
    return { accessToken, refreshToken };
  }
  
  async verifyAccessToken(token: string) {
    return await verify(token, this.jwtSecret);
  }
  
  async verifyRefreshToken(token: string) {
    return await verify(token, this.refreshSecret);
  }
}
