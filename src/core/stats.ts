/** Statistik: Kennwerte für eine und zwei Variablen, Regressionen. */
import { CalcError } from './errors';

export interface OneVarStats {
  n: number;
  sum: number;
  sumSq: number;
  mean: number;
  /** Varianz und Standardabweichung der Grundgesamtheit */
  popVar: number;
  popSd: number;
  /** Stichprobenvarianz und -standardabweichung (n − 1) */
  sampleVar: number;
  sampleSd: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

function checkData(xs: number[], freqs?: number[]): number[] {
  const f = freqs ?? xs.map(() => 1);
  if (f.length !== xs.length) throw new CalcError('DIM', 'Zu jedem Wert gehört genau eine Häufigkeit.');
  for (const v of f) {
    if (!(v >= 0)) throw new CalcError('ARG', 'Häufigkeiten dürfen nicht negativ sein.');
  }
  const n = f.reduce((a, b) => a + b, 0);
  if (xs.length === 0 || n <= 0) throw new CalcError('ARG', 'Es sind keine Daten vorhanden.');
  return f;
}

/** Kennwerte einer Datenreihe (optional mit Häufigkeiten). */
export function oneVar(xs: number[], freqs?: number[]): OneVarStats {
  const f = checkData(xs, freqs);
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < xs.length; i++) {
    n += f[i];
    sum += f[i] * xs[i];
    sumSq += f[i] * xs[i] * xs[i];
  }
  const mean = sum / n;
  let ss = 0;
  for (let i = 0; i < xs.length; i++) ss += f[i] * (xs[i] - mean) ** 2;
  const popVar = ss / n;
  const sampleVar = n > 1 ? ss / (n - 1) : NaN;

  // sortierte Werte mit kumulierten Häufigkeiten
  const pairs = xs.map((x, i) => ({ x, f: f[i] })).filter((p) => p.f > 0);
  pairs.sort((a, b) => a.x - b.x);
  const min = pairs[0].x;
  const max = pairs[pairs.length - 1].x;
  let q1 = NaN;
  let median = NaN;
  let q3 = NaN;
  if (Number.isInteger(n)) {
    const at = (k: number): number => {
      // k-ter Wert (1-basiert) der sortierten, ausgeschriebenen Liste
      let cum = 0;
      for (const p of pairs) {
        cum += p.f;
        if (k <= cum) return p.x;
      }
      return max;
    };
    const med = (from: number, count: number): number => {
      if (count <= 0) return NaN;
      if (count % 2 === 1) return at(from + (count - 1) / 2);
      return (at(from + count / 2 - 1) + at(from + count / 2)) / 2;
    };
    median = med(1, n);
    const half = Math.floor(n / 2);
    if (half >= 1) {
      q1 = med(1, half);
      q3 = med(n - half + 1, half);
    } else {
      q1 = median;
      q3 = median;
    }
  }
  return {
    n,
    sum,
    sumSq,
    mean,
    popVar,
    popSd: Math.sqrt(popVar),
    sampleVar,
    sampleSd: Math.sqrt(sampleVar),
    min,
    q1,
    median,
    q3,
    max,
  };
}

export interface TwoVarStats {
  n: number;
  sumX: number;
  sumX2: number;
  meanX: number;
  popSdX: number;
  sampleSdX: number;
  sumY: number;
  sumY2: number;
  meanY: number;
  popSdY: number;
  sampleSdY: number;
  sumXY: number;
  sumX3: number;
  sumX2Y: number;
  sumX4: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Kennwerte für Wertepaare (x, y). */
export function twoVar(xs: number[], ys: number[], freqs?: number[]): TwoVarStats {
  if (xs.length !== ys.length) throw new CalcError('DIM', 'x und y müssen gleich viele Werte enthalten.');
  const f = checkData(xs, freqs);
  let n = 0;
  let sx = 0;
  let sx2 = 0;
  let sy = 0;
  let sy2 = 0;
  let sxy = 0;
  let sx3 = 0;
  let sx2y = 0;
  let sx4 = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < xs.length; i++) {
    const w = f[i];
    const x = xs[i];
    const y = ys[i];
    n += w;
    sx += w * x;
    sx2 += w * x * x;
    sy += w * y;
    sy2 += w * y * y;
    sxy += w * x * y;
    sx3 += w * x * x * x;
    sx2y += w * x * x * y;
    sx4 += w * x * x * x * x;
    if (w > 0) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  const mx = sx / n;
  const my = sy / n;
  let ssx = 0;
  let ssy = 0;
  for (let i = 0; i < xs.length; i++) {
    ssx += f[i] * (xs[i] - mx) ** 2;
    ssy += f[i] * (ys[i] - my) ** 2;
  }
  return {
    n,
    sumX: sx,
    sumX2: sx2,
    meanX: mx,
    popSdX: Math.sqrt(ssx / n),
    sampleSdX: n > 1 ? Math.sqrt(ssx / (n - 1)) : NaN,
    sumY: sy,
    sumY2: sy2,
    meanY: my,
    popSdY: Math.sqrt(ssy / n),
    sampleSdY: n > 1 ? Math.sqrt(ssy / (n - 1)) : NaN,
    sumXY: sxy,
    sumX3: sx3,
    sumX2Y: sx2y,
    sumX4: sx4,
    minX,
    maxX,
    minY,
    maxY,
  };
}

export type RegType = 'linear' | 'quadratic' | 'log' | 'exp' | 'abexp' | 'power' | 'inverse';

export const REG_INFO: Record<RegType, { name: string; formula: string }> = {
  linear: { name: 'Linear', formula: 'y = a + b·x' },
  quadratic: { name: 'Quadratisch', formula: 'y = a + b·x + c·x²' },
  log: { name: 'Logarithmisch', formula: 'y = a + b·ln(x)' },
  exp: { name: 'e-Funktion', formula: 'y = a·e^(b·x)' },
  abexp: { name: 'Exponentiell a·bˣ', formula: 'y = a·b^x' },
  power: { name: 'Potenz', formula: 'y = a·x^b' },
  inverse: { name: 'Invers', formula: 'y = a + b/x' },
};

export interface Regression {
  type: RegType;
  a: number;
  b: number;
  c?: number;
  /** Korrelationskoeffizient (bei quadratischer Regression nicht definiert) */
  r: number | null;
  /** Bestimmtheitsmaß */
  r2: number;
  /** Schätzwert ŷ zu gegebenem x */
  predictY: (x: number) => number;
  /** Schätzwert(e) x̂ zu gegebenem y */
  predictX: (y: number) => number[];
}

interface LinFit {
  a: number;
  b: number;
  r: number;
}

function linFit(X: number[], Y: number[], f: number[]): LinFit {
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < X.length; i++) {
    n += f[i];
    sx += f[i] * X[i];
    sy += f[i] * Y[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < X.length; i++) {
    sxx += f[i] * (X[i] - mx) ** 2;
    syy += f[i] * (Y[i] - my) ** 2;
    sxy += f[i] * (X[i] - mx) * (Y[i] - my);
  }
  if (sxx === 0) throw new CalcError('DIV0', 'Alle x-Werte sind gleich – keine Regression möglich.');
  const b = sxy / sxx;
  const a = my - b * mx;
  const r = syy === 0 ? 1 : sxy / Math.sqrt(sxx * syy);
  return { a, b, r };
}

function solve3(m: number[][], v: number[]): number[] {
  const a = m.map((row, i) => [...row, v[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let i = c + 1; i < 3; i++) if (Math.abs(a[i][c]) > Math.abs(a[p][c])) p = i;
    if (Math.abs(a[p][c]) < 1e-300) throw new CalcError('DIV0', 'Die Daten reichen für diese Regression nicht aus.');
    [a[c], a[p]] = [a[p], a[c]];
    for (let i = 0; i < 3; i++) {
      if (i === c) continue;
      const fct = a[i][c] / a[c][c];
      for (let j = c; j < 4; j++) a[i][j] -= fct * a[c][j];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

/** Regressionsrechnung für Wertepaare. */
export function regression(type: RegType, xs: number[], ys: number[], freqs?: number[]): Regression {
  if (xs.length !== ys.length) throw new CalcError('DIM', 'x und y müssen gleich viele Werte enthalten.');
  const all = checkData(xs, freqs);
  // Zeilen mit Häufigkeit 0 zählen nicht (auch nicht für den Definitionsbereich)
  const keep = all.map((w) => w > 0);
  xs = xs.filter((_, i) => keep[i]);
  ys = ys.filter((_, i) => keep[i]);
  const f = all.filter((w) => w > 0);
  const need = type === 'quadratic' ? 3 : 2;
  if (xs.length < need) {
    throw new CalcError('ARG', `Für diese Regression werden mindestens ${need} Wertepaare benötigt.`);
  }
  const lnAll = (v: number[], what: string): number[] =>
    v.map((t) => {
      if (t <= 0) throw new CalcError('DOMAIN', `Für diese Regression müssen alle ${what}-Werte positiv sein.`);
      return Math.log(t);
    });

  if (type === 'quadratic') {
    // um den Mittelwert zentrieren (bessere Kondition), danach zurückrechnen
    let n = 0;
    let sx = 0;
    for (let i = 0; i < xs.length; i++) {
      n += f[i];
      sx += f[i] * xs[i];
    }
    const mx = sx / n;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    let t0 = 0;
    let t1 = 0;
    let t2 = 0;
    for (let i = 0; i < xs.length; i++) {
      const u = xs[i] - mx;
      const w = f[i];
      s1 += w * u;
      s2 += w * u * u;
      s3 += w * u * u * u;
      s4 += w * u * u * u * u;
      t0 += w * ys[i];
      t1 += w * u * ys[i];
      t2 += w * u * u * ys[i];
    }
    const [A, B, C] = solve3(
      [
        [n, s1, s2],
        [s1, s2, s3],
        [s2, s3, s4],
      ],
      [t0, t1, t2],
    );
    const c = C;
    const b = B - 2 * C * mx;
    const a = A - B * mx + C * mx * mx;
    const predictY = (x: number) => a + b * x + c * x * x;
    const my = t0 / n;
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < xs.length; i++) {
      ssRes += f[i] * (ys[i] - predictY(xs[i])) ** 2;
      ssTot += f[i] * (ys[i] - my) ** 2;
    }
    return {
      type,
      a,
      b,
      c,
      r: null,
      r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot,
      predictY,
      predictX: (y) => {
        if (c === 0) return b === 0 ? [] : [(y - a) / b];
        const D = b * b - 4 * c * (a - y);
        if (D < 0) return [];
        const s = Math.sqrt(D);
        return D === 0 ? [-b / (2 * c)] : [(-b + s) / (2 * c), (-b - s) / (2 * c)];
      },
    };
  }

  switch (type) {
    case 'linear': {
      const { a, b, r } = linFit(xs, ys, f);
      return { type, a, b, r, r2: r * r, predictY: (x) => a + b * x, predictX: (y) => [(y - a) / b] };
    }
    case 'log': {
      const { a, b, r } = linFit(lnAll(xs, 'x'), ys, f);
      return {
        type,
        a,
        b,
        r,
        r2: r * r,
        predictY: (x) => a + b * Math.log(x),
        predictX: (y) => [Math.exp((y - a) / b)],
      };
    }
    case 'exp': {
      const fit = linFit(xs, lnAll(ys, 'y'), f);
      const a = Math.exp(fit.a);
      const b = fit.b;
      return {
        type,
        a,
        b,
        r: fit.r,
        r2: fit.r * fit.r,
        predictY: (x) => a * Math.exp(b * x),
        predictX: (y) => [Math.log(y / a) / b],
      };
    }
    case 'abexp': {
      const fit = linFit(xs, lnAll(ys, 'y'), f);
      const a = Math.exp(fit.a);
      const b = Math.exp(fit.b);
      return {
        type,
        a,
        b,
        r: fit.r,
        r2: fit.r * fit.r,
        predictY: (x) => a * Math.pow(b, x),
        predictX: (y) => [Math.log(y / a) / Math.log(b)],
      };
    }
    case 'power': {
      const fit = linFit(lnAll(xs, 'x'), lnAll(ys, 'y'), f);
      const a = Math.exp(fit.a);
      const b = fit.b;
      return {
        type,
        a,
        b,
        r: fit.r,
        r2: fit.r * fit.r,
        predictY: (x) => a * Math.pow(x, b),
        predictX: (y) => [Math.pow(y / a, 1 / b)],
      };
    }
    default: {
      // invers: y = a + b/x
      const inv = xs.map((x) => {
        if (x === 0) throw new CalcError('DIV0', 'Für die inverse Regression darf kein x-Wert 0 sein.');
        return 1 / x;
      });
      const { a, b, r } = linFit(inv, ys, f);
      return { type, a, b, r, r2: r * r, predictY: (x) => a + b / x, predictX: (y) => [b / (y - a)] };
    }
  }
}
