/**
 * Baumstruktur für zweidimensionale Formeln (Natural Display).
 * Wird sowohl vom Formeleditor (Eingabe) als auch von der Ergebnisformatierung verwendet.
 */

export type TplKind =
  | 'frac' // [Zähler, Nenner]
  | 'mixed' // [Ganze, Zähler, Nenner]
  | 'sqrt' // [Radikand]
  | 'root' // [Wurzelexponent, Radikand]
  | 'pow' // [Exponent] – bezieht sich auf das Element davor
  | 'abs' // [Inhalt]
  | 'logb' // [Basis, Argument]
  | 'int' // [Integrand, untere Grenze, obere Grenze]
  | 'diff' // [Funktion, Stelle]
  | 'sum' // [Summand, Start, Ende]
  | 'prod'; // [Faktor, Start, Ende]

/** Einzelnes Zeichen bzw. benanntes Token (z. B. "7", "+", "sin("). */
export interface MTok {
  t: 'tok';
  id: string;
}
/** Vorlage mit Eingabefeldern. */
export interface MTpl {
  t: 'tpl';
  k: TplKind;
  s: MRow[];
}
/** Reiner Text (nur in Ergebnissen). */
export interface MTxt {
  t: 'txt';
  s: string;
}
export type MNode = MTok | MTpl | MTxt;
export type MRow = MNode[];

export const tok = (id: string): MTok => ({ t: 'tok', id });
export const txt = (s: string): MTxt => ({ t: 'txt', s });
export const tpl = (k: TplKind, ...s: MRow[]): MTpl => ({ t: 'tpl', k, s });
/** Zeichenkette in Einzel-Tokens zerlegen. */
export const toks = (s: string): MRow => [...s].map((c) => tok(c));

export const SLOT_COUNT: Record<TplKind, number> = {
  frac: 2,
  mixed: 3,
  sqrt: 1,
  root: 2,
  pow: 1,
  abs: 1,
  logb: 2,
  int: 3,
  diff: 2,
  sum: 3,
  prod: 3,
};
