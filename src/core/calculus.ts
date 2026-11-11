/** Numerische Verfahren: Integration, Ableitung, Nullstellensuche. */
import { CalcError } from './errors';

export type Fn = (x: number) => number;

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

function gk15(f: Fn, a: number, b: number): [number, number] {
  const c = 0.5 * (a + b);
  const h = 0.5 * (b - a);
  const fc = f(c);
  let k = fc * WGK[7];
  let g = fc * WG[3];
  for (let j = 0; j < 7; j++) {
    const dx = h * XGK[j];
    const f1 = f(c - dx);
    const f2 = f(c + dx);
    k += WGK[j] * (f1 + f2);
    if (j % 2 === 1) g += WG[(j - 1) / 2] * (f1 + f2);
  }
  return [k * h, Math.abs((k - g) * h)];
}

/** Bestimmtes Integral von f über [a, b] (adaptives Gauß-Kronrod-Verfahren). */
export function integrate(f: Fn, a: number, b: number, relTol = 1e-11): number {
  if (a === b) return 0;
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new CalcError('RANGE', 'Die Integrationsgrenzen müssen endlich sein.');
  if (a > b) return -integrate(f, b, a, relTol);
  let evals = 0;
  const g: Fn = (x) => {
    evals++;
    const y = f(x);
    if (!Number.isFinite(y)) throw new CalcError('DOMAIN', 'Der Integrand ist im Intervall nicht überall definiert.');
    return y;
  };
  const [whole, err0] = gk15(g, a, b);
  // globale adaptive Unterteilung: immer das Teilintervall mit dem größten Fehler halbieren
  type Seg = { a: number; b: number; v: number; e: number };
  const segs: Seg[] = [{ a, b, v: whole, e: err0 }];
  let total = whole;
  let errSum = err0;
  const absTol = 1e-13;
  while (errSum > Math.max(absTol, relTol * Math.abs(total))) {
    if (evals > 60000 || segs.length > 2000) {
      if (errSum <= 1e-6 * Math.max(1, Math.abs(total))) break;
      throw new CalcError('TIMEOUT', 'Das Integral konvergiert nicht.');
    }
    let worst = 0;
    for (let i = 1; i < segs.length; i++) if (segs[i].e > segs[worst].e) worst = i;
    const s = segs[worst];
    const m = 0.5 * (s.a + s.b);
    if (m === s.a || m === s.b) {
      s.e = 0; // nicht weiter teilbar
      errSum = segs.reduce((acc, x) => acc + x.e, 0);
      continue;
    }
    const [v1, e1] = gk15(g, s.a, m);
    const [v2, e2] = gk15(g, m, s.b);
    segs[worst] = { a: s.a, b: m, v: v1, e: e1 };
    segs.push({ a: m, b: s.b, v: v2, e: e2 });
    total = 0;
    errSum = 0;
    for (const x of segs) {
      total += x.v;
      errSum += x.e;
    }
  }
  return total;
}

/** Ableitung f'(x) nach Ridders (Extrapolation zentraler Differenzen). */
export function differentiate(f: Fn, x: number): number {
  let h = Math.max(Math.abs(x), 1) * 2e-3;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const d = ridders(f, x, h);
      // Rundungsrauschen um 0 entfernen (Größenordnung eps·|f|/h)
      const fmax = Math.max(Math.abs(f(x + h)), Math.abs(f(x - h)), Math.abs(f(x)));
      if (Math.abs(d) < (1e-13 * fmax) / h) return 0;
      return d;
    } catch (e) {
      lastErr = e;
      h /= 20;
    }
  }
  throw lastErr instanceof CalcError ? lastErr : new CalcError('DOMAIN');
}

function ridders(f: Fn, x: number, h: number): number {
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
      }
    }
    if (Math.abs(a[i][i] - a[i - 1][i - 1]) >= SAFE * err) break;
  }
  return ans;
}

function safe(f: Fn, x: number): number {
  try {
    const y = f(x);
    return Number.isFinite(y) ? y : NaN;
  } catch {
    return NaN;
  }
}

/** Rundet eine Nullstelle auf „glatte“ Werte, wenn der Funktionswert dort nicht schlechter ist. */
function polish(f: Fn, x: number): number {
  const fx = Math.abs(safe(f, x));
  if (fx === 0) return x;
  for (const digits of [3, 6, 9, 12]) {
    const r = Number(x.toPrecision(digits));
    const fr = Math.abs(safe(f, r));
    if (fr === 0 || fr <= fx) return r;
  }
  return x;
}

function newton(f: Fn, x0: number): number | null {
  let x = x0;
  let fx = safe(f, x);
  if (Number.isNaN(fx)) return null;
  for (let iter = 0; iter < 80; iter++) {
    if (fx === 0) return x;
    const h = Math.max(Math.abs(x), 1) * 1e-7;
    const f1 = safe(f, x + h);
    const f2 = safe(f, x - h);
    let d: number;
    if (!Number.isNaN(f1) && !Number.isNaN(f2)) d = (f1 - f2) / (2 * h);
    else if (!Number.isNaN(f1)) d = (f1 - fx) / h;
    else if (!Number.isNaN(f2)) d = (fx - f2) / h;
    else return null;
    if (d === 0 || !Number.isFinite(d)) return null;
    let step = fx / d;
    let xn = x - step;
    let fn = safe(f, xn);
    let damp = 0;
    while ((Number.isNaN(fn) || Math.abs(fn) > Math.abs(fx) * 4) && damp < 30) {
      step /= 2;
      xn = x - step;
      fn = safe(f, xn);
      damp++;
    }
    if (Number.isNaN(fn)) return null;
    const dx = Math.abs(xn - x);
    x = xn;
    fx = fn;
    if (dx <= 1e-14 * Math.max(1, Math.abs(x))) {
      return x;
    }
  }
  return Math.abs(fx) < 1e-9 ? x : null;
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

function accept(f: Fn, x: number | null): SolveResult | null {
  if (x === null || !Number.isFinite(x)) return null;
  const p = polish(f, x);
  const r = safe(f, p);
  if (Number.isNaN(r)) return null;
  // Skalierung zur Beurteilung des Restes
  const h = Math.max(Math.abs(p), 1) * 1e-6;
  const slope = Math.abs((safe(f, p + h) - safe(f, p - h)) / (2 * h));
  const tol = 1e-9 * Math.max(1, Number.isFinite(slope) ? slope * Math.max(1, Math.abs(p)) : 1);
  if (Math.abs(r) > tol) return null;
  return { root: p, residual: r };
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
