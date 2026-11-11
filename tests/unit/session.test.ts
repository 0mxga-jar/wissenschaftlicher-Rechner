import { describe, it, expect } from 'vitest';
import { calculate, createContext, formatScalar, DEFAULT_FORMAT, Real, type Scalar, type Value } from '../../src/core';
import { CalcSession } from '../../src/ui/session';
import { CellForm } from '../../src/ui/form';
import { serialize } from '../../src/editor/model';

function makeSession() {
  const vars: Record<string, Value> = {};
  const s = new CalcSession({
    evaluate: (src) => calculate(src, createContext({ vars })),
    onResult: (v) => {
      vars.Ans = v;
    },
  });
  const keys = (...actions: string[]) => actions.forEach((a) => s.key(a));
  const typeDigits = (text: string) => [...text].forEach((c) => s.key(`t:${c}`));
  const shown = () => (s.shown?.value ? formatScalar(s.shown.value as Scalar, DEFAULT_FORMAT, 'exact') : null);
  return { s, keys, typeDigits, shown, vars };
}

describe('Rechen-Sitzung (Verlauf, Ans, Fehler)', () => {
  it('rechnet und merkt sich den Verlauf', () => {
    const { s, keys, typeDigits, shown } = makeSession();
    typeDigits('2+3');
    keys('exe');
    expect(shown()).toBe('5');
    typeDigits('4×5');
    keys('exe');
    expect(shown()).toBe('20');
    expect(s.entries).toHaveLength(2);
    keys('up');
    expect(shown()).toBe('5');
    keys('up'); // am Anfang bleibt der erste Eintrag stehen
    expect(shown()).toBe('5');
    keys('down');
    expect(shown()).toBe('20');
    keys('down'); // hinter dem letzten Eintrag: leere Eingabe
    expect(s.shown).toBeNull();
    expect(s.ed.root).toHaveLength(0);
  });

  it('setzt nach einem Ergebnis bei Operatoren mit Ans fort, sonst beginnt eine neue Eingabe', () => {
    const { s, keys, typeDigits, shown } = makeSession();
    typeDigits('6');
    keys('exe', 't:×');
    expect(serialize(s.ed.root)).toBe('Ans *');
    typeDigits('7');
    keys('exe');
    expect(shown()).toBe('42');
    keys('sq');
    expect(serialize(s.ed.root)).toBe('Ans ^{2}');
    keys('exe');
    expect(shown()).toBe('1764');
    typeDigits('9');
    expect(serialize(s.ed.root)).toBe('9');
    keys('exe', 'neg'); // (−) beginnt eine neue Zahl
    expect(serialize(s.ed.root)).toBe('-');
  });

  it('nach einem Fehler bleibt der Ausdruck zum Korrigieren erhalten', () => {
    const { s, keys, typeDigits, shown } = makeSession();
    typeDigits('8÷0');
    keys('exe');
    expect(s.error?.code).toBe('DIV0');
    expect(s.entries).toHaveLength(0);
    keys('del'); // zurück in die Bearbeitung
    expect(s.error).toBeNull();
    keys('del');
    typeDigits('4');
    keys('exe');
    expect(shown()).toBe('2');
    keys('ac');
    expect(s.ed.root).toHaveLength(0);
    keys('exe'); // leere Eingabe ist kein Fehler
    expect(s.error).toBeNull();
  });

  it('S⇔D, gemischter Bruch, DMS und FACT schalten die Anzeige um', () => {
    const { s, keys, typeDigits } = makeSession();
    typeDigits('7÷2');
    keys('exe');
    expect(s.form).toBe('exact');
    keys('std');
    expect(s.form).toBe('decimal');
    keys('std');
    expect(s.form).toBe('exact');
    keys('mixedToggle');
    expect(s.form).toBe('mixed');
    keys('dms');
    expect(s.view).toBe('dms');
    keys('dms');
    expect(s.view).toBe('std');
    keys('ac');
    typeDigits('360');
    keys('exe', 'fact');
    expect(s.view).toBe('fact');
    keys('ac', 'dms'); // ohne Ergebnis fügt die Taste das Gradzeichen ein
    expect(serialize(s.ed.root)).toBe('°');
  });

  it('◀ und ▶ holen den berechneten Ausdruck zum Bearbeiten zurück', () => {
    const { s, keys, typeDigits, shown } = makeSession();
    typeDigits('12+3');
    keys('exe', 'left');
    expect(s.editing).toBe(true);
    expect(s.ed.cur).toEqual([4]);
    keys('del');
    typeDigits('8');
    keys('exe');
    expect(shown()).toBe('20');
    keys('right');
    expect(s.ed.cur).toEqual([0]);
  });

  it('≈ erzwingt die Dezimaldarstellung', () => {
    const { s, keys, typeDigits } = makeSession();
    typeDigits('1÷3');
    keys('approx');
    expect(s.form).toBe('decimal');
  });
});

describe('Formularfelder', () => {
  const makeForm = () => {
    const changes: string[] = [];
    const f = new CellForm({ evaluate: (src) => calculate(src, createContext()), onChange: (k) => changes.push(k) });
    f.setGrid([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    return { f, changes };
  };
  const typeInto = (f: CellForm, text: string) => [...text].forEach((c) => f.key(`t:${c}`));

  it('übernimmt Werte mit = und springt zum nächsten Feld', () => {
    const { f, changes } = makeForm();
    typeInto(f, '1÷4');
    f.key('exe');
    expect(f.num('a')).toBe(0.25);
    expect(f.active).toBe('b');
    typeInto(f, '7');
    f.key('exe');
    expect(f.active).toBe('c'); // Zeilenende → nächste Zeile
    expect(changes).toEqual(['a', 'b']);
  });

  it('meldet Fehler und behält die Eingabe', () => {
    const { f } = makeForm();
    typeInto(f, '1÷0');
    f.key('exe');
    expect(f.error).toContain('Division durch 0');
    expect(f.typing).toBe(true);
    expect(f.active).toBe('a');
    f.key('ac');
    expect(f.typing).toBe(false);
    expect(f.error).toBeNull();
  });

  it('Pfeiltasten wechseln das Feld; DEL leert es', () => {
    const { f } = makeForm();
    f.set('a', Real.int(5));
    f.key('right');
    expect(f.active).toBe('b');
    f.key('down');
    expect(f.active).toBe('d');
    f.key('left');
    f.key('up');
    expect(f.active).toBe('a');
    f.key('del');
    expect(f.value('a')).toBeNull();
    f.key('up'); // am Rand passiert nichts
    expect(f.active).toBe('a');
  });

  it('Bearbeiten eines vorhandenen Ausdrucks und Wiederherstellen aus der Speicherung', () => {
    const { f } = makeForm();
    typeInto(f, '2+3');
    f.key('exe');
    f.activate('a');
    f.activate('a'); // zweites Antippen lädt den Ausdruck
    expect(f.typing).toBe(true);
    expect(serialize(f.ed.root)).toBe('2+3');
    typeInto(f, '×4');
    f.key('exe');
    expect(f.num('a')).toBe(14);
    const snap = f.snapshot();
    const g = new CellForm({ evaluate: (src) => calculate(src, createContext()) });
    g.restore(JSON.parse(JSON.stringify(snap)));
    expect(g.num('a')).toBe(14);
  });

  it('focusFirstEmpty wählt das erste leere Feld', () => {
    const { f } = makeForm();
    f.set('a', Real.int(1));
    f.set('b', Real.int(2));
    f.active = 'd';
    f.focusFirstEmpty();
    expect(f.active).toBe('c');
    f.set('c', Real.int(3));
    f.set('d', Real.int(4));
    f.focusFirstEmpty();
    expect(f.active).toBe('a');
  });
});
