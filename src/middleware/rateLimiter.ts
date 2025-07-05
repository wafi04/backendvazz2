import { HTTPException } from "hono/http-exception";

export class RateLimiter {
  private attempts = new Map<string, { count: number; resetTime: number }>();
  
  constructor(
    private maxAttempts: number,
    private windowMs: number
  ) {}

  getMaxAttempts(): number {
    return this.maxAttempts;
  }
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(key);
    
    if (!record || now > record.resetTime) {
      this.attempts.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }
    
    if (record.count >= this.maxAttempts) {
      return false;
    }
    
    record.count++;
    return true;
  }
  
  getRemainingAttempts(key: string): number {
    const record = this.attempts.get(key);
    if (!record || Date.now() > record.resetTime) {
      return this.maxAttempts;
    }
    return Math.max(0, this.maxAttempts - record.count);
  }
  
  getResetTime(key: string): number {
    const record = this.attempts.get(key);
    return record ? record.resetTime : Date.now();
  }
}

export const rateLimitMiddleware = (limiter: RateLimiter, keyGenerator: (c: any) => string) => {
  return async (c: any, next: () => Promise<void>) => {
    const key = keyGenerator(c);
    
    if (!limiter.isAllowed(key)) {
      c.header('X-RateLimit-Limit', limiter.getMaxAttempts().toString());
      const resetTime = limiter.getResetTime(key);
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      
      c.header('Retry-After', retryAfter.toString());
      c.header('X-RateLimit-Limit', limiter.getMaxAttempts().toString());
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
      
      throw new HTTPException(429, { 
        message: "Too many requests. Please try again later."
      });
    }
    
   
    const remaining = limiter.getRemainingAttempts(key);
    c.header('X-RateLimit-Limit', limiter.getMaxAttempts().toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', Math.ceil(limiter.getResetTime(key) / 1000).toString());
    
    await next();
  };
};

export const createRateLimiters = () => {
  return {
    // By IP
    byIP: new RateLimiter(1000, 60 * 60 * 1000), // 1000 requests per hour
    
    // By User (after login)
    byUser: new RateLimiter(5000, 60 * 60 * 1000), // 5000 requests per hour
    
    // Login attempts
    loginAttempts: new RateLimiter(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
    
    // Password reset
    passwordReset: new RateLimiter(3, 60 * 60 * 1000), // 3 attempts per hour
    
    // Registration
    registration: new RateLimiter(5, 24 * 60 * 60 * 1000), // 5 per day
    
    // API calls
    apiCalls: new RateLimiter(10000, 60 * 60 * 1000), // 10k per hour
  };
};

