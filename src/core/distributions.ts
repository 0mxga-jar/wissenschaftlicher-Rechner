/** Wahrscheinlichkeitsverteilungen: Normal-, Binomial- und Poisson-Verteilung. */
import { CalcError } from './errors';

const SQRT_PI = Math.sqrt(Math.PI);
const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** Komplementäre Fehlerfunktion mit hoher relativer Genauigkeit. */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return 2 - erfc(-x);
  if (x < 2) {
    // erf(x) = 2/√π · e^(−x²) · Σ 2ⁿ x^(2n+1) / (1·3·…·(2n+1))
    let term = x;
    let sum = x;
    for (let n = 1; n < 200; n++) {
      term *= (2 * x * x) / (2 * n + 1);
      sum += term;
      if (term < sum * 1e-17) break;
    }
    return 1 - (2 / SQRT_PI) * Math.exp(-x * x) * sum;
  }
  if (x > 27) return 0;
  // Kettenbruch (rückwärts ausgewertet)
  let t = x;
  for (let k = 160; k >= 1; k--) t = x + k / 2 / t;
  return Math.exp(-x * x) / (SQRT_PI * t);
}

export function erf(x: number): number {
  return 1 - erfc(x);
}

/** Logarithmus der Gammafunktion (Lanczos-Näherung). */
export function lgamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function need(cond: boolean, msg: string): void {
  if (!cond) throw new CalcError('ARG', msg);
}

// ───────────────────────────── Normalverteilung ─────────────────────────────

/** Dichte der Normalverteilung. */
export function normalPdf(x: number, mu = 0, sigma = 1): number {
  need(sigma > 0, 'Die Standardabweichung σ muss größer als 0 sein.');
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * SQRT_2PI);
}

/** Verteilungsfunktion P(X ≤ x). */
export function normalCdf(x: number, mu = 0, sigma = 1): number {
  need(sigma > 0, 'Die Standardabweichung σ muss größer als 0 sein.');
  if (x === Infinity) return 1;
  if (x === -Infinity) return 0;
  return 0.5 * erfc(-(x - mu) / (sigma * Math.SQRT2));
}

/** P(lower ≤ X ≤ upper). */
export function normalCdfRange(lower: number, upper: number, mu = 0, sigma = 1): number {
  need(sigma > 0, 'Die Standardabweichung σ muss größer als 0 sein.');
  need(lower <= upper, 'Die untere Grenze darf nicht größer als die obere sein.');
  // im oberen Schwanz mit den Gegenwahrscheinlichkeiten rechnen (genauer)
  if (lower > mu) return normalCdf(2 * mu - lower, mu, sigma) - normalCdf(2 * mu - upper, mu, sigma);
  return normalCdf(upper, mu, sigma) - normalCdf(lower, mu, sigma);
}

/** Quantil: x mit P(X ≤ x) = p. */
export function normalInv(p: number, mu = 0, sigma = 1): number {
  need(sigma > 0, 'Die Standardabweichung σ muss größer als 0 sein.');
  need(p > 0 && p < 1, 'Die Fläche (Wahrscheinlichkeit) muss zwischen 0 und 1 liegen.');
  // Näherung nach Acklam
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968,
    2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let x: number;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pl) {
    const q = p - 0.5;
    const r = q * q;
    x =
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  // Verfeinerung (Halley) mit der genauen Verteilungsfunktion
  for (let i = 0; i < 3; i++) {
    const e = 0.5 * erfc(-x / Math.SQRT2) - p;
    const u = e * SQRT_2PI * Math.exp((x * x) / 2);
    x -= u / (1 + (x * u) / 2);
  }
  return mu + sigma * x;
}

// ───────────────────────────── Binomialverteilung ─────────────────────────────

function checkBinom(n: number, p: number): void {
  need(Number.isInteger(n) && n >= 0, 'Die Anzahl n muss eine natürliche Zahl sein.');
  need(n <= 1e6, 'Die Anzahl n ist zu groß.');
  need(p >= 0 && p <= 1, 'Die Wahrscheinlichkeit p muss zwischen 0 und 1 liegen.');
}

function binomRaw(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  if (n <= 1000) {
    const kk = Math.min(k, n - k);
    let c = 1;
    for (let i = 1; i <= kk; i++) c = (c * (n - kk + i)) / i;
    const v = c * Math.pow(p, k) * Math.pow(1 - p, n - k);
    if (v > 0 && Number.isFinite(v)) return v;
  }
  return Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log1p(-p));
}

/** P(X = k) für X ~ B(n; p). */
export function binomPmf(k: number, n: number, p: number): number {
  checkBinom(n, p);
  need(Number.isInteger(k), 'Die Trefferzahl x muss ganzzahlig sein.');
  return binomRaw(k, n, p);
}

/** P(X ≤ k) für X ~ B(n; p). */
export function binomCdf(k: number, n: number, p: number): number {
  checkBinom(n, p);
  k = Math.floor(k);
  if (k < 0) return 0;
  if (k >= n) return 1;
  let s = 0;
  for (let i = 0; i <= k; i++) s += binomRaw(i, n, p);
  return Math.min(1, s);
}

/** Kleinstes k mit P(X ≤ k) ≥ area. */
export function binomInv(area: number, n: number, p: number): number {
  checkBinom(n, p);
  need(area >= 0 && area <= 1, 'Die Fläche (Wahrscheinlichkeit) muss zwischen 0 und 1 liegen.');
  let s = 0;
  for (let k = 0; k <= n; k++) {
    s += binomRaw(k, n, p);
    if (s >= area - 1e-13) return k;
  }
  return n;
}

// ───────────────────────────── Poisson-Verteilung ─────────────────────────────

function poissonRaw(k: number, mu: number): number {
  if (k < 0) return 0;
  if (mu === 0) return k === 0 ? 1 : 0;
  if (k <= 20 && mu < 700) {
    let f = 1;
    for (let i = 2; i <= k; i++) f *= i;
    return (Math.exp(-mu) * Math.pow(mu, k)) / f;
  }
  return Math.exp(-mu + k * Math.log(mu) - lgamma(k + 1));
}

/** P(X = k) für X ~ Po(μ). */
export function poissonPmf(k: number, mu: number): number {
  need(mu >= 0, 'Der Erwartungswert μ darf nicht negativ sein.');
  need(Number.isInteger(k), 'Der Wert x muss ganzzahlig sein.');
  return poissonRaw(k, mu);
}

/** P(X ≤ k) für X ~ Po(μ). */
export function poissonCdf(k: number, mu: number): number {
  need(mu >= 0, 'Der Erwartungswert μ darf nicht negativ sein.');
  k = Math.floor(k);
  if (k < 0) return 0;
  need(k <= 1e6, 'Der Wert x ist zu groß.');
  let s = 0;
  for (let i = 0; i <= k; i++) s += poissonRaw(i, mu);
  return Math.min(1, s);
}

/** Kleinstes k mit P(X ≤ k) ≥ area. */
export function poissonInv(area: number, mu: number): number {
  need(mu >= 0, 'Der Erwartungswert μ darf nicht negativ sein.');
  need(area >= 0 && area < 1, 'Die Fläche (Wahrscheinlichkeit) muss zwischen 0 und 1 liegen (kleiner als 1).');
  let s = 0;
  for (let k = 0; k < 1e6; k++) {
    s += poissonRaw(k, mu);
    if (s >= area - 1e-13) return k;
  }
  throw new CalcError('TIMEOUT');
}
