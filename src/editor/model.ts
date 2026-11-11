/**
 * Modell des 2D-Formeleditors (ohne DOM): Baum aus Tokens und Vorlagen,
 * Cursor als Pfad, Bearbeitungs- und Navigationsoperationen, Serialisierung für den Parser.
 *
 * Cursorpfad: [i0, s0, i1, s1, …, ik]
 *   – Paare (i, s) steigen in die Vorlage an Position i und deren Feld s ab,
 *   – das letzte Element ist die Einfügeposition in der innersten Zeile.
 */
import { type MNode, type MRow, type MTpl, type TplKind, SLOT_COUNT, tok } from '../core/mathtree';
import { tokenSrc } from './tokens';

export interface EditorState {
  root: MRow;
  cur: number[];
}

export function createEditor(row: MRow = []): EditorState {
  const root = cloneRow(row);
  return { root, cur: [root.length] };
}

export function cloneRow(row: MRow): MRow {
  return row.map((n) => (n.t === 'tpl' ? { t: 'tpl', k: n.k, s: n.s.map(cloneRow) } : { ...n }));
}

export function isEmpty(ed: EditorState): boolean {
  return ed.root.length === 0;
}

export function clear(ed: EditorState): void {
  ed.root = [];
  ed.cur = [0];
}

export function setRow(ed: EditorState, row: MRow, atStart = false): void {
  ed.root = cloneRow(row);
  ed.cur = [atStart ? 0 : ed.root.length];
}

/** Zeile, in der sich der Pfad befindet. */
export function rowAt(root: MRow, path: number[]): MRow {
  let row = root;
  for (let k = 0; k + 2 < path.length; k += 2) {
    row = (row[path[k]] as MTpl).s[path[k + 1]];
  }
  return row;
}

function curRow(ed: EditorState): MRow {
  return rowAt(ed.root, ed.cur);
}
function curIdx(ed: EditorState): number {
  return ed.cur[ed.cur.length - 1];
}

export function insertNode(ed: EditorState, node: MNode): void {
  const row = curRow(ed);
  const idx = curIdx(ed);
  row.splice(idx, 0, node);
  ed.cur[ed.cur.length - 1] = idx + 1;
}

export function insertToken(ed: EditorState, id: string): void {
  insertNode(ed, tok(id));
}

export function insertRow(ed: EditorState, row: MRow): void {
  for (const n of cloneRow(row)) insertNode(ed, n);
}

/**
 * Vorlage einfügen. `filled` belegt Felder vor (z. B. Exponent 2 bei x²);
 * der Cursor springt in das erste leere Feld bzw. hinter die Vorlage.
 */
export function insertTemplate(ed: EditorState, kind: TplKind, filled: Array<MRow | null> = []): void {
  const slots: MRow[] = [];
  for (let i = 0; i < SLOT_COUNT[kind]; i++) slots.push(filled[i] ? cloneRow(filled[i]!) : []);
  const row = curRow(ed);
  const idx = curIdx(ed);
  row.splice(idx, 0, { t: 'tpl', k: kind, s: slots });
  const firstEmpty = slots.findIndex((s) => s.length === 0);
  if (firstEmpty < 0) ed.cur[ed.cur.length - 1] = idx + 1;
  else ed.cur = [...ed.cur.slice(0, -1), idx, firstEmpty, 0];
}

export function moveRight(ed: EditorState): void {
  const row = curRow(ed);
  const idx = curIdx(ed);
  const p = ed.cur;
  if (idx < row.length) {
    const node = row[idx];
    if (node.t === 'tpl') ed.cur = [...p.slice(0, -1), idx, 0, 0];
    else p[p.length - 1] = idx + 1;
    return;
  }
  if (p.length > 1) {
    const s = p[p.length - 2];
    const tplIdx = p[p.length - 3];
    const parent = rowAt(ed.root, p.slice(0, -2));
    const node = parent[tplIdx] as MTpl;
    if (s + 1 < node.s.length) ed.cur = [...p.slice(0, -2), s + 1, 0];
    else ed.cur = [...p.slice(0, -3), tplIdx + 1];
    return;
  }
  ed.cur = [0]; // am Ende: zum Anfang springen
}

export function moveLeft(ed: EditorState): void {
  const row = curRow(ed);
  const idx = curIdx(ed);
  const p = ed.cur;
  if (idx > 0) {
    const node = row[idx - 1];
    if (node.t === 'tpl') {
      const s = node.s.length - 1;
      ed.cur = [...p.slice(0, -1), idx - 1, s, node.s[s].length];
    } else p[p.length - 1] = idx - 1;
    return;
  }
  if (p.length > 1) {
    const s = p[p.length - 2];
    const tplIdx = p[p.length - 3];
    const parent = rowAt(ed.root, p.slice(0, -2));
    const node = parent[tplIdx] as MTpl;
    if (s > 0) ed.cur = [...p.slice(0, -2), s - 1, node.s[s - 1].length];
    else ed.cur = [...p.slice(0, -3), tplIdx];
    return;
  }
  ed.cur = [ed.root.length]; // am Anfang: zum Ende springen
}

/** Vertikale Nachbarfelder je Vorlage: [Feld] → Zielfeld bei ↑ bzw. ↓ */
const UP: Partial<Record<TplKind, Record<number, number>>> = {
  frac: { 1: 0 },
  mixed: { 2: 1 },
  int: { 1: 2, 0: 2 },
  sum: { 1: 2, 0: 2 },
  prod: { 1: 2, 0: 2 },
  root: { 1: 0 },
  logb: { 0: 1 },
};
const DOWN: Partial<Record<TplKind, Record<number, number>>> = {
  frac: { 0: 1 },
  mixed: { 1: 2 },
  int: { 2: 1, 0: 1 },
  sum: { 2: 1, 0: 1 },
  prod: { 2: 1, 0: 1 },
  root: { 0: 1 },
  logb: { 1: 0 },
};

function moveVertical(ed: EditorState, map: typeof UP): boolean {
  const p = ed.cur;
  for (let depth = p.length - 1; depth >= 2; depth -= 2) {
    const s = p[depth - 1];
    const tplIdx = p[depth - 2];
    const parent = rowAt(ed.root, p.slice(0, depth - 1));
    const node = parent[tplIdx] as MTpl;
    const target = map[node.k]?.[s];
    if (target !== undefined) {
      ed.cur = [...p.slice(0, depth - 1), target, node.s[target].length];
      return true;
    }
  }
  return false;
}

/** ↑ innerhalb der Struktur; false, wenn es kein Feld darüber gibt. */
export function moveUp(ed: EditorState): boolean {
  return moveVertical(ed, UP);
}
export function moveDown(ed: EditorState): boolean {
  return moveVertical(ed, DOWN);
}

function isEmptyTpl(n: MTpl): boolean {
  return n.s.every((r) => r.length === 0);
}

/** Löscht das Element links vom Cursor (DEL). */
export function backspace(ed: EditorState): boolean {
  const row = curRow(ed);
  const idx = curIdx(ed);
  const p = ed.cur;
  if (idx > 0) {
    const prev = row[idx - 1];
    if (prev.t === 'tpl' && !isEmptyTpl(prev)) {
      const s = prev.s.length - 1;
      ed.cur = [...p.slice(0, -1), idx - 1, s, prev.s[s].length];
      return true;
    }
    row.splice(idx - 1, 1);
    p[p.length - 1] = idx - 1;
    return true;
  }
  if (p.length > 1) {
    // am Feldanfang: Vorlage auflösen, Inhalte bleiben stehen
    const s = p[p.length - 2];
    const tplIdx = p[p.length - 3];
    const parent = rowAt(ed.root, p.slice(0, -2));
    const node = parent[tplIdx] as MTpl;
    if (s > 0) {
      // zuerst ins vorherige Feld wechseln
      ed.cur = [...p.slice(0, -2), s - 1, node.s[s - 1].length];
      return true;
    }
    const flat = node.s.flat();
    parent.splice(tplIdx, 1, ...flat);
    ed.cur = [...p.slice(0, -3), tplIdx];
    return true;
  }
  return false;
}

/** Cursor auf einen (von der Anzeige gelieferten) Pfad setzen, falls gültig. */
export function setCursor(ed: EditorState, path: number[]): void {
  try {
    let row = ed.root;
    for (let k = 0; k + 2 < path.length; k += 2) {
      const n = row[path[k]];
      if (!n || n.t !== 'tpl' || !n.s[path[k + 1]]) return;
      row = n.s[path[k + 1]];
    }
    const idx = path[path.length - 1];
    if (idx < 0 || idx > row.length) return;
    ed.cur = path.slice();
  } catch {
    /* ungültiger Pfad – ignorieren */
  }
}

function parenBalance(src: string): number {
  let d = 0;
  for (const c of src) {
    if (c === '(') d++;
    else if (c === ')') d--;
  }
  return d;
}

/** Zeile in die lineare Parser-Syntax übersetzen. */
export function serialize(row: MRow): string {
  let out = '';
  let depth = 0;
  for (const n of row) {
    if (n.t === 'tok') {
      const s = tokenSrc(n.id);
      depth += parenBalance(s);
      out += s;
    } else if (n.t === 'txt') {
      out += n.s;
    } else {
      const s = n.s.map(serialize);
      switch (n.k) {
        case 'frac':
          out += `((${s[0]})/(${s[1]}))`;
          break;
        case 'mixed':
          out += `mixed(${s[0]};${s[1]};${s[2]})`;
          break;
        case 'sqrt':
          out += `sqrt(${s[0]})`;
          break;
        case 'root':
          out += `nroot(${s[0]};${s[1]})`;
          break;
        case 'pow':
          out += `^{${s[0]}}`;
          break;
        case 'abs':
          out += `abs(${s[0]})`;
          break;
        case 'logb':
          out += `logb(${s[0]};${s[1]})`;
          break;
        case 'int':
          out += `integral(${s[0]};${s[1]};${s[2]})`;
          break;
        case 'diff':
          out += `diff(${s[0]};${s[1]})`;
          break;
        case 'sum':
          out += `sum(${s[0]};${s[1]};${s[2]})`;
          break;
        case 'prod':
          out += `prod(${s[0]};${s[1]};${s[2]})`;
          break;
      }
    }
  }
  // offene Klammern innerhalb eines Feldes schließen, damit sie nicht über das Feld hinausreichen
  if (depth > 0) out += ')'.repeat(depth);
  return out;
}

/** Enthält die Zeile eine bestimmte Token-ID (auch in Feldern)? */
export function containsToken(row: MRow, id: string): boolean {
  return row.some((n) => (n.t === 'tok' ? n.id === id : n.t === 'tpl' ? n.s.some((r) => containsToken(r, id)) : false));
}
