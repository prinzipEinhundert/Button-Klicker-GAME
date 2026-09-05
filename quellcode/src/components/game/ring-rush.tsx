"use client";

import { useEffect, useRef, useState } from "react";
import {
  Clock,
  Flame,
  Lock,
  MousePointerClick,
  PartyPopper,
  Pause,
  Play,
  RotateCcw,
  ShoppingCart,
  Timer,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import {
  BASE_TIME,
  BOOST_MAX,
  BOOST_START,
  HAPPY_END_COST,
  MAX_LEVEL,
  OD_COST,
  OD_MULT,
  PHOENIX_COST,
  boostCostFor,
  boostMultFor,
  chipCostFor,
  fmtCH,
  fmtCompact,
  formatTime,
  loadHighscores,
  loadLastName,
  loadSave,
  maxTimeFor,
  persistHighscores,
  persistLastName,
  persistSave,
  pressScoreFor,
  type HighscoreEntry,
} from "@/lib/game/config";
import { sound } from "@/lib/game/sound";
import { Fireworks, ParticleSystem } from "@/lib/game/particles";

/* ---------------- Konstanten ---------------- */

const RING_R = 90;
const RING_C = 2 * Math.PI * RING_R;

type Phase = "idle" | "running" | "gameover";
type FloatKind = "gain" | "hype" | "phoenix";

interface FloatText {
  id: number;
  x: number;
  y: number;
  text: string;
  kind: FloatKind;
}

const HYPES = ["KRASS!", "GEIL!", "KRANK!", "UNGLAUBLICH!", "PERFEKT!", "LETS GO!"];
const COLORS_STD = ["#22e4ff", "#ff2fb3", "#a855f7", "#ffffff"];
const COLORS_HOT = ["#ffd23f", "#ff2fb3", "#ffffff", "#22e4ff"];
const COLORS_PHOENIX = ["#ffb347", "#ff5e00", "#ffd23f", "#ffffff"];
const fmt = (n: number) => n.toLocaleString("de-DE");

/** Dynamische Textgröße: je länger die Zahl, desto kleiner der Font */
const sizeFor = (txt: string): string => {
  const len = txt.length;
  if (len <= 3) return "text-7xl sm:text-8xl";
  if (len <= 5) return "text-6xl sm:text-7xl";
  if (len <= 7) return "text-5xl sm:text-6xl";
  return "text-4xl sm:text-5xl";
};
const PCT_SIZES = [
  "text-7xl sm:text-8xl",
  "text-6xl sm:text-7xl",
  "text-5xl sm:text-6xl",
  "text-4xl sm:text-5xl",
];

/* ---------------- Kleine UI-Bausteine ---------------- */

function Coin({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`coin inline-flex shrink-0 items-center justify-center rounded-full font-display font-black text-black ${
        small ? "h-6 w-6 text-xs" : "h-9 w-9 text-sm"
      }`}
    >
      P
    </span>
  );
}

function Chip({
  icon,
  label,
  tint,
  locked,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tint: "cyan" | "emerald" | "rose" | "violet" | "gold";
  locked?: boolean;
  onClick: () => void;
}) {
  const tints = {
    cyan: "border-cyan-400/30 text-cyan-200",
    emerald: "border-emerald-400/30 text-emerald-200",
    rose: "border-rose-400/30 text-rose-200",
    violet: "border-violet-400/30 text-violet-200",
    gold: "border-amber-400/30 text-amber-200",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border bg-black/40 px-4 py-2 text-xs font-bold tracking-wider backdrop-blur-sm transition active:scale-95 sm:text-sm ${
        locked ? "border-white/10 text-white/35" : tints[tint]
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  const shown = typeof value === "number" ? fmtCompact(value) : value;
  return (
    <div className="rounded-2xl bg-white/5 p-3">
      <div className="font-display text-xl font-bold text-white tabular-nums">
        {shown}
      </div>
      <div className="mt-1 text-[10px] tracking-[0.18em] text-white/45">
        {label}
      </div>
    </div>
  );
}

/* ---------------- Shop-Karte (mobil gestapelt, Desktop wie bisher) ---------------- */

function ShopCard({
  shake,
  icon,
  iconClass,
  title,
  badge,
  badgeClass,
  desc,
  children,
  action,
}: {
  shake: boolean;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  badge: string;
  badgeClass: string;
  desc: React.ReactNode;
  children?: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center sm:flex-row sm:gap-4 sm:text-left ${
        shake ? "card-shake" : ""
      }`}
    >
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
      >
        {icon}
      </div>
      <div className="w-full min-w-0 flex-1">
        <span className="block text-base font-bold text-white sm:inline">
          {title}
        </span>
        <span
          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider sm:ml-2 sm:mt-0 ${badgeClass}`}
        >
          {badge}
        </span>
        <p className="mt-1 text-sm leading-snug text-white/60">{desc}</p>
        {children}
      </div>
      <div className="w-full sm:w-auto">{action}</div>
    </div>
  );
}

/* ---------------- Hauptkomponente ---------------- */

export default function RingRush() {
  /* Persistente Fortschritts-Daten */
  const [wallet, setWallet] = useState(0);
  const [best, setBest] = useState(0);
  const [timeLevel, setTimeLevel] = useState(0);
  const [overdrive, setOverdrive] = useState(false);
  const [phoenix, setPhoenix] = useState(false);
  const [boostLevel, setBoostLevel] = useState(BOOST_START);
  const [phoenixEverUsed, setPhoenixEverUsed] = useState(false);
  const [happyEnd, setHappyEnd] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [highscores, setHighscores] = useState<HighscoreEntry[]>([]);
  const [happyTime, setHappyTime] = useState(0);
  const [lastName, setLastName] = useState("");
  const [loaded, setLoaded] = useState(false);

  /* Run-Daten */
  const [phase, setPhase] = useState<Phase>("idle");
  const [runScore, setRunScore] = useState(0);
  const [presses, setPresses] = useState(0);
  const [bestPress, setBestPress] = useState(0);
  const [phoenixUsed, setPhoenixUsed] = useState(false);
  const [happyShow, setHappyShow] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | "GO" | null>(null);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [holding, setHolding] = useState(false);
  const [shake, setShake] = useState(false);
  const [shakeItem, setShakeItem] = useState<string | null>(null);
  const [flashKind, setFlashKind] = useState<"gold" | "red" | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  const maxTime = maxTimeFor(timeLevel);
  const boostMult = boostMultFor(boostLevel);
  const chipCost = timeLevel < MAX_LEVEL ? chipCostFor(timeLevel) : null;
  const boostCost = boostLevel < BOOST_MAX ? boostCostFor(boostLevel) : null;
  const canAffordAny =
    (chipCost !== null && wallet >= chipCost) ||
    (boostCost !== null && wallet >= boostCost) ||
    (!overdrive && wallet >= OD_COST) ||
    (!phoenix && wallet >= PHOENIX_COST) ||
    (!happyEnd && phoenixEverUsed && wallet >= HAPPY_END_COST);

  /* Refs für den Game-Loop (verhindert Re-Renders pro Frame) */
  const remainingRef = useRef(BASE_TIME);
  const lastTsRef = useRef(0);
  const holdingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const pausedRef = useRef(true);
  const tickRef = useRef(0);
  const floatIdRef = useRef(0);
  const cdTimersRef = useRef<number[]>([]);
  const runScoreRef = useRef(0);
  const bestRef = useRef(0);
  const runElapsedRef = useRef(0);
  const pctSizeRef = useRef(-1);
  const psRef = useRef<ParticleSystem | null>(null);

  const cfgRef = useRef({
    maxTime,
    boostMult,
    overdrive,
    phoenix,
    phoenixUsed,
    phase,
    shopOpen,
  });
  useEffect(() => {
    cfgRef.current = {
      maxTime,
      boostMult,
      overdrive,
      phoenix,
      phoenixUsed,
      phase,
      shopOpen,
    };
  }, [maxTime, boostMult, overdrive, phoenix, phoenixUsed, phase, shopOpen]);
  useEffect(() => {
    runScoreRef.current = runScore;
  }, [runScore]);
  useEffect(() => {
    bestRef.current = best;
  }, [best]);

  /* DOM-Refs für Frame-Updates ohne Re-Render */
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const pctRef = useRef<HTMLDivElement>(null);
  const secRef = useRef<HTMLDivElement>(null);
  const multRef = useRef<HTMLSpanElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ---------------- Persistenz ---------------- */

  useEffect(() => {
    // verzögert laden (nicht synchron im Effect), damit SSR-Hydration sauber bleibt
    const t = window.setTimeout(() => {
      const s = loadSave();
      setWallet(s.wallet);
      setBest(s.best);
      setTimeLevel(s.timeLevel);
      setOverdrive(s.overdrive);
      setPhoenix(s.phoenix);
      setBoostLevel(s.boostLevel);
      setPhoenixEverUsed(s.phoenixEverUsed);
      setHappyEnd(s.happyEnd);
      setSoundOn(s.soundOn);
      setHighscores(loadHighscores());
      setLastName(loadLastName());
      remainingRef.current = maxTimeFor(s.timeLevel);
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    persistSave({
      wallet,
      best,
      timeLevel,
      boostLevel,
      overdrive,
      phoenix,
      phoenixEverUsed,
      happyEnd,
      soundOn,
    });
  }, [
    loaded,
    wallet,
    best,
    timeLevel,
    boostLevel,
    overdrive,
    phoenix,
    phoenixEverUsed,
    happyEnd,
    soundOn,
  ]);

  useEffect(() => {
    sound.setMuted(!soundOn);
  }, [soundOn]);

  /* ---------------- Hilfsfunktionen ---------------- */

  const btnCenter = () => {
    const r = btnRef.current?.getBoundingClientRect();
    return r
      ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  };

  const addFloat = (x: number, y: number, text: string, kind: FloatKind) => {
    const id = ++floatIdRef.current;
    setFloats((f) => [...f.slice(-14), { id, x, y, text, kind }]);
    window.setTimeout(
      () => setFloats((f) => f.filter((t) => t.id !== id)),
      1100
    );
  };

  const triggerFlash = (kind: "gold" | "red") => {
    setFlashKind(kind);
    setFlashKey((k) => k + 1);
    window.setTimeout(() => setFlashKind(null), 750);
  };

  const cancelHoldState = () => {
    holdingRef.current = false;
    pointerIdRef.current = null;
    sound.overdriveOff();
    setHolding(false);
  };

  const clearCd = () => {
    cdTimersRef.current.forEach((t) => window.clearTimeout(t));
    cdTimersRef.current = [];
  };

  const collect = (
    pts: number,
    pct: number,
    kind: "gain" | "phoenix",
    x: number,
    y: number,
    patienceMult?: number
  ) => {
    setWallet((w) => w + pts);
    setRunScore((s) => s + pts);
    setPresses((p) => p + 1);
    setBestPress((b) => Math.max(b, pts));
    const multStr =
      kind === "gain" && typeof patienceMult === "number"
        ? ` · ×${patienceMult.toLocaleString("de-DE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : "";
    addFloat(
      x,
      y - 12,
      kind === "phoenix"
        ? `+${fmtCompact(pts)} PHÖNIX`
        : `+${fmtCompact(pts)}${multStr}`,
      kind === "phoenix" ? "phoenix" : "gain"
    );
    if (kind === "phoenix") {
      sound.play("phoenix");
      psRef.current?.burst(x, y, COLORS_PHOENIX, 64, 1.4);
    } else if (pct >= 95) {
      addFloat(x, y - 110, HYPES[Math.floor(Math.random() * HYPES.length)], "hype");
      sound.play("milestone");
      sound.play("coin", { vol: 0.5 });
      psRef.current?.burst(x, y, COLORS_HOT, 46, 1.25);
    } else if (pct >= 80) {
      sound.play("coin", { vol: 0.8 });
      psRef.current?.burst(x, y, COLORS_STD, 34, 1.1);
    } else {
      sound.play("press", { rate: 0.8 + (pct / 100) * 0.9, vol: 0.95 });
      psRef.current?.burst(x, y, COLORS_STD, Math.max(10, Math.round(pct / 3) + 8), 0.9);
    }
  };

  /* ---------------- Kern-Aktionen ---------------- */

  const doGameOver = () => {
    pausedRef.current = true;
    cancelHoldState();
    /* Verlust: Punkte verfallen komplett — nichts zählen, nichts speichern */
    setWallet(0);
    setTimeLevel(0);
    setBoostLevel(BOOST_START);
    setOverdrive(false);
    setPhoenix(false);
    setPhoenixEverUsed(false);
    setHappyEnd(false);
    remainingRef.current = maxTimeFor(0);
    tickRef.current = 0;
    setPhase("gameover");
    triggerFlash("red");
    setShake(true);
    window.setTimeout(() => setShake(false), 600);
    sound.play("fail");
    window.setTimeout(() => sound.play("gameover"), 380);
  };

  const expireRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    expireRef.current = () => {
      const cfg = cfgRef.current;
      cancelHoldState();
      if (cfg.phoenix && !cfg.phoenixUsed) {
        setPhoenixUsed(true);
        setPhoenixEverUsed(true);
        remainingRef.current = cfg.maxTime;
        tickRef.current = 0;
        triggerFlash("gold");
        const { x, y } = btnCenter();
        collect(pressScoreFor(100, cfg.boostMult), 100, "phoenix", x, y);
      } else {
        doGameOver();
      }
    };
  });

  const endHoldRef = useRef<(e?: React.PointerEvent) => void>(() => undefined);

  const beginHold = (e?: React.PointerEvent) => {
    void sound.init();
    const cfg = cfgRef.current;
    if (cfg.phase !== "running" || pausedRef.current) return;
    if (holdingRef.current) return;
    if (e && btnRef.current) {
      try {
        btnRef.current.setPointerCapture(e.pointerId);
      } catch {
        /* Capture nicht möglich — Window-Listener fängt das Release */
      }
    }
    pointerIdRef.current = e ? e.pointerId : -1;
    holdingRef.current = true;
    setHolding(true);
    if (cfg.overdrive) sound.overdriveOn();
  };

  const endHold = (e?: React.PointerEvent) => {
    if (!holdingRef.current) return;
    if (e && pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current)
      return;
    cancelHoldState();
    const cfg = cfgRef.current;
    if (cfg.phase !== "running" || pausedRef.current) return;
    const elapsedPct = (1 - remainingRef.current / cfg.maxTime) * 100;
    const pct = Math.max(0, Math.min(100, Math.floor(elapsedPct)));
    remainingRef.current = cfg.maxTime;
    tickRef.current = 0;
    const { x, y } = btnCenter();
    collect(
      pressScoreFor(pct, cfg.boostMult),
      pct,
      "gain",
      x,
      y,
      (pct * cfg.boostMult) / 100
    );
  };
  useEffect(() => {
    endHoldRef.current = endHold;
  });

  const runCountdown = (done: () => void) => {
    clearCd();
    pausedRef.current = true;
    holdingRef.current = false;
    pointerIdRef.current = null;
    setCountdown(3);
    sound.play("tick", { rate: 1.1, vol: 0.8 });
    const seq = (n: number) => {
      const t = window.setTimeout(() => {
        if (n <= 1) {
          setCountdown("GO");
          sound.play("tick", { rate: 1.9, vol: 0.9 });
          const t2 = window.setTimeout(() => {
            setCountdown(null);
            done();
          }, 380);
          cdTimersRef.current.push(t2);
        } else {
          sound.play("tick", { rate: 1.1 + (3 - n) * 0.18, vol: 0.8 });
          setCountdown(n - 1);
          seq(n - 1);
        }
      }, 520);
      cdTimersRef.current.push(t);
    };
    seq(3);
  };

  const startRun = () => {
    void sound.init();
    setRunScore(0);
    runScoreRef.current = 0;
    setPresses(0);
    setBestPress(0);
    setPhoenixUsed(false);
    setFloats([]);
    runElapsedRef.current = 0;
    remainingRef.current = maxTimeFor(timeLevel);
    tickRef.current = 0;
    psRef.current?.clear();
    setPhase("running");
    runCountdown(() => {
      pausedRef.current = false;
      lastTsRef.current = 0;
      sound.play("start");
    });
  };

  const openShop = () => {
    void sound.init();
    sound.play("tick", { rate: 1.3, vol: 0.6 });
    cancelHoldState();
    clearCd();
    setCountdown(null);
    pausedRef.current = true;
    setShopOpen(true);
  };

  const closeShop = () => {
    setShopOpen(false);
    if (cfgRef.current.phase === "running") {
      runCountdown(() => {
        pausedRef.current = false;
        lastTsRef.current = 0;
      });
    }
  };

  const deny = (id: string) => {
    sound.play("error");
    setShakeItem(id);
    window.setTimeout(
      () => setShakeItem((s) => (s === id ? null : s)),
      480
    );
  };

  const buyChip = () => {
    if (timeLevel >= MAX_LEVEL) return;
    const cost = chipCostFor(timeLevel);
    if (wallet < cost) {
      deny("chip");
      return;
    }
    const nl = Math.min(MAX_LEVEL, timeLevel + 1);
    setWallet((w) => w - cost);
    setTimeLevel(nl);
    remainingRef.current = maxTimeFor(nl);
    sound.play("buy");
    sound.play("heal", { vol: 0.5 });
  };

  const buyOverdrive = () => {
    if (overdrive) return;
    if (wallet < OD_COST) {
      deny("od");
      return;
    }
    setWallet((w) => w - OD_COST);
    setOverdrive(true);
    sound.play("buy");
    sound.play("bonus", { vol: 0.6 });
  };

  const buyPhoenix = () => {
    if (phoenix) return;
    if (wallet < PHOENIX_COST) {
      deny("phoenix");
      return;
    }
    setWallet((w) => w - PHOENIX_COST);
    setPhoenix(true);
    sound.play("buy");
    sound.play("phoenix", { vol: 0.5 });
  };

  const buyBoost = () => {
    if (boostLevel >= BOOST_MAX) return;
    const cost = boostCostFor(boostLevel);
    if (wallet < cost) {
      deny("boost");
      return;
    }
    setWallet((w) => w - cost);
    setBoostLevel((b) => Math.min(BOOST_MAX, b + 1));
    sound.play("buy");
    sound.play("coin", { vol: 0.7 });
  };

  const buyHappyEnd = () => {
    if (happyEnd) return;
    if (!phoenixEverUsed || wallet < HAPPY_END_COST) {
      deny("happy");
      return;
    }
    setWallet((w) => w - HAPPY_END_COST);
    setHappyEnd(true);
    /* Run abgeschlossen: Punkte zählen — Bestleistung & Zeit erfassen */
    setBest((b) => Math.max(b, runScoreRef.current));
    setHappyTime(runElapsedRef.current);
    setShopOpen(false);
    setHappyShow(true);
    cancelHoldState();
    clearCd();
    setCountdown(null);
    pausedRef.current = true;
    sound.play("buy");
    sound.play("phoenix", { vol: 0.9 });
  };

  /** Happy-End-Run in die Bestenliste eintragen (persistiert) */
  const submitHighscore = (rawName: string): HighscoreEntry => {
    const name = (rawName.trim() || "SPIELER").slice(0, 10).toUpperCase();
    const entry: HighscoreEntry = {
      name,
      time: happyTime,
      points: runScoreRef.current,
      ts: Date.now(),
    };
    setHighscores((prev) => {
      const next = [...prev, entry];
      persistHighscores(next);
      return next;
    });
    setLastName(name);
    persistLastName(name);
    sound.play("bling", { vol: 0.7 });
    return entry;
  };

  const resetProgress = () => {
    if (!window.confirm("Wirklich den kompletten Fortschritt löschen? Die Bestenliste wird ebenfalls gelöscht."))
      return;
    setWallet(0);
    setBest(0);
    setTimeLevel(0);
    setOverdrive(false);
    setPhoenix(false);
    setBoostLevel(BOOST_START);
    setPhoenixEverUsed(false);
    setHappyEnd(false);
    setHighscores([]);
    persistHighscores([]);
    persistLastName("");
    remainingRef.current = maxTimeFor(0);
    sound.play("error");
  };

  /* ---------------- Effekte: Canvas, Loop, globale Events ---------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ps = new ParticleSystem(canvas);
    psRef.current = ps;
    const resize = () =>
      ps.resize(
        window.innerWidth,
        window.innerHeight,
        Math.min(window.devicePixelRatio || 1, 2)
      );
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const last = lastTsRef.current;
      const dt = last ? Math.min(ts - last, 100) : 16;
      lastTsRef.current = ts;
      const cfg = cfgRef.current;
      const running = cfg.phase === "running" && !pausedRef.current;

      if (running) {
        const speed = holdingRef.current && cfg.overdrive ? OD_MULT : 1;
        remainingRef.current -= (dt / 1000) * speed;
        runElapsedRef.current += dt / 1000;
        if (remainingRef.current <= 0) {
          remainingRef.current = 0;
          expireRef.current();
        }
        if (
          remainingRef.current > 0 &&
          remainingRef.current <= 3.05 &&
          !holdingRef.current
        ) {
          const b = Math.ceil(remainingRef.current * 2);
          if (b !== tickRef.current) {
            tickRef.current = b;
            sound.heartbeat();
          }
        }
      }

      let progress = remainingRef.current / cfg.maxTime;
      if (cfg.phase === "idle") progress = 0.86 + 0.14 * Math.sin(ts / 850);
      progress = Math.max(0, Math.min(1, progress));
      const elapsedPct = (1 - progress) * 100;
      const odActive = running && holdingRef.current && cfg.overdrive;
      const hue = Math.round(150 * progress);
      const color = odActive ? "hsl(283 100% 66%)" : `hsl(${hue} 100% 58%)`;

      if (ringRef.current) {
        ringRef.current.style.strokeDashoffset = String(RING_C * (1 - progress));
        ringRef.current.style.stroke = color;
      }
      if (wrapRef.current) {
        wrapRef.current.style.setProperty("--ring-glow", color);
        wrapRef.current.classList.toggle("danger", running && progress < 0.25);
      }
      const base = Math.max(0, Math.min(100, Math.floor(elapsedPct)));
      if (pctRef.current) {
        const txt =
          cfg.phase === "running"
            ? fmtCompact(pressScoreFor(base, cfg.boostMult))
            : "";
        if (pctRef.current.textContent !== txt) pctRef.current.textContent = txt;
        const len = txt.length;
        const bucket = len <= 3 ? 0 : len <= 5 ? 1 : len <= 7 ? 2 : 3;
        if (pctSizeRef.current !== bucket) {
          pctSizeRef.current = bucket;
          pctRef.current.className = `pct-num font-display font-black leading-none tabular-nums ${PCT_SIZES[bucket]}`;
        }
      }
      if (multRef.current) {
        multRef.current.textContent =
          cfg.phase === "running"
            ? `GEDULD ×${((base * cfg.boostMult) / 100).toLocaleString("de-DE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "";
      }
      if (secRef.current) {
        secRef.current.textContent = running
          ? `${remainingRef.current.toFixed(1)}s`
          : "";
      }
      if (vignetteRef.current) {
        vignetteRef.current.style.opacity = odActive ? "1" : "0";
      }
      psRef.current?.frame(dt);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* Globales Release (falls Pointer-Capture fehlschlägt / Fensterwechsel) */
  useEffect(() => {
    const up = () => {
      if (holdingRef.current) endHoldRef.current();
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  /* Tab/Fenster-Verlust: faire Mercy-Auffüllung statt plötzlichem Tod */
  useEffect(() => {
    const onBlur = () => {
      const cfg = cfgRef.current;
      if (cfg.phase === "running" && !pausedRef.current) {
        cancelHoldState();
        remainingRef.current = cfg.maxTime;
        tickRef.current = 0;
      }
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  useEffect(() => {
    return () => clearCd();
  }, []);

  /* ---------------- Render ---------------- */

  return (
    <div
      className={`rr-root relative h-[100dvh] w-full select-none overflow-hidden bg-[#0b0416] text-white ${
        shake ? "shaking" : ""
      }`}
      onContextMenu={(e) => e.preventDefault()}
      style={{ fontFamily: "var(--font-rajdhani), system-ui, sans-serif" }}
    >
      {/* Hintergrund */}
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{ backgroundImage: "url(game/bg.jpg)" }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(11,4,22,0.15) 0%, rgba(11,4,22,0.55) 68%, rgba(11,4,22,0.92) 100%)",
        }}
      />

      {/* Overdrive-Vignette */}
      <div
        ref={vignetteRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-30 opacity-0 transition-opacity duration-200"
        style={{
          boxShadow:
            "inset 0 0 140px 44px rgba(168,85,247,0.5), inset 0 0 60px 12px rgba(217,70,239,0.3)",
        }}
      />

      {/* Blitz-Effekte (Phönix / Tod) */}
      {flashKind && (
        <div
          key={flashKey}
          aria-hidden
          className="flash pointer-events-none fixed inset-0 z-40"
          style={{
            background:
              flashKind === "gold"
                ? "radial-gradient(circle, rgba(255,205,80,0.8), rgba(255,140,0,0.28) 55%, transparent 80%)"
                : "radial-gradient(circle, rgba(255,45,85,0.75), rgba(170,0,45,0.3) 55%, transparent 80%)",
          }}
        />
      )}

      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-40" aria-hidden />

      {/* HUD */}
      {phase !== "idle" && (
        <header className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3 sm:p-4">
          <div className="hud-panel flex items-center gap-2.5 rounded-2xl px-3.5 py-2">
            <Coin />
            <div className="min-w-0">
              <div className="font-display text-2xl font-bold leading-none text-white tabular-nums sm:text-3xl">
                {fmtCompact(wallet)}
              </div>
              <div className="mt-1.5 max-w-[46vw] truncate text-xs leading-none text-white/55 sm:max-w-none">
                RUN {fmtCompact(runScore)} · BEST {fmtCompact(best)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openShop}
              className="hud-btn relative inline-flex items-center gap-2.5 rounded-2xl px-5 py-3"
              aria-label="Shop öffnen (pausiert den Timer)"
            >
              <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="font-display text-sm font-bold tracking-wider sm:text-base">
                SHOP
              </span>
              {canAffordAny && (
                <span className="pulse-dot absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[#ffd23f]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setSoundOn((s) => !s)}
              className="hud-btn rounded-2xl p-2.5"
              aria-label={soundOn ? "Ton ausschalten" : "Ton einschalten"}
            >
              {soundOn ? (
                <Volume2 className="h-8 w-8" />
              ) : (
                <VolumeX className="h-8 w-8" />
              )}
            </button>
          </div>
        </header>
      )}

      {/* Zentrale Spielfläche */}
      <main className="relative z-20 flex min-h-[100dvh] flex-col items-center justify-center px-4 py-20">
        {/* Startbildschirm-Titel */}
        {phase === "idle" && (
          <div className="mb-3 text-center sm:mb-5">
            <h1 className="font-display text-[clamp(2.6rem,9vw,6.3rem)] font-black leading-none tracking-tight">
              <span
                className="text-white"
                style={{ textShadow: "0 0 34px rgba(34,228,255,0.85)" }}
              >
                RING
              </span>{" "}
              <span
                className="bg-gradient-to-r from-[#ff2fb3] to-[#a855f7] bg-clip-text text-transparent"
                style={{ filter: "drop-shadow(0 0 20px rgba(255,47,179,0.65))" }}
              >
                RUSH
              </span>
            </h1>
            <p className="mt-2 text-base font-medium text-white/65 sm:text-lg">
              Je leerer der Ring, desto mehr Punkte pro Druck.
            </p>
            {(best > 0 || wallet > 0) && (
              <div className="mt-1.5 text-sm text-white/50">
                Bestleistung: {fmtCompact(best)} P · Guthaben: {" "}
                {fmtCompact(wallet)} P
              </div>
            )}
          </div>
        )}

        {/* Button + Ring */}
        <div
          ref={wrapRef}
          className="relative aspect-square w-[min(clamp(300px,80vmin,510px),56vh)]"
          style={{ ["--ring-glow" as string]: "#39ff88" }}
        >
          <svg
            viewBox="0 0 200 200"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            style={{ filter: "drop-shadow(0 0 12px var(--ring-glow))" }}
            aria-hidden
          >
            <g transform="rotate(-90 100 100)">
              <circle
                cx="100"
                cy="100"
                r="97"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
                strokeDasharray="2 6"
              />
              <circle
                cx="100"
                cy="100"
                r={RING_R}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="9"
              />
              <circle
                ref={ringRef}
                className="ring-arc"
                cx="100"
                cy="100"
                r={RING_R}
                fill="none"
                stroke="#39ff88"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={0}
                style={{ transition: "stroke 0.15s linear" }}
              />
            </g>
          </svg>

          <button
            ref={btnRef}
            type="button"
            aria-label={
              phase === "running"
                ? "Punkte-Button: drücken für Punkte, halten für Overdrive"
                : "Spiel starten"
            }
            className={`rr-btn absolute inset-[6%] rounded-full outline-none ${
              holding ? "pressed" : ""
            } ${phase === "idle" ? "cursor-pointer" : ""}`}
            style={{
              touchAction: "none",
              WebkitTapHighlightColor: "transparent",
              WebkitTouchCallout: "none",
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
            onPointerDown={beginHold}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            onPointerLeave={endHold}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if ((e.code === "Space" || e.code === "Enter") && !e.repeat) {
                e.preventDefault();
                beginHold();
              }
            }}
            onKeyUp={(e) => {
              if (e.code === "Space" || e.code === "Enter") endHold();
            }}
            onClick={phase === "idle" ? startRun : undefined}
          >
            {phase === "running" ? (
              <span className="flex flex-col items-center">
                <span
                  ref={pctRef}
                  className="pct-num font-display text-7xl font-black leading-none tabular-nums sm:text-8xl"
                  style={{
                    color: "#fff",
                    textShadow:
                      "0 0 34px var(--ring-glow), 0 3px 18px rgba(0,0,0,0.9)",
                  }}
                />
                <span
                  ref={multRef}
                  className="mt-2 font-display text-[11px] font-black tracking-[0.22em] text-[#39ff88] sm:text-sm"
                  style={{
                    textShadow:
                      "0 0 16px rgba(57,255,136,0.7), 0 2px 8px rgba(0,0,0,0.85)",
                  }}
                />
                <span className="mt-1.5 text-xs font-semibold tracking-[0.35em] text-white/70 sm:text-sm">
                  PUNKTE
                </span>
                <span
                  ref={secRef}
                  className="mt-2 text-sm tabular-nums text-white/55 sm:text-base"
                />
              </span>
            ) : phase === "idle" ? (
              <span className="flex flex-col items-center gap-2">
                <Play
                  className="h-16 w-16 text-white/90 sm:h-20 sm:w-20"
                  style={{ filter: "drop-shadow(0 0 16px var(--ring-glow))" }}
                  fill="currentColor"
                />
                <span className="text-xs font-bold tracking-[0.3em] text-white/65 sm:text-sm">
                  TIPPEN ZUM STARTEN
                </span>
              </span>
            ) : (
              <span className="flex flex-col items-center gap-2 text-white/70">
                <Timer className="h-16 w-16" />
                <span className="text-xs font-bold tracking-[0.3em]">
                  ABGELAUFEN
                </span>
              </span>
            )}
          </button>
        </div>

        {/* Hinweis + Chips */}
        {phase === "running" && (
          <>
            <div className="mt-5 flex max-w-md flex-wrap items-center justify-center gap-2">
              <Chip
                icon={<Clock className="h-4 w-4" />}
                label={`${maxTime}s MAX`}
                tint="cyan"
                onClick={openShop}
              />
              <Chip
                icon={<TrendingUp className="h-4 w-4" />}
                label={`BOOST ×${boostMult}`}
                tint="emerald"
                onClick={openShop}
              />
              <Chip
                icon={<Zap className="h-4 w-4" />}
                label={overdrive ? "OVERDRIVE 3×" : `OVERDRIVE · ${fmtCompact(OD_COST)} P`}
                tint="violet"
                locked={!overdrive}
                onClick={openShop}
              />
              <Chip
                icon={<Flame className="h-4 w-4" />}
                label={
                  phoenix
                    ? phoenixUsed
                      ? "PHÖNIX VERBRAUCHT"
                      : "PHÖNIX BEREIT"
                    : `PHÖNIX · ${fmtCompact(PHOENIX_COST)} P`
                }
                tint="gold"
                locked={!phoenix || phoenixUsed}
                onClick={openShop}
              />
              {!happyEnd && phoenixEverUsed && (
                <Chip
                  icon={<PartyPopper className="h-4 w-4" />}
                  label={`SPEZIAL · ${fmtCompact(HAPPY_END_COST)} P`}
                  tint="rose"
                  onClick={openShop}
                />
              )}
            </div>
            {presses < 2 && countdown === null && (
              <p className="mt-3 animate-pulse text-center text-sm text-white/55">
                Der Multiplikator im Button steigt mit den Prozent. Je länger du
                wartest, desto mehr Punkte — aber der Ring läuft leer.
              </p>
            )}
          </>
        )}

        {/* How-to (Startbildschirm) */}
        {phase === "idle" && (
          <>
            <p className="mt-5 text-center text-sm text-white/60 sm:hidden">
              Tippen = Punkte · Ring leer = Verlust · Shop pausiert den Timer
            </p>
            <div className="howto-desktop mt-6 hidden w-full max-w-2xl grid-cols-3 gap-3 sm:grid">
              <HowTo
                icon={<MousePointerClick className="h-5 w-5" />}
                title="Drücken = Punkte"
                text="Punkte = Prozent × Prozent ÷ 100. 50 % zahlen 25 P, 90 % zahlen 81 P. Der Button zeigt live den Wert des nächsten Drucks."
              />
              <HowTo
                icon={<Timer className="h-5 w-5" />}
                title="Ring leer = Verlust"
                text="Ist der Ring leer, endet der Run. Punkte und Upgrades des Runs verfallen."
              />
              <HowTo
                icon={<ShoppingCart className="h-5 w-5" />}
                title="Shop pausiert"
                text="Der Timer hält, während du kaufst: Zeit-Chips, Boost, Overdrive und Phönix."
              />
            </div>
            <button
              type="button"
              onClick={resetProgress}
              className="absolute bottom-3 left-4 z-10 text-[10px] text-white/30 transition hover:text-white/60"
            >
              Fortschritt zurücksetzen
            </button>
          </>
        )}
      </main>

      {/* Schwebende Punkte-Texte */}
      {floats.map((f) => (
        <div
          key={f.id}
          className={`float-text pointer-events-none fixed z-[55] font-display font-black ${
            f.kind === "hype"
              ? "float-hype"
              : f.kind === "phoenix"
                ? "float-phoenix"
                : "float-gain"
          }`}
          style={{ left: f.x, top: f.y }}
        >
          {f.text}
        </div>
      ))}

      {/* Countdown */}
      {countdown !== null && (
        <div
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          aria-live="polite"
        >
          <div
            key={String(countdown)}
            className={`cd font-display font-black ${
              countdown === "GO"
                ? "bg-gradient-to-r from-[#22e4ff] to-[#ff2fb3] bg-clip-text text-8xl text-transparent sm:text-9xl"
                : "text-9xl text-white sm:text-[12rem]"
            }`}
            style={
              countdown === "GO"
                ? undefined
                : { textShadow: "0 0 60px rgba(34,228,255,0.6)" }
            }
          >
            {countdown}
          </div>
        </div>
      )}

      {/* Shop-Modal */}
      {shopOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="pop-in flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#140a26]/95 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="font-display text-3xl font-black text-white">
                  SHOP
                </h2>
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-cyan-200">
                  <Pause className="h-3 w-3" /> TIMER PAUSIERT
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                  <Coin small />
                  <span className="font-display text-sm font-bold tabular-nums text-[#ffd23f]">
                    {fmt(wallet)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={closeShop}
                  aria-label="Shop schließen"
                  className="rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20 active:scale-95"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="nice-scroll flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {/* Zeit-Chip */}
              <ShopCard
                shake={shakeItem === "chip"}
                icon={<Clock className="h-8 w-8" />}
                iconClass="bg-cyan-400/15 text-cyan-300"
                title="Zeit-Chip"
                badge={`STUFE ${timeLevel}/${MAX_LEVEL}`}
                badgeClass="bg-cyan-400/15 text-cyan-200"
                desc="Verkürzt die maximale Zeit um 2 s pro Stufe. Kürzere Runden füllen die Prozent schneller. Nach dem Kauf ist der Ring voll."
                action={
                  chipCost === null ? (
                    <span className="block rounded-xl bg-white/10 px-4 py-2.5 text-center font-display text-xs font-bold tracking-wider text-white/50">
                      MAX
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        wallet >= chipCost ? buyChip() : deny("chip")
                      }
                      aria-disabled={wallet < chipCost}
                      className={`shop-buy w-full rounded-xl px-5 py-2.5 font-display text-base font-bold tabular-nums transition active:scale-95 sm:w-auto ${
                        wallet >= chipCost
                          ? "bg-gradient-to-r from-[#ffd23f] to-[#ff8a00] text-black shadow-lg shadow-amber-900/30"
                          : "cursor-not-allowed bg-white/10 text-white/40"
                      }`}
                    >
                      {fmt(chipCost)} P
                    </button>
                  )
                }
              >
                <div className="mt-2.5 flex items-center justify-center gap-2 sm:justify-start">
                  <div className="flex gap-0.5">
                    {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-2 rounded-full ${
                          i < timeLevel ? "bg-cyan-400" : "bg-white/15"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] tabular-nums text-white/50">
                    {maxTime}s → {timeLevel < MAX_LEVEL ? maxTimeFor(timeLevel + 1) : maxTime}s
                  </span>
                </div>
              </ShopCard>

              {/* Punkte-Boost */}
              <ShopCard
                shake={shakeItem === "boost"}
                icon={<TrendingUp className="h-8 w-8" />}
                iconClass="bg-emerald-400/15 text-emerald-300"
                title="Punkte-Boost"
                badge={`STUFE ${boostLevel}/${BOOST_MAX}`}
                badgeClass="bg-emerald-400/15 text-emerald-200"
                desc={`Multipliziert die Punkte pro Druck — aktuell ×${boostMult}${
                  boostLevel < BOOST_MAX ? `, nächste Stufe ×${boostLevel + 1}` : ""
                }.`}
                action={
                  boostCost === null ? (
                    <span className="block rounded-xl bg-white/10 px-4 py-2.5 text-center font-display text-xs font-bold tracking-wider text-white/50">
                      MAX
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        wallet >= boostCost ? buyBoost() : deny("boost")
                      }
                      aria-disabled={wallet < boostCost}
                      className={`shop-buy w-full rounded-xl px-5 py-2.5 font-display text-base font-bold tabular-nums transition active:scale-95 sm:w-auto ${
                        wallet >= boostCost
                          ? "bg-gradient-to-r from-[#ffd23f] to-[#ff8a00] text-black shadow-lg shadow-amber-900/30"
                          : "cursor-not-allowed bg-white/10 text-white/40"
                      }`}
                    >
                      {fmt(boostCost)} P
                    </button>
                  )
                }
              >
                <div className="mt-2.5 flex justify-center gap-0.5 sm:justify-start">
                  {Array.from({ length: BOOST_MAX }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-2 rounded-full ${
                        i < boostLevel ? "bg-emerald-400" : "bg-white/15"
                      }`}
                    />
                  ))}
                </div>
              </ShopCard>

              {/* Overdrive */}
              <ShopCard
                shake={shakeItem === "od"}
                icon={<Zap className="h-8 w-8" />}
                iconClass="bg-violet-400/15 text-violet-300"
                title="Overdrive"
                badge="EINMALIG"
                badgeClass="bg-violet-400/15 text-violet-200"
                desc={`Beim Halten läuft der Timer ${OD_MULT}× so schnell — Punkte kommen schneller, der Ring auch.`}
                action={
                  overdrive ? (
                    <span className="block rounded-xl bg-violet-400/20 px-4 py-2.5 text-center font-display text-xs font-bold tracking-wider text-violet-200">
                      AKTIV
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        wallet >= OD_COST ? buyOverdrive() : deny("od")
                      }
                      aria-disabled={wallet < OD_COST}
                      className={`shop-buy w-full rounded-xl px-5 py-2.5 font-display text-base font-bold tabular-nums transition active:scale-95 sm:w-auto ${
                        wallet >= OD_COST
                          ? "bg-gradient-to-r from-[#ffd23f] to-[#ff8a00] text-black shadow-lg shadow-amber-900/30"
                          : "cursor-not-allowed bg-white/10 text-white/40"
                      }`}
                    >
                      {fmt(OD_COST)} P
                    </button>
                  )
                }
              />

              {/* Phönix */}
              <ShopCard
                shake={shakeItem === "phoenix"}
                icon={<Flame className="h-8 w-8" />}
                iconClass="bg-amber-400/15 text-amber-300"
                title="Phönix"
                badge="EINMALIG"
                badgeClass="bg-amber-400/15 text-amber-200"
                desc={`Bei leerem Ring rettet er dich automatisch als Druck (+${fmt(pressScoreFor(100, boostMult))} P). Einmal pro Run. Verbraucht schaltet er das Happy-End-Spezial frei.`}
                action={
                  phoenix ? (
                    <span className="block rounded-xl bg-amber-400/20 px-4 py-2.5 text-center font-display text-xs font-bold tracking-wider text-amber-200">
                      {phoenixUsed ? "VERBRAUCHT" : "BEREIT"}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        wallet >= PHOENIX_COST ? buyPhoenix() : deny("phoenix")
                      }
                      aria-disabled={wallet < PHOENIX_COST}
                      className={`shop-buy w-full rounded-xl px-5 py-2.5 font-display text-base font-bold tabular-nums transition active:scale-95 sm:w-auto ${
                        wallet >= PHOENIX_COST
                          ? "bg-gradient-to-r from-[#ffd23f] to-[#ff8a00] text-black shadow-lg shadow-amber-900/30"
                          : "cursor-not-allowed bg-white/10 text-white/40"
                      }`}
                    >
                      {fmt(PHOENIX_COST)} P
                    </button>
                  )
                }
              />

              {/* Happy-End-Spezial */}
              <div
                className={`rounded-2xl border p-4 ${
                  happyEnd
                    ? "border-amber-300/40 bg-gradient-to-r from-amber-400/10 to-fuchsia-500/10"
                    : "border-white/10 bg-white/[0.04]"
                } ${shakeItem === "happy" ? "card-shake" : ""}`}
              >
                <ShopCard
                  shake={false}
                  icon={<PartyPopper className="h-8 w-8" />}
                  iconClass={`${
                    happyEnd
                      ? "bg-amber-400/20 text-amber-200"
                      : "bg-rose-400/15 text-rose-300"
                  }`}
                  title="Happy-End-Spezial"
                  badge="FINALE"
                  badgeClass="bg-rose-400/15 text-rose-200"
                  desc={
                    phoenixEverUsed
                      ? "Feuerwerk, Happy-End-Screen und dein Eintrag in der Bestenliste — mit Gesamtzeit und Punkten."
                      : "Feuerwerk, Happy-End-Screen und Bestenliste-Eintrag. Wird freigeschaltet, sobald du den Phönix verbrauchst."
                  }
                  action={
                    happyEnd ? (
                      <span className="block rounded-xl bg-amber-400/20 px-4 py-2.5 text-center font-display text-xs font-bold tracking-wider text-amber-200">
                        GEKAUFT
                      </span>
                    ) : !phoenixEverUsed ? (
                      <button
                        type="button"
                        onClick={() => deny("happy")}
                        aria-label="Gesperrt: Phönix verbrauchen, um das Spezial freizuschalten"
                        className="inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-xl bg-white/10 px-5 py-2.5 font-display text-xs font-bold tracking-wider text-white/45 sm:w-auto"
                      >
                        <Lock className="h-4 w-4" /> GESPERRT
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          wallet >= HAPPY_END_COST ? buyHappyEnd() : deny("happy")
                        }
                        aria-disabled={wallet < HAPPY_END_COST}
                        className={`shop-buy w-full rounded-xl px-5 py-2.5 font-display text-base font-bold tabular-nums transition active:scale-95 sm:w-auto ${
                          wallet >= HAPPY_END_COST
                            ? "bg-gradient-to-r from-[#ffd23f] to-[#ff8a00] text-black shadow-lg shadow-amber-900/30"
                            : "cursor-not-allowed bg-white/10 text-white/40"
                        }`}
                      >
                        {fmt(HAPPY_END_COST)} P
                      </button>
                    )
                  }
                />
              </div>
            </div>

            <div className="border-t border-white/10 px-6 py-3 text-center text-xs text-white/45">
              Bei Verlust werden Punkte und Upgrades gelöscht — nur die
              Happy-End-Bestenliste bleibt.
            </div>
          </div>
        </div>
      )}

      {/* Game-Over-Modal */}
      {phase === "gameover" && !shopOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="pop-in w-full max-w-xl rounded-3xl border border-white/10 bg-[#140a26]/95 p-8 text-center shadow-2xl">
            <h2 className="font-display bg-gradient-to-r from-[#ff2fb3] via-[#ff5e5e] to-[#a855f7] bg-clip-text text-5xl font-black text-transparent sm:text-6xl">
              GAME OVER
            </h2>
            <div
              className={`mt-5 font-display font-black tabular-nums text-white ${sizeFor(fmtCompact(runScore))}`}
              style={{ textShadow: "0 0 30px rgba(255,47,179,0.5)" }}
            >
              {fmtCompact(runScore)}
            </div>
            <div className="mt-1.5 text-xs tracking-[0.3em] text-white/50">
              PUNKTE VERLOREN
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Stat label="BEST" value={best} />
              <Stat label="PRESSES" value={presses} />
              <Stat label="TOP-PRESS" value={bestPress} />
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs leading-snug text-white/60">
              Guthaben, Upgrades und Fähigkeiten dieses Runs wurden gelöscht.
              Gespeichert bleibt nur deine{" "}
              <b className="text-white/85">Happy-End-Bestenliste</b>.
            </div>
            <button
              type="button"
              onClick={startRun}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff2fb3] to-[#a855f7] py-4 font-display text-xl font-bold text-white shadow-lg shadow-fuchsia-900/40 transition active:scale-95"
            >
              <RotateCcw className="h-5 w-5" /> NOCHMAL
            </button>
            <button
              type="button"
              onClick={openShop}
              className="mt-2 w-full rounded-2xl border border-white/15 py-3 text-base font-semibold text-white/70 transition hover:bg-white/5 active:scale-95"
            >
              Shop öffnen
            </button>
          </div>
        </div>
      )}

      {/* Happy-End-Spezial: Feuerwerk & Finale */}
      {happyShow && (
        <HappyEndOverlay
          runScore={runScore}
          presses={presses}
          timeSec={happyTime}
          highscores={highscores}
          lastName={lastName}
          onSubmitName={submitHighscore}
          onContinue={() => {
            setHappyShow(false);
            if (cfgRef.current.phase === "running") {
              runCountdown(() => {
                pausedRef.current = false;
                lastTsRef.current = 0;
              });
            }
          }}
        />
      )}

      {/* Credits */}
      <div className="pointer-events-none absolute bottom-1.5 right-3 z-10 text-[9px] text-white/25">
        SFX: mixkit.co · Grafik: KI-generiert
      </div>
    </div>
  );
}

/* ---------------- How-to-Karte ---------------- */

function HowTo({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur-sm">
      <div className="flex items-center gap-2 text-cyan-300">
        {icon}
        <span className="text-base font-bold text-white">{title}</span>
      </div>
      <p className="mt-1.5 text-sm leading-snug text-white/60">{text}</p>
    </div>
  );
}

/* ---------------- Happy-End-Spezial: Feuerwerk, Zeit & Bestenliste ---------------- */

function HappyEndOverlay({
  runScore,
  presses,
  timeSec,
  highscores,
  lastName,
  onSubmitName,
  onContinue,
}: {
  runScore: number;
  presses: number;
  timeSec: number;
  highscores: HighscoreEntry[];
  lastName: string;
  onSubmitName: (name: string) => HighscoreEntry;
  onContinue: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showBtn, setShowBtn] = useState(false);
  const [name, setName] = useState(lastName.slice(0, 10));
  const [myTs, setMyTs] = useState<number | null>(null);
  const myRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let lastBoom = 0;
    const fw = new Fireworks(canvas, {
      onExplode: () => {
        const now = performance.now();
        if (now - lastBoom < 90) return;
        lastBoom = now;
        const names = ["coin", "bling", "milestone"] as const;
        sound.play(names[Math.floor(Math.random() * names.length)], {
          vol: 0.32,
          rate: 0.85 + Math.random() * 0.5,
        });
      },
    });
    const resize = () =>
      fw.resize(
        window.innerWidth,
        window.innerHeight,
        Math.min(window.devicePixelRatio || 1, 2)
      );
    resize();
    window.addEventListener("resize", resize);
    fw.start();

    // Fanfare beim Öffnen
    const fanfare: Array<[number, Parameters<typeof sound.play>[0]]> = [
      [0, "phoenix"],
      [380, "milestone"],
      [760, "bonus"],
      [1250, "bling"],
      [1750, "milestone"],
    ];
    const timers = fanfare.map(([d, n]) =>
      window.setTimeout(() => sound.play(n, { vol: 0.85 }), d)
    );
    const t = window.setTimeout(() => setShowBtn(true), 2600);

    return () => {
      window.clearTimeout(t);
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("resize", resize);
      fw.stop();
    };
  }, []);

  /* Neuer Eintrag: in der Liste passend scrollen */
  useEffect(() => {
    if (myTs !== null)
      myRowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [myTs, highscores]);

  const submit = () => {
    if (myTs !== null) return;
    const entry = onSubmitName(name);
    setMyTs(entry.ts);
  };

  const sorted = [...highscores].sort((a, b) => a.time - b.time);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-[#0b0416]/90">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(11,4,22,0.08) 0%, rgba(11,4,22,0.5) 68%, rgba(11,4,22,0.88) 100%)",
        }}
      />
      <div className="pop-in nice-scroll relative z-10 mx-3 my-5 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-amber-300/25 bg-[#140a26]/80 p-5 text-center shadow-2xl backdrop-blur-md sm:mx-4 sm:p-8">
        <div className="mb-3 inline-block rounded-full bg-gradient-to-r from-[#ffd23f] to-[#ff8a00] px-4 py-1 text-xs font-black tracking-[0.2em] text-black">
          FINALE
        </div>
        <h2 className="happy-title font-display bg-gradient-to-r from-[#ffd23f] via-[#ff2fb3] to-[#22e4ff] bg-clip-text text-5xl font-black text-transparent sm:text-7xl">
          HAPPY END
        </h2>
        <p className="mt-2 text-base font-medium text-white/75">
          Phönix verbraucht, Spezial gekauft — geschafft! Dein Run kommt in die
          Bestenliste.
        </p>

        {/* Gesamtzeit */}
        <div className="mt-4">
          <div
            className={`font-display font-black tabular-nums text-white ${sizeFor(
              formatTime(timeSec)
            )}`}
            style={{ textShadow: "0 0 26px rgba(255,210,63,0.55)" }}
          >
            {formatTime(timeSec)}
          </div>
          <div className="mt-1 text-[10px] tracking-[0.3em] text-white/50 sm:text-xs">
            GESAMTZEIT (MIN:SEC)
          </div>
        </div>

        {/* Statistik — mobil untereinander */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          <Stat label="PUNKTE" value={runScore} />
          <Stat label="PRESSES" value={presses} />
        </div>

        {/* Namenseingabe */}
        <div className="mt-5">
          <label
            htmlFor="rr-name"
            className="block text-sm font-bold tracking-wider text-white/80"
          >
            Wie heißt du?
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="rr-name"
              type="text"
              value={name}
              maxLength={10}
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) =>
                setName(e.target.value.replace(/\s/g, "").toUpperCase())
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="DEIN NAME"
              className="h-12 w-full rounded-xl border border-white/15 bg-black/40 px-4 text-center font-display text-lg font-bold tracking-wider text-white outline-none placeholder:text-white/30 focus:border-amber-300/60 sm:flex-1 sm:text-left"
            />
            <button
              type="button"
              onClick={submit}
              disabled={myTs !== null}
              className={`h-12 shrink-0 rounded-xl px-6 font-display text-base font-bold tracking-wider transition active:scale-95 ${
                myTs !== null
                  ? "bg-white/10 text-white/40"
                  : "bg-gradient-to-r from-[#ffd23f] to-[#ff8a00] text-black shadow-lg shadow-amber-900/30"
              }`}
            >
              {myTs !== null ? "EINGETRAGEN ✓" : "EINTRAGEN"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-white/40">
            Maximal 10 Zeichen — leer lassen für „SPIELER“.
          </p>
        </div>

        {/* Bestenliste — 5 Zeilen sichtbar, scrollbar */}
        {sorted.length > 0 && (
          <div className="mt-5 text-left">
            <div className="mb-1.5 flex items-center justify-between px-1">
              <span className="text-xs font-black tracking-[0.22em] text-amber-200">
                BESTENLISTE
              </span>
              <span className="text-[10px] text-white/40">
                schnellste Zeit zuerst
              </span>
            </div>
            <div className="nice-scroll max-h-[11.25rem] overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-1.5">
              {sorted.map((e) => (
                <div
                  key={e.ts}
                  ref={e.ts === myTs ? myRowRef : undefined}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm tabular-nums ${
                    e.ts === myTs
                      ? "bg-amber-400/15 text-amber-100"
                      : "text-white/75"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {e.name}
                  </span>
                  <span className="shrink-0">
                    {formatTime(e.time)} - {fmtCH(e.points)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onContinue}
          className={`mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ffd23f] to-[#ff8a00] py-4 font-display text-xl font-bold text-black shadow-lg shadow-amber-900/40 transition-all duration-500 active:scale-95 ${
            showBtn
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0"
          }`}
        >
          <PartyPopper className="h-5 w-5" /> WEITERSPIELEN
        </button>
        <p className="mt-3 text-[11px] text-white/45">
          Dein Bestenliste-Eintrag bleibt gespeichert. Alles andere wird bei
          Verlust zurückgesetzt.
        </p>
      </div>
    </div>
  );
}
