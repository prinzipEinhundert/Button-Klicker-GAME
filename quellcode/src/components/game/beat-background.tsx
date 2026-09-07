"use client";

/**
 * RING RUSH — Beat-Hintergrund
 *
 * Vollflächiges Canvas hinter dem Spiel:
 *  - Sterne fliegen vom Zentrum nach außen, werden dabei größer und
 *    heller — jede mit eigener Größe, Geschwindigkeit und eigenem
 *    Zitter-Rhythmus. Im Takt der Musik zittern sie stärker (Puls aus
 *    der Musik-Engine) und bekommen Schwung.
 *  - Sanfte, sehr transparente Blasen steigen auf und wiegen sich —
 *    vertikal exakt zum Beat (bob), mit individuellem Ausmaß.
 *  - Auf jeden erkannten Kick läuft eine dezente Schockwelle nach außen.
 *  - Zentrum-Glühen atmet mit dem Takt.
 *
 * Ohne laufende Musik läuft alles auf einem sanften 84-BPM-Grid weiter.
 */

import { useEffect, useRef } from "react";
import { music } from "@/lib/game/music";

const STAR_RGB: Array<[number, number, number]> = [
  [255, 255, 255], // weiß
  [125, 249, 255], // cyan
  [192, 179, 255], // violett
  [255, 217, 242], // rosa
  [255, 233, 168], // warmgold
];

/** Weich leuchtendes Glühpunkt-Sprite vorrendern (schnell im Draw). */
function makeGlow(r: number, g: number, b: number, size = 64): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    );
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.3, `rgba(${r},${g},${b},0.5)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  return c;
}

interface Star {
  a: number; // Winkel
  d: number; // Abstand vom Zentrum
  sp: number; // Radialgeschwindigkeit px/s
  base: number; // Grundgröße
  ci: number; // Farbindex
  ph: number; // Zitter-Phase
  tf: number; // Zitter-Frequenz (Hz)
  ta: number; // Zitter-Amplitude px
  twf: number; // Funkel-Frequenz
  twp: number; // Funkel-Phase
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
  amp: number; // Wiegen-Amplitude
  sf: number; // Wiege-Frequenz (Hz)
  ph: number;
  k: number; // individuelle Beat-Empfindlichkeit
}

interface Wave {
  r: number;
  alpha: number;
}

export default function BeatBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mot = reduced ? 0.35 : 1; // Bewegungs-Faktor

    const sprites = STAR_RGB.map(([r, g, b]) => makeGlow(r, g, b));
    const bubbleGlow = makeGlow(150, 210, 255);

    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let bubbles: Bubble[] = [];
    const waves: Wave[] = [];
    let lastPulse = 0;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const spawnStar = (dist?: number): Star => ({
      a: Math.random() * Math.PI * 2,
      d: dist ?? Math.random() * 26,
      sp: rand(9, 42),
      base: rand(0.7, 2.3),
      ci: Math.random() < 0.4 ? 1 : Math.floor(Math.random() * STAR_RGB.length),
      ph: Math.random() * Math.PI * 2,
      tf: rand(3.2, 9.5),
      ta: rand(1.2, 4.6),
      twf: rand(0.6, 2.6),
      twp: Math.random() * Math.PI * 2,
    });

    const spawnBubble = (y?: number): Bubble => ({
      x: Math.random() * w,
      y: y ?? h + rand(20, 160),
      r: rand(20, 62),
      vy: rand(6, 15),
      amp: rand(8, 26),
      sf: rand(0.08, 0.22),
      ph: Math.random() * Math.PI * 2,
      k: rand(0.6, 1.5),
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(150, Math.max(70, (w * h) / 9000)));
      if (stars.length !== n) {
        // Start-Feld vorbefüllen, damit nichts leervorkommt
        const md = Math.hypot(w, h) / 2 + 40;
        stars = Array.from({ length: n }, () =>
          spawnStar(Math.pow(Math.random(), 1.6) * md)
        );
      }
      const bn = w < 640 ? 6 : 9;
      if (bubbles.length !== bn) {
        bubbles = Array.from({ length: bn }, () => spawnBubble(Math.random() * h));
      }
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = 0;
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(last ? ts - last : 16, 100);
      last = ts;
      const ds = dt / 1000;
      const pulse = music.getPulse(dt);
      const beat = music.beatPhase();

      // Kick erkannt -> Schockwelle spawnen
      if (pulse > 0.85 && lastPulse <= 0.85 && waves.length < 3) {
        waves.push({ r: 24, alpha: 0.14 });
      }
      lastPulse = pulse;

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const md = Math.hypot(w, h) / 2 + 40;

      ctx.globalCompositeOperation = "lighter";

      // Zentrum-Glühen atmet mit dem Takt
      const glowR = Math.min(w, h) * (0.3 + pulse * 0.05);
      ctx.globalAlpha = 0.05 + pulse * 0.08;
      ctx.drawImage(sprites[2], cx - glowR, cy - glowR, glowR * 2, glowR * 2);

      // Schockwellen
      const nextWaves: Wave[] = [];
      for (const wv of waves) {
        wv.r += 300 * ds;
        wv.alpha -= dt / 1400;
        if (wv.alpha > 0 && wv.r < md) {
          ctx.globalAlpha = wv.alpha;
          ctx.strokeStyle = "rgba(125,249,255,1)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(cx, cy, wv.r, 0, Math.PI * 2);
          ctx.stroke();
          nextWaves.push(wv);
        }
      }
      waves.length = 0;
      waves.push(...nextWaves);

      // Sterne: vom Zentrum nach außen, wachsen, funkeln, zittern im Takt
      for (const st of stars) {
        st.d += st.sp * ds * (1 + pulse * 1.7) * mot;
        if (st.d > md) {
          Object.assign(st, spawnStar());
          continue;
        }
        const grow = 0.55 + 1.9 * Math.pow(st.d / md, 0.75);
        const r = st.base * grow * 2.6;
        const wob =
          Math.sin(ts * 0.001 * st.tf * 6.283 + st.ph) *
          st.ta *
          (0.22 + pulse * 1.4) *
          mot;
        const tx = Math.cos(st.a + Math.PI / 2);
        const ty = Math.sin(st.a + Math.PI / 2);
        const x = cx + Math.cos(st.a) * st.d + tx * wob;
        const y = cy + Math.sin(st.a) * st.d + ty * wob;
        const tw = 0.72 + 0.28 * Math.sin(ts * 0.001 * st.twf + st.twp);
        const alpha = Math.min(
          0.62,
          (0.1 + 0.34 * (st.d / md)) * tw * (0.78 + 0.5 * pulse)
        );
        ctx.globalAlpha = alpha;
        const sp = sprites[st.ci];
        ctx.drawImage(sp, x - r, y - r, r * 2, r * 2);
      }

      // Sanfte Blasen: steigen, wiegen sich, bobben exakt zum Beat
      ctx.globalCompositeOperation = "source-over";
      for (const b of bubbles) {
        b.y -= b.vy * ds * mot;
        if (b.y < -b.r - 30) Object.assign(b, spawnBubble(h + b.r + rand(10, 90)));
        const sway = Math.sin(ts * 0.001 * b.sf * 6.283 + b.ph) * b.amp * mot;
        const bob =
          Math.sin(beat * 6.283) * 3 * (0.4 + pulse) * b.k * mot;
        const rr = b.r * (1 + 0.045 * pulse * b.k);
        const x = b.x + sway;
        const y = b.y + bob;

        ctx.globalAlpha = 0.045;
        ctx.drawImage(bubbleGlow, x - rr, y - rr, rr * 2, rr * 2);
        ctx.globalAlpha = 0.1 + pulse * 0.06;
        ctx.strokeStyle = "rgba(170,225,255,0.85)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.16 + pulse * 0.08;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(x - rr * 0.32, y - rr * 0.34, Math.max(1.2, rr * 0.07), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[6]"
    />
  );
}
