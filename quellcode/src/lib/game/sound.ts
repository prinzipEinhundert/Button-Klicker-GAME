/**
 * RING RUSH — Sound-Engine
 *
 * Echte SFX von Mixkit (Mixkit Stock SFX Free License, kostenlos auch kommerziell):
 * https://mixkit.co/free-sound-effects/game/
 * Fällt für einzelne Sounds automatisch auf synthetisierte Web-Audio-Klänge zurück,
 * falls ein Sample nicht geladen werden kann.
 */

export type SoundName =
  | "press" // Klick beim Punktedrücken (Pitch steigt mit Punktzahl)
  | "coin" // Münzen / hohe Punktzahl
  | "bonus" // Extra-Bonus
  | "buy" // Kauf im Shop
  | "error" // Kauf nicht möglich
  | "gameover" // Game-Over-Jingle
  | "fail" // Moment des Verlierens
  | "phoenix" // Phönix-Wiederbelebung
  | "tick" // Countdown-Blip
  | "start" // Run-Start
  | "milestone" // 95+ Punkte Press
  | "bling" // Neuer Rekord
  | "heal"; // Auffüllung

const SAMPLE_URLS: Record<SoundName, string> = {
  press: "game/sfx/press.mp3",
  coin: "game/sfx/coin.mp3",
  bonus: "game/sfx/bonus.mp3",
  buy: "game/sfx/buy.mp3",
  error: "game/sfx/error.mp3",
  gameover: "game/sfx/gameover.mp3",
  fail: "game/sfx/fail.mp3",
  phoenix: "game/sfx/phoenix.mp3",
  tick: "game/sfx/tick.mp3",
  start: "game/sfx/start.mp3",
  milestone: "game/sfx/milestone.mp3",
  bling: "game/sfx/bling.mp3",
  heal: "game/sfx/heal.mp3",
};

const DEFAULT_VOL: Record<SoundName, number> = {
  press: 0.9,
  coin: 0.55,
  bonus: 0.6,
  buy: 0.8,
  error: 0.5,
  gameover: 0.85,
  fail: 0.7,
  phoenix: 0.75,
  tick: 0.5,
  start: 0.7,
  milestone: 0.6,
  bling: 0.6,
  heal: 0.55,
};

interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  slideTo?: number;
  delay?: number;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<SoundName, AudioBuffer>();
  private initing = false;
  private od: {
    osc: OscillatorNode;
    lfo: OscillatorNode;
    gain: GainNode;
  } | null = null;
  muted = false;

  /** Muss vom ersten User-Gesture aus aufgerufen werden (Autoplay-Policy). */
  async init(): Promise<void> {
    if (this.ctx || this.initing) {
      await this.ctx?.resume().catch(() => undefined);
      return;
    }
    this.initing = true;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      await this.ctx.resume().catch(() => undefined);
      await Promise.all(
        (Object.keys(SAMPLE_URLS) as SoundName[]).map(async (name) => {
          try {
            const res = await fetch(SAMPLE_URLS[name]);
            if (!res.ok) return;
            const ab = await res.arrayBuffer();
            const buf = await this.ctx!.decodeAudioData(ab);
            this.buffers.set(name, buf);
          } catch {
            /* Sample nicht verfügbar -> Synth-Fallback */
          }
        })
      );
    } catch {
      this.ctx = null;
    } finally {
      this.initing = false;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
    if (m) this.overdriveOff();
  }

  play(name: SoundName, opts: { rate?: number; vol?: number } = {}): void {
    if (!this.ctx || !this.master || this.muted) return;
    const buf = this.buffers.get(name);
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = opts.rate ?? 1;
      const g = this.ctx.createGain();
      g.gain.value = (opts.vol ?? 1) * DEFAULT_VOL[name];
      src.connect(g);
      g.connect(this.master);
      src.start();
    } else {
      this.synthFallback(name, opts);
    }
  }

  /* ---------- Synth-Fallbacks ---------- */

  private tone(freq: number, dur: number, opts: ToneOpts = {}): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, opts.slideTo),
        t0 + dur
      );
    }
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(opts.vol ?? 0.3, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol = 0.3, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  private synthFallback(
    name: SoundName,
    opts: { rate?: number; vol?: number }
  ): void {
    const v = opts.vol ?? 1;
    switch (name) {
      case "press":
        this.tone(520, 0.06, { type: "square", vol: 0.22 * v, slideTo: 300 });
        break;
      case "coin":
        this.tone(990, 0.07, { type: "sine", vol: 0.25 * v });
        this.tone(1320, 0.12, { type: "sine", vol: 0.25 * v, delay: 0.07 });
        break;
      case "buy":
        this.tone(660, 0.09, { type: "triangle", vol: 0.3 * v });
        this.tone(990, 0.16, { type: "triangle", vol: 0.3 * v, delay: 0.09 });
        break;
      case "error":
        this.tone(160, 0.2, { type: "sawtooth", vol: 0.2 * v, slideTo: 110 });
        break;
      case "fail":
        this.noise(0.35, 0.3 * v);
        this.tone(220, 0.4, { type: "sawtooth", vol: 0.22 * v, slideTo: 60 });
        break;
      case "gameover":
        this.tone(300, 0.6, { type: "sawtooth", vol: 0.22 * v, slideTo: 70 });
        break;
      case "phoenix":
        this.tone(380, 0.5, { type: "sine", vol: 0.3 * v, slideTo: 950 });
        this.tone(760, 0.5, { type: "triangle", vol: 0.15 * v, slideTo: 1400 });
        break;
      case "tick":
        this.tone(1000, 0.045, { type: "square", vol: 0.18 * v });
        break;
      case "start":
        this.tone(440, 0.22, { type: "triangle", vol: 0.28 * v, slideTo: 880 });
        break;
      case "milestone":
        this.tone(1200, 0.12, { type: "sine", vol: 0.25 * v });
        this.tone(1600, 0.16, { type: "sine", vol: 0.2 * v, delay: 0.1 });
        break;
      case "bling":
        this.tone(1500, 0.15, { type: "sine", vol: 0.22 * v });
        this.tone(2000, 0.22, { type: "sine", vol: 0.18 * v, delay: 0.12 });
        break;
      case "heal":
        this.tone(500, 0.25, { type: "sine", vol: 0.25 * v, slideTo: 780 });
        break;
      case "bonus":
        this.tone(700, 0.1, { type: "triangle", vol: 0.25 * v });
        this.tone(1050, 0.15, { type: "triangle", vol: 0.25 * v, delay: 0.1 });
        break;
    }
  }

  /* ---------- Spezial-Sounds ---------- */

  /** Overdrive-Brummen, solange der Button gehalten wird. */
  overdriveOn(): void {
    if (!this.ctx || !this.master || this.muted || this.od) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 82;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.09, t0 + 0.15);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 9;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 26;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    lfo.start(t0);
    this.od = { osc, lfo, gain };
  }

  overdriveOff(): void {
    if (!this.ctx || !this.od) return;
    const { osc, lfo, gain } = this.od;
    this.od = null;
    const t0 = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t0);
    gain.gain.setValueAtTime(gain.gain.value, t0);
    gain.gain.linearRampToValueAtTime(0, t0 + 0.2);
    osc.stop(t0 + 0.25);
    lfo.stop(t0 + 0.25);
  }

  /** Herzschlag bei wenig Restzeit. */
  heartbeat(): void {
    this.tone(78, 0.13, { type: "sine", vol: 0.5, slideTo: 44 });
  }
}

/** Singleton-Instanz für das gesamte Spiel. */
export const sound = new SoundEngine();
