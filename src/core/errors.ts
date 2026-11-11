/** Fehlerklassen des Rechenkerns – alle Meldungen auf Deutsch. */

export type ErrCode =
  | 'SYNTAX'
  | 'DIV0'
  | 'DOMAIN'
  | 'OVERFLOW'
  | 'DIM'
  | 'ARG'
  | 'UNDEF'
  | 'NOSOL'
  | 'TIMEOUT'
  | 'CIRC'
  | 'RANGE';

const TITLES: Record<ErrCode, string> = {
  SYNTAX: 'Syntaxfehler',
  DIV0: 'Mathematischer Fehler',
  DOMAIN: 'Mathematischer Fehler',
  OVERFLOW: 'Mathematischer Fehler',
  DIM: 'Dimensionsfehler',
  ARG: 'Argumentfehler',
  UNDEF: 'Nicht definiert',
  NOSOL: 'Keine Lösung',
  TIMEOUT: 'Zeitüberschreitung',
  CIRC: 'Zirkelbezug',
  RANGE: 'Bereichsfehler',
};

const DEFAULTS: Record<ErrCode, string> = {
  SYNTAX: 'Die Eingabe ist unvollständig oder fehlerhaft.',
  DIV0: 'Division durch 0 ist nicht definiert.',
  DOMAIN: 'Der Wert liegt außerhalb des Definitionsbereichs.',
  OVERFLOW: 'Das Ergebnis ist zu groß (Überlauf).',
  DIM: 'Die Dimensionen passen nicht zusammen.',
  ARG: 'Ungültiges Argument.',
  UNDEF: 'Der Wert ist nicht definiert.',
  NOSOL: 'Es wurde keine Lösung gefunden.',
  TIMEOUT: 'Die Berechnung konvergiert nicht.',
  CIRC: 'Die Formeln verweisen im Kreis aufeinander.',
  RANGE: 'Der Wert liegt außerhalb des zulässigen Bereichs.',
};

export class CalcError extends Error {
  readonly code: ErrCode;
  readonly title: string;
  readonly detail: string;
  /** Position im Quelltext (falls bekannt), z. B. für Syntaxfehler. */
  pos?: number;

  constructor(code: ErrCode, detail?: string, pos?: number) {
    const d = detail ?? DEFAULTS[code];
    super(`${TITLES[code]}: ${d}`);
    this.name = 'CalcError';
    this.code = code;
    this.title = TITLES[code];
    this.detail = d;
    this.pos = pos;
  }
}

/** Wandelt beliebige Fehler in eine deutsche Meldung um. */
export function errorMessage(e: unknown): string {
  if (e instanceof CalcError) return e.message;
  if (e instanceof RangeError) return 'Mathematischer Fehler: Das Ergebnis ist zu groß (Überlauf).';
  return 'Fehler: Die Berechnung konnte nicht durchgeführt werden.';
}

export function toCalcError(e: unknown): CalcError {
  if (e instanceof CalcError) return e;
  if (e instanceof RangeError) return new CalcError('OVERFLOW');
  return new CalcError('ARG', 'Die Berechnung konnte nicht durchgeführt werden.');
}
