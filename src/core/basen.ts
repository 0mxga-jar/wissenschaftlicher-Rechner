/** Basis-N-Modus: Ganzzahlarithmetik (32 Bit, Zweierkomplement) in DEC/HEX/BIN/OCT mit Logikoperatoren. */
import { CalcError } from './errors';

export type Base = 2 | 8 | 10 | 16;

export const BASE_NAMES: Record<Base, string> = { 2: 'BIN', 8: 'OCT', 10: 'DEC', 16: 'HEX' };

const MIN = -2147483648;
const MAX = 2147483647;

type Tok =
  | { k: 'num'; v: number; pos: number }
  | { k: 'op'; v: string; pos: number }
  | { k: 'eof'; v: ''; pos: number };

const PREFIX: Record<string, Base> = { d: 10, h: 16, b: 2, o: 8 };
const WORDS = ['xnor', 'xor', 'and', 'or', 'Not(', 'Neg(', 'Ans'];

function check(v: number): number {
  if (!Number.isFinite(v) || v < MIN || v > MAX) {
    throw new CalcError('OVERFLOW', 'Das Ergebnis passt nicht in 32 Bit.');
  }
  return v;
}

function tokenize(src: string, base: Base): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ') {
      i++;
      continue;
    }
    const word = WORDS.find((w) => src.startsWith(w, i));
    if (word) {
      toks.push({ k: 'op', v: word, pos: i });
      i += word.length;
      continue;
    }
    let b = base;
    let j = i;
    if (PREFIX[c] && /[0-9A-F]/.test(src[i + 1] ?? '')) {
      b = PREFIX[c];
      j = i + 1;
    }
    if (/[0-9A-F]/.test(src[j] ?? '')) {
      let k = j;
      while (k < src.length && /[0-9A-F]/.test(src[k])) k++;
      const digits = src.slice(j, k);
      const valid = b === 16 ? /^[0-9A-F]+$/ : b === 10 ? /^[0-9]+$/ : b === 8 ? /^[0-7]+$/ : /^[01]+$/;
      if (!valid.test(digits)) {
        throw new CalcError('SYNTAX', `Die Ziffernfolge „${digits}“ ist im ${BASE_NAMES[b]}-System nicht erlaubt.`, j);
      }
      const v = parseInt(digits, b);
      if (b === 10) {
        if (v > MAX) throw new CalcError('OVERFLOW', 'Die Zahl passt nicht in 32 Bit.', j);
        toks.push({ k: 'num', v, pos: i });
      } else {
        if (v > 0xffffffff) throw new CalcError('OVERFLOW', 'Die Zahl passt nicht in 32 Bit.', j);
        toks.push({ k: 'num', v: v | 0, pos: i });
      }
      i = k;
      continue;
    }
    const map: Record<string, string> = { '+': '+', '-': '-', '−': '-', '×': '*', '*': '*', '÷': '/', '/': '/', '(': '(', ')': ')' };
    if (map[c]) {
      toks.push({ k: 'op', v: map[c], pos: i });
      i++;
      continue;
    }
    throw new CalcError('SYNTAX', `Das Zeichen „${c}“ ist im Basis-N-Modus nicht erlaubt.`, i);
  }
  toks.push({ k: 'eof', v: '', pos: src.length });
  return toks;
}

/** Wertet einen Basis-N-Ausdruck aus (Ergebnis: vorzeichenbehaftete 32-Bit-Zahl). */
export function evalBaseN(src: string, base: Base, ans = 0): number {
  const toks = tokenize(src, base);
  let i = 0;
  const peek = () => toks[i];
  const eat = (v: string): boolean => {
    if (toks[i].k === 'op' && toks[i].v === v) {
      i++;
      return true;
    }
    return false;
  };
  const fail = (): never => {
    const t = peek();
    if (t.k === 'eof') throw new CalcError('SYNTAX', 'Der Ausdruck ist unvollständig.', t.pos);
    throw new CalcError('SYNTAX', `Unerwartetes Zeichen „${t.k === 'num' ? t.v : t.v}“.`, t.pos);
  };

  function primary(): number {
    const t = peek();
    if (t.k === 'num') {
      i++;
      return t.v;
    }
    if (eat('Ans')) return ans;
    if (eat('Not(')) {
      const v = orExpr();
      if (!eat(')') && peek().k !== 'eof') fail();
      return ~v;
    }
    if (eat('Neg(')) {
      const v = orExpr();
      if (!eat(')') && peek().k !== 'eof') fail();
      return check(-v);
    }
    if (eat('(')) {
      const v = orExpr();
      if (!eat(')') && peek().k !== 'eof') fail();
      return v;
    }
    return fail();
  }
  function unary(): number {
    if (eat('-')) return check(-unary());
    if (eat('+')) return unary();
    return primary();
  }
  function mulExpr(): number {
    let v = unary();
    for (;;) {
      if (eat('*')) v = check(v * unary());
      else if (eat('/')) {
        const d = unary();
        if (d === 0) throw new CalcError('DIV0');
        v = check(Math.trunc(v / d));
      } else return v;
    }
  }
  function addExpr(): number {
    let v = mulExpr();
    for (;;) {
      if (eat('+')) v = check(v + mulExpr());
      else if (eat('-')) v = check(v - mulExpr());
      else return v;
    }
  }
  function andExpr(): number {
    let v = addExpr();
    while (eat('and')) v = v & addExpr();
    return v;
  }
  function orExpr(): number {
    let v = andExpr();
    for (;;) {
      if (eat('or')) v = v | andExpr();
      else if (eat('xor')) v = v ^ andExpr();
      else if (eat('xnor')) v = ~(v ^ andExpr());
      else return v;
    }
  }

  if (peek().k === 'eof') throw new CalcError('SYNTAX', 'Die Eingabe ist leer.', 0);
  const v = orExpr();
  if (peek().k !== 'eof') fail();
  return v;
}

/** Darstellung einer 32-Bit-Zahl in der gewünschten Basis (HEX/BIN/OCT im Zweierkomplement). */
export function formatBaseN(v: number, base: Base): string {
  if (base === 10) return v < 0 ? `−${-v}` : String(v);
  return (v >>> 0).toString(base).toUpperCase();
}
