/** Numerische Verfahren: Integration, Ableitung, Nullstellensuche. */
import { CalcError } from './errors';

export type Fn = (x: number) => number;

const EPS = 2.220446049250313e-16;

function safe(f: Fn, x: number): number {
  try {
    const y = f(x);
    return Number.isFinite(y) ? y : NaN;
  } catch {
    return NaN;
  }
}

// ───────────────────────────── Integration ─────────────────────────────

// Gauß-Kronrod (G7, K15) – Stützstellen und Gewichte
const XGK = [
  0.991455371120812639206854697526329, 0.949107912342758524526189684047851,
  0.864864423359769072789712788640926, 0.741531185599394439863864773280788,
  0.58608723546769113029414483825873, 0.405845151377397166906606412076961,
  0.207784955007898467600689403773245, 0.0,
];
const WGK = [
  0.02293532201052922496373200805897, 0.063092092629978553290700663189204,
  0.104790010322250183839876322541518, 0.140653259715525918745189590510238,
  0.16900472663926790282658342659855, 0.190350578064785409913256402421014,
  0.204432940075298892414161999234649, 0.209482141084727828012999174891714,
];
const WG = [
  0.129484966168869693270611432679082, 0.27970539148927666790146777142378,
  0.381830050505118944950369775488975, 0.417959183673469387755102040816327,
];

/** Liefert [Integral, Fehlerschätzung, Integral von |f|] auf [a, b]. */
function gk15(f: Fn, a: number, b: number): [number, number, number] {
  const c = 0.5 * (a + b);
  const h = 0.5 * (b - a);
  const fc = f(c);
  let k = fc * WGK[7];
  let g = fc * WG[3];
  let abs = Math.abs(fc) * WGK[7];
  for (let j = 0; j < 7; j++) {
    const dx = h * XGK[j];
    const f1 = f(c - dx);
    const f2 = f(c + dx);
    k += WGK[j] * (f1 + f2);
    abs += WGK[j] * (Math.abs(f1) + Math.abs(f2));
    if (j % 2 === 1) g += WG[(j - 1) / 2] * (f1 + f2);
  }
  return [k * h, Math.abs((k - g) * h), abs * h];
}

interface GKResult {
  value: number;
  abs: number;
  err: number;
  /** Toleranz erreicht? */
  ok: boolean;
  /** Ein Teilintervall ließ sich nicht weiter teilen, obwohl sein Fehler noch groß war (Polstelle). */
  stuck: boolean;
}

function adaptiveGK(g: Fn, a: number, b: number, relTol: number): GKResult {
  let evals = 0;
  const f: Fn = (x) => {
    evals++;
    return g(x);
  };
  type Seg = { a: number; b: number; v: number; e: number; s: number };
  const [v0, e0, s0] = gk15(f, a, b);
  const segs: Seg[] = [{ a, b, v: v0, e: e0, s: s0 }];
  let total = v0;
  let errSum = e0;
  let absSum = s0;
  let stuck = false;
  const tol = (): number => Math.max(1e-13 * absSum, relTol * Math.abs(total), 1e-300);
  while (errSum > tol()) {
    if (evals > 60000 || segs.length > 2000) break;
    let worst = 0;
    for (let i = 1; i < segs.length; i++) if (segs[i].e > segs[worst].e) worst = i;
    const s = segs[worst];
    const m = 0.5 * (s.a + s.b);
    if (m === s.a || m === s.b) {
      // Nicht weiter teilbar. Bleibt dort ein spürbarer Fehler oder trägt ein Intervall von der Breite
      // der Rechengenauigkeit noch merklich zum Integral bei, liegt eine Polstelle vor.
      if (s.e > tol() || Math.abs(s.v) > tol()) stuck = true;
      s.e = 0;
    } else {
      const [v1, e1, s1] = gk15(f, s.a, m);
      const [v2, e2, s2] = gk15(f, m, s.b);
      segs[worst] = { a: s.a, b: m, v: v1, e: e1, s: s1 };
      segs.push({ a: m, b: s.b, v: v2, e: e2, s: s2 });
    }
    total = 0;
    errSum = 0;
    absSum = 0;
    for (const x of segs) {
      total += x.v;
      errSum += x.e;
      absSum += x.s;
    }
  }
  // Ein Teilintervall von verschwindender Breite, das trotzdem merklich beiträgt, deutet auf eine
  // Singularität hin – dann ist die Fehlerschätzung nicht verlässlich.
  for (const x of segs) {
    if (x.b - x.a <= 1e-12 * (b - a) && Math.abs(x.v) > 1e-10 * absSum) stuck = true;
  }
  return { value: total, abs: absSum, err: errSum, ok: errSum <= tol() && !stuck, stuck };
}

/**
 * Tanh-Sinh-Quadratur für Integranden mit Singularität an einer Intervallgrenze.
 * Liefert null, wenn das Verfahren nicht zuverlässig konvergiert (z. B. divergentes Integral).
 */
function tanhSinh(f: Fn, a: number, b: number): number | null {
  const c = 0.5 * (a + b);
  const half = 0.5 * (b - a);
  const fc = safe(f, c);
  if (Number.isNaN(fc)) return null;
  let failed = false;
  /** Beitrag des Knotenpaars ±t; merkt sich den Betrag des äußersten Beitrags. */
  let lastTerm = 0;
  const node = (t: number): number => {
    const u = (Math.PI / 2) * Math.sinh(t);
    const ch = Math.cosh(u);
    const w = ((Math.PI / 2) * Math.cosh(t)) / (ch * ch);
    const delta = 2 / (1 + Math.exp(2 * u)); // 1 − tanh(u), auch nahe 0 genau
    const xr = b - half * delta;
    const xl = a + half * delta;
    let s = 0;
    if (xr < b && xr > a) {
      const y = safe(f, xr);
      if (Number.isNaN(y)) failed = true;
      else s += y;
    }
    if (xl > a && xl < b) {
      const y = safe(f, xl);
      if (Number.isNaN(y)) failed = true;
      else s += y;
    }
    return w * s;
  };
  const TMAX = 6.2;
  let h = 1;
  let sum = (Math.PI / 2) * fc;
  for (let k = 1; k * h <= TMAX; k++) {
    const term = node(k * h);
    sum += term;
    if (term !== 0) lastTerm = Math.abs(term);
  }
  if (failed) return null;
  let prev = half * h * sum;
  let hits = 0;
  for (let level = 1; level <= 9; level++) {
    h /= 2;
    lastTerm = 0;
    for (let k = 1; k * h <= TMAX; k += 2) {
      const term = node(k * h);
      sum += term;
      if (term !== 0) lastTerm = Math.abs(term);
    }
    if (failed) return null;
    const cur = half * h * sum;
    const err = Math.abs(cur - prev);
    prev = cur;
    if (level >= 3 && err <= 1e-11 * Math.abs(cur) + 1e-300) {
      hits++;
      if (hits >= 2) {
        // der äußerste Beitrag muss vernachlässigbar sein – sonst divergiert das Integral
        // oder die Singularität liegt zu nah an einer Grenze, um genau gerechnet zu werden
        if (lastTerm * h > 1e-11 * Math.abs(sum * h)) return null;
        return cur;
      }
    } else hits = 0;
  }
  return null;
}

/** Bestimmtes Integral von f über [a, b]. */
export function integrate(f: Fn, a: number, b: number, relTol = 1e-11): number {
  if (a === b) return 0;
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new CalcError('RANGE', 'Die Integrationsgrenzen müssen endlich sein.');
  if (a > b) return -integrate(f, b, a, relTol);
  const g: Fn = (x) => {
    const y = f(x);
    if (!Number.isFinite(y)) throw new CalcError('DOMAIN', 'Der Integrand ist im Intervall nicht überall definiert.');
    return y;
  };
  let res: GKResult | null = null;
  let firstError: unknown = null;
  try {
    res = adaptiveGK(g, a, b, relTol);
  } catch (e) {
    firstError = e;
  }
  if (res && res.ok) {
    // Ergebnis 0 nicht als Rundungsrauschen (z. B. 1,2·10⁻¹⁶) ausgeben
    return Math.abs(res.value) <= 4e-14 * res.abs ? 0 : res.value;
  }
  // Singularität an einer Grenze? → Tanh-Sinh-Quadratur
  const ts = tanhSinh(f, a, b);
  if (ts !== null) return ts;
  if (res && !res.stuck && res.err <= 1e-6 * Math.max(Math.abs(res.value), 1e-300)) return res.value;
  if (firstError instanceof CalcError) throw firstError;
  throw new CalcError('TIMEOUT', 'Das Integral konvergiert nicht (Polstelle oder zu stark schwankender Integrand).');
}

// ───────────────────────────── Ableitung ─────────────────────────────

interface RiddersResult {
  value: number;
  err: number;
  /** kleinste verwendete Schrittweite */
  hmin: number;
}

/** Ableitung nach Ridders (Extrapolation zentraler Differenzen) mit Fehlerschätzung. */
function ridders(f: Fn, x: number, h: number): RiddersResult {
  const CON = 1.4;
  const CON2 = CON * CON;
  const NTAB = 10;
  const SAFE = 2;
  const a: number[][] = Array.from({ length: NTAB }, () => new Array<number>(NTAB).fill(0));
  const d = (hh: number): number => {
    const v = (f(x + hh) - f(x - hh)) / (2 * hh);
    if (!Number.isFinite(v)) throw new CalcError('DOMAIN');
    return v;
  };
  let hh = h;
  a[0][0] = d(hh);
  let err = Number.MAX_VALUE;
  let ans = a[0][0];
  let hmin = hh;
  for (let i = 1; i < NTAB; i++) {
    hh /= CON;
    a[0][i] = d(hh);
    let fac = CON2;
    for (let j = 1; j <= i; j++) {
      a[j][i] = (a[j - 1][i] * fac - a[j - 1][i - 1]) / (fac - 1);
      fac = CON2 * fac;
      const errt = Math.max(Math.abs(a[j][i] - a[j - 1][i]), Math.abs(a[j][i] - a[j - 1][i - 1]));
      if (errt <= err) {
        err = errt;
        ans = a[j][i];
        hmin = hh;
      }
    }
    if (Math.abs(a[i][i] - a[i - 1][i - 1]) >= SAFE * err) break;
  }
  return { value: ans, err, hmin };
}

/**
 * Ableitung f'(x). Es werden mehrere Anfangsschrittweiten probiert (absolut und relativ zu x);
 * verwendet wird das Ergebnis mit der kleinsten Fehlerschätzung. Dadurch stören weder nahe
 * Polstellen und Knicke noch kurze Perioden bei großem |x|.
 */
export function differentiate(f: Fn, x: number): number {
  const ax = Math.abs(x);
  const f0 = Math.abs(safe(f, x)) || 0;
  const steps = new Set<number>([1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6]);
  if (ax > 0) for (const m of [1e-2, 1e-3, 1e-4, 1e-5, 1e-6]) steps.add(m * ax);
  let best: RiddersResult | null = null;
  let bestErr = Infinity;
  let lastErr: unknown = null;
  for (const h of [...steps].sort((p, q) => q - p)) {
    if (!(h > 0) || x + h === x) continue;
    try {
      const r = ridders(f, x, h);
      // Gesamtfehler: Extrapolationsfehler plus Rundungsrauschen der Differenzenquotienten
      // (Funktionswerte und Argument x ± h sind nur auf etwa 16 Stellen genau)
      const noise = (4 * EPS * (f0 + Math.abs(r.value) * ax)) / r.hmin;
      const total = r.err + noise;
      if (total < bestErr) {
        best = r;
        bestErr = total;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  if (!best) throw lastErr instanceof CalcError ? lastErr : new CalcError('DOMAIN');
  // Werte unterhalb des Rundungsrauschens (≈ eps·|f|/h) als 0 ausgeben
  const fmax = Math.max(f0, Math.abs(safe(f, x + best.hmin)) || 0, Math.abs(safe(f, x - best.hmin)) || 0);
  if (Math.abs(best.value) <= (16 * EPS * fmax) / best.hmin) return 0;
  return best.value;
}

// ───────────────────────────── Nullstellensuche ─────────────────────────────

/**
 * Steigung bei x; die Schrittweite wächst, bis sich der Funktionswert messbar ändert –
 * höchstens bis `maxRel`·max(|x|, 1).
 */
function slopeAt(f: Fn, x: number, fx: number, maxRel = 1e13): number | null {
  const base = Math.max(Math.abs(x), 1);
  let h = base * 1e-7;
  for (let i = 0; i < 12; i++) {
    const f1 = safe(f, x + h);
    const f2 = safe(f, x - h);
    let d: number | null = null;
    if (!Number.isNaN(f1) && !Number.isNaN(f2)) d = (f1 - f2) / (2 * h);
    else if (!Number.isNaN(f1)) d = (f1 - fx) / h;
    else if (!Number.isNaN(f2)) d = (fx - f2) / h;
    if (d !== null && d !== 0 && Number.isFinite(d)) return d;
    if (d === null) {
      // beide Nachbarpunkte außerhalb des Definitionsbereichs: kleinere Schritte versuchen
      if (i >= 4) return null;
      h /= 100;
      continue;
    }
    h *= 100;
    if (h > base * maxRel) break;
  }
  return null;
}

/** Newton-Verfahren mit Schrittweitenhalbierung (der Betrag von f muss in jedem Schritt abnehmen). */
function newton(f: Fn, x0: number): number | null {
  let x = x0;
  let fx = safe(f, x);
  if (Number.isNaN(fx)) return null;
  for (let iter = 0; iter < 400; iter++) {
    if (fx === 0) return x;
    const d = slopeAt(f, x, fx);
    if (d === null) return null;
    const step = fx / d;
    let t = 1;
    let xn = x;
    let fn = fx;
    let found = false;
    for (let k = 0; k < 50; k++) {
      xn = x - t * step;
      if (xn === x) break;
      fn = safe(f, xn);
      if (!Number.isNaN(fn) && Math.abs(fn) < Math.abs(fx)) {
        found = true;
        break;
      }
      t /= 2;
    }
    if (!found) {
      // keine Verbesserung mehr möglich: konvergiert (im Rahmen der Rechengenauigkeit) oder festgefahren
      return x;
    }
    x = xn;
    fx = fn;
  }
  return x;
}

/** Rundet eine Nullstelle auf „glatte“ Werte, wenn der Funktionswert dort nicht schlechter ist. */
function polish(f: Fn, x: number): number {
  const fx = Math.abs(safe(f, x));
  if (Number.isNaN(fx)) return x;
  const candidates: number[] = [];
  if (Math.abs(x) < 1e-9) candidates.push(0);
  for (const digits of [3, 6, 9, 12]) candidates.push(Number(x.toPrecision(digits)));
  for (const c of candidates) {
    if (c === x) continue;
    const fc = Math.abs(safe(f, c));
    if (!Number.isNaN(fc) && fc <= fx) return c;
  }
  return x;
}

function bisect(f: Fn, a: number, b: number, fa: number, fb: number): number {
  for (let i = 0; i < 200; i++) {
    const m = 0.5 * (a + b);
    if (m === a || m === b) break;
    const fm = safe(f, m);
    if (Number.isNaN(fm)) break;
    if (fm === 0) return m;
    if (fa < 0 === fm < 0) {
      a = m;
      fa = fm;
    } else {
      b = m;
      fb = fm;
    }
  }
  return Math.abs(fa) < Math.abs(fb) ? a : b;
}

export interface SolveResult {
  root: number;
  /** Funktionswert an der gefundenen Stelle (L − R). */
  residual: number;
}

/** Prüft, ob x tatsächlich eine Nullstelle ist: Der nächste Newton-Schritt muss verschwindend klein sein. */
function accept(f: Fn, x: number | null): SolveResult | null {
  if (x === null || !Number.isFinite(x)) return null;
  const p = polish(f, x);
  const r = safe(f, p);
  if (Number.isNaN(r)) return null;
  if (r === 0) return { root: p, residual: 0 };
  // nur die lokale Steigung zählt (eine Sekante über große Entfernungen wäre hier irreführend)
  const d = slopeAt(f, p, r, 1e-3);
  if (d === null) return null;
  const step = Math.abs(r / d);
  if (step <= 1e-9 * Math.abs(p) || step <= 1e-300) return { root: p, residual: r };
  return null;
}

/** Löst f(x) = 0 mit dem Newton-Verfahren ab dem Startwert x0 (mit Ausweichstrategien). */
export function solve(f: Fn, x0: number): SolveResult {
  const direct = accept(f, newton(f, x0));
  if (direct) return direct;
  // weitere Startwerte
  const starts: number[] = [];
  for (const d of [0.5, 1, 2, 5, 10, 50, 100, 1000]) starts.push(x0 + d, x0 - d);
  for (const s of starts) {
    const r = accept(f, newton(f, s));
    if (r) return r;
  }
  // Vorzeichenwechsel in wachsender Umgebung suchen
  for (const radius of [1, 10, 100, 1000, 1e4, 1e6]) {
    const N = 400;
    let prevX = x0 - radius;
    let prevF = safe(f, prevX);
    for (let i = 1; i <= N; i++) {
      const x = x0 - radius + (2 * radius * i) / N;
      const fx = safe(f, x);
      if (!Number.isNaN(fx) && !Number.isNaN(prevF)) {
        if (fx === 0) {
          const r = accept(f, x);
          if (r) return r;
        }
        if (prevF < 0 !== fx < 0) {
          const r = accept(f, bisect(f, prevX, x, prevF, fx));
          if (r) return r;
        }
      }
      prevX = x;
      prevF = fx;
    }
  }
  throw new CalcError('NOSOL', 'Es wurde keine Lösung gefunden. Bitte einen anderen Startwert versuchen.');
}
