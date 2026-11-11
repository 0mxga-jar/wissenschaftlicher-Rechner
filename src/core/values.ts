/** Wertetypen des Rechenkerns: reell, komplex, Matrix, Vektor, Wertepaar. */
import { CalcError } from './errors';
import {
  Real,
  rAdd,
  rSub,
  rMul,
  rDiv,
  rNeg,
  rSqrt,
  rAbs,
  rSin,
  rCos,
  rAcos,
  rAtan2,
  type AngleUnit,
} from './real';

export class Cx {
  readonly kind = 'complex' as const;
  constructor(
    readonly re: Real,
    readonly im: Real,
  ) {}
}

export class Mat {
  readonly kind = 'matrix' as const;
  readonly rows: number;
  readonly cols: number;
  constructor(readonly d: Real[][]) {
    this.rows = d.length;
    this.cols = d[0]?.length ?? 0;
  }
  static fromNumbers(a: number[][]): Mat {
    return new Mat(a.map((r) => r.map((x) => Real.num(x))));
  }
  toNumbers(): number[][] {
    return this.d.map((r) => r.map((x) => x.n));
  }
}

export class Vec {
  readonly kind = 'vector' as const;
  constructor(readonly d: Real[]) {}
  static fromNumbers(a: number[]): Vec {
    return new Vec(a.map((x) => Real.num(x)));
  }
  get dim(): number {
    return this.d.length;
  }
}

/** Zwei benannte Ergebnisse, z. B. Quotient/Rest oder r/θ. */
export class Pair {
  readonly kind = 'pair' as const;
  constructor(
    readonly labels: [string, string],
    readonly vals: [Real, Real],
  ) {}
}

export type Scalar = Real | Cx;
export type Value = Real | Cx | Mat | Vec | Pair;

export const isReal = (v: Value): v is Real => v.kind === 'real';
export const isCx = (v: Value): v is Cx => v.kind === 'complex';
export const isScalar = (v: Value): v is Scalar => v.kind === 'real' || v.kind === 'complex';
export const isMat = (v: Value): v is Mat => v.kind === 'matrix';
export const isVec = (v: Value): v is Vec => v.kind === 'vector';

/** Komplexe Zahl mit Imaginärteil 0 auf reell reduzieren. */
export function simplify(z: Scalar): Scalar {
  if (z.kind === 'complex' && z.im.isZero()) return z.re;
  return z;
}

export const re = (z: Scalar): Real => (z.kind === 'real' ? z : z.re);
export const im = (z: Scalar): Real => (z.kind === 'real' ? Real.ZERO : z.im);

export const I = new Cx(Real.ZERO, Real.ONE);

// ───────────────────────────── komplexe Arithmetik ─────────────────────────────

export function cAdd(a: Scalar, b: Scalar): Scalar {
  if (a.kind === 'real' && b.kind === 'real') return rAdd(a, b);
  return simplify(new Cx(rAdd(re(a), re(b)), rAdd(im(a), im(b))));
}
export function cSub(a: Scalar, b: Scalar): Scalar {
  if (a.kind === 'real' && b.kind === 'real') return rSub(a, b);
  return simplify(new Cx(rSub(re(a), re(b)), rSub(im(a), im(b))));
}
export function cNeg(a: Scalar): Scalar {
  if (a.kind === 'real') return rNeg(a);
  return new Cx(rNeg(a.re), rNeg(a.im));
}
export function cMul(a: Scalar, b: Scalar): Scalar {
  if (a.kind === 'real' && b.kind === 'real') return rMul(a, b);
  if (a.kind === 'real') return simplify(new Cx(rMul(a, re(b)), rMul(a, im(b))));
  if (b.kind === 'real') return simplify(new Cx(rMul(a.re, b), rMul(a.im, b)));
  return simplify(
    new Cx(rSub(rMul(a.re, b.re), rMul(a.im, b.im)), rAdd(rMul(a.re, b.im), rMul(a.im, b.re))),
  );
}
export function cDiv(a: Scalar, b: Scalar): Scalar {
  if (b.kind === 'real') {
    if (a.kind === 'real') return rDiv(a, b);
    return simplify(new Cx(rDiv(a.re, b), rDiv(a.im, b)));
  }
  const den = rAdd(rMul(b.re, b.re), rMul(b.im, b.im));
  if (den.isZero()) throw new CalcError('DIV0');
  const ar = re(a);
  const ai = im(a);
  return simplify(
    new Cx(
      rDiv(rAdd(rMul(ar, b.re), rMul(ai, b.im)), den),
      rDiv(rSub(rMul(ai, b.re), rMul(ar, b.im)), den),
    ),
  );
}
export function cConj(a: Scalar): Scalar {
  return a.kind === 'real' ? a : new Cx(a.re, rNeg(a.im));
}
export function cAbs(a: Scalar): Real {
  if (a.kind === 'real') return rAbs(a);
  if (a.re.isZero()) return rAbs(a.im);
  const s = rAdd(rMul(a.re, a.re), rMul(a.im, a.im));
  if (s.ex) return rSqrt(s);
  return Real.approx(Math.hypot(a.re.n, a.im.n));
}
export function cArg(a: Scalar, unit: AngleUnit): Real {
  return rAtan2(im(a), re(a), unit);
}
export function cPolar(r: Real, theta: Real, unit: AngleUnit): Scalar {
  return simplify(new Cx(rMul(r, rCos(theta, unit)), rMul(r, rSin(theta, unit))));
}

/** Komplexe Zahl aus doubles; Rundungsrauschen (z. B. e^(iπ) = −1 + 1,2·10⁻¹⁶·i) wird entfernt. */
const cx = (a: number, b: number): Scalar => {
  if (Math.abs(b) <= 1e-14 * Math.abs(a)) b = 0;
  else if (Math.abs(a) <= 1e-14 * Math.abs(b)) a = 0;
  return simplify(new Cx(Real.num(a), Real.num(b)));
};

export function cExp(a: Scalar): Scalar {
  const e = Math.exp(re(a).n);
  const y = im(a).n;
  return cx(e * Math.cos(y), e * Math.sin(y));
}
export function cLn(a: Scalar): Scalar {
  const r = cAbs(a).n;
  if (r === 0) throw new CalcError('DOMAIN', 'Der Logarithmus von 0 ist nicht definiert.');
  return cx(Math.log(r), Math.atan2(im(a).n, re(a).n));
}
export function cSqrt(a: Scalar): Scalar {
  if (a.kind === 'real') {
    if (a.n >= 0) return rSqrt(a);
    return new Cx(Real.ZERO, rSqrt(rNeg(a)));
  }
  const r = cAbs(a);
  const two = Real.int(2);
  const x = rSqrt(rDiv(rAdd(r, a.re), two));
  const half = rDiv(rSub(r, a.re), two);
  const y = rSqrt(half.n < 0 ? Real.ZERO : half);
  return simplify(new Cx(x, a.im.n < 0 ? rNeg(y) : y));
}
export function cPow(a: Scalar, b: Scalar): Scalar {
  if (b.kind === 'real' && b.isInt() && Math.abs(b.n) <= 1e6) {
    let n = Math.abs(b.n);
    if (n === 0) {
      if (cAbs(a).isZero()) throw new CalcError('DOMAIN', '0 hoch 0 ist nicht definiert.');
      return Real.ONE;
    }
    let result: Scalar = Real.ONE;
    let base: Scalar = a;
    while (n > 0) {
      if (n & 1) result = cMul(result, base);
      n >>= 1;
      if (n > 0) base = cMul(base, base);
    }
    return b.n < 0 ? cDiv(Real.ONE, result) : result;
  }
  if (cAbs(a).isZero()) {
    if (re(b).n > 0) return Real.ZERO;
    throw new CalcError('DIV0');
  }
  return cExp(cMul(b, cLn(a)));
}
export function cSin(a: Cx): Scalar {
  const x = a.re.n;
  const y = a.im.n;
  return cx(Math.sin(x) * Math.cosh(y), Math.cos(x) * Math.sinh(y));
}
export function cCos(a: Cx): Scalar {
  const x = a.re.n;
  const y = a.im.n;
  return cx(Math.cos(x) * Math.cosh(y), -Math.sin(x) * Math.sinh(y));
}
export function cTan(a: Cx): Scalar {
  return cDiv(cSin(a), cCos(a));
}
export function cSinh(a: Cx): Scalar {
  const x = a.re.n;
  const y = a.im.n;
  return cx(Math.sinh(x) * Math.cos(y), Math.cosh(x) * Math.sin(y));
}
export function cCosh(a: Cx): Scalar {
  const x = a.re.n;
  const y = a.im.n;
  return cx(Math.cosh(x) * Math.cos(y), Math.sinh(x) * Math.sin(y));
}
export function cTanh(a: Cx): Scalar {
  return cDiv(cSinh(a), cCosh(a));
}

// ───────────────────────────── Matrizen ─────────────────────────────

function dimErr(msg: string): never {
  throw new CalcError('DIM', msg);
}

export function mAdd(a: Mat, b: Mat, sub = false): Mat {
  if (a.rows !== b.rows || a.cols !== b.cols) dimErr('Die Matrizen müssen gleich groß sein.');
  return new Mat(a.d.map((r, i) => r.map((x, j) => (sub ? rSub(x, b.d[i][j]) : rAdd(x, b.d[i][j])))));
}
export function mScale(a: Mat, s: Real): Mat {
  return new Mat(a.d.map((r) => r.map((x) => rMul(x, s))));
}
export function mMul(a: Mat, b: Mat): Mat {
  if (a.cols !== b.rows) {
    dimErr('Für A×B muss die Spaltenzahl von A gleich der Zeilenzahl von B sein.');
  }
  const out: Real[][] = [];
  for (let i = 0; i < a.rows; i++) {
    const row: Real[] = [];
    for (let j = 0; j < b.cols; j++) {
      let s = Real.ZERO;
      for (let k = 0; k < a.cols; k++) s = rAdd(s, rMul(a.d[i][k], b.d[k][j]));
      row.push(s);
    }
    out.push(row);
  }
  return new Mat(out);
}
export function mTranspose(a: Mat): Mat {
  const out: Real[][] = [];
  for (let j = 0; j < a.cols; j++) out.push(a.d.map((r) => r[j]));
  return new Mat(out);
}
export function mIdentity(n: number): Mat {
  if (!Number.isInteger(n) || n < 1 || n > 4) throw new CalcError('ARG', 'Die Einheitsmatrix ist für n = 1 bis 4 möglich.');
  const out: Real[][] = [];
  for (let i = 0; i < n; i++) {
    out.push(Array.from({ length: n }, (_, j) => (i === j ? Real.ONE : Real.ZERO)));
  }
  return new Mat(out);
}

/** Gauß-Elimination mit Pivotsuche; liefert Determinante und (optional) reduzierte erweiterte Matrix. */
function eliminate(m: Real[][], cols: number): { det: Real; rank: number } {
  const n = m.length;
  let det = Real.ONE;
  let rank = 0;
  let row = 0;
  // Größenordnung jeder Zeile (für die Beurteilung „numerisch null“ bei nicht exakten Werten)
  const rowScale = m.map((r) => r.slice(0, cols).reduce((acc, x) => Math.max(acc, Math.abs(x.n)), 0));
  for (let col = 0; col < cols && row < n; col++) {
    let piv = -1;
    let best = 0;
    for (let i = row; i < n; i++) {
      const x = m[i][col];
      if (x.isZero()) continue;
      // numerisch winzige Einträge (nur bei nicht exakten Werten) als 0 behandeln
      if (!x.ex && Math.abs(x.n) < 1e-13 * rowScale[i]) continue;
      // relativ zur Zeilengröße vergleichen (skalierte Pivotsuche)
      const v = rowScale[i] > 0 ? Math.abs(x.n) / rowScale[i] : Math.abs(x.n);
      if (v > best) {
        best = v;
        piv = i;
      }
    }
    if (piv < 0) {
      det = Real.ZERO;
      continue;
    }
    if (piv !== row) {
      [m[piv], m[row]] = [m[row], m[piv]];
      [rowScale[piv], rowScale[row]] = [rowScale[row], rowScale[piv]];
      det = rNeg(det);
    }
    const p = m[row][col];
    det = rMul(det, p);
    for (let j = col; j < m[row].length; j++) m[row][j] = rDiv(m[row][j], p);
    for (let i = 0; i < n; i++) {
      if (i === row) continue;
      const f = m[i][col];
      if (f.isZero()) continue;
      for (let j = col; j < m[i].length; j++) m[i][j] = rSub(m[i][j], rMul(f, m[row][j]));
    }
    row++;
    rank++;
  }
  if (rank < Math.min(n, cols)) det = Real.ZERO;
  return { det, rank };
}

export function mDet(a: Mat): Real {
  if (a.rows !== a.cols) dimErr('Die Determinante gibt es nur für quadratische Matrizen.');
  const m = a.d.map((r) => r.slice());
  return eliminate(m, a.cols).det;
}
export function mInverse(a: Mat): Mat {
  if (a.rows !== a.cols) dimErr('Nur quadratische Matrizen sind invertierbar.');
  const n = a.rows;
  const m = a.d.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? Real.ONE : Real.ZERO))]);
  const { rank } = eliminate(m, n);
  if (rank < n) throw new CalcError('DIV0', 'Die Matrix ist nicht invertierbar (Determinante = 0).');
  return new Mat(m.map((r) => r.slice(n)));
}
export function mPow(a: Mat, e: number): Mat {
  if (a.rows !== a.cols) dimErr('Potenzen gibt es nur für quadratische Matrizen.');
  if (!Number.isInteger(e)) throw new CalcError('ARG', 'Der Exponent einer Matrix muss ganzzahlig sein.');
  if (Math.abs(e) > 1000) throw new CalcError('RANGE');
  if (e < 0) return mPow(mInverse(a), -e);
  let result = mIdentity(a.rows);
  let base = a;
  let k = e;
  while (k > 0) {
    if (k & 1) result = mMul(result, base);
    k >>= 1;
    if (k > 0) base = mMul(base, base);
  }
  return result;
}
/** Zeilenstufenform (reduziert). */
export function mRref(a: Mat): Mat {
  const m = a.d.map((r) => r.slice());
  eliminate(m, a.cols);
  return new Mat(m);
}
export function mRank(a: Mat): number {
  const m = a.d.map((r) => r.slice());
  return eliminate(m, a.cols).rank;
}

/** Löst A·x = b. Ergebnis: eindeutige Lösung, 'none' oder 'infinite'. */
export function solveLinear(A: Real[][], b: Real[]): Real[] | 'none' | 'infinite' {
  const n = A.length;
  const m = A.map((r, i) => [...r, b[i]]);
  const { rank } = eliminate(m, n);
  if (rank === n) return m.map((r) => r[n]);
  // Rang der erweiterten Matrix prüfen
  for (let i = 0; i < n; i++) {
    const zeroRow = m[i].slice(0, n).every((x) => x.isZero() || (!x.ex && Math.abs(x.n) < 1e-12));
    const rhs = m[i][n];
    if (zeroRow && !(rhs.isZero() || (!rhs.ex && Math.abs(rhs.n) < 1e-12))) return 'none';
  }
  return 'infinite';
}

// ───────────────────────────── Vektoren ─────────────────────────────

function sameDim(a: Vec, b: Vec): void {
  if (a.dim !== b.dim) dimErr('Die Vektoren müssen die gleiche Dimension haben.');
}
export function vAdd(a: Vec, b: Vec, sub = false): Vec {
  sameDim(a, b);
  return new Vec(a.d.map((x, i) => (sub ? rSub(x, b.d[i]) : rAdd(x, b.d[i]))));
}
export function vScale(a: Vec, s: Real): Vec {
  return new Vec(a.d.map((x) => rMul(x, s)));
}
export function vDot(a: Vec, b: Vec): Real {
  sameDim(a, b);
  let s = Real.ZERO;
  for (let i = 0; i < a.dim; i++) s = rAdd(s, rMul(a.d[i], b.d[i]));
  return s;
}
export function vCross(a: Vec, b: Vec): Vec {
  sameDim(a, b);
  const x = a.dim === 2 ? [...a.d, Real.ZERO] : a.d;
  const y = b.dim === 2 ? [...b.d, Real.ZERO] : b.d;
  return new Vec([
    rSub(rMul(x[1], y[2]), rMul(x[2], y[1])),
    rSub(rMul(x[2], y[0]), rMul(x[0], y[2])),
    rSub(rMul(x[0], y[1]), rMul(x[1], y[0])),
  ]);
}
export function vNorm(a: Vec): Real {
  return rSqrt(vDot(a, a));
}
export function vUnit(a: Vec): Vec {
  const n = vNorm(a);
  if (n.isZero()) throw new CalcError('DIV0', 'Der Nullvektor hat keinen Einheitsvektor.');
  return new Vec(a.d.map((x) => rDiv(x, n)));
}
export function vAngle(a: Vec, b: Vec, unit: AngleUnit): Real {
  const na = vNorm(a);
  const nb = vNorm(b);
  if (na.isZero() || nb.isZero()) throw new CalcError('DIV0', 'Der Winkel zum Nullvektor ist nicht definiert.');
  let c = rDiv(vDot(a, b), rMul(na, nb));
  if (c.n > 1) c = Real.ONE;
  if (c.n < -1) c = Real.int(-1);
  return rAcos(c, unit);
}
