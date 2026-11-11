/** Tabellenkalkulation (5 Spalten × 45 Zeilen) und Wertetabellen. */
import { CalcError, toCalcError } from './errors';
import { Real, rAdd, rMul } from './real';
import { type Value } from './values';
import { parse, type Node } from './parser';
import { evaluate, type EvalContext } from './evaluator';

export const SHEET_COLS = 5;
export const SHEET_ROWS = 45;

export type CellResult = { value: Real } | { error: CalcError } | null;

export const cellName = (col: number, row: number): string => `${String.fromCharCode(65 + col)}${row + 1}`;

/**
 * Berechnet alle Zellen. `raw[row][col]` enthält den Quelltext (lineare Syntax, optional mit führendem „=“)
 * oder eine leere Zeichenkette. Zellbezüge wie A1 und Bereiche wie A1:B3 (in Summe/Mittel/Min/Max) sind erlaubt.
 */
export function computeSheet(raw: string[][], base: EvalContext): CellResult[][] {
  const rows = raw.length;
  const cols = rows ? raw[0].length : 0;
  const results: CellResult[][] = raw.map((r) => r.map(() => null));
  const state: number[][] = raw.map((r) => r.map(() => 0)); // 0 offen, 1 in Arbeit, 2 fertig

  const ctx: EvalContext = {
    ...base,
    vars: { ...base.vars },
    cell: (col, row) => valueOf(col, row),
  };

  function valueOf(col: number, row: number): Value {
    if (row < 0 || row >= rows || col < 0 || col >= cols) throw new CalcError('RANGE', 'Der Zellbezug liegt außerhalb der Tabelle.');
    compute(col, row);
    const res = results[row][col];
    if (res === null) return Real.ZERO;
    if ('error' in res) throw res.error;
    return res.value;
  }

  function compute(col: number, row: number): void {
    if (state[row][col] === 2) return;
    if (state[row][col] === 1) throw new CalcError('CIRC');
    const src = (raw[row][col] ?? '').trim().replace(/^=/, '');
    if (src === '') {
      state[row][col] = 2;
      results[row][col] = null;
      return;
    }
    state[row][col] = 1;
    try {
      const v = evaluate(parse(src, { cells: true }), ctx);
      if (v.kind !== 'real') throw new CalcError('ARG', 'In Zellen sind nur reelle Zahlen möglich.');
      results[row][col] = { value: v };
    } catch (e) {
      results[row][col] = { error: toCalcError(e) };
    }
    state[row][col] = 2;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      try {
        compute(c, r);
      } catch (e) {
        results[r][c] = { error: toCalcError(e) };
        state[r][c] = 2;
      }
    }
  }
  return results;
}

/** Verschiebt relative Zellbezüge einer Formel (zum Kopieren/Ausfüllen). */
export function shiftFormula(src: string, dCol: number, dRow: number): string {
  return src.replace(/([A-E])([1-9][0-9]?)(?![0-9])/g, (_m, c: string, r: string) => {
    const col = c.charCodeAt(0) - 65 + dCol;
    const row = parseInt(r, 10) - 1 + dRow;
    if (col < 0 || col >= SHEET_COLS || row < 0 || row >= SHEET_ROWS) return `${c}${r}`;
    return cellName(col, row);
  });
}

// ───────────────────────────── Wertetabelle ─────────────────────────────

export interface TableRow {
  x: Real;
  f: Real | CalcError | null;
  g: Real | CalcError | null;
}

export const TABLE_MAX_ROWS = 100;

/** Wertetabelle für f(x) und g(x) von start bis end mit Schrittweite step. */
export function buildTable(
  f: Node | null,
  g: Node | null,
  start: Real,
  end: Real,
  step: Real,
  ctx: EvalContext,
): TableRow[] {
  if (step.isZero()) throw new CalcError('ARG', 'Die Schrittweite darf nicht 0 sein.');
  const count = Math.floor((end.n - start.n) / step.n + 1e-9) + 1;
  if (!(count >= 1)) throw new CalcError('ARG', 'Start, Ende und Schrittweite passen nicht zusammen.');
  if (count > TABLE_MAX_ROWS) {
    throw new CalcError('RANGE', `Die Tabelle hätte ${count} Zeilen – erlaubt sind höchstens ${TABLE_MAX_ROWS}.`);
  }
  const local: EvalContext = { ...ctx, vars: { ...ctx.vars } };
  const evalAt = (node: Node | null, x: Real): Real | CalcError | null => {
    if (!node) return null;
    try {
      local.vars.x = x;
      const v = evaluate(node, local);
      if (v.kind !== 'real') throw new CalcError('ARG', 'Die Funktion muss reelle Werte liefern.');
      return v;
    } catch (e) {
      return toCalcError(e);
    }
  };
  const rows: TableRow[] = [];
  for (let k = 0; k < count; k++) {
    const x = rAdd(start, rMul(Real.int(k), step));
    rows.push({ x, f: evalAt(f, x), g: evalAt(g, x) });
  }
  return rows;
}
