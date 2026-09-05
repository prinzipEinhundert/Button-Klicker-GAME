/**
 * RING RUSH — Spielkonfiguration & Balance
 *
 * Kernregel pro Press:
 *   Basis         = floor(abgelaufener Anteil des Timers in %)
 *   multipliziert = Basis × Boost                  (gekaufter Punkte-Boost)
 *   Gedulds-Bonus = multipliziert / 100            (1 % der multiplizierten Punkte)
 *   Endpunkte     = multipliziert × Gedulds-Bonus  = (Basis × Boost)² / 100
 *   maxTime (z.B. 30s) -> 0 %  -> 0 Punkte
 *   0s verbleibend     -> 100 % -> Boost × 100 × Boost (bzw. Game Over / Phönix)
 *
 * Bei Game Over (Ring leer, kein Phönix) werden ALLE Werte zurückgesetzt —
 * nur der Rekord (best) bleibt erhalten.
 *
 * Zeit-Chip (invertiert): verkürzt die Max-Zeit Stufe für Stufe (30s -> 4s).
 *   Weniger Zeit = Prozent füllen sich schneller = mehr Punkte pro Sekunde,
 *   aber der Ring läuft auch schneller leer — Risk & Reward.
 */

export const BASE_TIME = 30; // Sekunden, Max-Zeit bei Stufe 0
export const TIME_PER_LEVEL = 2; // −2s pro Zeit-Chip-Stufe
export const MIN_TIME = 4; // hartes Minimum
export const MAX_LEVEL = 13; // 30 − 13×2 = 4s
export const BOOST_START = 1; // Punkte-Boost startet bei ×1
export const BOOST_MAX = 10; // Punkte-Boost endet bei ×10
export const OD_MULT = 3; // Overdrive: Timer tickt 3x schneller beim Halten
export const OD_COST = 1000; // Overdrive, einmalig
export const PHOENIX_COST = 5000; // Zweite Chance, einmalig
export const HAPPY_END_COST = 25000; // Happy-End-Spezial, einmalig
export const SAVE_KEY = "ring-rush-save-v2"; // v2: neues Balancing (30s→4s, Boost, Happy End) — bewusster Neustart

/** Maximale Timer-Zeit für eine gegebene Zeit-Chip-Stufe (30s → 4s) */
export const maxTimeFor = (level: number): number =>
  Math.max(MIN_TIME, BASE_TIME - level * TIME_PER_LEVEL);

/** Kosten für den nächsten Zeit-Chip (aktuelle Stufe -> +1) */
export const chipCostFor = (level: number): number =>
  Math.round((80 * Math.pow(1.42, level)) / 10) * 10;

/** Multiplikator für eine Boost-Stufe (Stufe 1 = ×1 … Stufe 10 = ×10) */
export const boostMultFor = (level: number): number =>
  Math.max(BOOST_START, Math.min(BOOST_MAX, level));

/**
 * Gedulds-Multiplikator & Endpunktzahl eines Press.
 *
 * multiplizierte Punkte = floor(%) × Boost
 * Gedulds-Multiplikator = multiplizierte Punkte / 100
 *   (348 multiplizierte Punkte → ×3,48 · 672 → ×6,72 · 1 → ×0,01)
 * Endpunkte = multiplizierte Punkte × Gedulds-Multiplikator
 *
 * Beispiele: 87 % × Boost 4 → 348 → ×3,48 → 1.211 P
 *            96 % × Boost 7 → 672 → ×6,72 → 4.516 P
 */
export const pressScoreFor = (basePct: number, boost: number): number => {
  const multiplied = Math.max(0, Math.floor(basePct)) * Math.max(1, boost);
  return Math.round(multiplied * (multiplied / 100));
};

/** Kosten für die nächste Boost-Stufe (aktuelle Stufe -> +1) */
export const boostCostFor = (level: number): number =>
  Math.round((250 * Math.pow(1.75, Math.max(1, level) - 1)) / 50) * 50;

export interface SaveData {
  wallet: number;
  best: number;
  timeLevel: number;
  boostLevel: number;
  overdrive: boolean;
  phoenix: boolean;
  phoenixEverUsed: boolean;
  happyEnd: boolean;
  soundOn: boolean;
}

export const DEFAULT_SAVE: SaveData = {
  wallet: 0,
  best: 0,
  timeLevel: 0,
  boostLevel: BOOST_START,
  overdrive: false,
  phoenix: false,
  phoenixEverUsed: false,
  happyEnd: false,
  soundOn: true,
};

export function loadSave(): SaveData {
  if (typeof window === "undefined") return { ...DEFAULT_SAVE };
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      wallet: Number.isFinite(parsed.wallet) ? Number(parsed.wallet) : 0,
      best: Number.isFinite(parsed.best) ? Number(parsed.best) : 0,
      timeLevel: Number.isFinite(parsed.timeLevel)
        ? Math.max(0, Math.min(MAX_LEVEL, Number(parsed.timeLevel)))
        : 0,
      boostLevel: Number.isFinite(parsed.boostLevel)
        ? Math.max(BOOST_START, Math.min(BOOST_MAX, Number(parsed.boostLevel)))
        : BOOST_START,
      overdrive: Boolean(parsed.overdrive),
      phoenix: Boolean(parsed.phoenix),
      phoenixEverUsed: Boolean(parsed.phoenixEverUsed),
      happyEnd: Boolean(parsed.happyEnd),
      soundOn: parsed.soundOn !== false,
    };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function persistSave(data: SaveData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* Speicher nicht verfügbar — Spiel läuft trotzdem */
  }
}
