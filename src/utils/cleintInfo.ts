// Debug version - Helper function untuk mendapatkan real IP address
export const getRealIP = (c: any): string => {
  console.log('=== IP Debug Info ===');
  console.log('All headers:', Object.fromEntries(c.req.raw.headers));
  
  const xForwardedFor = c.req.header('x-forwarded-for');
  const xRealIP = c.req.header('x-real-ip');
  const cfConnectingIP = c.req.header('cf-connecting-ip'); // Cloudflare
  const xClientIP = c.req.header('x-client-ip');
  const xForwarded = c.req.header('x-forwarded');
  const forwarded = c.req.header('forwarded');
  
  console.log('xForwardedFor:', xForwardedFor);
  console.log('xRealIP:', xRealIP);
  console.log('cfConnectingIP:', cfConnectingIP);
  console.log('xClientIP:', xClientIP);
  console.log('c.env?.REMOTE_ADDR:', c.env?.REMOTE_ADDR);
  console.log('c.req.raw?.cf:', c.req.raw?.cf);
  
  // Prioritas berdasarkan reliability
  if (cfConnectingIP) {
    console.log('Using cfConnectingIP:', cfConnectingIP);
    return cfConnectingIP;
  }
  
  if (xRealIP) {
    console.log('Using xRealIP:', xRealIP);
    return xRealIP;
  }
  
  if (xForwardedFor) {
    const ip = xForwardedFor.split(',')[0].trim();
    console.log('Using xForwardedFor:', ip);
    return ip;
  }
  
  if (xClientIP) {
    console.log('Using xClientIP:', xClientIP);
    return xClientIP;
  }
  
  if (xForwarded) {
    const ip = xForwarded.split(',')[0].trim();
    console.log('Using xForwarded:', ip);
    return ip;
  }
  
  if (forwarded) {
    const match = forwarded.match(/for=([^;,\s]+)/);
    if (match) {
      console.log('Using forwarded:', match[1]);
      return match[1];
    }
  }
  
  // Fallback options
  const fallbackIP = c.env?.REMOTE_ADDR || 
                     c.req.raw?.cf?.connectingIP || 
                     c.req.socket?.remoteAddress ||
                     'unknown';
  
  console.log('Using fallback:', fallbackIP);
  return fallbackIP;
};

// Alternative approach - More comprehensive IP detection
export const getRealIPv2 = (c: any): string => {
  const headers = c.req.raw.headers;
  
  // Array of header names to check (in order of preference)
  const headerNames = [
    'cf-connecting-ip',      // Cloudflare
    'x-real-ip',            // Nginx
    'x-forwarded-for',      // Standard
    'x-client-ip',          // Apache
    'x-forwarded',          // General
    'forwarded-for',        // Alternative
    'forwarded',            // RFC 7239
    'x-cluster-client-ip',  // Cluster
    'x-original-forwarded-for', // Original
    'client-ip',            // Simple
    'true-client-ip',       // Alternative
  ];
  
  for (const headerName of headerNames) {
    const value = headers.get(headerName);
    if (value) {
      // Handle comma-separated values (take first)
      const ip = value.split(',')[0].trim();
      
      // Validate IP format (basic check)
      if (isValidIP(ip)) {
        return ip;
      }
    }
  }
  
  // Check Cloudflare object
  if (c.req.raw.cf?.connectingIP) {
    return c.req.raw.cf.connectingIP;
  }
  
  // Check environment variables
  if (c.env?.REMOTE_ADDR) {
    return c.env.REMOTE_ADDR;
  }
  
  // Last resort - check request object
  if (c.req.socket?.remoteAddress) {
    return c.req.socket.remoteAddress;
  }
  
  return 'unknown';
};

// Helper function untuk validasi IP
const isValidIP = (ip: string): boolean => {
  if (!ip || ip === 'unknown') return false;
  
  // Remove IPv6 brackets if present
  ip = ip.replace(/[\[\]]/g, '');
  
  // Check if it's a valid IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }
  
  // Check if it's a valid IPv6 (basic check)
  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  if (ipv6Regex.test(ip) && ip.includes(':')) {
    return true;
  }
  
  return false;
};

export const getRealIPByPlatform = (c: any, platform: string = 'auto'): string => {
  if (platform === 'auto') {
    if (c.req.raw?.cf) platform = 'cloudflare';
    else if (c.env?.VERCEL) platform = 'vercel';
    else if (c.env?.NETLIFY) platform = 'netlify';
    else platform = 'generic';
  }
  
  switch (platform) {
    case 'cloudflare':
      return c.req.raw.cf?.connectingIP || 
             c.req.header('cf-connecting-ip') ||
             getRealIPv2(c);
             
    case 'vercel':
      return c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
             c.req.header('x-real-ip') ||
             getRealIPv2(c);
             
    case 'netlify':
      return c.req.header('x-nf-client-connection-ip') ||
             c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
             getRealIPv2(c);
             
    default:
      return getRealIPv2(c);
  }
};

// Usage example dengan error handling
export const safeGetRealIP = (c: any): string => {
  try {
    return getRealIP(c);
  } catch (error) {
    console.error('Error getting real IP:', error);
    return 'unknown';
  }
};

// Untuk testing - log semua informasi yang tersedia
export const debugIPInfo = (c: any) => {
  console.log('=== Complete IP Debug Info ===');
  console.log('Headers:', Object.fromEntries(c.req.raw.headers));
  console.log('CF Object:', c.req.raw.cf);
  console.log('Environment:', {
    REMOTE_ADDR: c.env?.REMOTE_ADDR,
    VERCEL: c.env?.VERCEL,
    NETLIFY: c.env?.NETLIFY
  });
  console.log('Request:', {
    url: c.req.url,
    method: c.req.method,
    socket: c.req.socket?.remoteAddress
  });
  
  const finalIP = getRealIP(c);
  console.log('Final IP:', finalIP);
  console.log('==========================');
  
  return finalIP;
};

// Helper function untuk mendapatkan User Agent
export const getUserAgent = (c: any): string => {
  return c.req.header('user-agent') || 'unknown';
};