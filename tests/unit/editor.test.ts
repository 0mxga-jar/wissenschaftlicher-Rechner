import { describe, it, expect } from 'vitest';
import {
  createEditor,
  insertToken,
  insertTemplate,
  moveLeft,
  moveRight,
  moveUp,
  moveDown,
  backspace,
  serialize,
  setCursor,
  isEmpty,
  clear,
  type EditorState,
} from '../../src/editor/model';
import { toks, calculate, createContext, formatScalar, DEFAULT_FORMAT, rowToText, type Scalar } from '../../src/core';

const type = (ed: EditorState, s: string) => [...s].forEach((c) => insertToken(ed, c));
const evalEd = (ed: EditorState) =>
  formatScalar(calculate(serialize(ed.root), createContext()) as Scalar, DEFAULT_FORMAT, 'exact');

describe('Formeleditor', () => {
  it('lineare Eingabe', () => {
    const ed = createEditor();
    type(ed, '1+2×3');
    expect(serialize(ed.root)).toBe('1+2*3');
    expect(evalEd(ed)).toBe('7');
  });
  it('Bruch: Zähler, ↓, Nenner, → verlässt den Bruch', () => {
    const ed = createEditor();
    insertTemplate(ed, 'frac');
    type(ed, '1');
    expect(moveDown(ed)).toBe(true);
    type(ed, '2');
    moveRight(ed);
    type(ed, '+');
    insertTemplate(ed, 'frac');
    type(ed, '1');
    moveRight(ed);
    type(ed, '3');
    expect(serialize(ed.root)).toBe('((1)/(2))+((1)/(3))');
    expect(evalEd(ed)).toBe('5/6');
    expect(rowToText(ed.root)).toBe('1/2+1/3');
  });
  it('↑ und ↓ wechseln zwischen Zähler und Nenner; außerhalb gibt es kein Ziel', () => {
    const ed = createEditor();
    expect(moveUp(ed)).toBe(false);
    insertTemplate(ed, 'frac');
    expect(moveUp(ed)).toBe(false);
    expect(moveDown(ed)).toBe(true);
    expect(ed.cur).toEqual([0, 1, 0]);
    expect(moveUp(ed)).toBe(true);
    expect(ed.cur).toEqual([0, 0, 0]);
  });
  it('Wurzel in einem Bruch: ↓ findet den Nenner auch aus der Wurzel heraus', () => {
    const ed = createEditor();
    insertTemplate(ed, 'frac');
    insertTemplate(ed, 'sqrt');
    type(ed, '3');
    expect(moveDown(ed)).toBe(true);
    type(ed, '2');
    expect(serialize(ed.root)).toBe('((sqrt(3))/(2))');
    expect(evalEd(ed)).toBe('√3/2');
  });
  it('Potenzen: x², vorbelegter Exponent und verschachtelt', () => {
    const ed = createEditor();
    type(ed, '3');
    insertTemplate(ed, 'pow', [toks('2')]);
    expect(ed.cur).toEqual([2]);
    type(ed, '+2');
    insertTemplate(ed, 'pow');
    type(ed, '10');
    expect(serialize(ed.root)).toBe('3^{2}+2^{10}');
    expect(evalEd(ed)).toBe('1033');
  });
  it('Integral, Summe und Ableitung', () => {
    const ed = createEditor();
    insertTemplate(ed, 'int');
    type(ed, 'x');
    insertTemplate(ed, 'pow', [toks('2')]);
    moveRight(ed);
    type(ed, '0');
    moveRight(ed);
    type(ed, '3');
    expect(serialize(ed.root)).toBe('integral(x ^{2};0;3)');
    expect(evalEd(ed)).toBe('9');
    clear(ed);
    insertTemplate(ed, 'sum');
    type(ed, 'x');
    moveRight(ed);
    type(ed, '1');
    expect(moveUp(ed)).toBe(true);
    type(ed, '10');
    expect(evalEd(ed)).toBe('55');
    clear(ed);
    insertTemplate(ed, 'diff');
    type(ed, 'x');
    insertTemplate(ed, 'pow', [toks('3')]);
    moveRight(ed);
    type(ed, '2');
    expect(evalEd(ed)).toBe('12');
  });
  it('gemischter Bruch, n-te Wurzel, Betrag, Logarithmus zur Basis', () => {
    const ed = createEditor();
    insertTemplate(ed, 'mixed');
    type(ed, '2');
    moveRight(ed);
    type(ed, '1');
    moveRight(ed);
    type(ed, '3');
    expect(evalEd(ed)).toBe('7/3');
    clear(ed);
    insertTemplate(ed, 'root');
    type(ed, '3');
    moveRight(ed);
    type(ed, '27');
    expect(evalEd(ed)).toBe('3');
    clear(ed);
    insertTemplate(ed, 'abs');
    type(ed, '2-5');
    expect(evalEd(ed)).toBe('3');
    clear(ed);
    insertTemplate(ed, 'logb');
    type(ed, '2');
    moveRight(ed);
    type(ed, '32');
    expect(evalEd(ed)).toBe('5');
  });
  it('Cursor wandert durch alle Felder und springt am Ende zum Anfang', () => {
    const ed = createEditor();
    type(ed, '1');
    insertTemplate(ed, 'frac');
    type(ed, '2');
    moveRight(ed);
    type(ed, '3');
    moveRight(ed);
    expect(ed.cur).toEqual([2]);
    moveRight(ed);
    expect(ed.cur).toEqual([0]);
    moveLeft(ed);
    expect(ed.cur).toEqual([2]);
    moveLeft(ed);
    expect(ed.cur).toEqual([1, 1, 1]);
    moveLeft(ed);
    moveLeft(ed);
    expect(ed.cur).toEqual([1, 0, 1]);
    moveLeft(ed);
    moveLeft(ed);
    expect(ed.cur).toEqual([1]);
  });
  it('DEL löscht Zeichen, betritt gefüllte Vorlagen und entfernt leere', () => {
    const ed = createEditor();
    type(ed, '12');
    backspace(ed);
    expect(serialize(ed.root)).toBe('1');
    insertTemplate(ed, 'sqrt');
    type(ed, '9');
    moveRight(ed);
    backspace(ed); // betritt die Wurzel
    expect(ed.cur).toEqual([1, 0, 1]);
    backspace(ed); // löscht 9
    backspace(ed); // löst die leere Wurzel auf
    expect(serialize(ed.root)).toBe('1');
    backspace(ed);
    expect(isEmpty(ed)).toBe(true);
    expect(backspace(ed)).toBe(false);
  });
  it('DEL am Feldanfang löst die Vorlage auf und behält den Inhalt', () => {
    const ed = createEditor();
    insertTemplate(ed, 'frac');
    type(ed, '12');
    moveRight(ed);
    type(ed, '34');
    setCursor(ed, [0, 0, 0]);
    backspace(ed);
    expect(serialize(ed.root)).toBe('1234');
    expect(ed.cur).toEqual([0]);
  });
  it('offene Klammern bleiben auf ihr Feld begrenzt', () => {
    const ed = createEditor();
    insertTemplate(ed, 'sqrt');
    type(ed, '(7+9');
    moveRight(ed);
    type(ed, '+5');
    expect(serialize(ed.root)).toBe('sqrt((7+9))+5');
    expect(evalEd(ed)).toBe('9');
    clear(ed);
    insertToken(ed, 'sin(');
    type(ed, '30');
    expect(serialize(ed.root)).toBe('sin(30)');
  });
  it('Namen werden mit Leerzeichen getrennt (A·B, 2π, Konstanten)', () => {
    const ed = createEditor();
    type(ed, '2');
    insertToken(ed, 'π');
    insertToken(ed, 'A');
    insertToken(ed, 'B');
    insertToken(ed, '$c0');
    type(ed, '2');
    expect(serialize(ed.root)).toBe('2pi A B $c0 2');
  });
  it('ungültige Cursorpfade werden ignoriert', () => {
    const ed = createEditor(toks('12'));
    setCursor(ed, [5]);
    expect(ed.cur).toEqual([2]);
    setCursor(ed, [0, 0, 0]);
    expect(ed.cur).toEqual([2]);
    setCursor(ed, [1]);
    expect(ed.cur).toEqual([1]);
  });
  it('leere Felder ergeben einen Syntaxfehler', () => {
    const ed = createEditor();
    insertTemplate(ed, 'frac');
    type(ed, '1');
    expect(() => calculate(serialize(ed.root), createContext())).toThrow(/Syntaxfehler/);
    clear(ed);
    type(ed, '2');
    insertTemplate(ed, 'pow');
    expect(() => calculate(serialize(ed.root), createContext())).toThrow(/Exponent fehlt/);
  });
});
