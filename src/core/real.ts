/**
 * Reelle Zahlen: Gleitkommawert plus (wenn möglich) exakte Darstellung.
 * Alle Operationen versuchen zunächst exakt zu rechnen und fallen sonst auf double zurück.
 */
import { CalcError } from './errors';
import { Exact, sqrtRat, surd, extractSquare } from './exact';
import { Rat, bgcd, exactRoot, babs } from './rat';

export type AngleUnit = 'DEG' | 'RAD' | 'GRA';

export class Real {
  readonly kind = 'real' as const;
  readonly n: number;
  readonly ex: Exact | null;

  constructor(n: number, ex: Exact | null = null) {
    this.n = n === 0 ? 0 : n; // -0 vermeiden
    this.ex = ex;
  }

  static readonly ZERO = new Real(0, Exact.ZERO);
  static readonly ONE = new Real(1, Exact.ONE);
  static readonly PI = new Real(Math.PI, Exact.PI);
  static readonly E = new Real(Math.E, null);

  /** Aus double; ganzzahlige Werte werden als exakt angesehen. */
  static num(x: number): Real {
    if (Number.isNaN(x)) throw new CalcError('DOMAIN');
    if (!Number.isFinite(x)) throw new CalcError('OVERFLOW');
    if (Number.isSafeInteger(x)) return new Real(x, Exact.fromInt(x));
    return new Real(x, null);
  }
  /** Rein numerisch (ohne exakte Form). */
  static approx(x: number): Real {
    if (Number.isNaN(x)) throw new CalcError('DOMAIN');
    if (!Number.isFinite(x)) throw new CalcError('OVERFLOW');
    return new Real(x, null);
  }
  static int(n: number | bigint): Real {
    const e = Exact.fromInt(n);
    return new Real(e.toNumber(), e);
  }
  static rat(n: number | bigint, d: number | bigint): Real {
    const e = Exact.rat(n, d);
    return new Real(e.toNumber(), e);
  }
  static fromRat(q: Rat): Real {
    return new Real(q.toNumber(), Exact.fromRat(q));
  }
  static fromExact(e: Exact): Real {
    const n = e.toNumber();
    if (!Number.isFinite(n)) throw new CalcError('OVERFLOW');
    return new Real(n, e);
  }

  isZero(): boolean {
    return this.ex ? this.ex.isZero() : this.n === 0;
  }
  isInt(): boolean {
    return this.ex ? this.ex.isInteger() : Number.isInteger(this.n);
  }
  /** Rationale Darstellung, falls vorhanden. */
  rat(): Rat | null {
    return this.ex && this.ex.isRational() ? this.ex.asRat() : null;
  }
}

function fin(x: number, ex: Exact | null = null): Real {
  if (Number.isNaN(x)) throw new CalcError('DOMAIN');
  if (!Number.isFinite(x)) throw new CalcError('OVERFLOW');
  if (ex === null && Number.isSafeInteger(x) && Math.abs(x) < 1e15) return new Real(x, Exact.fromInt(x));
  return new Real(x, ex);
}

function fromEx(e: Exact | null, fallback: () => number): Real {
  if (e) {
    const n = e.toNumber();
    if (Number.isFinite(n)) return new Real(n, e);
  }
  const x = fallback();
  if (Number.isNaN(x)) throw new CalcError('DOMAIN');
  if (!Number.isFinite(x)) throw new CalcError('OVERFLOW');
  return new Real(x, null);
}

export function rNeg(a: Real): Real {
  return new Real(-a.n, a.ex ? a.ex.neg() : null);
}
export function rAdd(a: Real, b: Real): Real {
  if (a.ex && b.ex) return fromEx(a.ex.add(b.ex), () => a.n + b.n);
  return fin(a.n + b.n);
}
export function rSub(a: Real, b: Real): Real {
  if (a.ex && b.ex) return fromEx(a.ex.sub(b.ex), () => a.n - b.n);
  return fin(a.n - b.n);
}
export function rMul(a: Real, b: Real): Real {
  if (a.ex && b.ex) return fromEx(a.ex.mul(b.ex), () => a.n * b.n);
  return fin(a.n * b.n);
}
export function rDiv(a: Real, b: Real): Real {
  if (b.isZero()) throw new CalcError('DIV0');
  if (a.ex && b.ex) return fromEx(a.ex.div(b.ex), () => a.n / b.n);
  return fin(a.n / b.n);
}
export function rAbs(a: Real): Real {
  return a.n < 0 ? rNeg(a) : a;
}
export function rCmp(a: Real, b: Real): number {
  if (a.ex && b.ex) {
    const d = a.ex.sub(b.ex);
    if (d) return d.sign();
  }
  return a.n < b.n ? -1 : a.n > b.n ? 1 : 0;
}
export function rEq(a: Real, b: Real): boolean {
  if (a.ex && b.ex) return a.ex.equals(b.ex);
  return a.n === b.n;
}
export function rSign(a: Real): number {
  return a.ex ? a.ex.sign() : Math.sign(a.n);
}

export function rSqrt(a: Real): Real {
  if (a.n < 0) throw new CalcError('DOMAIN', 'Die Wurzel aus einer negativen Zahl ist nicht reell.');
  if (a.ex) return fromEx(a.ex.sqrt(), () => Math.sqrt(a.n));
  return fin(Math.sqrt(a.n));
}

function ratRoot(q: Rat, k: number): Rat | null {
  const n = exactRoot(q.n, k);
  if (n === null) return null;
  const d = exactRoot(q.d, k);
  if (d === null) return null;
  return Rat.of(n, d);
}

/** k-te Wurzel (k ganzzahlig ≠ 0); für ungerade k auch aus negativen Zahlen. */
export function rRoot(a: Real, k: Real): Real {
  if (k.isZero()) throw new CalcError('DIV0');
  if (k.isInt() && Math.abs(k.n) <= 1000) {
    const kk = k.n;
    const q = a.rat();
    if (q) {
      if (q.sign() < 0 && kk % 2 === 0) throw new CalcError('DOMAIN', 'Gerade Wurzel aus einer negativen Zahl.');
      if (Math.abs(kk) === 2 && q.sign() >= 0) {
        const s = sqrtRat(q);
        if (s) return kk > 0 ? Real.fromExact(s) : rDiv(Real.ONE, Real.fromExact(s));
      }
      const r = ratRoot(q, Math.abs(kk));
      if (r) return Real.fromRat(kk > 0 ? r : r.inv());
    }
    if (a.n < 0) {
      if (kk % 2 === 0) throw new CalcError('DOMAIN', 'Gerade Wurzel aus einer negativen Zahl.');
      return fin(-Math.pow(-a.n, 1 / kk));
    }
    if (a.n === 0 && kk < 0) throw new CalcError('DIV0');
    if (kk === 3) return fin(Math.cbrt(a.n));
    return fin(Math.pow(a.n, 1 / kk));
  }
  return rPow(a, rDiv(Real.ONE, k));
}

export function rPow(a: Real, b: Real): Real {
  // exakte ganzzahlige Potenz
  if (b.isInt() && Math.abs(b.n) <= 100000) {
    const e = b.n;
    if (a.isZero()) {
      if (e > 0) return Real.ZERO;
      if (e === 0) throw new CalcError('DOMAIN', '0 hoch 0 ist nicht definiert.');
      throw new CalcError('DIV0');
    }
    if (a.ex) {
      const p = a.ex.powInt(e);
      if (p) {
        const n = p.toNumber();
        if (Number.isFinite(n)) return new Real(n, p);
      }
    }
    return fin(Math.pow(a.n, e));
  }
  // rationale Basis und rationaler Exponent
  const qa = a.rat();
  const qb = b.rat();
  if (qa && qb && qb.d <= 64n && babs(qb.n) <= 64n) {
    const k = Number(qb.d);
    const p = Number(qb.n);
    if (qa.sign() < 0 && k % 2 === 0) throw new CalcError('DOMAIN', 'Negative Basis mit gebrochenem Exponenten.');
    if (qa.isZero()) {
      if (p > 0) return Real.ZERO;
      throw new CalcError('DIV0');
    }
    if (k === 2) {
      const s = sqrtRat(qa);
      const r = s ? s.powInt(p) : null;
      if (r) return Real.fromExact(r);
    } else {
      const r = ratRoot(qa, k);
      if (r) return Real.fromRat(r.pow(p));
    }
    if (qa.sign() < 0) {
      const v = Math.pow(-a.n, b.n);
      return fin(p % 2 === 0 ? v : -v);
    }
    return fin(Math.pow(a.n, b.n));
  }
  if (a.n < 0) {
    if (qb && qb.d % 2n === 1n) {
      const v = Math.pow(-a.n, b.n);
      return fin(qb.n % 2n === 0n ? v : -v);
    }
    if (Number.isInteger(b.n)) return fin(Math.pow(a.n, b.n));
    throw new CalcError('DOMAIN', 'Negative Basis mit gebrochenem Exponenten.');
  }
  if (a.n === 0) {
    if (b.n > 0) return Real.ZERO;
    if (b.n === 0) throw new CalcError('DOMAIN', '0 hoch 0 ist nicht definiert.');
    throw new CalcError('DIV0');
  }
  return fin(Math.pow(a.n, b.n));
}

export function rExp(a: Real): Real {
  if (a.isZero()) return Real.ONE;
  return fin(Math.exp(a.n));
}
export function rLn(a: Real): Real {
  if (a.n <= 0) throw new CalcError('DOMAIN', 'Der Logarithmus ist nur für positive Zahlen definiert.');
  if (a.ex && a.ex.equals(Exact.ONE)) return Real.ZERO;
  return fin(Math.log(a.n));
}
/** Logarithmus zur Basis b; exakt, wenn a eine rationale Potenz von b ist. */
export function rLogB(b: Real, a: Real): Real {
  if (a.n <= 0 || b.n <= 0) throw new CalcError('DOMAIN', 'Der Logarithmus ist nur für positive Zahlen definiert.');
  if (b.n === 1) throw new CalcError('DOMAIN', 'Die Basis 1 ist nicht zulässig.');
  const qa = a.rat();
  const qb = b.rat();
  if (qa && qb) {
    const est = Math.log(a.n) / Math.log(b.n);
    const k = Math.round(est);
    if (Math.abs(est - k) < 1e-9 && Math.abs(k) <= 400) {
      try {
        if (qb.pow(k).eq(qa)) return Real.int(k);
      } catch {
        /* weiter numerisch */
      }
    }
  }
  const v = b.n === 10 ? Math.log10(a.n) : b.n === 2 ? Math.log2(a.n) : Math.log(a.n) / Math.log(b.n);
  return fin(v);
}
export function rLog10(a: Real): Real {
  return rLogB(Real.int(10), a);
}

// ───────────────────────────── Fakultät, Kombinatorik ─────────────────────────────

export function rFact(a: Real): Real {
  if (!a.isInt() || a.n < 0) throw new CalcError('DOMAIN', 'Die Fakultät ist nur für natürliche Zahlen definiert.');
  if (a.n > 170) throw new CalcError('OVERFLOW');
  let f = 1n;
  for (let i = 2n; i <= BigInt(a.n); i++) f *= i;
  const e = Exact.make([{ c: Rat.of(f), r: 1n, p: 0 }]);
  return e ? Real.fromExact(e) : fin(Number(f));
}

function bigToReal(v: bigint): Real {
  const e = Exact.make([{ c: Rat.of(v), r: 1n, p: 0 }]);
  if (e) return Real.fromExact(e);
  const n = Number(v);
  if (!Number.isFinite(n)) throw new CalcError('OVERFLOW');
  return new Real(n, null);
}

function checkNR(n: Real, r: Real): void {
  if (!n.isInt() || !r.isInt() || n.n < 0 || r.n < 0 || r.n > n.n) {
    throw new CalcError('DOMAIN', 'nPr und nCr benötigen ganze Zahlen mit 0 ≤ r ≤ n.');
  }
  if (n.n > 1e10) throw new CalcError('RANGE');
}

export function rPerm(n: Real, r: Real): Real {
  checkNR(n, r);
  if (r.n > 20000) throw new CalcError('OVERFLOW');
  let v = 1n;
  const N = BigInt(n.n);
  for (let i = 0n; i < BigInt(r.n); i++) v *= N - i;
  return bigToReal(v);
}

export function rComb(n: Real, r: Real): Real {
  checkNR(n, r);
  let k = r.n;
  if (k > n.n - k) k = n.n - k;
  if (k > 20000) throw new CalcError('OVERFLOW');
  let v = 1n;
  const N = BigInt(n.n);
  for (let i = 1n; i <= BigInt(k); i++) v = (v * (N - BigInt(k) + i)) / i;
  return bigToReal(v);
}

function toBigIntStrict(a: Real, what: string): bigint {
  const q = a.rat();
  if (!q || !q.isInt()) throw new CalcError('ARG', `${what} benötigt ganze Zahlen.`);
  return q.n;
}

export function rGcd(a: Real, b: Real): Real {
  return bigToReal(bgcd(toBigIntStrict(a, 'ggT'), toBigIntStrict(b, 'ggT')));
}
export function rLcm(a: Real, b: Real): Real {
  const x = toBigIntStrict(a, 'kgV');
  const y = toBigIntStrict(b, 'kgV');
  if (x === 0n || y === 0n) return Real.ZERO;
  return bigToReal(babs(x * y) / bgcd(x, y));
}

export function rFloor(a: Real): Real {
  const q = a.rat();
  if (q) return bigToReal(q.floor());
  return fin(Math.floor(a.n));
}
export function rTrunc(a: Real): Real {
  const q = a.rat();
  if (q) return bigToReal(q.trunc());
  return fin(Math.trunc(a.n));
}

/** Division mit Rest: liefert [Quotient, Rest] mit 0 ≤ Rest < |b|. */
export function rDivRem(a: Real, b: Real): [Real, Real] {
  const x = toBigIntStrict(a, 'Die Division mit Rest');
  const y = toBigIntStrict(b, 'Die Division mit Rest');
  if (y === 0n) throw new CalcError('DIV0');
  let q = x / y;
  let r = x - q * y;
  if (r < 0n) {
    if (y > 0n) {
      q -= 1n;
      r += y;
    } else {
      q += 1n;
      r -= y;
    }
  }
  return [bigToReal(q), bigToReal(r)];
}

/** Primfaktorzerlegung einer natürlichen Zahl: Liste [Primzahl, Exponent]. */
export function primeFactors(a: Real): Array<[bigint, number]> {
  const q = a.rat();
  if (!q || !q.isInt() || q.n < 1n) {
    throw new CalcError('ARG', 'Die Primfaktorzerlegung benötigt eine natürliche Zahl.');
  }
  if (q.n >= 10n ** 15n) throw new CalcError('RANGE', 'Die Zahl ist für die Primfaktorzerlegung zu groß.');
  let rem = Number(q.n);
  const out: Array<[bigint, number]> = [];
  for (let p = 2; p * p <= rem; p += p === 2 ? 1 : 2) {
    if (rem % p === 0) {
      let e = 0;
      while (rem % p === 0) {
        rem /= p;
        e++;
      }
      out.push([BigInt(p), e]);
    }
  }
  if (rem > 1 || out.length === 0) out.push([BigInt(rem), 1]);
  return out;
}

// ───────────────────────────── Trigonometrie ─────────────────────────────

const S = {
  0: Exact.ZERO,
  1: Exact.make([...surd(1, 4, 6).terms, ...surd(-1, 4, 2).terms])!, // sin 15°
  2: Exact.rat(1, 2),
  3: surd(1, 2, 2),
  4: surd(1, 2, 3),
  5: Exact.make([...surd(1, 4, 6).terms, ...surd(1, 4, 2).terms])!, // sin 75°
  6: Exact.ONE,
} as Record<number, Exact>;

/** sin(k·15°) exakt. */
function sin15(k: number): Exact {
  k = ((k % 24) + 24) % 24;
  if (k <= 6) return S[k];
  if (k <= 12) return S[12 - k];
  if (k <= 18) return S[k - 12].neg();
  return S[24 - k].neg();
}

const TAN_TABLE: Exact[] = [0, 1, 2, 3, 4, 5].map((k) => sin15(k).div(sin15(k + 6))!);

/** Winkel als Vielfaches von 15° (exakt), sonst null. */
function angleSteps(a: Real, unit: AngleUnit): number | null {
  if (!a.ex) return null;
  let turns24: Rat;
  if (unit === 'RAD') {
    if (a.ex.isZero()) return 0;
    if (a.ex.terms.length !== 1) return null;
    const t = a.ex.terms[0];
    if (t.p !== 1 || t.r !== 1n) return null;
    turns24 = t.c.mul(Rat.of(12)); // x/(2π)·24
  } else {
    if (!a.ex.isRational()) return null;
    turns24 = a.ex.asRat().div(Rat.of(unit === 'DEG' ? 15 : 50, unit === 'DEG' ? 1 : 3));
  }
  if (!turns24.isInt()) return null;
  return Number(((turns24.n % 24n) + 24n) % 24n);
}

export function toRadians(x: number, unit: AngleUnit): number {
  return unit === 'RAD' ? x : unit === 'DEG' ? (x * Math.PI) / 180 : (x * Math.PI) / 200;
}
export function fromRadians(x: number, unit: AngleUnit): number {
  return unit === 'RAD' ? x : unit === 'DEG' ? (x * 180) / Math.PI : (x * 200) / Math.PI;
}

/** sin und cos mit sauberer Quadrantenreduktion für DEG/GRA. */
function sinCosFloat(x: number, unit: AngleUnit): [number, number] {
  if (unit === 'RAD') return [Math.sin(x), Math.cos(x)];
  const quarter = unit === 'DEG' ? 90 : 100;
  let r = x % (4 * quarter);
  if (r < 0) r += 4 * quarter;
  const q = Math.floor(r / quarter) % 4;
  const rr = r - q * quarter;
  let s: number;
  let c: number;
  if (rr <= quarter / 2) {
    const t = (rr * Math.PI) / (2 * quarter);
    s = Math.sin(t);
    c = Math.cos(t);
  } else {
    const t = ((quarter - rr) * Math.PI) / (2 * quarter);
    s = Math.cos(t);
    c = Math.sin(t);
  }
  switch (q) {
    case 0:
      return [s, c];
    case 1:
      return [c, -s];
    case 2:
      return [-s, -c];
    default:
      return [-c, s];
  }
}

export function rSin(a: Real, unit: AngleUnit): Real {
  const k = angleSteps(a, unit);
  if (k !== null) return Real.fromExact(sin15(k));
  return fin(sinCosFloat(a.n, unit)[0]);
}
export function rCos(a: Real, unit: AngleUnit): Real {
  const k = angleSteps(a, unit);
  if (k !== null) return Real.fromExact(sin15(k + 6));
  return fin(sinCosFloat(a.n, unit)[1]);
}
export function rTan(a: Real, unit: AngleUnit): Real {
  const k = angleSteps(a, unit);
  if (k !== null) {
    const c = sin15(k + 6);
    if (c.isZero()) throw new CalcError('DOMAIN', 'Der Tangens ist an dieser Stelle nicht definiert.');
    const t = sin15(k).div(c);
    if (t) return Real.fromExact(t);
  }
  const [s, c] = sinCosFloat(a.n, unit);
  if (c === 0) throw new CalcError('DOMAIN', 'Der Tangens ist an dieser Stelle nicht definiert.');
  return fin(s / c);
}

/** Winkel k·15° in der aktuellen Einheit als exakte Zahl. */
function stepsToAngle(k: number, unit: AngleUnit): Real {
  if (unit === 'DEG') return Real.int(15 * k);
  if (unit === 'GRA') return Real.rat(50 * k, 3);
  return Real.fromExact(Exact.make([{ c: Rat.of(k, 12), r: 1n, p: 1 }])!);
}

function lookup(table: Record<number, Exact> | Exact[], e: Exact, max: number): number | null {
  for (let k = 0; k <= max; k++) {
    const t = (table as Record<number, Exact>)[k];
    if (t.equals(e)) return k;
  }
  const ne = e.neg();
  for (let k = 1; k <= max; k++) {
    const t = (table as Record<number, Exact>)[k];
    if (t.equals(ne)) return -k;
  }
  return null;
}

export function rAsin(a: Real, unit: AngleUnit): Real {
  if (a.n < -1 || a.n > 1) throw new CalcError('DOMAIN', 'sin⁻¹ ist nur für Werte von −1 bis 1 definiert.');
  if (a.ex) {
    const k = lookup(S, a.ex, 6);
    if (k !== null) return stepsToAngle(k, unit);
  }
  return fin(fromRadians(Math.asin(a.n), unit));
}
export function rAcos(a: Real, unit: AngleUnit): Real {
  if (a.n < -1 || a.n > 1) throw new CalcError('DOMAIN', 'cos⁻¹ ist nur für Werte von −1 bis 1 definiert.');
  if (a.ex) {
    const k = lookup(S, a.ex, 6);
    if (k !== null) return stepsToAngle(6 - k, unit);
  }
  return fin(fromRadians(Math.acos(a.n), unit));
}
export function rAtan(a: Real, unit: AngleUnit): Real {
  if (a.ex) {
    const k = lookup(TAN_TABLE, a.ex, 5);
    if (k !== null) return stepsToAngle(k, unit);
  }
  return fin(fromRadians(Math.atan(a.n), unit));
}

/** atan2 in der aktuellen Winkeleinheit, exakt für Sonderfälle. */
export function rAtan2(y: Real, x: Real, unit: AngleUnit): Real {
  const sy = rSign(y);
  const sx = rSign(x);
  if (sx === 0 && sy === 0) return Real.ZERO;
  if (sy === 0) return sx > 0 ? Real.ZERO : stepsToAngle(12, unit);
  if (sx === 0) return stepsToAngle(sy > 0 ? 6 : -6, unit);
  if (x.ex && y.ex) {
    const ratio = rDiv(rAbs(y), rAbs(x));
    if (ratio.ex) {
      const k = lookup(TAN_TABLE, ratio.ex, 5);
      if (k !== null) {
        const steps = sx > 0 ? k : 12 - k;
        return stepsToAngle(sy > 0 ? steps : -steps, unit);
      }
    }
  }
  return fin(fromRadians(Math.atan2(y.n, x.n), unit));
}

export function rSinh(a: Real): Real {
  return fin(Math.sinh(a.n));
}
export function rCosh(a: Real): Real {
  return fin(Math.cosh(a.n));
}
export function rTanh(a: Real): Real {
  return fin(Math.tanh(a.n));
}
export function rAsinh(a: Real): Real {
  return fin(Math.asinh(a.n));
}
export function rAcosh(a: Real): Real {
  if (a.n < 1) throw new CalcError('DOMAIN', 'cosh⁻¹ ist nur für Werte ≥ 1 definiert.');
  return fin(Math.acosh(a.n));
}
export function rAtanh(a: Real): Real {
  if (a.n <= -1 || a.n >= 1) throw new CalcError('DOMAIN', 'tanh⁻¹ ist nur für Werte zwischen −1 und 1 definiert.');
  return fin(Math.atanh(a.n));
}

/** Umrechnung eines Winkels aus `from` in die Einheit `to`. */
export function convertAngle(a: Real, from: AngleUnit, to: AngleUnit): Real {
  if (from === to) return a;
  const half: Record<AngleUnit, Real> = { DEG: Real.int(180), RAD: Real.PI, GRA: Real.int(200) };
  return rDiv(rMul(a, half[to]), half[from]);
}

export { extractSquare };
