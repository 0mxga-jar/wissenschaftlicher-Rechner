/** Token-Verzeichnis des Formeleditors: Anzeige-Beschriftung und Quelltext für den Parser. */
import { CONSTANTS, unitLabel } from '../core/constants';

export type TokClass = 'num' | 'op' | 'fn' | 'var' | 'sym' | 'unit' | 'word';

interface TokDef {
  label: string;
  src: string;
  cls: TokClass;
}

const DEFS: Record<string, TokDef> = {};

function def(id: string, label: string, src: string, cls: TokClass): void {
  DEFS[id] = { label, src, cls };
}

for (const d of '0123456789') def(d, d, d, 'num');
def('.', ',', '.', 'num');
def('ᴇ', '×⏨', 'ᴇ', 'num');
def('+', '+', '+', 'op');
def('-', '−', '-', 'op');
def('×', '×', '*', 'op');
def('÷', '÷', '/', 'op');
def('÷R', '÷R', '÷R', 'op');
def('=', '=', '=', 'op');
def('(', '(', '(', 'sym');
def(')', ')', ')', 'sym');
def(';', ';', ';', 'sym');
def(':', ':', ':', 'sym');
def('!', '!', '!', 'sym');
def('%', '%', '%', 'sym');
def('°', '°', '°', 'sym');
def('′', '′', '°', 'sym');
def('″', '″', '°', 'sym');
def('∠', '∠', '∠', 'op');
def('•', '•', '•', 'op');
def('nPr', '𝐏', '𝐏', 'op');
def('nCr', '𝐂', '𝐂', 'op');
def('π', 'π', 'pi', 'var');
def('e', 'e', 'e', 'var');
def('i', 'i', 'i', 'var');
def('Ans', 'Ans', 'Ans', 'fn');
def('PreAns', 'PreAns', 'PreAns', 'fn');
def('Ran#', 'Ran#', 'Ran#', 'fn');
def('@deg', '°', '@deg', 'unit');
def('@rad', 'ʳ', '@rad', 'unit');
def('@gra', 'ᵍ', '@gra', 'unit');
for (const v of ['A', 'B', 'C', 'D', 'E', 'F', 'M', 'x', 'y', 'z']) def(v, v, v, 'var');

/** Funktionen: Token-ID (= Quelltext inkl. Klammer) → Beschriftung */
const FUNCTIONS: Record<string, string> = {
  'sin(': 'sin(',
  'cos(': 'cos(',
  'tan(': 'tan(',
  'asin(': 'sin⁻¹(',
  'acos(': 'cos⁻¹(',
  'atan(': 'tan⁻¹(',
  'sinh(': 'sinh(',
  'cosh(': 'cosh(',
  'tanh(': 'tanh(',
  'asinh(': 'sinh⁻¹(',
  'acosh(': 'cosh⁻¹(',
  'atanh(': 'tanh⁻¹(',
  'log(': 'log(',
  'ln(': 'ln(',
  'Abs(': 'Abs(',
  'ggT(': 'ggT(',
  'kgV(': 'kgV(',
  'Int(': 'Int(',
  'Intg(': 'Intg(',
  'Rnd(': 'Rnd(',
  'RanInt(': 'RanInt(',
  'Rest(': 'Rest(',
  'Pol(': 'Pol(',
  'Rec(': 'Rec(',
  'Arg(': 'Arg(',
  'Conjg(': 'Conjg(',
  'Re(': 'Re(',
  'Im(': 'Im(',
  'det(': 'det(',
  'Trn(': 'Trn(',
  'Inv(': 'Inv(',
  'Rref(': 'Rref(',
  'Identity(': 'Identity(',
  'DotP(': 'DotP(',
  'CrossP(': 'CrossP(',
  'Angle(': 'Angle(',
  'UnitV(': 'UnitV(',
  'Summe(': 'Summe(',
  'Mittel(': 'Mittel(',
  'Min(': 'Min(',
  'Max(': 'Max(',
  'Not(': 'Not(',
  'Neg(': 'Neg(',
};
for (const [id, label] of Object.entries(FUNCTIONS)) def(id, label, id, 'fn');

for (const n of ['A', 'B', 'C', 'D', 'Ans']) {
  def(`Mat${n}`, `Mat${n}`, `Mat${n}`, 'fn');
  def(`Vct${n}`, `Vct${n}`, `Vct${n}`, 'fn');
}

// Basis-N
for (const w of ['and', 'or', 'xor', 'xnor']) def(w, w, ` ${w} `, 'word');
def('bd', 'd', 'd', 'unit');
def('bh', 'h', 'h', 'unit');
def('bb', 'b', 'b', 'unit');
def('bo', 'o', 'o', 'unit');

for (const c of CONSTANTS) def(`$${c.id}`, c.symbol, `$${c.id}`, 'var');

function lookup(id: string): TokDef {
  const d = DEFS[id];
  if (d) return d;
  if (id.startsWith('@') && id.includes('>')) {
    const [from, to] = id.slice(1).split('>');
    return { label: `${unitLabel(from)}▸${unitLabel(to)}`, src: id, cls: 'unit' };
  }
  return { label: id, src: id, cls: 'sym' };
}

/** Beschriftung eines Tokens in der Anzeige. */
export function tokenLabel(id: string, comma = true): string {
  if (id === '.') return comma ? ',' : '.';
  return lookup(id).label;
}

export function tokenClass(id: string): TokClass {
  return lookup(id).cls;
}

/** Quelltext eines Tokens für den Parser (Namen erhalten ein Leerzeichen als Trenner). */
export function tokenSrc(id: string): string {
  const s = lookup(id).src;
  if (id.startsWith('$') || id.startsWith('@')) return `${s} `;
  if (/^b[dhbo]$/.test(id)) return s; // Basis-Präfix steht direkt vor den Ziffern
  return /[A-Za-zπ#]$/.test(s) ? `${s} ` : s;
}

/** Tokens, nach denen ein Ergebnis mit „Ans“ fortgesetzt wird (Operatoren und nachgestellte Zeichen). */
export const CONTINUES_WITH_ANS = new Set(['+', '-', '×', '÷', '÷R', '!', '%', 'nPr', 'nCr', '∠', '•', '°', '@deg', '@rad', '@gra', 'and', 'or', 'xor', 'xnor']);
