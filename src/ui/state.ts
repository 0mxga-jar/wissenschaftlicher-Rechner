/** Globaler App-Zustand: Einstellungen, Modus, Variablen, Persistenz. */
import { useEffect, useState } from 'preact/hooks';
import {
  Real,
  Cx,
  Exact,
  Rat,
  createContext,
  roundToFormat,
  type AngleUnit,
  type EvalContext,
  type NumFormat,
  type NumMode,
  type ResultForm,
  type ComplexForm,
  type Value,
  type Term,
} from '../core';

export type ModeId =
  | 'calc'
  | 'complex'
  | 'basen'
  | 'matrix'
  | 'vector'
  | 'stats'
  | 'dist'
  | 'table'
  | 'equation'
  | 'ineq'
  | 'ratio'
  | 'sheet';

export interface Settings {
  angle: AngleUnit;
  numMode: NumMode;
  fixDigits: number;
  sciDigits: number;
  comma: boolean;
  resultForm: 'exact' | 'decimal';
  fraction: 'improper' | 'mixed';
  complexForm: ComplexForm;
  theme: 'dark' | 'light';
  haptics: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  angle: 'DEG',
  numMode: 'norm1',
  fixDigits: 2,
  sciDigits: 4,
  comma: true,
  resultForm: 'exact',
  fraction: 'improper',
  complexForm: 'rect',
  theme: 'dark',
  haptics: true,
};

export type Overlay =
  | { kind: 'menu' }
  | { kind: 'setup' }
  | { kind: 'catalog' }
  | { kind: 'const' }
  | { kind: 'conv' }
  | { kind: 'hyp' }
  | { kind: 'vars'; purpose: 'sto' | 'rcl' }
  | { kind: 'help' };

export const VAR_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z', 'M'];

export const app = {
  settings: { ...DEFAULT_SETTINGS } as Settings,
  mode: 'calc' as ModeId,
  shift: false,
  alpha: false,
  overlay: null as Overlay | null,
  toast: null as string | null,
  keypadHidden: false,
  /** Funktionstasten ein-/ausblenden: null = Vorgabe des Modus */
  fnKeys: null as boolean | null,
  /** Variablen A–F, x, y, z, M sowie Ans/PreAns (modusübergreifend) */
  vars: {} as Record<string, Value>,
};

// ───────────────────────────── Benachrichtigung ─────────────────────────────

let version = 0;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

/** Nach jeder Zustandsänderung aufrufen: rendert neu und speichert verzögert. */
export function update(): void {
  version++;
  listeners.forEach((l) => l());
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}

/** Hook: Komponente bei jeder Zustandsänderung neu zeichnen. */
export function useApp(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}

export function toast(msg: string): void {
  app.toast = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    app.toast = null;
    update();
  }, 2600);
  update();
}

// ───────────────────────────── abgeleitete Werte ─────────────────────────────

export function numFormat(): NumFormat {
  const s = app.settings;
  return {
    mode: s.numMode,
    digits: s.numMode === 'fix' ? s.fixDigits : s.numMode === 'sci' ? s.sciDigits : 0,
    comma: s.comma,
  };
}

export function formatLabel(): string {
  const s = app.settings;
  if (s.numMode === 'fix') return `Fix ${s.fixDigits}`;
  if (s.numMode === 'sci') return `Sci ${s.sciDigits}`;
  return s.numMode === 'norm1' ? 'Norm 1' : 'Norm 2';
}

/** Standard-Ergebnisdarstellung laut Einstellungen. */
export function defaultForm(): ResultForm {
  const s = app.settings;
  if (s.resultForm === 'decimal') return 'decimal';
  return s.fraction === 'mixed' ? 'mixed' : 'exact';
}

/** Auswertungskontext mit den gemeinsamen Variablen. */
export function makeContext(extra: Partial<EvalContext> = {}): EvalContext {
  return createContext({
    angle: app.settings.angle,
    vars: app.vars,
    round: (r) => roundToFormat(r, numFormat()),
    ...extra,
  });
}

export function haptic(ms = 8): void {
  if (!app.settings.haptics) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* nicht verfügbar */
  }
}

// ───────────────────────────── Persistenz ─────────────────────────────

const STORAGE_KEY = 'rechenwerk.v1';

type EncReal = { n: number; ex?: Array<[string, string, string, number]> };
type EncValue = { k: 'r'; v: EncReal } | { k: 'c'; re: EncReal; im: EncReal };

export function encodeReal(r: Real): EncReal {
  if (!r.ex) return { n: r.n };
  return { n: r.n, ex: r.ex.terms.map((t) => [t.c.n.toString(), t.c.d.toString(), t.r.toString(), t.p]) };
}
export function decodeReal(e: EncReal | null | undefined): Real {
  if (!e || typeof e.n !== 'number') return Real.ZERO;
  if (e.ex) {
    try {
      const terms: Term[] = e.ex.map(([n, d, r, p]) => ({ c: Rat.of(BigInt(n), BigInt(d)), r: BigInt(r), p }));
      const ex = Exact.make(terms);
      if (ex) return Real.fromExact(ex);
    } catch {
      /* beschädigt → numerisch */
    }
  }
  return Number.isFinite(e.n) ? new Real(e.n, null) : Real.ZERO;
}
function encodeValue(v: Value): EncValue | null {
  if (v.kind === 'real') return { k: 'r', v: encodeReal(v) };
  if (v.kind === 'complex') return { k: 'c', re: encodeReal(v.re), im: encodeReal(v.im) };
  return null;
}
function decodeValue(e: EncValue): Value {
  if (e.k === 'c') return new Cx(decodeReal(e.re), decodeReal(e.im));
  return decodeReal(e.v);
}

interface Persister {
  save: () => unknown;
  load: (data: unknown) => void;
  reset: () => void;
}
const persisters = new Map<string, Persister>();

/** Ein Modus meldet hier an, wie sein Zustand gespeichert und zurückgesetzt wird. */
export function registerPersister(id: string, p: Persister): void {
  persisters.set(id, p);
}

function saveNow(): void {
  try {
    const vars: Record<string, EncValue> = {};
    for (const [k, v] of Object.entries(app.vars)) {
      const e = encodeValue(v);
      if (e) vars[k] = e;
    }
    const modes: Record<string, unknown> = {};
    persisters.forEach((p, id) => {
      modes[id] = p.save();
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings: app.settings, mode: app.mode, vars, modes }));
  } catch {
    /* Speicher nicht verfügbar – App läuft ohne Persistenz */
  }
}

export function loadState(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.settings) app.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    if (typeof data.mode === 'string') app.mode = data.mode;
    if (data.vars) {
      for (const [k, v] of Object.entries(data.vars as Record<string, EncValue>)) app.vars[k] = decodeValue(v);
    }
    if (data.modes) {
      persisters.forEach((p, id) => {
        if (data.modes[id] !== undefined) {
          try {
            p.load(data.modes[id]);
          } catch {
            p.reset();
          }
        }
      });
    }
  } catch {
    /* beschädigte Daten ignorieren */
  }
}

/** Alles zurücksetzen (Einstellungen, Variablen, Daten aller Modi). */
export function resetAll(scope: 'settings' | 'memory' | 'all'): void {
  if (scope === 'settings' || scope === 'all') app.settings = { ...DEFAULT_SETTINGS };
  if (scope === 'memory' || scope === 'all') {
    for (const k of Object.keys(app.vars)) delete app.vars[k];
    persisters.forEach((p) => p.reset());
  }
  if (scope === 'all') app.mode = 'calc';
  applyTheme();
  update();
}

export function applyTheme(): void {
  document.documentElement.dataset.theme = app.settings.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', app.settings.theme === 'dark' ? '#0b0f14' : '#e9edf2');
}
