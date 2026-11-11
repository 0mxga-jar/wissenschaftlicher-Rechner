/**
 * Lexer und Parser für die lineare Ausdruckssyntax des Rechenkerns.
 *
 * Rangfolge (niedrig → hoch):
 *   =  |  + −  |  × ÷ ÷R •  |  nPr nCr ∠  |  Vorzeichen  |  implizite Multiplikation
 *   |  Potenzen und nachgestellte Operatoren (! % ° …)  |  Funktionen, Klammern
 *
 * Besonderheiten:
 *   – `^{…}` ist die Potenz aus dem 2D-Editor (linksassoziativ verkettbar),
 *     `^` ohne geschweifte Klammer ist rechtsassoziativ.
 *   – Fehlende schließende Klammern am Ende werden ergänzt.
 *   – Dezimaltrennzeichen ist intern immer der Punkt; Argumente werden mit `;` (oder `,`) getrennt.
 */
import { CalcError } from './errors';
import { Rat } from './rat';
import { Real } from './real';

export type BinOp = '+' | '-' | '*' | '/' | '^' | 'divr' | 'nPr' | 'nCr' | 'angle' | 'dot';
export type PostOp = '!' | '%' | 'deg' | 'rad' | 'gra';

export type Node =
  | { t: 'num'; v: Real }
  | { t: 'var'; name: string }
  | { t: 'sym'; name: 'pi' | 'e' | 'i' }
  | { t: 'const'; id: string }
  | { t: 'mat'; name: string }
  | { t: 'vct'; name: string }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: BinOp; a: Node; b: Node; implicit?: boolean }
  | { t: 'post'; op: PostOp; a: Node }
  | { t: 'dms'; d: Node; m: Node | null; s: Node | null }
  | { t: 'conv'; from: string; to: string; a: Node }
  | { t: 'call'; name: string; args: Node[] }
  | { t: 'eq'; a: Node; b: Node }
  | { t: 'cell'; col: number; row: number }
  | { t: 'range'; c1: number; r1: number; c2: number; r2: number };

/** Funktionsnamen (Quelltext → kanonischer Name). */
export const FUNCTION_NAMES: Record<string, string> = {
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  asin: 'asin',
  acos: 'acos',
  atan: 'atan',
  arcsin: 'asin',
  arccos: 'acos',
  arctan: 'atan',
  sinh: 'sinh',
  cosh: 'cosh',
  tanh: 'tanh',
  asinh: 'asinh',
  acosh: 'acosh',
  atanh: 'atanh',
  log: 'log',
  ln: 'ln',
  exp: 'exp',
  sqrt: 'sqrt',
  '√': 'sqrt',
  cbrt: 'cbrt',
  nroot: 'nroot',
  abs: 'abs',
  Abs: 'abs',
  logb: 'logb',
  integral: 'integral',
  diff: 'diff',
  sum: 'sum',
  prod: 'prod',
  mixed: 'mixed',
  nPr: 'nPr',
  nCr: 'nCr',
  ggT: 'gcd',
  GCD: 'gcd',
  kgV: 'lcm',
  LCM: 'lcm',
  Int: 'int',
  Intg: 'intg',
  Rnd: 'rnd',
  RanInt: 'ranint',
  Rest: 'rest',
  Pol: 'pol',
  Rec: 'rec',
  Arg: 'arg',
  Conjg: 'conjg',
  Re: 're',
  Im: 'im',
  Det: 'det',
  det: 'det',
  Trn: 'trn',
  Identity: 'identity',
  Inv: 'inv',
  Rref: 'rref',
  DotP: 'dotp',
  CrossP: 'crossp',
  Angle: 'angle',
  UnitV: 'unitv',
  Summe: 'cellsum',
  Mittel: 'cellmean',
  Min: 'cellmin',
  Max: 'cellmax',
};

export const VARIABLE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'M', 'x', 'y', 'z'];

const VALUE_NAMES: Record<string, Node> = {
  pi: { t: 'sym', name: 'pi' },
  π: { t: 'sym', name: 'pi' },
  e: { t: 'sym', name: 'e' },
  ℯ: { t: 'sym', name: 'e' },
  i: { t: 'sym', name: 'i' },
  ⅈ: { t: 'sym', name: 'i' },
  Ans: { t: 'var', name: 'Ans' },
  PreAns: { t: 'var', name: 'PreAns' },
  'Ran#': { t: 'call', name: 'ran', args: [] },
  MatA: { t: 'mat', name: 'A' },
  MatB: { t: 'mat', name: 'B' },
  MatC: { t: 'mat', name: 'C' },
  MatD: { t: 'mat', name: 'D' },
  MatAns: { t: 'mat', name: 'Ans' },
  VctA: { t: 'vct', name: 'A' },
  VctB: { t: 'vct', name: 'B' },
  VctC: { t: 'vct', name: 'C' },
  VctD: { t: 'vct', name: 'D' },
  VctAns: { t: 'vct', name: 'Ans' },
};
for (const v of VARIABLE_NAMES) VALUE_NAMES[v] = { t: 'var', name: v };

const ALL_NAMES = [...Object.keys(FUNCTION_NAMES), ...Object.keys(VALUE_NAMES)].sort(
  (a, b) => b.length - a.length,
);

type TokKind = 'num' | 'value' | 'fn' | 'op' | 'const' | 'conv' | 'unit' | 'cell' | 'eof';
interface Tok {
  k: TokKind;
  v: string;
  pos: number;
  node?: Node;
  from?: string;
  to?: string;
  col?: number;
  row?: number;
}

const OP_MAP: Record<string, string> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '–': '-',
  '*': '*',
  '×': '*',
  '·': '*',
  '⋅': '*',
  '/': '/',
  '÷': '/',
  ':': ':',
  '^': '^',
  '!': '!',
  '%': '%',
  '(': '(',
  ')': ')',
  '{': '{',
  '}': '}',
  ';': ';',
  ',': ';',
  '=': '=',
  '∠': '∠',
  '°': '°',
  '′': '°',
  '″': '°',
  '•': '•',
  '𝐏': 'nPr',
  '𝐂': 'nCr',
  ᴇ: 'ᴇ',
};

export interface ParseOptions {
  /** Zellbezüge wie A1 oder B12 erlauben (Tabellenkalkulation). */
  cells?: boolean;
}

function syntax(msg: string, pos: number): never {
  throw new CalcError('SYNTAX', msg, pos);
}

function tokenize(src: string, opts: ParseOptions): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  const isDigit = (c: string) => c >= '0' && c <= '9';
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '​') {
      i++;
      continue;
    }
    // Zahl
    if (isDigit(c) || (c === '.' && i + 1 < n && isDigit(src[i + 1]))) {
      const start = i;
      while (i < n && isDigit(src[i])) i++;
      if (src[i] === '.') {
        i++;
        while (i < n && isDigit(src[i])) i++;
      }
      const mant = src.slice(start, i);
      let exp = 0;
      if (src[i] === 'ᴇ') {
        let j = i + 1;
        let sign = 1;
        if (src[j] === '-' || src[j] === '−') {
          sign = -1;
          j++;
        } else if (src[j] === '+') j++;
        const es = j;
        while (j < n && isDigit(src[j])) j++;
        if (j === es) syntax('Nach „×10^“ fehlt der Exponent.', i);
        exp = sign * parseInt(src.slice(es, j), 10);
        i = j;
      }
      if (src[i] === '.') syntax('Die Zahl enthält zwei Dezimaltrennzeichen.', i);
      let v: Real;
      if (Math.abs(exp) <= 120 && mant.length <= 40) {
        v = Real.fromRat(Rat.fromDecimal(mant, exp));
      } else {
        v = Real.approx(parseFloat(`${mant}e${exp}`));
      }
      if (!Number.isFinite(v.n)) throw new CalcError('OVERFLOW', undefined, start);
      toks.push({ k: 'num', v: src.slice(start, i), pos: start, node: { t: 'num', v } });
      continue;
    }
    if (c === '.') syntax('Das Dezimaltrennzeichen steht an einer ungültigen Stelle.', i);
    // physikalische Konstante: $name
    if (c === '$') {
      const m = /^\$([A-Za-z0-9_]+)/.exec(src.slice(i));
      if (!m) syntax('Unbekannte Konstante.', i);
      toks.push({ k: 'const', v: m[1], pos: i });
      i += m[0].length;
      continue;
    }
    // Einheitenumrechnung @von>nach oder Winkelmarke @deg/@rad/@gra
    if (c === '@') {
      const m = /^@([A-Za-z0-9_]+)(?:>([A-Za-z0-9_]+))?/.exec(src.slice(i));
      if (!m) syntax('Unbekannte Einheit.', i);
      if (m[2]) toks.push({ k: 'conv', v: m[0], pos: i, from: m[1], to: m[2] });
      else toks.push({ k: 'unit', v: m[1], pos: i });
      i += m[0].length;
      continue;
    }
    // Division mit Rest
    if (c === '÷' && src[i + 1] === 'R') {
      toks.push({ k: 'op', v: 'divr', pos: i });
      i += 2;
      continue;
    }
    // 𝐏 / 𝐂 (Surrogatpaare)
    const cp = String.fromCodePoint(src.codePointAt(i)!);
    if (cp.length === 2 && OP_MAP[cp]) {
      toks.push({ k: 'op', v: OP_MAP[cp], pos: i });
      i += 2;
      continue;
    }
    // Zellbezug
    if (opts.cells) {
      const m = /^([A-E])([1-9][0-9]?)(?![0-9])/.exec(src.slice(i));
      if (m) {
        toks.push({ k: 'cell', v: m[0], pos: i, col: m[1].charCodeAt(0) - 65, row: parseInt(m[2], 10) - 1 });
        i += m[0].length;
        continue;
      }
    }
    // Namen (längster Treffer)
    let matched = false;
    for (const name of ALL_NAMES) {
      if (src.startsWith(name, i)) {
        if (FUNCTION_NAMES[name]) toks.push({ k: 'fn', v: FUNCTION_NAMES[name], pos: i });
        else toks.push({ k: 'value', v: name, pos: i, node: VALUE_NAMES[name] });
        i += name.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (OP_MAP[c]) {
      toks.push({ k: 'op', v: OP_MAP[c], pos: i });
      i++;
      continue;
    }
    syntax(`Unbekanntes Zeichen „${cp}“.`, i);
  }
  toks.push({ k: 'eof', v: '', pos: n });
  return toks;
}

class Parser {
  private i = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok {
    return this.toks[this.i];
  }
  private next(): Tok {
    return this.toks[this.i++];
  }
  private isOp(v: string): boolean {
    const t = this.peek();
    return t.k === 'op' && t.v === v;
  }
  private eat(v: string): boolean {
    if (this.isOp(v)) {
      this.i++;
      return true;
    }
    return false;
  }
  private unexpected(): never {
    const t = this.peek();
    if (t.k === 'eof') syntax('Der Ausdruck ist unvollständig.', t.pos);
    if (t.k === 'op' && t.v === ')') syntax('Schließende Klammer ohne passende öffnende Klammer.', t.pos);
    const shown = t.k === 'op' ? { '*': '×', '/': '÷', '-': '−', divr: '÷R', ';': ';' }[t.v] ?? t.v : t.v;
    syntax(`Unerwartetes Zeichen „${shown}“.`, t.pos);
  }

  parseTop(): Node {
    if (this.peek().k === 'eof') syntax('Die Eingabe ist leer.', 0);
    let node = this.parseAddSub();
    if (this.eat('=')) {
      const rhs = this.parseAddSub();
      node = { t: 'eq', a: node, b: rhs };
    }
    if (this.peek().k !== 'eof') this.unexpected();
    return node;
  }

  parseAddSub(): Node {
    let node = this.parseMulDiv();
    for (;;) {
      if (this.eat('+')) node = { t: 'bin', op: '+', a: node, b: this.parseMulDiv() };
      else if (this.eat('-')) node = { t: 'bin', op: '-', a: node, b: this.parseMulDiv() };
      else return node;
    }
  }

  private parseMulDiv(): Node {
    let node = this.parsePerm();
    for (;;) {
      if (this.eat('*')) node = { t: 'bin', op: '*', a: node, b: this.parsePerm() };
      else if (this.eat('/')) node = { t: 'bin', op: '/', a: node, b: this.parsePerm() };
      else if (this.eat('divr')) node = { t: 'bin', op: 'divr', a: node, b: this.parsePerm() };
      else if (this.eat('•')) node = { t: 'bin', op: 'dot', a: node, b: this.parsePerm() };
      else return node;
    }
  }

  private parsePerm(): Node {
    let node = this.parseSigned();
    for (;;) {
      if (this.eat('nPr')) node = { t: 'bin', op: 'nPr', a: node, b: this.parseSigned() };
      else if (this.eat('nCr')) node = { t: 'bin', op: 'nCr', a: node, b: this.parseSigned() };
      else if (this.eat('∠')) node = { t: 'bin', op: 'angle', a: node, b: this.parseSigned() };
      else return node;
    }
  }

  private parseSigned(): Node {
    if (this.eat('-')) return { t: 'neg', a: this.parseSigned() };
    if (this.eat('+')) return this.parseSigned();
    return this.parseImplicit();
  }

  private startsPrimary(): boolean {
    const t = this.peek();
    if (t.k === 'num' || t.k === 'value' || t.k === 'fn' || t.k === 'const' || t.k === 'cell') return true;
    return t.k === 'op' && t.v === '(';
  }

  private parseImplicit(): Node {
    let node = this.parsePostfix();
    while (this.startsPrimary()) {
      node = { t: 'bin', op: '*', a: node, b: this.parsePostfix(), implicit: true };
    }
    return node;
  }

  private parseExponent(): Node {
    if (this.eat('-')) return { t: 'neg', a: this.parseExponent() };
    if (this.eat('+')) return this.parseExponent();
    return this.parsePostfix();
  }

  private parseSignedInt(): number {
    let sign = 1;
    if (this.eat('-')) sign = -1;
    else this.eat('+');
    const t = this.peek();
    if (t.k !== 'num' || !/^\d+$/.test(t.v)) syntax('Nach „×10^“ wird ein ganzzahliger Exponent erwartet.', t.pos);
    this.next();
    return sign * parseInt(t.v, 10);
  }

  private pow10(e: number): Node {
    return { t: 'bin', op: '^', a: { t: 'num', v: Real.int(10) }, b: { t: 'num', v: Real.int(e) } };
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();
    for (;;) {
      const t = this.peek();
      if (t.k === 'op') {
        if (t.v === '!') {
          this.next();
          node = { t: 'post', op: '!', a: node };
        } else if (t.v === '%') {
          this.next();
          node = { t: 'post', op: '%', a: node };
        } else if (t.v === '^') {
          this.next();
          if (this.eat('{')) {
            if (this.isOp('}') || this.peek().k === 'eof') syntax('Der Exponent fehlt.', this.peek().pos);
            const e = this.parseAddSub();
            if (!this.eat('}') && this.peek().k !== 'eof') this.unexpected();
            node = { t: 'bin', op: '^', a: node, b: e };
          } else {
            node = { t: 'bin', op: '^', a: node, b: this.parseExponent() };
          }
        } else if (t.v === '°') {
          this.next();
          let m: Node | null = null;
          let s: Node | null = null;
          if (this.peek().k === 'num') {
            m = this.next().node!;
            if (!this.eat('°')) syntax('Bei Grad-Minuten-Sekunden fehlt das Zeichen ° nach den Minuten.', this.peek().pos);
            if (this.peek().k === 'num') {
              s = this.next().node!;
              if (!this.eat('°')) syntax('Bei Grad-Minuten-Sekunden fehlt das Zeichen ° nach den Sekunden.', this.peek().pos);
            }
          }
          node = { t: 'dms', d: node, m, s };
        } else if (t.v === 'ᴇ') {
          this.next();
          node = { t: 'bin', op: '*', a: node, b: this.pow10(this.parseSignedInt()) };
        } else break;
      } else if (t.k === 'unit') {
        this.next();
        if (t.v !== 'deg' && t.v !== 'rad' && t.v !== 'gra') syntax('Unbekannte Winkeleinheit.', t.pos);
        node = { t: 'post', op: t.v, a: node };
      } else if (t.k === 'conv') {
        this.next();
        node = { t: 'conv', from: t.from!, to: t.to!, a: node };
      } else break;
    }
    return node;
  }

  private parsePrimary(): Node {
    const t = this.peek();
    switch (t.k) {
      case 'num':
      case 'value':
        this.next();
        return t.node!;
      case 'const':
        this.next();
        return { t: 'const', id: t.v };
      case 'cell': {
        this.next();
        if (this.isOp(':')) {
          const save = this.i;
          this.next();
          const t2 = this.peek();
          if (t2.k === 'cell') {
            this.next();
            return {
              t: 'range',
              c1: Math.min(t.col!, t2.col!),
              r1: Math.min(t.row!, t2.row!),
              c2: Math.max(t.col!, t2.col!),
              r2: Math.max(t.row!, t2.row!),
            };
          }
          this.i = save;
        }
        return { t: 'cell', col: t.col!, row: t.row! };
      }
      case 'fn': {
        this.next();
        if (!this.eat('(')) syntax('Nach dem Funktionsnamen wird eine öffnende Klammer erwartet.', this.peek().pos);
        const args: Node[] = [];
        if (!this.eat(')')) {
          if (this.peek().k === 'eof') syntax('Das Argument der Funktion fehlt.', this.peek().pos);
          for (;;) {
            if (this.isOp(';') || this.isOp(')')) syntax('Ein Argument der Funktion fehlt.', this.peek().pos);
            args.push(this.parseAddSub());
            if (this.eat(';')) {
              if (this.peek().k === 'eof') syntax('Ein Argument der Funktion fehlt.', this.peek().pos);
              continue;
            }
            if (this.eat(')')) break;
            if (this.peek().k === 'eof' || this.isOp('}') || this.isOp('=')) break; // Klammer automatisch schließen
            this.unexpected();
          }
        }
        return { t: 'call', name: t.v, args };
      }
      case 'op':
        if (t.v === '(') {
          this.next();
          if (this.isOp(')')) syntax('Die Klammer ist leer.', this.peek().pos);
          const e = this.parseAddSub();
          if (!this.eat(')')) {
            if (!(this.peek().k === 'eof' || this.isOp('}') || this.isOp('='))) this.unexpected();
          }
          return e;
        }
        if (t.v === 'ᴇ') {
          this.next();
          return this.pow10(this.parseSignedInt());
        }
        if (t.v === '*' || t.v === '/' || t.v === '^' || t.v === '!' || t.v === '%') {
          syntax('Vor dem Operator fehlt ein Operand.', t.pos);
        }
        return this.unexpected();
      default:
        return this.unexpected();
    }
  }
}

/** Zerlegt einen Ausdruck in einen Syntaxbaum. */
export function parse(src: string, opts: ParseOptions = {}): Node {
  return new Parser(tokenize(src, opts)).parseTop();
}

/** Alle im Ausdruck vorkommenden Variablen (ohne Ans). */
export function collectVars(node: Node, out: Set<string> = new Set()): Set<string> {
  switch (node.t) {
    case 'var':
      if (node.name !== 'Ans' && node.name !== 'PreAns') out.add(node.name);
      break;
    case 'neg':
    case 'post':
    case 'conv':
      collectVars(node.a, out);
      break;
    case 'bin':
    case 'eq':
      collectVars(node.a, out);
      collectVars(node.b, out);
      break;
    case 'dms':
      collectVars(node.d, out);
      break;
    case 'call':
      if (['integral', 'diff', 'sum', 'prod'].includes(node.name)) {
        // die gebundene Variable x des Rumpfs zählt nicht
        const inner = new Set<string>();
        if (node.args[0]) collectVars(node.args[0], inner);
        inner.delete('x');
        inner.forEach((v) => out.add(v));
        node.args.slice(1).forEach((a) => collectVars(a, out));
      } else node.args.forEach((a) => collectVars(a, out));
      break;
    default:
      break;
  }
  return out;
}
