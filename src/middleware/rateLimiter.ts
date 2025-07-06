export const getRealIP = (c: any): string => {
  const isDevelopment = process.env.NODE_ENV === 'development' || 
                       c.req.url?.includes('localhost') ||
                       c.req.url?.includes('127.0.0.1');
  
  if (isDevelopment) {
    const userAgent = c.req.header('user-agent') || 'unknown';
    const origin = c.req.header('origin') || c.req.header('referer') || 'unknown';
    const combined = `${userAgent}-${origin}`;
    const hash = Buffer.from(combined).toString('base64').substring(0, 12);
    
    return `dev-${hash}`;
  }
  
  const headers = [
    'cf-connecting-ip',     
    'x-real-ip',            
    'x-forwarded-for',      
    'x-client-ip',          
    'true-client-ip',       
    'x-cluster-client-ip',  
    'forwarded-for',        
    'forwarded'             // RFC 7239
  ];
  
  for (const header of headers) {
    const value = c.req.header(header);
    if (value) {
      const ip = value.split(',')[0].trim();
      if (ip && ip !== 'unknown') {
        return ip;
      }
    }
  }
  
  return c.env?.REMOTE_ADDR || 'unknown';
};

export class SmartRateLimiter {
  private attempts = new Map<string, { count: number; resetTime: number }>();
  private isDevelopment: boolean;
  
  constructor(
    private maxAttempts: number,
    private windowMs: number,
    private devMaxAttempts?: number
  ) {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  getMaxAttempts(): number {
    return this.isDevelopment && this.devMaxAttempts 
      ? this.devMaxAttempts 
      : this.maxAttempts;
  }
  
  isAllowed(key: string): boolean {
    if (this.isDevelopment && process.env.DISABLE_RATE_LIMIT === 'true') {
      return true;
    }
    
    const now = Date.now();
    const record = this.attempts.get(key);
    const maxAttempts = this.getMaxAttempts();
    
    if (!record || now > record.resetTime) {
      this.attempts.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }
    
    if (record.count >= maxAttempts) {
      return false;
    }
    
    record.count++;
    return true;
  }
  
  getRemainingAttempts(key: string): number {
    const record = this.attempts.get(key);
    const maxAttempts = this.getMaxAttempts();
    
    if (!record || Date.now() > record.resetTime) {
      return maxAttempts;
    }
    return Math.max(0, maxAttempts - record.count);
  }
  
  getResetTime(key: string): number {
    const record = this.attempts.get(key);
    return record ? record.resetTime : Date.now();
  }
  
  clearAttempts(key: string): void {
    this.attempts.delete(key);
  }
  
  getDebugInfo(): any {
    return {
      isDevelopment: this.isDevelopment,
      maxAttempts: this.getMaxAttempts(),
      totalKeys: this.attempts.size,
      keys: Array.from(this.attempts.keys())
    };
  }
}

export const createSmartRateLimiters = () => {
  return {
    loginAttempts: new SmartRateLimiter(
      5,                    // Production: 5 attempts
      15 * 60 * 1000,      // 15 minutes window
      50                   // Development: 50 attempts
    ),
    
    apiCalls: new SmartRateLimiter(
      1000,                // Production: 1000 per hour
      60 * 60 * 1000,      // 1 hour window
      10000                // Development: 10000 per hour
    ),
    
    registration: new SmartRateLimiter(
      5,                   
      24 * 60 * 60 * 1000, 
      100                  
    )
  };
};
