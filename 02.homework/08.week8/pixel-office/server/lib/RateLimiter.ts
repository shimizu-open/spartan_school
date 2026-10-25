/** Token bucket: allows `perSecond` events on average, with bursts up to `burst`. */
export class RateLimiter {
  private tokens: number;
  private last = Date.now();
  private readonly perSecond: number;
  private readonly burst: number;

  constructor(perSecond: number, burst: number) {
    this.perSecond = perSecond;
    this.burst = burst;
    this.tokens = burst;
  }

  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.perSecond);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
