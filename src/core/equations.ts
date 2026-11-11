/** Polynomgleichungen (Grad 1–4), Scheitelpunkt und Polynom-Ungleichungen. */
import { CalcError } from './errors';
import { Rat, babs, bgcd } from './rat';
import { Real, rAdd, rSub, rMul, rDiv, rNeg, rSqrt, rCmp, rEq } from './real';
import { Cx, type Scalar } from './values';
import { cleanFloat } from './evaluator';

interface C {
  re: number;
  im: number;
}

function polyEvalC(c: number[], z: C): C {
  let re = 0;
  let im = 0;
  for (const a of c) {
    const r = re * z.re - im * z.im + a;
    im = re * z.im + im * z.re;
    re = r;
  }
  return { re, im };
}

function polyEval(c: number[], x: number): number {
  let v = 0;
  for (const a of c) v = v * x + a;
  return v;
}

/** Betrag einer komplexen Zahl */
const cabs = (z: C): number => Math.hypot(z.re, z.im);

/**
 * Numerische Nullstellen (Durand-Kerner mit Newton-Nachiteration).
 * Mehrfache Nullstellen werden anschließend zu ihrem Mittelwert zusammengefasst.
 */
function numericRoots(coeffs: number[]): C[] {
  const n = coeffs.length - 1;
  const c = coeffs.map((a) => a / coeffs[0]);
  if (n === 1) return [{ re: -c[1], im: 0 }];
  // Fujiwara-Schranke für den Betrag der Nullstellen
  let radius = 0;
  for (let k = 1; k <= n; k++) radius = Math.max(radius, Math.pow(Math.abs(c[k]), 1 / k));
  radius = 2 * radius || 1;
  let z: C[] = [];
  for (let k = 0; k < n; k++) {
    const ang = (2 * Math.PI * k) / n + 0.4;
    z.push({ re: radius * 0.55 * Math.cos(ang), im: radius * 0.55 * Math.sin(ang) });
  }
  for (let iter = 0; iter < 3000; iter++) {
    let converged = true;
    const next: C[] = [];
    for (let i = 0; i < n; i++) {
      const p = polyEvalC(c, z[i]);
      let dr = 1;
      let di = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const ar = z[i].re - (j < i ? next[j].re : z[j].re);
        const ai = z[i].im - (j < i ? next[j].im : z[j].im);
        const t = dr * ar - di * ai;
        di = dr * ai + di * ar;
        dr = t;
      }
      const den = dr * dr + di * di;
      if (den === 0) {
        const eps = (cabs(z[i]) || radius) * 1e-8;
        next.push({ re: z[i].re + eps, im: z[i].im + eps });
        converged = false;
        continue;
      }
      const qr = (p.re * dr + p.im * di) / den;
      const qi = (p.im * dr - p.re * di) / den;
      next.push({ re: z[i].re - qr, im: z[i].im - qi });
      // Abbruch relativ zum Betrag der jeweiligen Nullstelle (auch für sehr kleine Nullstellen)
      if (Math.abs(qr) + Math.abs(qi) > 1e-15 * cabs(next[i])) converged = false;
    }
    z = next;
    if (converged) break;
  }
  const dc = c.slice(0, n).map((a, i) => a * (n - i));
  /** Schranke für den Rundungsfehler bei der Auswertung des Polynoms an der Stelle z */
  const evalNoise = (r: C): number => {
    const m = cabs(r);
    let acc = 0;
    for (const a of c) acc = acc * m + Math.abs(a);
    return 2.3e-16 * acc;
  };
  const newton = (r: C, steps: number): C => {
    let cur = r;
    for (let k = 0; k < steps; k++) {
      const p = polyEvalC(c, cur);
      const d = polyEvalC(dc, cur);
      const den = d.re * d.re + d.im * d.im;
      if (den === 0) break;
      const nx = { re: cur.re - (p.re * d.re + p.im * d.im) / den, im: cur.im - (p.im * d.re - p.re * d.im) / den };
      if (!Number.isFinite(nx.re) || !Number.isFinite(nx.im)) break;
      if (cabs(polyEvalC(c, nx)) > cabs(p)) break;
      cur = nx;
    }
    return cur;
  };
  // Häufungen (mehrfache Nullstellen) durch ihren Mittelwert ersetzen: Die Einzelwerte streuen dort
  // um etwa eps^(1/k), ihr Mittelwert ist dagegen fast auf Rechengenauigkeit richtig.
  const used = new Array<boolean>(n).fill(false);
  const out: C[] = [];
  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    const group = [i];
    for (let j = i + 1; j < n; j++) {
      if (used[j]) continue;
      const dist = Math.hypot(z[i].re - z[j].re, z[i].im - z[j].im);
      if (dist <= 2e-3 * Math.max(cabs(z[i]), cabs(z[j]))) group.push(j);
    }
    if (group.length > 1) {
      let center: C = {
        re: group.reduce((sum, k) => sum + z[k].re, 0) / group.length,
        im: group.reduce((sum, k) => sum + z[k].im, 0) / group.length,
      };
      // Eine k-fache Nullstelle von P ist eine einfache (gut konditionierte) Nullstelle der
      // (k−1)-ten Ableitung – dort mit dem Newton-Verfahren nachschärfen.
      let d = c.slice();
      for (let k = 1; k < group.length; k++) {
        const m = d.length - 1;
        d = d.slice(0, m).map((a, idx) => a * (m - idx));
      }
      const dd = d.slice(0, d.length - 1).map((a, idx) => a * (d.length - 1 - idx));
      for (let it = 0; it < 30; it++) {
        const pv = polyEvalC(d, center);
        const dv = polyEvalC(dd, center);
        const den = dv.re * dv.re + dv.im * dv.im;
        if (den === 0) break;
        const nx = {
          re: center.re - (pv.re * dv.re + pv.im * dv.im) / den,
          im: center.im - (pv.im * dv.re - pv.re * dv.im) / den,
        };
        if (!Number.isFinite(nx.re) || !Number.isFinite(nx.im)) break;
        const moved = Math.hypot(nx.re - center.re, nx.im - center.im);
        center = nx;
        if (moved <= 1e-16 * cabs(center)) break;
      }
      // zusammenfassen, wenn dieser Wert im Rahmen der Rechengenauigkeit Nullstelle von P ist
      if (cabs(polyEvalC(c, center)) <= 200 * evalNoise(center)) {
        for (const k of group) used[k] = true;
        for (let k = 0; k < group.length; k++) out.push(center);
        continue;
      }
    }
    used[i] = true;
    out.push(newton(z[i], 6));
  }
  return out;
}

function toScalar(z: C): Scalar {
  let { re, im } = z;
  // Rundungsrauschen relativ zur Nullstelle selbst entfernen
  if (Math.abs(im) <= 1e-9 * Math.abs(re)) im = 0;
  if (Math.abs(re) <= 1e-12 * Math.abs(im)) re = 0;
  if (im === 0) return Real.num(cleanFloat(re));
  return new Cx(Real.num(cleanFloat(re)), Real.num(cleanFloat(im)));
}

// ── exakte Polynomarithmetik (rationale Koeffizienten, höchster Grad zuerst) ──

function trimPoly(p: Rat[]): Rat[] {
  let i = 0;
  while (i < p.length - 1 && p[i].isZero()) i++;
  return p.slice(i);
}
function polyDerivative(p: Rat[]): Rat[] {
  const n = p.length - 1;
  return n === 0 ? [Rat.ZERO] : p.slice(0, n).map((a, i) => a.mul(Rat.of(n - i)));
}
/** Polynomdivision: [Quotient, Rest] */
function polyDivMod(a: Rat[], b: Rat[]): [Rat[], Rat[]] {
  const r = a.slice();
  const q: Rat[] = [];
  const db = b.length - 1;
  for (let i = 0; i + db < a.length; i++) {
    const f = r[i].div(b[0]);
    q.push(f);
    for (let j = 0; j <= db; j++) r[i + j] = r[i + j].sub(f.mul(b[j]));
  }
  const rest = trimPoly(r.slice(a.length - db));
  return [q.length ? q : [Rat.ZERO], rest];
}
function polyGcd(a: Rat[], b: Rat[]): Rat[] {
  let x = trimPoly(a);
  let y = trimPoly(b);
  while (!(y.length === 1 && y[0].isZero())) {
    const [, rem] = polyDivMod(x, y);
    x = y;
    y = rem.length ? rem : [Rat.ZERO];
  }
  return x.map((c) => c.div(x[0]));
}
/** Quadratfreier Teil: gleiche Nullstellen, aber jede nur einfach. */
function squareFree(p: Rat[]): Rat[] {
  if (p.length <= 2) return p;
  const g = polyGcd(p, polyDerivative(p));
  if (g.length <= 1) return p;
  return polyDivMod(p, g)[0];
}

/** Exakte Lösungen von a·x² + b·x + c = 0. */
function quadraticExact(a: Rat, b: Rat, c: Rat): Scalar[] {
  const D = b.mul(b).sub(Rat.of(4).mul(a).mul(c));
  const twoA = Real.fromRat(a.mul(Rat.of(2)));
  const mb = Real.fromRat(b.neg());
  if (D.isZero()) return [rDiv(mb, twoA)];
  if (D.sign() > 0) {
    const s = rSqrt(Real.fromRat(D));
    if (!s.ex) {
      // Wurzel nicht exakt darstellbar: numerisch stabile Form (vermeidet Auslöschung bei −b ± √D)
      const bn = b.toNumber();
      const q = -0.5 * (bn + (bn >= 0 ? 1 : -1) * s.n);
      const x1 = Real.num(cleanFloat(q / a.toNumber()));
      const x2 = Real.num(cleanFloat(q !== 0 ? c.toNumber() / q : 0));
      return x1.n <= x2.n ? [x1, x2] : [x2, x1];
    }
    const r1 = rDiv(rSub(mb, s), twoA);
    const r2 = rDiv(rAdd(mb, s), twoA);
    return rCmp(r1, r2) <= 0 ? [r1, r2] : [r2, r1];
  }
  const s = rSqrt(Real.fromRat(D.neg()));
  const re = rDiv(mb, twoA);
  let im = rDiv(s, twoA);
  if (im.n < 0) im = rNeg(im);
  return [new Cx(re, im), new Cx(re, rNeg(im))];
}

function divisors(n: bigint): bigint[] | null {
  if (n > 10n ** 12n) return null;
  const N = Number(n);
  const out: bigint[] = [];
  for (let d = 1; d * d <= N; d++) {
    if (N % d === 0) {
      out.push(BigInt(d));
      if (d * d !== N) out.push(BigInt(N / d));
    }
  }
  return out;
}

/** Ganzzahlige Koeffizienten (höchster Grad zuerst) aus rationalen. */
function toIntPoly(c: Rat[]): bigint[] {
  let L = 1n;
  for (const q of c) L = (L * q.d) / bgcd(L, q.d);
  let ints = c.map((q) => q.n * (L / q.d));
  let g = 0n;
  for (const v of ints) g = bgcd(g, v);
  if (g > 1n) ints = ints.map((v) => v / g);
  return ints;
}

function evalIntPolyAt(c: bigint[], p: bigint, q: bigint): bigint {
  // q^n · P(p/q)
  const n = c.length - 1;
  let acc = 0n;
  let qp = 1n;
  const pw: bigint[] = [1n];
  for (let i = 1; i <= n; i++) pw.push(pw[i - 1] * p);
  for (let i = n; i >= 0; i--) {
    acc += c[n - i] * pw[i] * qp;
    qp *= q;
  }
  return acc;
}

function deflate(c: Rat[], r: Rat): Rat[] {
  const out: Rat[] = [c[0]];
  for (let i = 1; i < c.length - 1; i++) out.push(c[i].add(out[i - 1].mul(r)));
  return out;
}

function sortRoots(roots: Scalar[]): Scalar[] {
  const reals = roots.filter((r): r is Real => r.kind === 'real').sort((a, b) => rCmp(a, b));
  const cx = roots
    .filter((r): r is Cx => r.kind === 'complex')
    .sort((a, b) => (a.re.n !== b.re.n ? a.re.n - b.re.n : b.im.n - a.im.n));
  const out: Scalar[] = [];
  const same = (a: Scalar, b: Scalar): boolean => {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'real' && b.kind === 'real') {
      if (a.ex && b.ex) return rEq(a, b);
      return Math.abs(a.n - b.n) <= 1e-7 * Math.max(1, Math.abs(a.n));
    }
    const x = a as Cx;
    const y = b as Cx;
    return (
      Math.abs(x.re.n - y.re.n) <= 1e-7 * Math.max(1, Math.abs(x.re.n)) &&
      Math.abs(x.im.n - y.im.n) <= 1e-7 * Math.max(1, Math.abs(x.im.n))
    );
  };
  for (const r of [...reals, ...cx]) {
    if (!out.some((o) => same(o, r))) out.push(r);
  }
  return out;
}

/**
 * Löst a_n·xⁿ + … + a_0 = 0 (n = 1 … 4). Koeffizienten: höchster Grad zuerst.
 * Liefert die verschiedenen Lösungen – exakt, wo möglich –, reelle aufsteigend zuerst.
 */
export function solvePolynomial(coeffs: Real[]): Scalar[] {
  if (coeffs.length < 2 || coeffs.length > 5) throw new CalcError('ARG', 'Es werden Polynome vom Grad 1 bis 4 unterstützt.');
  if (coeffs[0].isZero()) throw new CalcError('ARG', 'Der Koeffizient der höchsten Potenz darf nicht 0 sein.');
  const rats = coeffs.map((c) => c.rat());
  const roots: Scalar[] = [];
  let numeric: number[] | null = coeffs.map((c) => c.n);

  if (rats.every((q) => q !== null)) {
    // mehrfache Nullstellen vorab entfernen (ausgegeben werden nur die verschiedenen Lösungen)
    let c = squareFree(rats as Rat[]);
    // Nullstellen bei 0 abspalten
    while (c.length > 2 && c[c.length - 1].isZero()) {
      roots.push(Real.ZERO);
      c = c.slice(0, -1);
    }
    // rationale Nullstellen suchen (Kandidaten aus den numerischen Lösungen)
    if (c.length > 3) {
      const ints = toIntPoly(c);
      const qs = divisors(babs(ints[0]));
      if (qs) {
        const approx = numericRoots(c.map((q) => q.toNumber()));
        for (const z of approx) {
          if (c.length <= 3) break;
          if (Math.abs(z.im) > 1e-4 * Math.max(1e-300, Math.abs(z.re)) && Math.abs(z.im) > 1e-9) continue;
          for (const q of qs) {
            const pf = Math.round(z.re * Number(q));
            if (!Number.isSafeInteger(pf)) continue;
            const p = BigInt(pf);
            if (bgcd(p, q) !== 1n && !(p === 0n && q === 1n)) continue;
            const r = Rat.of(p, q);
            let found = false;
            // auch mehrfache Nullstellen abspalten
            while (c.length > 3 && evalIntPolyAt(toIntPoly(c), r.n, r.d) === 0n) {
              c = deflate(c, r);
              found = true;
            }
            if (found) {
              roots.push(Real.fromRat(r));
              break;
            }
          }
        }
      }
    }
    if (c.length === 2) {
      roots.push(Real.fromRat(c[1].neg().div(c[0])));
      numeric = null;
    } else if (c.length === 3) {
      roots.push(...quadraticExact(c[0], c[1], c[2]));
      numeric = null;
    } else if (c.length === 5 && c[1].isZero() && c[3].isZero()) {
      // biquadratisch: Substitution u = x²
      const us = quadraticExact(c[0], c[2], c[4]);
      if (us.every((u) => u.kind === 'real')) {
        for (const u of us as Real[]) {
          if (u.isZero()) roots.push(Real.ZERO);
          else if (u.n > 0) {
            const s = rSqrt(u);
            roots.push(s, rNeg(s));
          } else {
            const s = rSqrt(rNeg(u));
            roots.push(new Cx(Real.ZERO, s), new Cx(Real.ZERO, rNeg(s)));
          }
        }
        numeric = null;
      } else numeric = c.map((q) => q.toNumber());
    } else {
      numeric = c.map((q) => q.toNumber());
    }
  }

  if (numeric) {
    // Nullstellen bei 0 abspalten
    while (numeric.length > 2 && numeric[numeric.length - 1] === 0) {
      roots.push(Real.ZERO);
      numeric = numeric.slice(0, -1);
    }
    if (numeric.length === 2) roots.push(Real.num(-numeric[1] / numeric[0]));
    else if (numeric.length === 3) {
      // stabile Mitternachtsformel
      const [a, b, c] = numeric;
      let D = b * b - 4 * a * c;
      // Diskriminante im Bereich des Rundungsrauschens: doppelte Nullstelle
      if (Math.abs(D) <= 1e-13 * Math.max(b * b, Math.abs(4 * a * c))) D = 0;
      if (D === 0) {
        roots.push(Real.num(cleanFloat(-b / (2 * a))));
      } else if (D > 0) {
        const q = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(D));
        const r1 = q / a;
        const r2 = q !== 0 ? c / q : r1;
        roots.push(Real.num(cleanFloat(r1)), Real.num(cleanFloat(r2)));
      } else {
        const re = Real.num(cleanFloat(-b / (2 * a)));
        const im = Real.num(cleanFloat(Math.sqrt(-D) / Math.abs(2 * a)));
        roots.push(new Cx(re, im), new Cx(re, rNeg(im)));
      }
    } else {
      for (const z of numericRoots(numeric)) roots.push(toScalar(z));
    }
  }
  return sortRoots(roots);
}

export interface Vertex {
  x: Real;
  y: Real;
  kind: 'min' | 'max';
}

/** Scheitelpunkt der Parabel y = a·x² + b·x + c. */
export function quadraticVertex(a: Real, b: Real, c: Real): Vertex {
  if (a.isZero()) throw new CalcError('ARG', 'Der Koeffizient a darf nicht 0 sein.');
  const x = rDiv(rNeg(b), rMul(Real.int(2), a));
  const y = rSub(c, rDiv(rMul(b, b), rMul(Real.int(4), a)));
  return { x, y, kind: a.n > 0 ? 'min' : 'max' };
}

// ───────────────────────────── Ungleichungen ─────────────────────────────

export type IneqOp = '>' | '<' | '>=' | '<=';

export interface Interval {
  /** untere Grenze; null = −∞ */
  lo: Real | null;
  /** obere Grenze; null = +∞ */
  hi: Real | null;
  loClosed: boolean;
  hiClosed: boolean;
}

/** Lösungsmenge von P(x) op 0 als Liste disjunkter Intervalle (aufsteigend). */
export function solveInequality(coeffs: Real[], op: IneqOp): Interval[] {
  const roots = solvePolynomial(coeffs).filter((r): r is Real => r.kind === 'real');
  const nums = coeffs.map((c) => c.n);
  const strict = op === '>' || op === '<';
  const wantPositive = op === '>' || op === '>=';
  const k = roots.length;
  // Vorzeichen in den k+1 offenen Intervallen
  const ok: boolean[] = [];
  for (let i = 0; i <= k; i++) {
    let t: number;
    if (k === 0) t = 0;
    else if (i === 0) t = roots[0].n - 1;
    else if (i === k) t = roots[k - 1].n + 1;
    else t = (roots[i - 1].n + roots[i].n) / 2;
    const v = polyEval(nums, t);
    ok.push(wantPositive ? v > 0 : v < 0);
  }
  const out: Interval[] = [];
  let cur: Interval | null = null;
  for (let i = 0; i <= k; i++) {
    const lo = i === 0 ? null : roots[i - 1];
    const hi = i === k ? null : roots[i];
    if (ok[i]) {
      if (cur && !strict) cur.hi = hi;
      else {
        if (cur) out.push(cur);
        cur = { lo, hi, loClosed: !strict && lo !== null, hiClosed: false };
      }
      cur.hi = hi;
      cur.hiClosed = !strict && hi !== null;
    } else {
      if (cur) {
        out.push(cur);
        cur = null;
        // die Grenze gehört (bei ≤/≥) bereits zum abgeschlossenen Intervall
      } else if (!strict && lo !== null) {
        // isolierter Punkt zwischen zwei nicht erfüllten Intervallen
        if (!(out.length && out[out.length - 1].hi === lo && out[out.length - 1].hiClosed)) {
          out.push({ lo, hi: lo, loClosed: true, hiClosed: true });
        }
      }
    }
  }
  if (cur) out.push(cur);
  // bei ≤/≥: letzter isolierter Punkt am rechten Rand kann fehlen – wird oben bereits über lo erfasst
  return out;
}
