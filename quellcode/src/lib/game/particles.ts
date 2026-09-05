/**
 * RING RUSH — Partikelsystem (Canvas-Overlay)
 * Leichte, additive Partikel für Press-Bursts und Effekte.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

export class ParticleSystem {
  private ctx: CanvasRenderingContext2D;
  private parts: Particle[] = [];
  private w = 0;
  private h = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D-Kontext nicht verfügbar");
    this.ctx = ctx;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  burst(x: number, y: number, colors: string[], count = 24, power = 1): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (110 + Math.random() * 280) * power;
      const max = 480 + Math.random() * 480;
      this.parts.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 70,
        life: max,
        max,
        size: 1.6 + Math.random() * 3.4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    if (this.parts.length > 600) {
      this.parts.splice(0, this.parts.length - 600);
    }
  }

  clear(): void {
    this.parts = [];
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  /** Pro Frame aufrufen; dt in Millisekunden. */
  frame(dt: number): void {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    if (this.parts.length === 0) return;
    const s = Math.min(dt, 100) / 1000;
    c.globalCompositeOperation = "lighter";
    const next: Particle[] = [];
    for (const p of this.parts) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += 540 * s;
      p.x += p.vx * s;
      p.y += p.vy * s;
      const a = Math.max(0, p.life / p.max);
      c.globalAlpha = a;
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.size * (0.35 + a * 0.65), 0, Math.PI * 2);
      c.fill();
      next.push(p);
    }
    this.parts = next;
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  }
}

/* ============================================================
   Feuerwerk — für das Happy-End-Spezial
   Raketen steigen auf, explodieren in Funkenwolken mit Halo.
   ============================================================ */

interface Rocket {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  targetY: number;
  color: string;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  twinkle: number;
}

interface Halo {
  x: number;
  y: number;
  life: number;
  max: number;
  color: string;
}

export interface FireworksOpts {
  onExplode?: (x: number, y: number) => void;
}

export class Fireworks {
  private ctx: CanvasRenderingContext2D;
  private rockets: Rocket[] = [];
  private sparks: Spark[] = [];
  private halos: Halo[] = [];
  private raf = 0;
  private w = 0;
  private h = 0;
  private running = false;
  private lastTs = 0;
  private launchTimer = 1400; // erste Dauer-Schüsse nach der Eröffnungssalve
  private palette = [
    "#ffd23f",
    "#ff2fb3",
    "#22e4ff",
    "#a855f7",
    "#ffffff",
    "#ff8a00",
    "#39ff88",
  ];

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: FireworksOpts = {}
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D-Kontext nicht verfügbar");
    this.ctx = ctx;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Startet die Show inkl. Eröffnungssalve. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = 0;
    for (let i = 0; i < 5; i++) {
      window.setTimeout(() => {
        if (this.running) this.launch();
      }, i * 260);
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.rockets = [];
    this.sparks = [];
    this.halos = [];
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  private launch(): void {
    const x = this.w * (0.12 + Math.random() * 0.76);
    const targetY = this.h * (0.14 + Math.random() * 0.34);
    const vy = -Math.sqrt(
      Math.max(160, 2 * 460 * Math.max(60, this.h - targetY))
    );
    const color =
      this.palette[Math.floor(Math.random() * this.palette.length)];
    this.rockets.push({
      x,
      y: this.h + 6,
      px: x,
      py: this.h + 6,
      vx: (Math.random() - 0.5) * 60,
      vy,
      targetY,
      color,
    });
  }

  private explode(x: number, y: number, color: string): void {
    const n = 70 + Math.floor(Math.random() * 50);
    const twoTone = Math.random() < 0.5;
    const alt = this.palette[Math.floor(Math.random() * this.palette.length)];
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * Math.random() * 330;
      const max = 900 + Math.random() * 1100;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: max,
        max,
        size: 1.4 + Math.random() * 2.6,
        color: twoTone && i % 2 === 0 ? alt : color,
        twinkle: 0.02 + Math.random() * 0.05,
      });
    }
    this.halos.push({ x, y, life: 300, max: 300, color });
    if (this.sparks.length > 900) {
      this.sparks.splice(0, this.sparks.length - 900);
    }
    this.opts.onExplode?.(x, y);
  }

  private loop = (ts: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.lastTs ? ts - this.lastTs : 16, 100);
    this.lastTs = ts;
    const s = dt / 1000;
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    c.globalCompositeOperation = "lighter";

    // Nachschub im steadigen Rhythmus
    this.launchTimer -= dt;
    if (this.launchTimer <= 0) {
      this.launch();
      if (Math.random() < 0.35) this.launch();
      this.launchTimer = 480 + Math.random() * 620;
    }

    // Raketen
    const nextRockets: Rocket[] = [];
    for (const r of this.rockets) {
      r.px = r.x;
      r.py = r.y;
      r.vy += 460 * s;
      r.x += r.vx * s;
      r.y += r.vy * s;
      c.globalAlpha = 0.9;
      c.strokeStyle = r.color;
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(r.px, r.py);
      c.lineTo(r.x, r.y);
      c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(r.x, r.y, 2.1, 0, Math.PI * 2);
      c.fill();
      if (r.vy > -60 || r.y <= r.targetY) {
        this.explode(r.x, r.y, r.color);
      } else {
        nextRockets.push(r);
      }
    }
    this.rockets = nextRockets;

    // Explosions-Halos
    const nextHalos: Halo[] = [];
    for (const f of this.halos) {
      f.life -= dt;
      if (f.life <= 0) continue;
      const t = 1 - f.life / f.max;
      c.globalAlpha = (1 - t) * 0.35;
      c.strokeStyle = f.color;
      c.lineWidth = 2 + 14 * t;
      c.beginPath();
      c.arc(f.x, f.y, 8 + 90 * t, 0, Math.PI * 2);
      c.stroke();
      nextHalos.push(f);
    }
    this.halos = nextHalos;

    // Funken
    const nextSparks: Spark[] = [];
    for (const p of this.sparks) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += 190 * s;
      const drag = Math.exp(-0.9 * s);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * s;
      p.y += p.vy * s;
      const a = Math.max(0, p.life / p.max);
      const tw = 0.75 + 0.25 * Math.sin(p.life * p.twinkle);
      c.globalAlpha = a * tw;
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2);
      c.fill();
      nextSparks.push(p);
    }
    this.sparks = nextSparks;

    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  };
}
