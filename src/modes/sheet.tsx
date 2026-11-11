/** Modus 12: Tabellenkalkulation (5 Spalten × 45 Zeilen mit Formeln und Zellbezügen). */
import type { VNode } from 'preact';
import {
  computeSheet,
  cellName,
  parse,
  formatReal,
  SHEET_COLS,
  SHEET_ROWS,
  tok,
  toks,
  type MRow,
  type CellResult,
} from '../core';
import { serialize, cloneRow } from '../editor/model';
import { makeContext, numFormat, defaultForm, registerPersister, update, toast } from '../ui/state';
import { CellForm } from '../ui/form';
import { FormulaBar } from '../ui/components';
import type { Chip, ModeDef } from './types';

const COLS = 'ABCDE';
const rows: Record<string, MRow> = {};

/** Quelltext einer Zelle: Spaltenbuchstabe und Zeilennummer gehören zusammen (A 1 → A1). */
const toSrc = (row: MRow): string => serialize(row).replace(/(^|[^A-Za-z0-9$@_])([A-E]) (?=[1-9])/g, '$1$2');

const form = new CellForm({
  advance: 'down',
  commitRow: (key, row) => {
    if (!row) {
      delete rows[key];
      form.set(key, null);
      return;
    }
    // Syntax sofort prüfen; Rechenfehler erscheinen in der Zelle
    parse(toSrc(row).replace(/^\s*=/, ''), { cells: true });
    rows[key] = row;
    form.set(key, null, row);
  },
});
form.setGrid(Array.from({ length: SHEET_ROWS }, (_, r) => Array.from({ length: SHEET_COLS }, (_, c) => cellName(c, r))));

function compute(): CellResult[][] {
  const raw = Array.from({ length: SHEET_ROWS }, (_, r) =>
    Array.from({ length: SHEET_COLS }, (_, c) => {
      const row = rows[cellName(c, r)];
      return row ? toSrc(row) : '';
    }),
  );
  return computeSheet(raw, makeContext());
}

/** Zellbezüge innerhalb einer Formelzeile verschieben (zum Ausfüllen). */
function shiftRow(row: MRow, dCol: number, dRow: number): MRow {
  const out: MRow = [];
  let i = 0;
  while (i < row.length) {
    const n = row[i];
    if (n.t === 'tpl') {
      out.push({ t: 'tpl', k: n.k, s: n.s.map((s) => shiftRow(s, dCol, dRow)) });
      i++;
      continue;
    }
    if (n.t === 'tok' && /^[A-E]$/.test(n.id)) {
      let j = i + 1;
      let digits = '';
      while (j < row.length && digits.length < 2) {
        const d = row[j];
        if (d.t === 'tok' && /^[0-9]$/.test(d.id)) {
          digits += d.id;
          j++;
        } else break;
      }
      if (digits && digits[0] !== '0') {
        const col = n.id.charCodeAt(0) - 65 + dCol;
        const r = parseInt(digits, 10) + dRow;
        if (col >= 0 && col < SHEET_COLS && r >= 1 && r <= SHEET_ROWS) {
          out.push(tok(COLS[col]), ...toks(String(r)));
          i = j;
          continue;
        }
      }
    }
    out.push({ ...n } as MRow[number]);
    i++;
  }
  return out;
}

function fill(dCol: number, dRow: number): void {
  if (form.typing && !form.commit()) return;
  const key = form.active;
  const src = rows[key];
  if (!src) {
    toast('Die aktive Zelle ist leer.');
    return;
  }
  const col = key.charCodeAt(0) - 65 + dCol;
  const r = parseInt(key.slice(1), 10) - 1 + dRow;
  if (col >= SHEET_COLS || r >= SHEET_ROWS) return;
  const target = cellName(col, r);
  const shifted = shiftRow(cloneRow(src), dCol, dRow);
  rows[target] = shifted;
  form.set(target, null, shifted);
  form.active = target;
}

function View(): VNode {
  const res = compute();
  const fmt = numFormat();
  const f = defaultForm();
  return (
    <div class="pane">
      <div class="sheet-wrap" data-testid="sheet">
        <div class="sgrid">
          <span class="sg-corner" />
          {[...COLS].map((c) => (
            <span class="sg-colh" key={c}>
              {c}
            </span>
          ))}
          {Array.from({ length: SHEET_ROWS }, (_, r) => [
            <span class="sg-rowh" key={`h${r}`}>
              {r + 1}
            </span>,
            ...Array.from({ length: SHEET_COLS }, (_, c) => {
              const key = cellName(c, r);
              const cell = res[r][c];
              const active = form.active === key;
              let text = '';
              let err = false;
              if (cell) {
                if ('error' in cell) {
                  text = 'FEHLER';
                  err = true;
                } else text = formatReal(cell.value, fmt, f);
              }
              return (
                <button
                  type="button"
                  key={key}
                  class={`sg-cell${active ? ' active' : ''}${err ? ' err' : ''}${rows[key] ? ' filled' : ''}`}
                  data-cell={key}
                  data-value={text}
                  title={cell && 'error' in cell ? cell.error.message : undefined}
                  ref={active ? (el) => el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }) : undefined}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    form.activate(key);
                    update();
                  }}
                >
                  {text}
                </button>
              );
            }),
          ])}
        </div>
      </div>
      <FormulaBar form={form} label={form.active} hint="Zahl oder Formel, z. B. = A1 + B1" />
    </div>
  );
}

function onKey(action: string): boolean {
  if (['std', 'mixedToggle', 'dms', 'fact'].includes(action)) return true;
  return form.key(action);
}

function chips(): Chip[] {
  return [
    { label: '=', action: 't:=', id: 'eq' },
    { label: ':', action: 't::', id: 'colon' },
    ...[...COLS].map((c) => ({ label: c, action: `t:${c}`, id: `col-${c}` })),
    { label: 'Summe', action: 't:Summe(', id: 'sum' },
    { label: 'Mittel', action: 't:Mittel(', id: 'mean' },
    { label: 'Min', action: 't:Min(', id: 'min' },
    { label: 'Max', action: 't:Max(', id: 'max' },
    { label: ';', action: 't:;', id: 'semi' },
    { label: '↓ ausfüllen', id: 'fill-down', run: () => fill(0, 1), title: 'Formel in die Zelle darunter kopieren' },
    { label: '→ ausfüllen', id: 'fill-right', run: () => fill(1, 0), title: 'Formel in die Zelle rechts kopieren' },
    {
      label: 'Alles löschen',
      id: 'clear',
      run: () => {
        for (const k of Object.keys(rows)) delete rows[k];
        form.cells.clear();
        form.cancel();
        form.active = 'A1';
      },
    },
  ];
}

registerPersister('sheet', {
  save: () => ({ rows }),
  load: (d) => {
    const s = d as { rows?: Record<string, MRow> };
    for (const k of Object.keys(rows)) delete rows[k];
    form.cells.clear();
    for (const [k, row] of Object.entries(s.rows ?? {})) {
      if (/^[A-E]([1-9]|[1-3][0-9]|4[0-5])$/.test(k) && Array.isArray(row)) {
        rows[k] = row;
        form.set(k, null, row);
      }
    }
  },
  reset: () => {
    for (const k of Object.keys(rows)) delete rows[k];
    form.cells.clear();
    form.cancel();
    form.active = 'A1';
  },
});

export const sheetMode: ModeDef = {
  id: 'sheet',
  title: 'Tabellenkalkulation',
  icon: '▦',
  hint: '5 × 45 Zellen, Formeln',
  View,
  onKey,
  chips,
  compactKeys: () => true,
};
