/** Rechen-Sitzung: Eingabezeile, Ergebnis, Verlauf – gemeinsam genutzt von mehreren Modi. */
import {
  CalcError,
  toCalcError,
  Real,
  tok,
  toks,
  hasExactForm,
  hasMixedForm,
  primeFactors,
  type MRow,
  type TplKind,
  type ResultForm,
  type Value,
} from '../core';
import {
  createEditor,
  cloneRow,
  insertToken,
  insertTemplate,
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  backspace,
  clear,
  isEmpty,
  setRow,
  rowAt,
  setCursor,
  serialize,
  serializeMarked,
  pathForPos,
  type EditorState,
} from '../editor/model';
import { CONTINUES_WITH_ANS } from '../editor/tokens';
import { defaultForm, toast } from './state';

/** Wendet eine Tastenaktion auf einen Editor an; false, wenn die Aktion nicht zum Editor gehört. */
export function editorKey(ed: EditorState, action: string): boolean {
  if (action.startsWith('t:')) {
    insertToken(ed, action.slice(2));
    return true;
  }
  if (action.startsWith('p:')) {
    insertTemplate(ed, action.slice(2) as TplKind);
    return true;
  }
  switch (action) {
    case 'neg':
      insertToken(ed, '-');
      return true;
    case 'sq':
      insertTemplate(ed, 'pow', [toks('2')]);
      return true;
    case 'cube':
      insertTemplate(ed, 'pow', [toks('3')]);
      return true;
    case 'inv':
      insertTemplate(ed, 'pow', [[tok('-'), tok('1')]]);
      return true;
    case 'cbrt':
      insertTemplate(ed, 'root', [toks('3')]);
      return true;
    case 'pow10': {
      // direkt hinter einer Zahl: 5 · 10^□ statt der Ziffernfolge „510“
      const row = rowAt(ed.root, ed.cur);
      const prev = row[ed.cur[ed.cur.length - 1] - 1];
      if (prev && prev.t === 'tok' && /^[0-9.]$/.test(prev.id)) insertToken(ed, '×');
      insertToken(ed, '1');
      insertToken(ed, '0');
      insertTemplate(ed, 'pow');
      return true;
    }
    case 'epow':
      insertToken(ed, 'e');
      insertTemplate(ed, 'pow');
      return true;
    case 'left':
      moveLeft(ed);
      return true;
    case 'right':
      moveRight(ed);
      return true;
    case 'del':
      backspace(ed);
      return true;
    default:
      return false;
  }
}

/** Ist die Aktion eine Eingabe (Token/Vorlage), die Text erzeugt? */
export function isInputAction(action: string): boolean {
  return (
    action.startsWith('t:') ||
    action.startsWith('p:') ||
    ['neg', 'sq', 'cube', 'inv', 'cbrt', 'pow10', 'epow'].includes(action)
  );
}

export type ResultView = 'std' | 'dms' | 'fact';

export interface Entry {
  row: MRow;
  value: Value | null;
  error: string | null;
  /** Zusatz hinter dem Ausdruck, z. B. „→A“ oder „M+“ */
  note?: string;
}

export interface SessionOptions {
  /** Ausdruck auswerten (wirft CalcError). */
  evaluate: (src: string, row: MRow) => Value;
  /** Wird nach jeder erfolgreichen Berechnung aufgerufen (Ans setzen usw.). */
  onResult?: (v: Value) => void;
  /** Quelltext-Erzeugung anpassen (z. B. Basis-N). */
  serialize?: (row: MRow) => string;
  /** Token, das für „letztes Ergebnis“ eingefügt wird, wenn nach einem Ergebnis ein Operator folgt. */
  ansToken?: (v: Value) => string;
}

const MAX_HISTORY = 60;

export class CalcSession {
  ed: EditorState = createEditor();
  entries: Entry[] = [];
  /** Index des Verlaufseintrags, der gerade groß angezeigt wird (oder null beim Tippen). */
  current: number | null = null;
  /** Position beim Blättern im Verlauf (auch für Einträge ohne gespeichertes Ergebnis). */
  private pos: number | null = null;
  form: ResultForm = 'exact';
  view: ResultView = 'std';
  error: CalcError | null = null;
  /** Cursorposition der Fehlerstelle (bei Syntaxfehlern), sonst null. */
  private errorPath: number[] | null = null;

  constructor(private opts: SessionOptions) {}

  get shown(): Entry | null {
    return this.current !== null ? (this.entries[this.current] ?? null) : null;
  }
  get editing(): boolean {
    return this.current === null && this.error === null;
  }

  private src(): string {
    return (this.opts.serialize ?? serialize)(this.ed.root);
  }

  /** Aktuelle Eingabe auswerten, ohne den Verlauf zu verändern (für STO, M+). */
  valueOfInput(): Value {
    const s = this.shown;
    if (s && s.value) return s.value;
    return this.opts.evaluate(this.src(), this.ed.root);
  }

  execute(forceDecimal = false, note?: string): Value | null {
    if (isEmpty(this.ed)) return null;
    try {
      const v = this.opts.evaluate(this.src(), this.ed.root);
      this.push({ row: cloneRow(this.ed.root), value: v, error: null, note });
      this.pos = null;
      this.form = forceDecimal ? 'decimal' : defaultForm();
      this.view = 'std';
      this.error = null;
      this.opts.onResult?.(v);
      return v;
    } catch (e) {
      this.error = toCalcError(e);
      this.current = null;
      this.errorPath = null;
      if (!this.opts.serialize && this.error.pos !== undefined) {
        this.errorPath = pathForPos(serializeMarked(this.ed.root).marks, this.error.pos);
      }
      return null;
    }
  }

  private push(e: Entry): void {
    this.entries.push(e);
    if (this.entries.length > MAX_HISTORY) this.entries.splice(0, this.entries.length - MAX_HISTORY);
    this.current = this.entries.length - 1;
  }

  /** Eintrag mit bereits berechnetem Wert in den Verlauf schreiben (STO, M+ …). */
  record(value: Value, note: string): void {
    this.push({ row: cloneRow(this.ed.root), value, error: null, note });
    this.pos = null;
    this.form = defaultForm();
    this.view = 'std';
    this.error = null;
    // der angezeigte Wert ist das neue „letzte Ergebnis“ (Ans)
    this.opts.onResult?.(value);
  }

  /** Zurück in den Bearbeitungszustand (Ausdruck bleibt stehen). */
  private resume(atStart = false, toError = false): void {
    const path = toError && this.error ? this.errorPath : null;
    this.current = null;
    this.error = null;
    this.errorPath = null;
    this.ed.cur = [atStart ? 0 : this.ed.root.length];
    // nach einem Syntaxfehler springt der Cursor an die Fehlerstelle
    if (path) setCursor(this.ed, path);
  }

  loadEntry(i: number): void {
    const e = this.entries[i];
    if (!e) return;
    setRow(this.ed, e.row);
    this.pos = i;
    if (!e.value) {
      // wiederhergestellter Eintrag ohne Ergebnis: zum Bearbeiten laden
      this.current = null;
      this.error = null;
      return;
    }
    this.current = i;
    this.error = null;
    this.form = defaultForm();
    this.view = 'std';
  }

  clearAll(): void {
    this.entries = [];
    this.current = null;
    this.pos = null;
    this.error = null;
    clear(this.ed);
  }

  /** Verarbeitet eine Tastenaktion; true, wenn sie behandelt wurde. */
  key(action: string): boolean {
    switch (action) {
      case 'exe':
      case 'approx':
        this.execute(action === 'approx');
        return true;
      case 'ac':
        clear(this.ed);
        this.current = null;
        this.pos = null;
        this.error = null;
        return true;
      case 'del':
        if (!this.editing) this.resume();
        else backspace(this.ed);
        return true;
      case 'left':
      case 'right':
        if (!this.editing) this.resume(action === 'right', true);
        else if (action === 'left') moveLeft(this.ed);
        else moveRight(this.ed);
        return true;
      case 'up':
      case 'down': {
        if (this.editing && !isEmpty(this.ed)) {
          const moved = action === 'up' ? moveUp(this.ed) : moveDown(this.ed);
          if (moved) return true;
          // eine neu getippte Eingabe wird nicht durch den Verlauf überschrieben (erst AC drücken)
          if (this.pos === null) return true;
        }
        this.browse(action === 'up' ? -1 : 1);
        return true;
      }
      case 'std':
        this.toggleForm();
        return true;
      case 'mixedToggle':
        this.toggleMixed();
        return true;
      case 'dms': {
        const s = this.shown;
        if (s && s.value && s.value.kind === 'real') {
          this.view = this.view === 'dms' ? 'std' : 'dms';
          return true;
        }
        return this.input('t:°');
      }
      case 'fact': {
        const s = this.shown;
        if (s && s.value && s.value.kind === 'real' && s.value.isInt() && s.value.n >= 1) {
          if (this.view === 'fact') this.view = 'std';
          else {
            try {
              primeFactors(s.value); // prüft u. a. die Größe der Zahl
              this.view = 'fact';
            } catch (e) {
              toast(toCalcError(e).detail);
            }
          }
        } else toast('FACT: erst eine natürliche Zahl berechnen (z. B. 360 =).');
        return true;
      }
      default:
        if (isInputAction(action)) return this.input(action);
        return false;
    }
  }

  private browse(dir: number): void {
    if (this.entries.length === 0) return;
    const base = this.current ?? this.pos;
    if (base === null) {
      if (dir < 0) this.loadEntry(this.entries.length - 1);
      return;
    }
    const i = base + dir;
    if (i < 0) return;
    if (i >= this.entries.length) {
      // unterhalb des letzten Eintrags: leere Eingabezeile
      clear(this.ed);
      this.current = null;
      this.pos = null;
      this.error = null;
      return;
    }
    this.loadEntry(i);
  }

  private input(action: string): boolean {
    this.pos = null;
    if (this.error) this.resume();
    const s = this.shown;
    if (s) {
      // nach einem Ergebnis: Operatoren rechnen mit dem letzten Ergebnis weiter, alles andere beginnt neu
      const id = action.startsWith('t:') ? action.slice(2) : '';
      const cont = (action !== 'neg' && CONTINUES_WITH_ANS.has(id)) || ['sq', 'cube', 'inv', 'p:pow'].includes(action);
      clear(this.ed);
      this.current = null;
      if (cont && s.value) insertToken(this.ed, this.opts.ansToken ? this.opts.ansToken(s.value) : 'Ans');
    }
    return editorKey(this.ed, action);
  }

  private toggleForm(): void {
    const s = this.shown;
    if (!s || !s.value) return;
    this.view = 'std';
    this.form = this.form === 'decimal' ? defaultExact() : 'decimal';
  }

  private toggleMixed(): void {
    const s = this.shown;
    if (!s || !s.value) return;
    const v = s.value;
    if (v.kind === 'real' && !hasMixedForm(v)) {
      toast('Kein unechter Bruch – gemischte Schreibweise nicht möglich.');
      return;
    }
    this.view = 'std';
    this.form = this.form === 'mixed' ? 'exact' : 'mixed';
  }

  /** Zustand für die Persistenz. */
  snapshot(): { rows: MRow[]; input: MRow } {
    return { rows: this.entries.slice(-20).map((e) => e.row), input: this.editing ? this.ed.root : [] };
  }
}

function defaultExact(): ResultForm {
  const f = defaultForm();
  return f === 'decimal' ? 'exact' : f;
}

/** Gibt es für diesen Wert einen Unterschied zwischen exakter und dezimaler Anzeige? */
export function canToggleExact(v: Value): boolean {
  if (v.kind === 'real') return hasExactForm(v);
  if (v.kind === 'complex') return hasExactForm(v.re) || hasExactForm(v.im);
  if (v.kind === 'matrix') return v.d.some((r) => r.some(hasExactForm));
  if (v.kind === 'vector') return v.d.some(hasExactForm);
  if (v.kind === 'pair') return v.vals.some(hasExactForm);
  return false;
}

export { CalcError, Real };
