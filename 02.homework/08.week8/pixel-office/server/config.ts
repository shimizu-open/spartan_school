// All settings come from environment variables, so the same Docker image
// works on a laptop and on AWS.

const production = process.env.NODE_ENV === 'production';

export const config = {
  production,
  port: Number(process.env.PORT ?? 3000),
  // The development server (Vite) must not be reachable from other machines.
  host: process.env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1'),
  /** Set to 1 when running behind a load balancer / CloudFront (uses X-Forwarded-*). */
  trustProxy: process.env.TRUST_PROXY === '1',
  /** Extra origins allowed to open a realtime connection (comma separated). */
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  /** STUN servers given to people who joined (no passwords here — see TURN below). */
  iceServers: parseIceServers(process.env.ICE_SERVERS),
  /** TURN relay (optional): addresses, and the secret shared with coturn (--static-auth-secret). */
  turnUrls: (process.env.TURN_URLS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  turnSecret: process.env.TURN_SECRET ?? '',
  /** Where the database and uploaded files are stored (a Docker volume in production). */
  dataDir: process.env.DATA_DIR ?? 'data',
  /** Delete spaces nobody entered for this many days. 0 = keep forever (default). */
  retentionDays: Math.max(0, Number(process.env.SPACE_RETENTION_DAYS ?? 0) || 0),
  /** Most spaces kept on disk. Anyone can create a space, so this protects the disk. */
  maxStoredSpaces: Math.max(1, Number(process.env.MAX_STORED_SPACES ?? 1000) || 1000),
  /** Realtime connections open at once from one IP (an office may share one IP). */
  maxConnectionsPerIp: Math.max(1, Number(process.env.MAX_CONNECTIONS_PER_IP ?? 60) || 60),
  /** New spaces one IP may create per hour. */
  maxNewSpacesPerHour: Math.max(1, Number(process.env.MAX_NEW_SPACES_PER_HOUR ?? 20) || 20),
  /**
   * Shared secret CloudFront adds as the header "X-Origin-Secret". When set, requests
   * without it are refused, so nobody can reach the server around CloudFront (and WAF).
   */
  originSecret: process.env.ORIGIN_SECRET ?? '',
  /** Total size of all uploaded files on this server, in MB. */
  maxTotalStorageMb: Math.max(1, Number(process.env.MAX_TOTAL_STORAGE_MB ?? 10240) || 10240),
};

/**
 * STUN servers tell browsers how to reach each other through routers. Format: JSON array, e.g.
 *   [{"urls":"stun:stun.l.google.com:19302"}]
 * Do not put TURN passwords here; use TURN_URLS + TURN_SECRET (temporary passwords per person).
 */
function parseIceServers(raw: string | undefined): unknown[] {
  const fallback = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (!raw) return fallback;
  try {
    const v: unknown = JSON.parse(raw);
    if (Array.isArray(v)) return v;
  } catch {
    // fall through
  }
  console.error('ICE_SERVERS is not a JSON array; using the default STUN server');
  return fallback;
}
