/** Exakte rationale Zahlen auf BigInt-Basis. */
import { CalcError } from './errors';

export const babs = (a: bigint): bigint => (a < 0n ? -a : a);

export function bgcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export function bitLen(a: bigint): number {
  if (a < 0n) a = -a;
  if (a === 0n) return 0;
  return a.toString(16).length * 4;
}

function ldexp(x: number, e: number): number {
  while (e > 1000) {
    x *= 2 ** 1000;
    e -= 1000;
  }
  while (e < -1000) {
    x *= 2 ** -1000;
    e += 1000;
  }
  return x * 2 ** e;
}

const TWO53 = 9007199254740992n;

/** n/d als double (auch für sehr große Zähler/Nenner). */
export function ratioToNumber(n: bigint, d: bigint): number {
  if (n === 0n) return 0;
  const neg = n < 0n;
  if (neg) n = -n;
  let r: number;
  if (n < TWO53 && d < TWO53) {
    r = Number(n) / Number(d);
  } else {
    const shift = 64 - (bitLen(n) - bitLen(d));
    const q = shift >= 0 ? (n << BigInt(shift)) / d : n / (d << BigInt(-shift));
    r = ldexp(Number(q), -shift);
  }
  return neg ? -r : r;
}

/** Ganzzahlige Quadratwurzel (abgerundet). */
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new CalcError('DOMAIN');
  if (n < 2n) return n;
  if (n < TWO53) return BigInt(Math.floor(Math.sqrt(Number(n))));
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y === x || y === x + 1n || y === x - 1n) {
      x = y;
      break;
    }
    x = y;
  }
  while (x * x > n) x -= 1n;
  while ((x + 1n) * (x + 1n) <= n) x += 1n;
  return x;
}

/** Ganzzahlige k-te Wurzel, falls n eine perfekte k-te Potenz ist; sonst null. */
export function exactRoot(n: bigint, k: number): bigint | null {
  if (n < 0n) {
    if (k % 2 === 0) return null;
    const r = exactRoot(-n, k);
    return r === null ? null : -r;
  }
  if (n < 2n) return n;
  if (k === 2) {
    const s = isqrt(n);
    return s * s === n ? s : null;
  }
  const approx = Math.round(Math.pow(ratioToNumber(n, 1n), 1 / k));
  if (!Number.isFinite(approx)) return null;
  const K = BigInt(k);
  for (let c = BigInt(approx) - 1n; c <= BigInt(approx) + 1n; c++) {
    if (c >= 0n && c ** K === n) return c;
  }
  return null;
}

export class Rat {
  readonly n: bigint;
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    this.n = n;
    this.d = d;
  }

  static readonly ZERO = new Rat(0n, 1n);
  static readonly ONE = new Rat(1n, 1n);

  static of(n: bigint | number, d: bigint | number = 1n): Rat {
    let N = typeof n === 'bigint' ? n : BigInt(n);
    let D = typeof d === 'bigint' ? d : BigInt(d);
    if (D === 0n) throw new CalcError('DIV0');
    if (D < 0n) {
      N = -N;
      D = -D;
    }
    if (D !== 1n) {
      const g = bgcd(N, D);
      if (g > 1n) {
        N /= g;
        D /= g;
      }
    }
    return new Rat(N, D);
  }

  /** Dezimalzeichenkette wie "12.345" (optional mit Zehnerexponent) exakt einlesen. */
  static fromDecimal(mantissa: string, exp10 = 0): Rat {
    const neg = mantissa.startsWith('-');
    if (neg) mantissa = mantissa.slice(1);
    const dot = mantissa.indexOf('.');
    let digits = mantissa;
    let scale = 0;
    if (dot >= 0) {
      digits = mantissa.slice(0, dot) + mantissa.slice(dot + 1);
      scale = mantissa.length - dot - 1;
    }
    if (digits === '') digits = '0';
    let n = BigInt(digits);
    if (neg) n = -n;
    const e = exp10 - scale;
    return e >= 0 ? Rat.of(n * 10n ** BigInt(e), 1n) : Rat.of(n, 10n ** BigInt(-e));
  }

  isZero(): boolean {
    return this.n === 0n;
  }
  isInt(): boolean {
    return this.d === 1n;
  }
  sign(): number {
    return this.n === 0n ? 0 : this.n < 0n ? -1 : 1;
  }
  neg(): Rat {
    return new Rat(-this.n, this.d);
  }
  abs(): Rat {
    return this.n < 0n ? new Rat(-this.n, this.d) : this;
  }
  inv(): Rat {
    if (this.n === 0n) throw new CalcError('DIV0');
    return this.n < 0n ? new Rat(-this.d, -this.n) : new Rat(this.d, this.n);
  }
  add(o: Rat): Rat {
    if (this.d === 1n && o.d === 1n) return new Rat(this.n + o.n, 1n);
    return Rat.of(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Rat): Rat {
    if (this.d === 1n && o.d === 1n) return new Rat(this.n - o.n, 1n);
    return Rat.of(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Rat): Rat {
    if (this.d === 1n && o.d === 1n) return new Rat(this.n * o.n, 1n);
    return Rat.of(this.n * o.n, this.d * o.d);
  }
  div(o: Rat): Rat {
    if (o.n === 0n) throw new CalcError('DIV0');
    return Rat.of(this.n * o.d, this.d * o.n);
  }
  cmp(o: Rat): number {
    const l = this.n * o.d;
    const r = o.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  eq(o: Rat): boolean {
    return this.n === o.n && this.d === o.d;
  }
  /** Ganzzahlige Potenz. */
  pow(e: number): Rat {
    if (e === 0) return Rat.ONE;
    if (e < 0) return this.inv().pow(-e);
    const E = BigInt(e);
    return new Rat(this.n ** E, this.d ** E);
  }
  floor(): bigint {
    const q = this.n / this.d;
    return this.n < 0n && this.n % this.d !== 0n ? q - 1n : q;
  }
  trunc(): bigint {
    return this.n / this.d;
  }
  toNumber(): number {
    return ratioToNumber(this.n, this.d);
  }
  bits(): number {
    return Math.max(bitLen(this.n), bitLen(this.d));
  }
  toString(): string {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }
}
