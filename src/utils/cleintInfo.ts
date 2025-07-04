
// Helper function untuk mendapatkan real IP address
export const getRealIP = (c: any): string => {
  const xForwardedFor = c.req.header('x-forwarded-for');
  const xRealIP = c.req.header('x-real-ip');
  const cfConnectingIP = c.req.header('cf-connecting-ip'); // Cloudflare
  const xClientIP = c.req.header('x-client-ip');
  const xForwarded = c.req.header('x-forwarded');
  const forwarded = c.req.header('forwarded');

  // Priority order untuk mendapatkan real IP
  if (cfConnectingIP) return cfConnectingIP;
  if (xRealIP) return xRealIP;
  if (xForwardedFor) {
    // x-forwarded-for bisa berisi multiple IP, ambil yang pertama
    return xForwardedFor.split(',')[0].trim();
  }
  if (xClientIP) return xClientIP;
  if (xForwarded) return xForwarded.split(',')[0].trim();
  if (forwarded) {
    // Parse forwarded header format: for=192.168.1.1;proto=http
    const match = forwarded.match(/for=([^;,\s]+)/);
    if (match) return match[1];
  }

  // Fallback ke remote address (mungkin tidak akurat jika ada proxy)
  return c.env?.REMOTE_ADDR || c.req.raw?.cf?.connectingIP || 'unknown';
};

// Helper function untuk mendapatkan User Agent
export const getUserAgent = (c: any): string => {
  return c.req.header('user-agent') || 'unknown';
};