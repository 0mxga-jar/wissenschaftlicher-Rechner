/** Auswertung des Syntaxbaums. */
import { CalcError } from './errors';
import { Rat } from './rat';
import {
  Real,
  rAdd,
  rSub,
  rMul,
  rDiv,
  rNeg,
  rPow,
  rSqrt,
  rRoot,
  rAbs,
  rExp,
  rLn,
  rLog10,
  rLogB,
  rFact,
  rPerm,
  rComb,
  rGcd,
  rLcm,
  rFloor,
  rTrunc,
  rDivRem,
  rSin,
  rCos,
  rTan,
  rAsin,
  rAcos,
  rAtan,
  rAtan2,
  rSinh,
  rCosh,
  rTanh,
  rAsinh,
  rAcosh,
  rAtanh,
  rCmp,
  convertAngle,
  type AngleUnit,
} from './real';
import {
  Cx,
  Mat,
  Vec,
  Pair,
  I,
  type Value,
  type Scalar,
  isScalar,
  isMat,
  isVec,
  cAdd,
  cSub,
  cMul,
  cDiv,
  cNeg,
  cPow,
  cSqrt,
  cAbs,
  cArg,
  cConj,
  cPolar,
  cExp,
  cLn,
  cSin,
  cCos,
  cTan,
  cSinh,
  cCosh,
  cTanh,
  re,
  im,
  mAdd,
  mMul,
  mScale,
  mPow,
  mDet,
  mTranspose,
  mIdentity,
  mInverse,
  mRref,
  vAdd,
  vScale,
  vDot,
  vCross,
  vNorm,
  vUnit,
  vAngle,
} from './values';
import { parse, type Node, type ParseOptions } from './parser';
import { integrate, differentiate, solve as solveNumeric, type Fn } from './calculus';
import { getConstant, convertUnit } from './constants';

export interface EvalContext {
  angle: AngleUnit;
  /** Komplexe Zahlen zulassen (Modus „Komplexe Zahlen“). */
  complex: boolean;
  /** Variablen A–F, M, x, y, z sowie Ans und PreAns. */
  vars: Record<string, Value>;
  mats: Record<string, Mat>;
  vcts: Record<string, Vec>;
  /** Zellzugriff der Tabellenkalkulation. */
  cell?: (col: number, row: number) => Value;
  random: () => number;
  /** Rundung gemäß Anzeigeformat (Funktion Rnd). */
  round?: (r: Real) => Real;
}

export function createContext(p: Partial<EvalContext> = {}): EvalContext {
  return {
    angle: 'DEG',
    complex: false,
    vars: {},
    mats: {},
    vcts: {},
    random: Math.random,
    ...p,
  };
}

function argErr(msg: string): never {
  throw new CalcError('ARG', msg);
}

function asReal(v: Value, what = 'Die Funktion'): Real {
  if (v.kind === 'real') return v;
  if (v.kind === 'complex') argErr(`${what} erwartet eine reelle Zahl.`);
  argErr(`${what} erwartet eine Zahl.`);
}
function asScalar(v: Value, what = 'Die Funktion'): Scalar {
  if (isScalar(v)) return v;
  argErr(`${what} erwartet eine Zahl.`);
}
function asInt(v: Value, what: string): number {
  const r = asReal(v, what);
  if (!r.isInt()) argErr(`${what} erwartet eine ganze Zahl.`);
  return r.n;
}
function asMat(v: Value, what: string): Mat {
  if (isMat(v)) return v;
  argErr(`${what} erwartet eine Matrix.`);
}
function asVec(v: Value, what: string): Vec {
  if (isVec(v)) return v;
  argErr(`${what} erwartet einen Vektor.`);
}

// ───────────────────────────── Grundrechenarten ─────────────────────────────

export function add(a: Value, b: Value): Value {
  if (isScalar(a) && isScalar(b)) return cAdd(a, b);
  if (isMat(a) && isMat(b)) return mAdd(a, b);
  if (isVec(a) && isVec(b)) return vAdd(a, b);
  argErr('Diese Werte lassen sich nicht addieren.');
}
export function sub(a: Value, b: Value): Value {
  if (isScalar(a) && isScalar(b)) return cSub(a, b);
  if (isMat(a) && isMat(b)) return mAdd(a, b, true);
  if (isVec(a) && isVec(b)) return vAdd(a, b, true);
  argErr('Diese Werte lassen sich nicht subtrahieren.');
}
export function neg(a: Value): Value {
  if (isScalar(a)) return cNeg(a);
  if (isMat(a)) return mScale(a, Real.int(-1));
  if (isVec(a)) return vScale(a, Real.int(-1));
  argErr('Das Vorzeichen lässt sich hier nicht anwenden.');
}
export function mul(a: Value, b: Value): Value {
  if (isScalar(a) && isScalar(b)) return cMul(a, b);
  if (isMat(a) && isMat(b)) return mMul(a, b);
  if (isMat(a) && b.kind === 'real') return mScale(a, b);
  if (a.kind === 'real' && isMat(b)) return mScale(b, a);
  if (isVec(a) && b.kind === 'real') return vScale(a, b);
  if (a.kind === 'real' && isVec(b)) return vScale(b, a);
  if (isVec(a) && isVec(b)) return vCross(a, b);
  if (isMat(a) && isVec(b)) {
    const col = new Mat(b.d.map((x) => [x]));
    return new Vec(mMul(a, col).d.map((r) => r[0]));
  }
  argErr('Diese Werte lassen sich nicht multiplizieren.');
}
export function div(a: Value, b: Value): Value {
  if (isScalar(a) && isScalar(b)) return cDiv(a, b);
  if (b.kind === 'real') {
    if (b.isZero()) throw new CalcError('DIV0');
    if (isMat(a)) return new Mat(a.d.map((r) => r.map((x) => rDiv(x, b))));
    if (isVec(a)) return new Vec(a.d.map((x) => rDiv(x, b)));
  }
  argErr('Diese Werte lassen sich nicht dividieren.');
}
export function pow(a: Value, b: Value, ctx: EvalContext): Value {
  if (isMat(a)) {
    const e = asReal(b, 'Der Exponent');
    if (!e.isInt()) argErr('Der Exponent einer Matrix muss ganzzahlig sein.');
    return mPow(a, e.n);
  }
  if (!isScalar(a) || !isScalar(b)) argErr('Potenzen sind nur für Zahlen und quadratische Matrizen definiert.');
  if (a.kind === 'real' && b.kind === 'real') {
    try {
      return rPow(a, b);
    } catch (e) {
      if (ctx.complex && e instanceof CalcError && e.code === 'DOMAIN' && a.n < 0) return cPow(a, b);
      throw e;
    }
  }
  return cPow(a, b);
}

// ───────────────────────────── Funktionen ─────────────────────────────

type Impl = (args: Node[], ctx: EvalContext) => Value;
interface FnDef {
  min: number;
  max: number;
  fn: Impl;
  label: string;
}

const FUNCS: Record<string, FnDef> = {};

function def(name: string, label: string, min: number, max: number, fn: Impl): void {
  FUNCS[name] = { min, max, fn, label };
}
/** Funktion mit einem reellen Argument. */
function real1(name: string, label: string, f: (x: Real, ctx: EvalContext) => Value): void {
  def(name, label, 1, 1, (args, ctx) => f(asReal(evaluate(args[0], ctx), label), ctx));
}
/** Funktion mit reeller und komplexer Variante. */
function scalar1(
  name: string,
  label: string,
  fr: (x: Real, ctx: EvalContext) => Value,
  fc: (z: Cx, ctx: EvalContext) => Value,
): void {
  def(name, label, 1, 1, (args, ctx) => {
    const v = asScalar(evaluate(args[0], ctx), label);
    return v.kind === 'real' ? fr(v, ctx) : fc(v, ctx);
  });
}

scalar1('sin', 'sin', (x, c) => rSin(x, c.angle), (z) => cSin(z));
scalar1('cos', 'cos', (x, c) => rCos(x, c.angle), (z) => cCos(z));
scalar1('tan', 'tan', (x, c) => rTan(x, c.angle), (z) => cTan(z));
real1('asin', 'sin⁻¹', (x, c) => rAsin(x, c.angle));
real1('acos', 'cos⁻¹', (x, c) => rAcos(x, c.angle));
real1('atan', 'tan⁻¹', (x, c) => rAtan(x, c.angle));
scalar1('sinh', 'sinh', (x) => rSinh(x), (z) => cSinh(z));
scalar1('cosh', 'cosh', (x) => rCosh(x), (z) => cCosh(z));
scalar1('tanh', 'tanh', (x) => rTanh(x), (z) => cTanh(z));
real1('asinh', 'sinh⁻¹', (x) => rAsinh(x));
real1('acosh', 'cosh⁻¹', (x) => rAcosh(x));
real1('atanh', 'tanh⁻¹', (x) => rAtanh(x));
scalar1('exp', 'e^', (x) => rExp(x), (z) => cExp(z));
scalar1(
  'ln',
  'ln',
  (x, c) => (x.n < 0 && c.complex ? cLn(x) : rLn(x)),
  (z) => cLn(z),
);
scalar1(
  'sqrt',
  '√',
  (x, c) => (x.n < 0 && c.complex ? cSqrt(x) : rSqrt(x)),
  (z) => cSqrt(z),
);
real1('cbrt', '∛', (x) => rRoot(x, Real.int(3)));

def('log', 'log', 1, 2, (args, ctx) => {
  if (args.length === 2) {
    return rLogB(asReal(evaluate(args[0], ctx), 'log'), asReal(evaluate(args[1], ctx), 'log'));
  }
  const v = asScalar(evaluate(args[0], ctx), 'log');
  if (v.kind === 'complex' || (v.n < 0 && ctx.complex)) return cDiv(cLn(v), Real.approx(Math.LN10));
  return rLog10(v);
});
def('logb', 'log', 2, 2, (args, ctx) =>
  rLogB(asReal(evaluate(args[0], ctx), 'log'), asReal(evaluate(args[1], ctx), 'log')),
);
def('nroot', 'Wurzel', 2, 2, (args, ctx) => {
  const n = asReal(evaluate(args[0], ctx), 'Der Wurzelexponent');
  const x = asScalar(evaluate(args[1], ctx), 'Die Wurzel');
  if (x.kind === 'complex') return cPow(x, rDiv(Real.ONE, n));
  try {
    return rRoot(x, n);
  } catch (e) {
    if (ctx.complex && e instanceof CalcError && e.code === 'DOMAIN') return cPow(x, rDiv(Real.ONE, n));
    throw e;
  }
});
def('abs', 'Abs', 1, 1, (args, ctx) => {
  const v = evaluate(args[0], ctx);
  if (isScalar(v)) return cAbs(v);
  if (isVec(v)) return vNorm(v);
  if (isMat(v)) return new Mat(v.d.map((r) => r.map((x) => rAbs(x))));
  argErr('Abs erwartet eine Zahl, einen Vektor oder eine Matrix.');
});
def('mixed', 'Gemischter Bruch', 3, 3, (args, ctx) => {
  const w = asReal(evaluate(args[0], ctx), 'Der gemischte Bruch');
  const a = asReal(evaluate(args[1], ctx), 'Der gemischte Bruch');
  const b = asReal(evaluate(args[2], ctx), 'Der gemischte Bruch');
  return rAdd(w, rDiv(a, b));
});
def('nPr', 'nPr', 2, 2, (args, ctx) => rPerm(asReal(evaluate(args[0], ctx), 'nPr'), asReal(evaluate(args[1], ctx), 'nPr')));
def('nCr', 'nCr', 2, 2, (args, ctx) => rComb(asReal(evaluate(args[0], ctx), 'nCr'), asReal(evaluate(args[1], ctx), 'nCr')));
def('gcd', 'ggT', 2, 8, (args, ctx) => args.map((a) => asReal(evaluate(a, ctx), 'ggT')).reduce((p, c) => rGcd(p, c)));
def('lcm', 'kgV', 2, 8, (args, ctx) => args.map((a) => asReal(evaluate(a, ctx), 'kgV')).reduce((p, c) => rLcm(p, c)));
real1('int', 'Int', (x) => rTrunc(x));
real1('intg', 'Intg', (x) => rFloor(x));
real1('rnd', 'Rnd', (x, c) => (c.round ? c.round(x) : x));
def('rest', 'Rest', 2, 2, (args, ctx) => rDivRem(asReal(evaluate(args[0], ctx), 'Rest'), asReal(evaluate(args[1], ctx), 'Rest'))[1]);
def('ran', 'Ran#', 0, 0, (_a, ctx) => Real.rat(Math.floor(ctx.random() * 1000), 1000));
def('ranint', 'RanInt', 2, 2, (args, ctx) => {
  const a = asInt(evaluate(args[0], ctx), 'RanInt');
  const b = asInt(evaluate(args[1], ctx), 'RanInt');
  if (a > b) argErr('Bei RanInt muss der erste Wert kleiner oder gleich dem zweiten sein.');
  return Real.int(a + Math.floor(ctx.random() * (b - a + 1)));
});
def('pol', 'Pol', 2, 2, (args, ctx) => {
  const x = asReal(evaluate(args[0], ctx), 'Pol');
  const y = asReal(evaluate(args[1], ctx), 'Pol');
  const r = cAbs(new Cx(x, y));
  const t = rAtan2(y, x, ctx.angle);
  ctx.vars.x = r;
  ctx.vars.y = t;
  return new Pair(['r', 'θ'], [r, t]);
});
def('rec', 'Rec', 2, 2, (args, ctx) => {
  const r = asReal(evaluate(args[0], ctx), 'Rec');
  const t = asReal(evaluate(args[1], ctx), 'Rec');
  const x = rMul(r, rCos(t, ctx.angle));
  const y = rMul(r, rSin(t, ctx.angle));
  ctx.vars.x = x;
  ctx.vars.y = y;
  return new Pair(['x', 'y'], [x, y]);
});
def('arg', 'Arg', 1, 1, (args, ctx) => cArg(asScalar(evaluate(args[0], ctx), 'Arg'), ctx.angle));
def('conjg', 'Conjg', 1, 1, (args, ctx) => cConj(asScalar(evaluate(args[0], ctx), 'Conjg')));
def('re', 'Re', 1, 1, (args, ctx) => re(asScalar(evaluate(args[0], ctx), 'Re')));
def('im', 'Im', 1, 1, (args, ctx) => im(asScalar(evaluate(args[0], ctx), 'Im')));

def('det', 'det', 1, 1, (args, ctx) => mDet(asMat(evaluate(args[0], ctx), 'det')));
def('trn', 'Trn', 1, 1, (args, ctx) => mTranspose(asMat(evaluate(args[0], ctx), 'Trn')));
def('inv', 'Inv', 1, 1, (args, ctx) => mInverse(asMat(evaluate(args[0], ctx), 'Inv')));
def('rref', 'Rref', 1, 1, (args, ctx) => mRref(asMat(evaluate(args[0], ctx), 'Rref')));
def('identity', 'Identity', 1, 1, (args, ctx) => mIdentity(asInt(evaluate(args[0], ctx), 'Identity')));
def('dotp', 'DotP', 2, 2, (args, ctx) => vDot(asVec(evaluate(args[0], ctx), 'DotP'), asVec(evaluate(args[1], ctx), 'DotP')));
def('crossp', 'CrossP', 2, 2, (args, ctx) => vCross(asVec(evaluate(args[0], ctx), 'CrossP'), asVec(evaluate(args[1], ctx), 'CrossP')));
def('angle', 'Angle', 2, 2, (args, ctx) =>
  vAngle(asVec(evaluate(args[0], ctx), 'Angle'), asVec(evaluate(args[1], ctx), 'Angle'), ctx.angle),
);
def('unitv', 'UnitV', 1, 1, (args, ctx) => vUnit(asVec(evaluate(args[0], ctx), 'UnitV')));

// ── Analysis (gebundene Variable x) ──

function withX<T>(ctx: EvalContext, f: () => T): T {
  const had = Object.prototype.hasOwnProperty.call(ctx.vars, 'x');
  const old = ctx.vars.x;
  try {
    return f();
  } finally {
    if (had) ctx.vars.x = old;
    else delete ctx.vars.x;
  }
}

/** Baut aus einem Syntaxbaum eine numerische Funktion der Variablen `name`. */
export function numericFn(body: Node, ctx: EvalContext, name = 'x'): Fn {
  return (t: number) => {
    ctx.vars[name] = new Real(t, null);
    const v = evaluate(body, ctx);
    if (v.kind !== 'real') throw new CalcError('ARG', 'Der Ausdruck muss reelle Werte liefern.');
    return v.n;
  };
}

def('integral', '∫', 3, 3, (args, ctx) => {
  const a = asReal(evaluate(args[1], ctx), 'Die untere Grenze');
  const b = asReal(evaluate(args[2], ctx), 'Die obere Grenze');
  return withX(ctx, () => Real.num(integrate(numericFn(args[0], ctx), a.n, b.n)));
});
def('diff', 'd/dx', 2, 2, (args, ctx) => {
  const x0 = asReal(evaluate(args[1], ctx), 'Die Stelle');
  return withX(ctx, () => Real.num(differentiate(numericFn(args[0], ctx), x0.n)));
});
function series(args: Node[], ctx: EvalContext, product: boolean): Value {
  const what = product ? 'Das Produkt' : 'Die Summe';
  const a = asInt(evaluate(args[1], ctx), `${what} (Startwert)`);
  const b = asInt(evaluate(args[2], ctx), `${what} (Endwert)`);
  if (a > b) argErr('Der Startwert darf nicht größer als der Endwert sein.');
  if (b - a > 100000) throw new CalcError('RANGE', 'Zu viele Summanden bzw. Faktoren.');
  return withX(ctx, () => {
    let acc: Value = product ? Real.ONE : Real.ZERO;
    for (let k = a; k <= b; k++) {
      ctx.vars.x = Real.int(k);
      const v = evaluate(args[0], ctx);
      acc = product ? mul(acc, v) : add(acc, v);
    }
    return acc;
  });
}
def('sum', 'Σ', 3, 3, (args, ctx) => series(args, ctx, false));
def('prod', 'Π', 3, 3, (args, ctx) => series(args, ctx, true));

// ── Tabellenkalkulation ──

function cellValues(args: Node[], ctx: EvalContext, what: string): Real[] {
  const out: Real[] = [];
  for (const a of args) {
    if (a.t === 'range') {
      if (!ctx.cell) argErr('Zellbereiche gibt es nur in der Tabellenkalkulation.');
      for (let r = a.r1; r <= a.r2; r++) {
        for (let c = a.c1; c <= a.c2; c++) out.push(asReal(ctx.cell(c, r), what));
      }
    } else out.push(asReal(evaluate(a, ctx), what));
  }
  if (out.length === 0) argErr(`${what} benötigt mindestens einen Wert.`);
  return out;
}
def('cellsum', 'Summe', 1, 16, (args, ctx) => cellValues(args, ctx, 'Summe').reduce((p, c) => rAdd(p, c)));
def('cellmean', 'Mittel', 1, 16, (args, ctx) => {
  const v = cellValues(args, ctx, 'Mittel');
  return rDiv(v.reduce((p, c) => rAdd(p, c)), Real.int(v.length));
});
def('cellmin', 'Min', 1, 16, (args, ctx) => cellValues(args, ctx, 'Min').reduce((p, c) => (rCmp(c, p) < 0 ? c : p)));
def('cellmax', 'Max', 1, 16, (args, ctx) => cellValues(args, ctx, 'Max').reduce((p, c) => (rCmp(c, p) > 0 ? c : p)));

// ───────────────────────────── Auswertung ─────────────────────────────

export function evaluate(node: Node, ctx: EvalContext): Value {
  switch (node.t) {
    case 'num':
      return node.v;
    case 'var':
      return ctx.vars[node.name] ?? Real.ZERO;
    case 'sym':
      if (node.name === 'pi') return Real.PI;
      if (node.name === 'e') return Real.E;
      if (!ctx.complex) argErr('Die imaginäre Einheit i gibt es nur im Modus „Komplexe Zahlen“.');
      return I;
    case 'const':
      return Real.num(getConstant(node.id).value);
    case 'mat': {
      const m = ctx.mats[node.name];
      if (!m) throw new CalcError('UNDEF', `Mat${node.name} ist nicht definiert.`);
      return m;
    }
    case 'vct': {
      const v = ctx.vcts[node.name];
      if (!v) throw new CalcError('UNDEF', `Vct${node.name} ist nicht definiert.`);
      return v;
    }
    case 'neg':
      return neg(evaluate(node.a, ctx));
    case 'bin': {
      const a = evaluate(node.a, ctx);
      const b = evaluate(node.b, ctx);
      switch (node.op) {
        case '+':
          return add(a, b);
        case '-':
          return sub(a, b);
        case '*':
          return mul(a, b);
        case '/':
          return div(a, b);
        case '^':
          return pow(a, b, ctx);
        case 'divr': {
          const [q, r] = rDivRem(asReal(a, 'Die Division mit Rest'), asReal(b, 'Die Division mit Rest'));
          return new Pair(['Q', 'R'], [q, r]);
        }
        case 'nPr':
          return rPerm(asReal(a, 'nPr'), asReal(b, 'nPr'));
        case 'nCr':
          return rComb(asReal(a, 'nCr'), asReal(b, 'nCr'));
        case 'angle':
          if (!ctx.complex) argErr('Die Polarform r∠θ gibt es nur im Modus „Komplexe Zahlen“.');
          return cPolar(asReal(a, 'Der Betrag'), asReal(b, 'Der Winkel'), ctx.angle);
        case 'dot':
          return vDot(asVec(a, 'Das Skalarprodukt'), asVec(b, 'Das Skalarprodukt'));
      }
      break;
    }
    case 'post': {
      const a = evaluate(node.a, ctx);
      switch (node.op) {
        case '!':
          return rFact(asReal(a, 'Die Fakultät'));
        case '%':
          return div(a, Real.int(100));
        case 'deg':
          return convertAngle(asReal(a, 'Die Winkelangabe'), 'DEG', ctx.angle);
        case 'rad':
          return convertAngle(asReal(a, 'Die Winkelangabe'), 'RAD', ctx.angle);
        case 'gra':
          return convertAngle(asReal(a, 'Die Winkelangabe'), 'GRA', ctx.angle);
      }
      break;
    }
    case 'dms': {
      let v = asReal(evaluate(node.d, ctx), 'Die Gradangabe');
      const sign = v.n < 0 ? -1 : 1;
      if (node.m) {
        const m = rDiv(asReal(evaluate(node.m, ctx)), Real.int(60));
        v = sign < 0 ? rSub(v, m) : rAdd(v, m);
      }
      if (node.s) {
        const s = rDiv(asReal(evaluate(node.s, ctx)), Real.int(3600));
        v = sign < 0 ? rSub(v, s) : rAdd(v, s);
      }
      return v;
    }
    case 'conv': {
      const a = asReal(evaluate(node.a, ctx), 'Die Umrechnung');
      return Real.num(cleanFloat(convertUnit(a.n, node.from, node.to)));
    }
    case 'call': {
      const f = FUNCS[node.name];
      if (!f) throw new CalcError('UNDEF', `Die Funktion „${node.name}“ ist nicht bekannt.`);
      if (node.args.length < f.min || node.args.length > f.max) {
        const need = f.min === f.max ? `${f.min}` : `${f.min} bis ${f.max}`;
        throw new CalcError('SYNTAX', `${f.label} benötigt ${need} Argument${f.max === 1 ? '' : 'e'}.`);
      }
      return f.fn(node.args, ctx);
    }
    case 'eq':
      throw new CalcError('SYNTAX', 'Gleichungen werden mit SOLVE gelöst (SHIFT + CALC).');
    case 'cell':
      if (!ctx.cell) argErr('Zellbezüge gibt es nur in der Tabellenkalkulation.');
      return ctx.cell(node.col, node.row);
    case 'range':
      argErr('Ein Zellbereich ist nur innerhalb von Summe, Mittel, Min oder Max erlaubt.');
  }
  throw new CalcError('ARG');
}

/** Rundungsrauschen entfernen (15 signifikante Stellen). */
export function cleanFloat(x: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  return Number(x.toPrecision(15));
}

/** Ausdruck einlesen und auswerten. */
export function calculate(src: string, ctx: EvalContext, opts: ParseOptions = {}): Value {
  return evaluate(parse(src, opts), ctx);
}

export interface SolveOutcome {
  root: Real;
  /** Linke minus rechte Seite an der Lösung. */
  residual: Real;
}

/** Löst die Gleichung (oder Ausdruck = 0) nach der Variablen `name` mit Startwert x0. */
export function solveFor(node: Node, name: string, x0: number, ctx: EvalContext): SolveOutcome {
  const body: Node = node.t === 'eq' ? { t: 'bin', op: '-', a: node.a, b: node.b } : node;
  const had = Object.prototype.hasOwnProperty.call(ctx.vars, name);
  const old = ctx.vars[name];
  try {
    const f = numericFn(body, ctx, name);
    const res = solveNumeric(f, x0);
    return { root: Real.num(res.root), residual: Real.num(res.residual) };
  } finally {
    if (had) ctx.vars[name] = old;
    else delete ctx.vars[name];
  }
}

export { Rat };
