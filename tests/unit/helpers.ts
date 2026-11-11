import {
  calculate,
  createContext,
  formatScalar,
  DEFAULT_FORMAT,
  CalcError,
  type EvalContext,
  type NumFormat,
  type ResultForm,
  type Scalar,
  type Value,
} from '../../src/core';

export function ctx(p: Partial<EvalContext> = {}): EvalContext {
  return createContext(p);
}

/** Ausdruck auswerten und als Text formatieren (Standard: exakt, Norm 1, Dezimalkomma). */
export function show(
  src: string,
  form: ResultForm = 'exact',
  c: EvalContext = ctx(),
  fmt: NumFormat = DEFAULT_FORMAT,
): string {
  const v = calculate(src, c);
  if (v.kind !== 'real' && v.kind !== 'complex') throw new Error(`kein Skalar: ${v.kind}`);
  return formatScalar(v as Scalar, fmt, form, 'rect', c.angle);
}

export const dec = (src: string, c: EvalContext = ctx(), fmt: NumFormat = DEFAULT_FORMAT): string =>
  show(src, 'decimal', c, fmt);

export function num(src: string, c: EvalContext = ctx()): number {
  const v: Value = calculate(src, c);
  if (v.kind !== 'real') throw new Error(`keine reelle Zahl: ${v.kind}`);
  return v.n;
}

/** Erwartet einen CalcError und liefert ihn zurück. */
export function err(src: string, c: EvalContext = ctx()): CalcError {
  try {
    calculate(src, c);
  } catch (e) {
    if (e instanceof CalcError) return e;
    throw e;
  }
  throw new Error(`kein Fehler bei: ${src}`);
}
