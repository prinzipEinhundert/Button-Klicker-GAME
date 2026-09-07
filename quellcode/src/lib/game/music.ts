/**
 * RING RUSH — Musik-Engine
 *
 * Cosy-Chiptune-Loop (84 BPM, 8 Takte — eigener Song, im Projekt generiert):
 * Wird per Web Audio sample-genau geloopt. Ein Analyser überwacht das
 * Bassband (Kick) und erzeugt daraus einen "Puls" (0..1), der die Sterne
 * und Blasen im Hintergrund taktsynchron zittern lässt.
 *
 * Ohne laufende Musik fällt der Puls auf ein sanftes 84-BPM-Grid zurück,
 * damit der Hintergrund auch bei ausgeschalteter Musik lebt.
 *
 * Autoplay-Policy: unlock() muss vom ersten User-Gesture aus aufgerufen
 * werden (macht die Hauptkomponente).
 */

const LOOP_URL = "game/music/ambient-loop.mp3";
export const MUSIC_BPM = 84;
const SPB = 60 / MUSIC_BPM; // Sekunden pro Beat
const LOOP_SEC = 22.857143; // exakte Loop-Länge (1.008.000 Samples @ 44,1 kHz)
const MUSIC_VOL = 0.4;
const FADE_IN_S = 1.4;
const FADE_OUT_S = 0.35;

const MUSIC_KEY = "ring-rush-music-v1";

/** Gespeicherte Musik-Präferenz (Default: an). */
export const loadMusicPref = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(MUSIC_KEY) !== "off";
  } catch {
    return true;
  }
};

export const persistMusicPref = (on: boolean): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUSIC_KEY, on ? "on" : "off");
  } catch {
    /* Speicher nicht verfügbar — Einstellung gilt nur für diese Sitzung */
  }
};

class MusicEngine {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Uint8Array<ArrayBuffer> | null = null;
  private src: AudioBufferSourceNode | null = null;
  private startedAt = 0;
  private startOffset = 0;
  private loading = false;
  private stopTimer = 0;

  private bassEma = 0;
  private lastBeatAt = 0;
  private pulseV = 0;
  private beatCount = 0;

  playing = false;
  enabled = true;

  /** Erster User-Gesture: Kontext + Loop-Puffer aufbauen, ggf. starten. */
  async unlock(): Promise<void> {
    if (this.ctx) {
      await this.ctx.resume().catch(() => undefined);
      this.playIfEnabled();
      return;
    }
    if (this.loading) return;
    this.loading = true;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AC();
      const res = await fetch(LOOP_URL);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        this.buffer = await ctx.decodeAudioData(ab);
      }
      const master = ctx.createGain();
      master.gain.value = 0;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.55;
      const data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      master.connect(analyser);
      analyser.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.analyser = analyser;
      this.data = data;
      await ctx.resume().catch(() => undefined);
    } catch {
      /* Kein Web Audio / Loop nicht geladen — Spiel läuft trotzdem */
      this.ctx = null;
      this.buffer = null;
    } finally {
      this.loading = false;
    }
    this.playIfEnabled();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) {
      void this.ctx?.resume().catch(() => undefined);
      this.playIfEnabled();
    } else {
      this.fadeOut();
    }
  }

  private playIfEnabled(): void {
    if (
      !this.enabled ||
      !this.ctx ||
      !this.master ||
      !this.buffer ||
      this.playing
    )
      return;
    window.clearTimeout(this.stopTimer);
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    src.connect(this.master);
    const offset = this.startOffset % LOOP_SEC;
    src.start(0, offset);
    this.startedAt = ctx.currentTime - offset;
    this.src = src;
    this.playing = true;
    const g = this.master.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(MUSIC_VOL, ctx.currentTime + FADE_IN_S);
  }

  private fadeOut(): void {
    window.clearTimeout(this.stopTimer);
    if (!this.ctx || !this.master || !this.src) return;
    const ctx = this.ctx;
    this.startOffset = this.position();
    const g = this.master.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(0, ctx.currentTime + FADE_OUT_S);
    const src = this.src;
    this.src = null;
    this.stopTimer = window.setTimeout(
      () => {
        try {
          src.stop();
          src.disconnect();
        } catch {
          /* war schon gestoppt */
        }
      },
      FADE_OUT_S * 1000 + 80
    );
    this.playing = false;
  }

  /** Aktuelle Position im Loop (Sekunden), an der Medienzeit orientiert. */
  position(): number {
    if (this.playing && this.ctx) {
      return (this.ctx.currentTime - this.startedAt) % LOOP_SEC;
    }
    return this.startOffset;
  }

  /** Phase innerhalb des aktuellen Beats (0..1) — für weiches Schweben. */
  beatPhase(): number {
    if (this.playing && this.ctx) {
      return (this.position() / SPB) % 1;
    }
    return ((performance.now() / 1000) % SPB) / SPB;
  }

  /** Anzahl erkannter Beats seit Start (für eigene Trigger). */
  get beats(): number {
    return this.beatCount;
  }

  /**
   * Puls 0..1 für die Visualisierung (pro Frame aufrufen, dt in ms).
   * Mit Musik: Bass-Onset-Erkennung — der Kick setzt den Puls auf 1,
   * danach zerfällt er. Ohne Musik: sanftes Grid im Song-Takt.
   */
  getPulse(dtMs: number): number {
    if (this.playing && this.analyser && this.data) {
      this.analyser.getByteFrequencyData(this.data);
      let sum = 0;
      for (let i = 2; i <= 5; i++) sum += this.data[i];
      const bass = sum / (4 * 255);
      this.bassEma +=
        (bass - this.bassEma) * Math.min(1, Math.max(dtMs, 1) / 700);
      const now = performance.now();
      if (
        bass > this.bassEma * 1.32 + 0.015 &&
        bass > 0.1 &&
        now - this.lastBeatAt > 260
      ) {
        this.lastBeatAt = now;
        this.pulseV = 1;
        this.beatCount++;
      }
    } else if (!this.playing) {
      const ph = ((performance.now() / 1000) % SPB) / SPB;
      this.pulseV = Math.max(this.pulseV, Math.pow(1 - ph, 2.6) * 0.34);
    }
    this.pulseV = Math.max(0, this.pulseV - dtMs / 360);
    return this.pulseV;
  }
}

/** Singleton-Instanz für das gesamte Spiel. */
export const music = new MusicEngine();
