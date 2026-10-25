// View helper: particles and light — confetti for 🎉, sparks for 🔥,
// falling sakura / snow / rain / leaves, and the color of the time of day.

import type { Daylight, Weather } from '../models/SettingsModel.ts';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  spin: number;
}

const PARTY = ['#ff6f59', '#ffc145', '#2ec4a6', '#4d8ff0', '#7b5cd6', '#f08ab0'];
const FIRE = ['#ffc145', '#ff9f43', '#ff6f59', '#fff1a8'];

export class Effects {
  private burst: Particle[] = [];
  private flakes: Particle[] = [];
  private weatherKind: Weather = 'none';

  /** A burst of confetti (or sparks) at a point on the map. */
  confetti(x: number, y: number, kind: 'party' | 'fire'): void {
    const colors = kind === 'fire' ? FIRE : PARTY;
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 140;
      this.burst.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (kind === 'fire' ? 160 : 120),
        life: 0,
        max: 1.2 + Math.random() * 0.8,
        color: colors[i % colors.length]!,
        size: 2 + Math.random() * 3,
        spin: Math.random() * 10,
      });
    }
    if (this.burst.length > 600) this.burst.splice(0, this.burst.length - 600);
  }

  drawWorld(c: CanvasRenderingContext2D, dt: number): void {
    this.burst = this.burst.filter((p) => (p.life += dt) < p.max);
    for (const p of this.burst) {
      p.vy += 260 * dt;
      p.vx *= 0.98;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      c.globalAlpha = Math.max(0, 1 - p.life / p.max);
      c.fillStyle = p.color;
      const w = p.size * Math.abs(Math.cos(p.life * p.spin));
      c.fillRect(p.x - w / 2, p.y - p.size / 2, Math.max(1, w), p.size);
    }
    c.globalAlpha = 1;
  }

  drawWeather(c: CanvasRenderingContext2D, kind: Weather, w: number, h: number, dt: number): void {
    if (kind !== this.weatherKind) {
      this.weatherKind = kind;
      this.flakes = [];
    }
    if (kind === 'none') return;
    const target = kind === 'rain' ? 140 : 70;
    while (this.flakes.length < target) this.flakes.push(this.newFlake(kind, w, h, true));
    for (let i = 0; i < this.flakes.length; i++) {
      const p = this.flakes[i]!;
      p.life += dt;
      p.x += (p.vx + Math.sin(p.life * 2 + p.spin) * (kind === 'rain' ? 0 : 18)) * dt;
      p.y += p.vy * dt;
      if (p.y > h + 10 || p.x < -20 || p.x > w + 20) this.flakes[i] = this.newFlake(kind, w, h, false);
      c.fillStyle = p.color;
      if (kind === 'rain') {
        c.globalAlpha = 0.5;
        c.fillRect(p.x, p.y, 1.5, 10);
      } else if (kind === 'snow') {
        c.globalAlpha = 0.9;
        c.fillRect(p.x, p.y, p.size, p.size);
      } else {
        c.globalAlpha = 0.85;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.life * p.spin * 0.3);
        c.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
        c.restore();
      }
    }
    c.globalAlpha = 1;
  }

  private newFlake(kind: Weather, w: number, h: number, anywhere: boolean): Particle {
    const color =
      kind === 'sakura' ? (Math.random() < 0.5 ? '#ffc8dd' : '#ffafcc') : kind === 'snow' ? '#ffffff' : kind === 'rain' ? '#a9c8ff' : ['#e07a3f', '#d4a72c', '#b5542a'][Math.floor(Math.random() * 3)]!;
    return {
      x: Math.random() * (w + 40) - 20,
      y: anywhere ? Math.random() * h : -10,
      vx: kind === 'rain' ? -40 : 10 + Math.random() * 20,
      vy: kind === 'rain' ? 520 + Math.random() * 200 : 30 + Math.random() * 40,
      life: Math.random() * 10,
      max: 0,
      color,
      size: kind === 'snow' ? 2 + Math.random() * 2 : 2.5 + Math.random() * 1.5,
      spin: Math.random() * 6,
    };
  }

  drawDaylight(c: CanvasRenderingContext2D, mode: Daylight, w: number, h: number): void {
    const phase = mode === 'auto' ? phaseOfDay(new Date().getHours()) : mode;
    if (phase === 'day') return;
    if (phase === 'evening') {
      c.fillStyle = 'rgba(255, 140, 70, 0.14)';
      c.fillRect(0, 0, w, h);
      return;
    }
    // night: dark blue with a soft light in the middle (around me)
    const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, 'rgba(20, 22, 60, 0.12)');
    g.addColorStop(1, 'rgba(20, 22, 60, 0.45)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
}

function phaseOfDay(hour: number): 'day' | 'evening' | 'night' {
  if (hour >= 6 && hour < 16) return 'day';
  if (hour >= 16 && hour < 19) return 'evening';
  return 'night';
}
