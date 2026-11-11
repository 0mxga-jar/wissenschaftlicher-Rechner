/** Formular aus Zahlenfeldern, die über die Bildschirmtastatur gefüllt werden (Matrizen, Statistik, Gleichungen …). */
import { CalcError, toCalcError, calculate, type MRow, type Real, type Value } from '../core';
import {
  createEditor,
  cloneRow,
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  backspace,
  clear,
  isEmpty,
  setRow,
  serialize,
  type EditorState,
} from '../editor/model';
import { editorKey, isInputAction } from './session';
import { makeContext, encodeReal, decodeReal, type EncReal } from './state';

/** Gespeicherter Feldinhalt: eingegebener Ausdruck oder (bei programmatisch gesetzten Feldern) der Wert. */
export type FormSnapshot = Record<string, MRow | { v: EncReal }>;

export interface Cell {
  /** eingegebener Ausdruck */
  row: MRow | null;
  value: Real | null;
  error: string | null;
}

export interface FormOptions {
  /** Ausdruck auswerten; Standard: reelle Berechnung mit den gemeinsamen Variablen. */
  evaluate?: (src: string) => Value;
  /** Nach jeder Änderung eines Feldes. */
  onChange?: (key: string) => void;
  /** Eigene Übernahme (z. B. Tabellenkalkulation speichert Formeln statt Werten). */
  commitRow?: (key: string, row: MRow | null) => void;
  /** Wird aufgerufen, wenn „=“ im letzten Feld gedrückt wird. */
  onDone?: () => void;
  /** Richtung, in die „=“ weiterspringt (Standard: nach rechts, am Zeilenende in die nächste Zeile). */
  advance?: 'right' | 'down';
}

export class CellForm {
  cells = new Map<string, Cell>();
  grid: string[][] = [];
  active = '';
  ed: EditorState = createEditor();
  typing = false;
  error: string | null = null;

  constructor(public opts: FormOptions = {}) {}

  /** Navigationsraster setzen (Zeilen von Feldschlüsseln). */
  setGrid(grid: string[][]): void {
    this.grid = grid.filter((r) => r.length > 0);
    const all = this.grid.flat();
    if (!all.includes(this.active)) {
      this.active = all[0] ?? '';
      this.cancel();
    }
  }

  cell(key: string): Cell {
    let c = this.cells.get(key);
    if (!c) {
      c = { row: null, value: null, error: null };
      this.cells.set(key, c);
    }
    return c;
  }
  value(key: string): Real | null {
    return this.cells.get(key)?.value ?? null;
  }
  num(key: string): number | null {
    const v = this.value(key);
    return v ? v.n : null;
  }
  /** Feld direkt belegen (ohne Benutzereingabe). */
  set(key: string, value: Real | null, row: MRow | null = null): void {
    const c = this.cell(key);
    c.value = value;
    c.row = row;
    c.error = null;
  }

  private evaluate(src: string): Real {
    const v = this.opts.evaluate ? this.opts.evaluate(src) : calculate(src, makeContext());
    if (v.kind !== 'real') throw new CalcError('ARG', 'Hier wird eine reelle Zahl erwartet.');
    return v;
  }

  cancel(): void {
    this.typing = false;
    this.error = null;
    clear(this.ed);
  }

  /** Eingabe in das aktive Feld übernehmen; false bei Fehler. */
  commit(): boolean {
    if (!this.typing) return true;
    const key = this.active;
    try {
      if (this.opts.commitRow) {
        this.opts.commitRow(key, isEmpty(this.ed) ? null : cloneRow(this.ed.root));
      } else if (isEmpty(this.ed)) {
        this.set(key, null);
      } else {
        const v = this.evaluate(serialize(this.ed.root));
        this.set(key, v, cloneRow(this.ed.root));
      }
    } catch (e) {
      this.error = toCalcError(e).message;
      return false;
    }
    this.cancel();
    this.opts.onChange?.(key);
    return true;
  }

  /** Feld aktivieren (laufende Eingabe wird vorher übernommen). */
  activate(key: string): void {
    if (key === this.active && !this.typing) {
      this.startEdit();
      return;
    }
    if (this.typing && !this.commit()) return;
    this.active = key;
    this.error = null;
  }

  /** Erstes leeres Feld aktivieren (oder das erste Feld, wenn alle belegt sind). */
  focusFirstEmpty(): void {
    const all = this.grid.flat();
    this.cancel();
    this.active = all.find((k) => !this.cells.get(k)?.value && !this.cells.get(k)?.row) ?? all[0] ?? '';
  }

  /** Vorhandenen Ausdruck des aktiven Feldes zum Bearbeiten laden. */
  startEdit(): void {
    const c = this.cell(this.active);
    if (c.row) setRow(this.ed, c.row);
    else clear(this.ed);
    this.typing = true;
    this.error = null;
  }

  private pos(): [number, number] {
    for (let r = 0; r < this.grid.length; r++) {
      const c = this.grid[r].indexOf(this.active);
      if (c >= 0) return [r, c];
    }
    return [0, 0];
  }

  move(dr: number, dc: number): boolean {
    const [r, c] = this.pos();
    let nr = r + dr;
    let nc = c + dc;
    if (dc !== 0) {
      // am Zeilenende in die nächste/vorige Zeile springen
      if (nc >= this.grid[r].length) {
        nr = r + 1;
        nc = 0;
      } else if (nc < 0) {
        nr = r - 1;
        nc = nr >= 0 ? this.grid[nr].length - 1 : 0;
      }
    }
    if (nr < 0 || nr >= this.grid.length) return false;
    nc = Math.min(nc, this.grid[nr].length - 1);
    this.active = this.grid[nr][nc];
    this.error = null;
    return true;
  }

  /** Verarbeitet eine Tastenaktion; true, wenn sie behandelt wurde. */
  key(action: string): boolean {
    if (!this.active) return false;
    if (isInputAction(action)) {
      if (!this.typing) {
        this.typing = true;
        this.error = null;
        clear(this.ed);
      }
      return editorKey(this.ed, action);
    }
    switch (action) {
      case 'exe':
      case 'approx': {
        if (this.typing && !this.commit()) return true;
        const moved = this.opts.advance === 'down' ? this.move(1, 0) : this.move(0, 1);
        if (!moved) this.opts.onDone?.();
        return true;
      }
      case 'del':
        if (this.typing) {
          backspace(this.ed);
          if (isEmpty(this.ed)) this.error = null;
        } else this.clearActive();
        return true;
      case 'ac':
        if (this.typing) this.cancel();
        else this.clearActive();
        return true;
      case 'left':
        if (this.typing) moveLeft(this.ed);
        else this.move(0, -1);
        return true;
      case 'right':
        if (this.typing) moveRight(this.ed);
        else this.move(0, 1);
        return true;
      case 'up':
      case 'down': {
        const d = action === 'up' ? -1 : 1;
        if (this.typing) {
          const moved = action === 'up' ? moveUp(this.ed) : moveDown(this.ed);
          if (moved) return true;
          if (!this.commit()) return true;
        }
        this.move(d, 0);
        return true;
      }
      default:
        return false;
    }
  }

  private clearActive(): void {
    const key = this.active;
    try {
      if (this.opts.commitRow) this.opts.commitRow(key, null);
      else this.set(key, null);
    } catch {
      /* ignorieren */
    }
    this.error = null;
    this.opts.onChange?.(key);
  }

  /** Feldinhalte für die Persistenz (Ausdruck, sonst Wert). */
  snapshot(): FormSnapshot {
    const out: FormSnapshot = {};
    this.cells.forEach((c, k) => {
      if (c.row) out[k] = c.row;
      else if (c.value) out[k] = { v: encodeReal(c.value) };
    });
    return out;
  }
  /** Gespeicherte Inhalte laden; Ausdrücke werden neu ausgewertet. */
  restore(data: FormSnapshot | undefined): void {
    this.cells.clear();
    if (!data) return;
    for (const [k, entry] of Object.entries(data)) {
      try {
        if (Array.isArray(entry)) this.set(k, this.evaluate(serialize(entry)), entry);
        else if (entry && typeof entry === 'object' && 'v' in entry) this.set(k, decodeReal(entry.v));
      } catch {
        /* fehlerhafte Einträge überspringen */
      }
    }
  }
}
