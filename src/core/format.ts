/** Zahlenformatierung: Dezimal (Norm/Fix/Sci), exakte Darstellung, DMS, Primfaktoren. */
import { Exact } from './exact';
import { Rat, babs, bgcd } from './rat';
import { Real, rAbs, rSign, primeFactors, type AngleUnit } from './real';
import { type Scalar, cAbs, cArg } from './values';
import { type MRow, tok, toks, tpl } from './mathtree';

export type NumMode = 'norm1' | 'norm2' | 'fix' | 'sci';

export interface NumFormat {
  mode: NumMode;
  /** Nachkommastellen (Fix) bzw. signifikante Stellen (Sci, 0 = 10). */
  digits: number;
  /** Dezimalkomma statt Dezimalpunkt anzeigen. */
  comma: boolean;
}

export const DEFAULT_FORMAT: NumFormat = { mode: 'norm1', digits: 2, comma: true };

/** Ergebnisdarstellung: exakt (Bruch/Wurzel/π), dezimal oder gemischter Bruch. */
export type ResultForm = 'exact' | 'decimal' | 'mixed';

interface Sci {
  neg: boolean;
  /** signifikante Ziffern, erste Ziffer ≠ 0 (außer bei 0) */
  digits: string;
  /** Wert = d,ddd… × 10^exp */
  exp: number;
  zero: boolean;
}

const ZERO_SCI: Sci = { neg: false, digits: '0', exp: 0, zero: true };

function sciFromNumber(x: number): Sci {
  if (x === 0 || !Number.isFinite(x)) return ZERO_SCI;
  const s = Math.abs(x).toExponential(14);
  const k = s.indexOf('e');
  return { neg: x < 0, digits: s.slice(0, k).replace('.', ''), exp: parseInt(s.slice(k + 1), 10), zero: false };
}

function sciFromRat(q: Rat): Sci {
  if (q.isZero()) return ZERO_SCI;
  const n = babs(q.n);
  const d = q.d;
  const P = 24;
  const scale = (e: number): bigint => {
    const sh = P - 1 - e;
    return sh >= 0 ? (n * 10n ** BigInt(sh)) / d : n / (d * 10n ** BigInt(-sh));
  };
  let e = n.toString().length - d.toString().length;
  let str = scale(e).toString();
  if (str.length < P) {
    e -= 1;
    str = scale(e).toString();
  } else if (str.length > P) {
    e += 1;
    str = scale(e).toString();
  }
  return { neg: q.n < 0n, digits: str, exp: e, zero: false };
}

function toSci(r: Real): Sci {
  if (r.ex && r.ex.isRational()) {
    const q = r.ex.asRat();
    if (q.bits() < 2000) return sciFromRat(q);
  }
  return sciFromNumber(r.n);
}

/** Auf n signifikante Stellen runden (kaufmännisch). */
function roundSig(s: Sci, n: number): Sci {
  if (s.zero) return s;
  if (n <= 0) {
    if (n === 0 && s.digits.charCodeAt(0) - 48 >= 5) return { neg: s.neg, digits: '1', exp: s.exp + 1, zero: false };
    return ZERO_SCI;
  }
  if (s.digits.length <= n) return s;
  let v = BigInt(s.digits.slice(0, n));
  if (s.digits.charCodeAt(n) - 48 >= 5) v += 1n;
  let str = v.toString();
  let exp = s.exp;
  if (str.length > n) {
    exp += 1;
    str = str.slice(0, n);
  }
  return { neg: s.neg, digits: str, exp, zero: false };
}

/** Feste Zahl von Nachkommastellen. */
function roundFix(s: Sci, k: number): Sci {
  return roundSig(s, s.exp + 1 + k);
}

function plain(s: Sci, decimals: number | null): string {
  let D = s.digits;
  const e = s.exp;
  let intPart: string;
  let frac: string;
  if (s.zero) {
    intPart = '0';
    frac = '';
  } else if (e >= 0) {
    if (D.length < e + 1) D = D.padEnd(e + 1, '0');
    intPart = D.slice(0, e + 1);
    frac = D.slice(e + 1);
  } else {
    intPart = '0';
    frac = '0'.repeat(-e - 1) + D;
  }
  if (decimals === null) frac = frac.replace(/0+$/, '');
  else frac = frac.padEnd(decimals, '0').slice(0, decimals);
  return frac ? `${intPart}.${frac}` : intPart;
}

function mantissa(s: Sci, n: number | null): string {
  let rest = s.digits.slice(1);
  if (n === null) rest = rest.replace(/0+$/, '');
  else rest = rest.padEnd(n - 1, '0').slice(0, n - 1);
  return rest ? `${s.digits[0]}.${rest}` : s.digits[0];
}

export interface DecParts {
  neg: boolean;
  /** Mantisse mit Dezimalpunkt */
  mant: string;
  /** Zehnerexponent oder null (ohne Exponentendarstellung) */
  exp: number | null;
}

/** Zerlegt eine Zahl gemäß Anzeigeformat in Vorzeichen, Mantisse und Exponent. */
export function decimalParts(r: Real, fmt: NumFormat): DecParts {
  const s = toSci(r);
  switch (fmt.mode) {
    case 'fix': {
      const k = Math.max(0, Math.min(9, fmt.digits));
      if (!s.zero && s.exp >= 10) {
        const m = roundSig(s, k + 1);
        return { neg: m.neg, mant: mantissa(m, k + 1), exp: m.exp };
      }
      const f = roundFix(s, k);
      if (!f.zero && f.exp >= 10) return { neg: f.neg, mant: mantissa(f, k + 1), exp: f.exp };
      return { neg: f.zero ? false : f.neg, mant: plain(f, k), exp: null };
    }
    case 'sci': {
      const n = fmt.digits <= 0 || fmt.digits > 10 ? 10 : fmt.digits;
      if (s.zero) return { neg: false, mant: mantissa({ ...s, digits: '0' }, n), exp: 0 };
      const m = roundSig(s, n);
      return { neg: m.neg, mant: mantissa(m, n), exp: m.exp };
    }
    default: {
      if (s.zero) return { neg: false, mant: '0', exp: null };
      const m = roundSig(s, 10);
      const lower = fmt.mode === 'norm1' ? -2 : -9;
      if (m.exp < lower || m.exp >= 10) return { neg: m.neg, mant: mantissa(m, null), exp: m.exp };
      if (m.exp < 0 && fmt.mode === 'norm2') {
        const f = roundFix(s, 10);
        return { neg: f.zero ? false : f.neg, mant: plain(f, null), exp: null };
      }
      return { neg: m.neg, mant: plain(m, null), exp: null };
    }
  }
}

const SUP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
  '−': '⁻',
  '+': '⁺',
  '(': '⁽',
  ')': '⁾',
};
export function superscript(s: string): string {
  return [...s].map((c) => SUP[c] ?? c).join('');
}

/** Dezimaldarstellung als Text, z. B. „−1,25×10⁻⁵“. */
export function formatDecimal(r: Real, fmt: NumFormat): string {
  const p = decimalParts(r, fmt);
  let out = (p.neg ? '−' : '') + (fmt.comma ? p.mant.replace('.', ',') : p.mant);
  if (p.exp !== null) out += `×10${superscript(String(p.exp))}`;
  return out;
}

/** Zahl beliebiger Größe als double kompakt darstellen. */
export function formatNumber(x: number, fmt: NumFormat): string {
  if (Number.isNaN(x)) return '—';
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '−∞';
  return formatDecimal(new Real(x, null), fmt);
}

/** Dezimaldarstellung als Formelzeile. */
export function decimalRow(r: Real, fmt: NumFormat): MRow {
  const p = decimalParts(r, fmt);
  const row: MRow = [];
  if (p.neg) row.push(tok('-'));
  row.push(...toks(p.mant));
  if (p.exp !== null) {
    row.push(tok('×'), tok('1'), tok('0'), tpl('pow', toks(String(p.exp))));
  }
  return row;
}

/** Rundet einen Wert auf das Anzeigeformat (Funktion Rnd). */
export function roundToFormat(r: Real, fmt: NumFormat): Real {
  const p = decimalParts(r, fmt);
  const q = Rat.fromDecimal((p.neg ? '-' : '') + p.mant, p.exp ?? 0);
  return Real.fromRat(q);
}

// ───────────────────────────── exakte Darstellung ─────────────────────────────

const LIMIT = 10n ** 10n;
const intRow = (n: bigint): MRow => toks(n.toString());

function termRow(a: bigint, r: bigint, p: number): MRow {
  const row: MRow = [];
  if (a !== 1n || (r === 1n && p === 0)) row.push(...intRow(a));
  if (r !== 1n) row.push(tpl('sqrt', intRow(r)));
  if (p === 1) row.push(tok('π'));
  return row;
}

interface Layout {
  /** Vorzeichen vor dem gesamten Ausdruck */
  neg: boolean;
  /** Zählerterme (ganzzahlige Koeffizienten) */
  terms: Array<{ a: bigint; r: bigint; p: number }>;
  /** gemeinsamer Nenner */
  den: bigint;
}

function layoutExact(e: Exact): Layout | null {
  let L = 1n;
  for (const t of e.terms) L = (L * t.c.d) / bgcd(L, t.c.d);
  if (L >= LIMIT) return null;
  let terms = e.terms.map((t) => ({ a: t.c.n * (L / t.c.d), r: t.r, p: t.p }));
  for (const t of terms) if (babs(t.a) >= LIMIT || t.r >= LIMIT) return null;
  let neg = false;
  if (terms.every((t) => t.a < 0n)) {
    neg = true;
    terms = terms.map((t) => ({ ...t, a: -t.a }));
  } else if (terms[0].a < 0n) {
    const i = terms.findIndex((t) => t.a > 0n);
    const [first] = terms.splice(i, 1);
    terms.unshift(first);
  }
  return { neg, terms, den: L };
}

/** Exakte Darstellung als Formelzeile oder null, wenn sie nicht sinnvoll anzeigbar ist. */
export function exactRow(e: Exact, mixed = false): MRow | null {
  if (e.isZero()) return toks('0');
  if (e.isRational()) {
    const q = e.asRat();
    const n = babs(q.n);
    if (n >= LIMIT || q.d >= LIMIT) return null;
    const row: MRow = q.n < 0n ? [tok('-')] : [];
    if (q.d === 1n) row.push(...intRow(n));
    else if (mixed && n > q.d) row.push(tpl('mixed', intRow(n / q.d), intRow(n % q.d), intRow(q.d)));
    else row.push(tpl('frac', intRow(n), intRow(q.d)));
    return row;
  }
  const lay = layoutExact(e);
  if (!lay || lay.terms.length > 3) return null;
  const num: MRow = [];
  lay.terms.forEach((t, i) => {
    if (i > 0) num.push(tok(t.a < 0n ? '-' : '+'));
    else if (t.a < 0n) num.push(tok('-'));
    num.push(...termRow(babs(t.a), t.r, t.p));
  });
  const row: MRow = lay.neg ? [tok('-')] : [];
  if (lay.den === 1n) {
    if (lay.neg && lay.terms.length > 1) row.push(tok('('), ...num, tok(')'));
    else row.push(...num);
  } else row.push(tpl('frac', num, intRow(lay.den)));
  return row;
}

/** Gibt es eine exakte Darstellung, die sich von der Dezimalzahl unterscheidet? */
export function hasExactForm(r: Real): boolean {
  if (!r.ex || r.ex.isInteger()) return false;
  return exactRow(r.ex) !== null;
}
/** Lässt sich der Wert als gemischter Bruch schreiben? */
export function hasMixedForm(r: Real): boolean {
  const q = r.rat();
  return !!q && !q.isInt() && babs(q.n) > q.d && hasExactForm(r);
}

/** Reelle Zahl als Formelzeile in der gewünschten Darstellung. */
export function realRow(r: Real, fmt: NumFormat, form: ResultForm = 'exact'): MRow {
  if (form !== 'decimal' && r.ex) {
    const row = exactRow(r.ex, form === 'mixed');
    if (row) return row;
  }
  return decimalRow(r, fmt);
}

function isSum(r: Real, form: ResultForm): boolean {
  if (form === 'decimal' || !r.ex || r.ex.terms.length < 2) return false;
  const lay = layoutExact(r.ex);
  return !!lay && lay.den === 1n && lay.terms.length <= 3;
}

export type ComplexForm = 'rect' | 'polar';

/** Reelle oder komplexe Zahl als Formelzeile (a+bi bzw. r∠θ). */
export function scalarRow(
  z: Scalar,
  fmt: NumFormat,
  form: ResultForm = 'exact',
  cform: ComplexForm = 'rect',
  angle: AngleUnit = 'DEG',
): MRow {
  if (cform === 'polar' && z.kind === 'complex') {
    return [...realRow(cAbs(z), fmt, form), tok('∠'), ...realRow(cArg(z, angle), fmt, form)];
  }
  if (z.kind === 'real') return realRow(z, fmt, form);
  const row: MRow = [];
  const hasRe = !z.re.isZero();
  if (hasRe) row.push(...realRow(z.re, fmt, form));
  const s = rSign(z.im);
  const a = rAbs(z.im);
  if (hasRe) row.push(tok(s < 0 ? '-' : '+'));
  else if (s < 0) row.push(tok('-'));
  const one = a.ex ? a.ex.equals(Exact.ONE) : false;
  if (!one) {
    if (isSum(a, form)) row.push(tok('('), ...realRow(a, fmt, form), tok(')'));
    else row.push(...realRow(a, fmt, form));
  }
  row.push(tok('i'));
  return row;
}

// ───────────────────────────── DMS und Primfaktoren ─────────────────────────────

/** Grad-Minuten-Sekunden-Darstellung (Sekunden auf 2 Nachkommastellen). */
export function dmsRow(r: Real): MRow {
  const q = r.rat();
  let hs: bigint;
  if (q) {
    const v = q.abs().mul(Rat.of(360000));
    hs = (v.n * 2n + v.d) / (v.d * 2n);
  } else hs = BigInt(Math.round(Math.abs(r.n) * 360000));
  const d = hs / 360000n;
  const rem = hs % 360000n;
  const m = rem / 6000n;
  const sec = rem % 6000n;
  let s = (sec / 100n).toString();
  const frac = (sec % 100n).toString().padStart(2, '0').replace(/0+$/, '');
  if (frac) s += `.${frac}`;
  const row: MRow = r.n < 0 && hs > 0n ? [tok('-')] : [];
  row.push(...toks(d.toString()), tok('°'), ...toks(m.toString()), tok('′'), ...toks(s), tok('″'));
  return row;
}

/** Primfaktorzerlegung als Formelzeile, z. B. 2³×3×5. */
export function factorRow(r: Real): MRow {
  const f = primeFactors(r);
  const row: MRow = [];
  f.forEach(([p, e], i) => {
    if (i > 0) row.push(tok('×'));
    row.push(...toks(p.toString()));
    if (e > 1) row.push(tpl('pow', toks(String(e))));
  });
  return row;
}

// ───────────────────────────── Formelzeile → Text ─────────────────────────────

const TEXT_LABEL: Record<string, string> = { '-': '−', '*': '×', '/': '÷' };

/** Wandelt eine Formelzeile in einzeiligen Text um (für Tabellen, Listen und Tests). */
export function rowToText(row: MRow, comma = true): string {
  let out = '';
  for (const n of row) {
    if (n.t === 'txt') out += n.s;
    else if (n.t === 'tok') out += n.id === '.' ? (comma ? ',' : '.') : (TEXT_LABEL[n.id] ?? n.id);
    else {
      const s = n.s.map((r) => rowToText(r, comma));
      const wrap = (x: string) => (/^[0-9,.πi√]+$|^[A-Za-z]$/.test(x) ? x : `(${x})`);
      switch (n.k) {
        case 'frac':
          out += `${wrap(s[0])}/${wrap(s[1])}`;
          break;
        case 'mixed':
          out += `${s[0]} ${s[1]}/${s[2]}`;
          break;
        case 'sqrt':
          out += `√${wrap(s[0])}`;
          break;
        case 'root':
          out += `${superscript(s[0])}√${wrap(s[1])}`;
          break;
        case 'pow':
          out += /^[0-9+\-−()]+$/.test(s[0]) ? superscript(s[0]) : `^(${s[0]})`;
          break;
        case 'abs':
          out += `|${s[0]}|`;
          break;
        case 'logb':
          out += `log_${s[0]}(${s[1]})`;
          break;
        case 'int':
          out += `∫(${s[0]}; ${s[1]}; ${s[2]})`;
          break;
        case 'diff':
          out += `d/dx(${s[0]})|x=${s[1]}`;
          break;
        case 'sum':
          out += `Σ(${s[0]}; ${s[1]}; ${s[2]})`;
          break;
        case 'prod':
          out += `Π(${s[0]}; ${s[1]}; ${s[2]})`;
          break;
      }
    }
  }
  return out;
}

/** Reelle Zahl als kompakter Text (exakt, wenn möglich und gewünscht). */
export function formatReal(r: Real, fmt: NumFormat, form: ResultForm = 'decimal'): string {
  return rowToText(realRow(r, fmt, form), fmt.comma);
}
/** Reelle oder komplexe Zahl als kompakter Text. */
export function formatScalar(
  z: Scalar,
  fmt: NumFormat,
  form: ResultForm = 'decimal',
  cform: ComplexForm = 'rect',
  angle: AngleUnit = 'DEG',
): string {
  return rowToText(scalarRow(z, fmt, form, cform, angle), fmt.comma);
}
