// Limits per client IP address, so one person cannot use up the server:
//   - how many realtime connections can be open at the same time
//   - how many NEW spaces can be created per hour
// Note: people in the same office often share one public IP, so the defaults
// are generous (see MAX_CONNECTIONS_PER_IP / MAX_NEW_SPACES_PER_HOUR).

import type { IncomingHttpHeaders } from 'node:http';

/**
 * The visitor's IP. Behind CloudFront/ALB (trustProxy), the proxy appends the real
 * address as the LAST entry of X-Forwarded-For; earlier entries can be faked by the client.
 */
export function clientIp(headers: IncomingHttpHeaders, remote: string | undefined, trustProxy: boolean): string {
  if (trustProxy) {
    const fwd = headers['x-forwarded-for'];
    const list = (Array.isArray(fwd) ? fwd.join(',') : (fwd ?? '')).split(',').map((s) => s.trim()).filter(Boolean);
    const last = list[list.length - 1];
    if (last) return limitKey(last);
  }
  return limitKey(remote ?? 'unknown');
}

/**
 * The key used for per-IP limits. One home or office usually gets a whole IPv6 /64
 * (billions of addresses), so IPv6 is counted per /64; IPv4-mapped IPv6 becomes plain IPv4.
 */
export function limitKey(ip: string): string {
  const v4 = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4) return v4[1]!;
  if (!ip.includes(':')) return ip;
  const [head = '', tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left;
  return `${groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(':')}::/64`;
}

export class IpLimits {
  private readonly open = new Map<string, number>();
  private readonly created = new Map<string, { count: number; since: number }>();
  private readonly maxConnections: number;
  private readonly maxNewSpacesPerHour: number;

  constructor(maxConnections: number, maxNewSpacesPerHour: number) {
    this.maxConnections = maxConnections;
    this.maxNewSpacesPerHour = maxNewSpacesPerHour;
  }

  /** Call when a connection opens. False = too many from this IP (refuse it). */
  connect(ip: string): boolean {
    const n = this.open.get(ip) ?? 0;
    if (n >= this.maxConnections) return false;
    this.open.set(ip, n + 1);
    return true;
  }

  disconnect(ip: string): void {
    const n = (this.open.get(ip) ?? 1) - 1;
    if (n <= 0) this.open.delete(ip);
    else this.open.set(ip, n);
  }

  /** Call before creating a new space. False = this IP created too many in the last hour. */
  allowNewSpace(ip: string, now = Date.now()): boolean {
    const hour = 60 * 60 * 1000;
    if (this.created.size > 10_000) for (const [k, v] of this.created) if (now - v.since > hour) this.created.delete(k);
    let w = this.created.get(ip);
    if (!w || now - w.since > hour) this.created.set(ip, (w = { count: 0, since: now }));
    if (w.count >= this.maxNewSpacesPerHour) return false;
    w.count++;
    return true;
  }
}
