/**
 * Exakte Zahlen der Form  Σ cᵢ · √rᵢ · π^pᵢ
 * (cᵢ rational, rᵢ quadratfreie natürliche Zahl, pᵢ ∈ {0, 1}).
 * Damit lassen sich Brüche, Wurzelausdrücke und π-Vielfache exakt darstellen.
 * Alle Operationen liefern `null`, wenn das Ergebnis diese Form verlässt.
 */
import { CalcError } from './errors';
import { Rat, bgcd, isqrt, ratioToNumber } from './rat';

export interface Term {
  /** Koeffizient */
  c: Rat;
  /** quadratfreier Radikand ≥ 1 */
  r: bigint;
  /** Exponent von π (0 oder 1) */
  p: number;
}

const MAX_TERMS = 6;
const MAX_BITS = 400;

let PRIMES: number[] | null = null;
export function smallPrimes(): number[] {
  if (PRIMES) return PRIMES;
  const N = 100000;
  const sieve = new Uint8Array(N + 1);
  const out: number[] = [];
  for (let i = 2; i <= N; i++) {
    if (!sieve[i]) {
      out.push(i);
      for (let j = i * i; j <= N; j += i) sieve[j] = 1;
    }
  }
  PRIMES = out;
  return out;
}

/** Zerlegt m = out² · inn mit quadratfreiem inn. Liefert null, wenn m zu groß zum Faktorisieren ist. */
export function extractSquare(m: bigint): [bigint, bigint] | null {
  if (m < 0n) throw new CalcError('DOMAIN');
  if (m === 0n) return [0n, 1n];
  if (m < 9007199254740992n) {
    let rem = Number(m);
    let out = 1;
    let inn = 1;
    const primes = smallPrimes();
    let exhausted = true;
    for (const p of primes) {
      if (p * p > rem) {
        exhausted = false;
        break;
      }
      if (rem % p === 0) {
        let e = 0;
        while (rem % p === 0) {
          rem /= p;
          e++;
        }
        out *= p ** (e >> 1);
        if (e & 1) inn *= p;
      }
    }
    if (rem > 1) {
      if (!exhausted) {
        inn *= rem; // rem ist prim
      } else {
        const s = Math.round(Math.sqrt(rem));
        if (s * s === rem) out *= s;
        else if (rem < 1e15) inn *= rem;
        else return null;
      }
    }
    if (!Number.isSafeInteger(inn) || !Number.isSafeInteger(out)) return null;
    return [BigInt(out), BigInt(inn)];
  }
  let rem = m;
  let out = 1n;
  let inn = 1n;
  let done = false;
  for (const pn of smallPrimes()) {
    const p = BigInt(pn);
    if (p * p > rem) {
      done = true;
      break;
    }
    if (rem % p === 0n) {
      let e = 0;
      while (rem % p === 0n) {
        rem /= p;
        e++;
      }
      out *= p ** BigInt(e >> 1);
      if (e & 1) inn *= p;
    }
  }
  if (rem > 1n) {
    if (done) inn *= rem;
    else {
      const s = isqrt(rem);
      if (s * s === rem) out *= s;
      else if (rem < 10n ** 15n) inn *= rem;
      else return null;
    }
  }
  return [out, inn];
}

export class Exact {
  readonly terms: readonly Term[];

  private constructor(terms: readonly Term[]) {
    this.terms = terms;
  }

  static readonly ZERO = new Exact([]);
  static readonly ONE = new Exact([{ c: Rat.ONE, r: 1n, p: 0 }]);
  static readonly PI = new Exact([{ c: Rat.ONE, r: 1n, p: 1 }]);

  static fromRat(q: Rat): Exact {
    return q.isZero() ? Exact.ZERO : new Exact([{ c: q, r: 1n, p: 0 }]);
  }
  static fromInt(n: bigint | number): Exact {
    return Exact.fromRat(Rat.of(n));
  }
  static rat(n: bigint | number, d: bigint | number): Exact {
    return Exact.fromRat(Rat.of(n, d));
  }

  /** Normalform bilden (gleiche Terme zusammenfassen, sortieren, Größe begrenzen). */
  static make(terms: Term[]): Exact | null {
    const map = new Map<string, Term>();
    for (const t of terms) {
      if (t.c.isZero()) continue;
      const key = `${t.p}|${t.r}`;
      const prev = map.get(key);
      if (prev) {
        const c = prev.c.add(t.c);
        if (c.isZero()) map.delete(key);
        else map.set(key, { c, r: t.r, p: t.p });
      } else {
        map.set(key, t);
      }
    }
    const out = [...map.values()];
    if (out.length > MAX_TERMS) return null;
    for (const t of out) {
      if (t.c.bits() > MAX_BITS) return null;
    }
    out.sort((a, b) => (a.p !== b.p ? a.p - b.p : a.r < b.r ? -1 : a.r > b.r ? 1 : 0));
    return new Exact(out);
  }

  isZero(): boolean {
    return this.terms.length === 0;
  }
  isRational(): boolean {
    return this.terms.length === 0 || (this.terms.length === 1 && this.terms[0].r === 1n && this.terms[0].p === 0);
  }
  asRat(): Rat {
    return this.terms.length === 0 ? Rat.ZERO : this.terms[0].c;
  }
  isInteger(): boolean {
    return this.isRational() && this.asRat().isInt();
  }
  hasPi(): boolean {
    return this.terms.some((t) => t.p > 0);
  }
  equals(o: Exact): boolean {
    if (this.terms.length !== o.terms.length) return false;
    for (let i = 0; i < this.terms.length; i++) {
      const a = this.terms[i];
      const b = o.terms[i];
      if (a.p !== b.p || a.r !== b.r || !a.c.eq(b.c)) return false;
    }
    return true;
  }

  toNumber(): number {
    if (this.terms.length === 0) return 0;
    if (this.terms.length === 1) return termToNumber(this.terms[0]);
    let s = 0;
    let mag = 0;
    for (const t of this.terms) {
      const v = termToNumber(t);
      s += v;
      mag += Math.abs(v);
    }
    // Auslöschung (z. B. √(10²⁰+1) − 10¹⁰): mit 60 Dezimalstellen nachrechnen
    if (Number.isFinite(mag) && Math.abs(s) < 1e-3 * mag) return this.toNumberPrecise();
    return s;
  }

  /** Wert mit 60 Dezimalstellen Festkomma-Genauigkeit berechnen und erst dann runden. */
  private toNumberPrecise(): number {
    let sum = 0n;
    for (const t of this.terms) {
      let v = t.c.n * (t.r === 1n ? HP_SCALE : isqrt(t.r * HP_SCALE * HP_SCALE));
      if (t.p === 1) v = (v * HP_PI) / HP_SCALE;
      sum += v / t.c.d;
    }
    return ratioToNumber(sum, HP_SCALE);
  }

  sign(): number {
    if (this.terms.length === 0) return 0;
    if (this.terms.length === 1) return this.terms[0].c.sign();
    const n = this.toNumber();
    return n === 0 ? 1 : Math.sign(n);
  }

  neg(): Exact {
    return new Exact(this.terms.map((t) => ({ c: t.c.neg(), r: t.r, p: t.p })));
  }
  add(o: Exact): Exact | null {
    if (this.terms.length === 0) return o;
    if (o.terms.length === 0) return this;
    return Exact.make([...this.terms, ...o.terms]);
  }
  sub(o: Exact): Exact | null {
    return this.add(o.neg());
  }
  mul(o: Exact): Exact | null {
    const out: Term[] = [];
    for (const a of this.terms) {
      for (const b of o.terms) {
        const p = a.p + b.p;
        if (p > 1) return null;
        if (a.r === 1n) out.push({ c: a.c.mul(b.c), r: b.r, p });
        else if (b.r === 1n) out.push({ c: a.c.mul(b.c), r: a.r, p });
        else {
          const g = bgcd(a.r, b.r);
          out.push({ c: a.c.mul(b.c).mul(Rat.of(g)), r: (a.r / g) * (b.r / g), p });
        }
      }
    }
    return Exact.make(out);
  }
  div(o: Exact): Exact | null {
    if (o.terms.length === 0) throw new CalcError('DIV0');
    if (o.terms.length === 1) {
      const b = o.terms[0];
      const out: Term[] = [];
      const denom = b.c.mul(Rat.of(b.r));
      for (const a of this.terms) {
        const p = a.p - b.p;
        if (p < 0 || p > 1) return null;
        const g = bgcd(a.r, b.r);
        out.push({ c: a.c.mul(Rat.of(g)).div(denom), r: (a.r / g) * (b.r / g), p });
      }
      return Exact.make(out);
    }
    if (o.terms.length === 2 && o.terms.every((t) => t.p === 0)) {
      const [u, v] = o.terms;
      const den = u.c.mul(u.c).mul(Rat.of(u.r)).sub(v.c.mul(v.c).mul(Rat.of(v.r)));
      if (den.isZero()) return null;
      const conj = Exact.make([u, { c: v.c.neg(), r: v.r, p: 0 }]);
      if (!conj) return null;
      const num = this.mul(conj);
      if (!num) return null;
      return num.mul(Exact.fromRat(den.inv()));
    }
    return null;
  }

  /** Ganzzahlige Potenz. */
  powInt(e: number): Exact | null {
    if (e === 0) return Exact.ONE;
    if (e < 0) {
      const inv = Exact.ONE.div(this);
      return inv ? inv.powInt(-e) : null;
    }
    if (this.terms.length === 0) return Exact.ZERO;
    if (this.isRational()) {
      const c = this.asRat();
      if (c.bits() * e > MAX_BITS + 64) return null;
      return Exact.make([{ c: c.pow(e), r: 1n, p: 0 }]);
    }
    if (e > 64) return null;
    let result: Exact | null = Exact.ONE;
    let base: Exact | null = this;
    let k = e;
    while (k > 0) {
      if (k & 1) {
        result = result!.mul(base!);
        if (!result) return null;
      }
      k >>= 1;
      if (k > 0) {
        base = base!.mul(base!);
        if (!base) return null;
      }
    }
    return result;
  }

  /** Quadratwurzel, falls exakt darstellbar (nur für nichtnegative rationale Zahlen). */
  sqrt(): Exact | null {
    if (this.terms.length === 0) return Exact.ZERO;
    if (!this.isRational()) return null;
    return sqrtRat(this.asRat());
  }
}

const HP_SCALE = 10n ** 60n;
/** π · 10⁶⁰ */
const HP_PI = 3141592653589793238462643383279502884197169399375105820974944n;

function termToNumber(t: Term): number {
  let x = t.c.toNumber();
  if (t.r !== 1n) x *= Math.sqrt(Number(t.r));
  if (t.p === 1) x *= Math.PI;
  return x;
}

/** √q für q ≥ 0 als exakter Wurzelausdruck. */
export function sqrtRat(q: Rat): Exact | null {
  if (q.sign() < 0) throw new CalcError('DOMAIN');
  if (q.isZero()) return Exact.ZERO;
  const sq = extractSquare(q.n * q.d);
  if (!sq) return null;
  const [out, inn] = sq;
  return Exact.make([{ c: Rat.of(out, q.d), r: inn, p: 0 }]);
}

/** Hilfsfunktion: a·√r (a rational als n/d). */
export function surd(n: number, d: number, r: number): Exact {
  return Exact.make([{ c: Rat.of(n, d), r: BigInt(r), p: 0 }])!;
}
