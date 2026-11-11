import { describe, it, expect } from 'vitest';
import {
  Real,
  Pair,
  calculate,
  errorMessage,
  formatDecimal,
  formatReal,
  roundToFormat,
  hasExactForm,
  hasMixedForm,
  parse,
  collectVars,
  solveFor,
  type NumFormat,
} from '../../src/core';
import { ctx, show, dec, err, num } from './helpers';

const DEG = () => ctx({ angle: 'DEG' });
const RAD = () => ctx({ angle: 'RAD' });
const GRA = () => ctx({ angle: 'GRA' });

describe('Trigonometrie im Gradmaß (DEG)', () => {
  const cases: Array<[string, string]> = [
    ['sin(0)', '0'],
    ['sin(30)', '1/2'],
    ['sin(45)', '√2/2'],
    ['sin(60)', '√3/2'],
    ['sin(90)', '1'],
    ['sin(180)', '0'],
    ['sin(270)', '−1'],
    ['sin(360)', '0'],
    ['sin(-30)', '−1/2'],
    ['sin(390)', '1/2'],
    ['sin(15)', '(√6−√2)/4'],
    ['cos(0)', '1'],
    ['cos(60)', '1/2'],
    ['cos(90)', '0'],
    ['cos(180)', '−1'],
    ['cos(30)', '√3/2'],
    ['tan(45)', '1'],
    ['tan(60)', '√3'],
    ['tan(30)', '√3/3'],
    ['tan(15)', '2−√3'],
    ['tan(135)', '−1'],
    ['asin(1/2)', '30'],
    ['asin(-1)', '−90'],
    ['acos(1/2)', '60'],
    ['acos(-1)', '180'],
    ['acos(0)', '90'],
    ['atan(1)', '45'],
    ['atan(sqrt(3))', '60'],
    ['atan(-1)', '−45'],
    ['sin(30)^2+cos(30)^2', '1'],
  ];
  for (const [src, want] of cases) {
    it(`${src} = ${want}`, () => expect(show(src, 'exact', DEG())).toBe(want));
  }
  it('nicht exakte Winkel', () => {
    expect(dec('sin(37)', DEG())).toBe('0,6018150232');
    expect(dec('cos(37)', DEG())).toBe('0,79863551');
    expect(dec('tan(10)', DEG())).toBe('0,1763269807');
    expect(dec('sin(1)', DEG())).toBe('0,01745240644');
    expect(dec('asin(0.3)', DEG())).toBe('17,45760312');
    expect(dec('sin(20)^2+cos(20)^2', DEG())).toBe('1');
  });
  it('große Winkel werden sauber reduziert', () => {
    expect(num('sin(180.0000)', DEG())).toBe(0);
    expect(num('cos(36000090)', DEG())).toBe(0);
    expect(dec('sin(7200030)', DEG())).toBe('0,5');
  });
});

describe('Trigonometrie im Bogenmaß (RAD)', () => {
  const cases: Array<[string, string]> = [
    ['sin(pi/6)', '1/2'],
    ['sin(pi/2)', '1'],
    ['sin(pi)', '0'],
    ['cos(pi)', '−1'],
    ['cos(pi/3)', '1/2'],
    ['tan(pi/4)', '1'],
    ['sin(2pi)', '0'],
    ['cos(-pi/4)', '√2/2'],
    ['asin(1/2)', 'π/6'],
    ['acos(0)', 'π/2'],
    ['atan(1)', 'π/4'],
    ['acos(-1)', 'π'],
    ['sin(0)', '0'],
  ];
  for (const [src, want] of cases) {
    it(`${src} = ${want}`, () => expect(show(src, 'exact', RAD())).toBe(want));
  }
  it('Dezimalwerte', () => {
    expect(dec('sin(1)', RAD())).toBe('0,8414709848');
    expect(dec('cos(1)', RAD())).toBe('0,5403023059');
    expect(dec('tan(1)', RAD())).toBe('1,557407725');
    expect(dec('asin(0.5)', RAD())).toBe('0,5235987756');
    expect(dec('atan(2)', RAD())).toBe('1,107148718');
  });
});

describe('Trigonometrie in Neugrad (GRA)', () => {
  const cases: Array<[string, string]> = [
    ['sin(100)', '1'],
    ['cos(200)', '−1'],
    ['sin(50)', '√2/2'],
    ['tan(50)', '1'],
    ['sin(100/3)', '1/2'],
    ['cos(100)', '0'],
    ['asin(1)', '100'],
    ['atan(1)', '50'],
    ['acos(1/2)', '200/3'],
  ];
  for (const [src, want] of cases) {
    it(`${src} = ${want}`, () => expect(show(src, 'exact', GRA())).toBe(want));
  }
  it('Dezimalwert', () => expect(dec('sin(10)', GRA())).toBe('0,1564344650'.replace(/0$/, '')));
});

describe('Winkelmarken, Hyperbelfunktionen, Koordinaten', () => {
  it('Winkelmarken rechnen in die aktuelle Einheit um', () => {
    expect(show('sin(30@deg)', 'exact', RAD())).toBe('1/2');
    expect(show('sin(pi@rad/6)', 'exact', DEG())).toBe('1/2');
    expect(show('90@deg', 'exact', RAD())).toBe('π/2');
    expect(show('pi@rad', 'exact', DEG())).toBe('180');
    expect(show('100@gra', 'exact', DEG())).toBe('90');
  });
  it('Hyperbelfunktionen', () => {
    expect(show('sinh(0)')).toBe('0');
    expect(show('cosh(0)')).toBe('1');
    expect(dec('sinh(1)')).toBe('1,175201194');
    expect(dec('cosh(1)')).toBe('1,543080635');
    expect(dec('tanh(1)')).toBe('0,761594156');
    expect(dec('asinh(1)')).toBe('0,881373587');
    expect(show('acosh(1)')).toBe('0');
    expect(dec('atanh(0.5)')).toBe('0,5493061443');
    expect(dec('acosh(2)')).toBe('1,316957897');
  });
  it('Pol und Rec', () => {
    const c = DEG();
    const p = calculate('Pol(1;1)', c) as Pair;
    expect(formatReal(p.vals[0], { mode: 'norm1', digits: 0, comma: true }, 'exact')).toBe('√2');
    expect(p.vals[1].n).toBe(45);
    expect((c.vars.y as Real).n).toBe(45);
    const r = calculate('Rec(2;60)', DEG()) as Pair;
    expect(r.vals[0].n).toBe(1);
    expect(formatReal(r.vals[1], { mode: 'norm1', digits: 0, comma: true }, 'exact')).toBe('√3');
    const q = calculate('Pol(-1;0)', DEG()) as Pair;
    expect(q.vals[1].n).toBe(180);
    const s = calculate('Pol(3;4)', RAD()) as Pair;
    expect(s.vals[0].n).toBe(5);
    expect(s.vals[1].n).toBeCloseTo(0.927295218, 9);
  });
});

describe('Zahlenformate Norm / Fix / Sci', () => {
  const f = (mode: NumFormat['mode'], digits = 0, comma = true): NumFormat => ({ mode, digits, comma });
  const fd = (r: Real, fmt: NumFormat) => formatDecimal(r, fmt);
  it('Norm 1 und Norm 2', () => {
    expect(fd(Real.rat(1, 3), f('norm1'))).toBe('0,3333333333');
    expect(fd(Real.rat(1, 300), f('norm1'))).toBe('3,333333333×10⁻³');
    expect(fd(Real.rat(1, 300), f('norm2'))).toBe('0,0033333333');
    expect(fd(Real.rat(1, 100), f('norm1'))).toBe('0,01');
    expect(fd(Real.int(1234567890), f('norm1'))).toBe('1234567890');
    expect(fd(Real.int(12345678901), f('norm1'))).toBe('1,23456789×10¹⁰');
    expect(fd(Real.rat(19999999999, 2), f('norm1'))).toBe('1×10¹⁰');
    expect(fd(Real.num(1e-10), f('norm2'))).toBe('1×10⁻¹⁰');
    expect(fd(Real.num(-0.5), f('norm1'))).toBe('−0,5');
    expect(fd(Real.ZERO, f('norm1'))).toBe('0');
    expect(fd(Real.num(123456.789), f('norm1'))).toBe('123456,789');
  });
  it('Fix rundet kaufmännisch – auch bei „krummen“ Binärzahlen', () => {
    expect(fd(Real.rat(1, 3), f('fix', 2))).toBe('0,33');
    expect(fd(Real.rat(2, 3), f('fix', 2))).toBe('0,67');
    expect(fd(calcR('1.005'), f('fix', 2))).toBe('1,01');
    expect(fd(calcR('2.675'), f('fix', 2))).toBe('2,68');
    expect(fd(Real.approx(2.675), f('fix', 2))).toBe('2,68');
    expect(fd(calcR('2.5'), f('fix', 0))).toBe('3');
    expect(fd(calcR('-0.004'), f('fix', 2))).toBe('0,00');
    expect(fd(calcR('0.005'), f('fix', 2))).toBe('0,01');
    expect(fd(calcR('1234.5678'), f('fix', 1))).toBe('1234,6');
    expect(fd(Real.int(5), f('fix', 3))).toBe('5,000');
    expect(fd(calcR('0.0004'), f('fix', 3))).toBe('0,000');
    expect(fd(Real.int(123456789012), f('fix', 2))).toBe('1,23×10¹¹');
    expect(fd(calcR('9.999'), f('fix', 2))).toBe('10,00');
  });
  it('Sci', () => {
    expect(fd(Real.int(12345), f('sci', 3))).toBe('1,23×10⁴');
    expect(fd(calcR('0.00012345'), f('sci', 3))).toBe('1,23×10⁻⁴');
    expect(fd(Real.int(5), f('sci', 1))).toBe('5×10⁰');
    expect(fd(Real.int(999), f('sci', 2))).toBe('1,0×10³');
    expect(fd(Real.rat(1, 3), f('sci', 0))).toBe('3,333333333×10⁻¹');
    expect(fd(Real.ZERO, f('sci', 3))).toBe('0,00×10⁰');
  });
  it('Dezimalpunkt statt Dezimalkomma', () => {
    expect(fd(Real.rat(1, 2), f('norm1', 0, false))).toBe('0.5');
    expect(fd(Real.rat(5, 4), f('fix', 3, false))).toBe('1.250');
  });
  it('Rnd rundet auf das Anzeigeformat', () => {
    expect(roundToFormat(Real.rat(2, 3), f('fix', 2)).n).toBe(0.67);
    expect(roundToFormat(Real.rat(1, 3), f('norm1')).n).toBe(0.3333333333);
    const c = ctx({ round: (r) => roundToFormat(r, f('fix', 1)) });
    expect(show('Rnd(2/3)×3', 'exact', c)).toBe('21/10');
  });
  it('erkennt, ob eine exakte bzw. gemischte Darstellung existiert', () => {
    expect(hasExactForm(Real.rat(1, 2))).toBe(true);
    expect(hasExactForm(Real.int(5))).toBe(false);
    expect(hasExactForm(Real.approx(0.123))).toBe(false);
    expect(hasMixedForm(Real.rat(7, 2))).toBe(true);
    expect(hasMixedForm(Real.rat(1, 2))).toBe(false);
  });
});

function calcR(src: string): Real {
  return calculate(src, ctx()) as Real;
}

describe('Fehlerfälle mit deutschen Meldungen', () => {
  it('Division durch 0', () => {
    for (const src of ['1/0', '0/0', '5÷(2−2)', '1/sin(0)', '2^-1×0^-1', '7÷R0']) {
      const e = err(src);
      expect(e.code).toBe('DIV0');
      expect(e.message).toBe('Mathematischer Fehler: Division durch 0 ist nicht definiert.');
    }
  });
  it('Definitionsbereich', () => {
    for (const src of [
      'sqrt(-1)',
      'ln(0)',
      'ln(-1)',
      'log(-5)',
      'asin(2)',
      'acos(-1.5)',
      '0^0',
      '(-8)^(1/2)',
      '(-1)!',
      '2.5!',
      'tan(90)',
      'acosh(0.5)',
      'atanh(1)',
      'nCr(2;5)',
      'nroot(2;-4)',
      'logb(1;5)',
    ]) {
      const e = err(src);
      expect(e.code, src).toBe('DOMAIN');
      expect(e.message.startsWith('Mathematischer Fehler: '), src).toBe(true);
    }
    expect(err('tan(pi/2)', ctx({ angle: 'RAD' })).code).toBe('DOMAIN');
  });
  it('Überlauf', () => {
    expect(err('171!').code).toBe('OVERFLOW');
    expect(err('10^400').code).toBe('OVERFLOW');
    expect(err('e^1000').code).toBe('OVERFLOW');
    expect(err('9ᴇ307×9ᴇ307').message).toContain('Überlauf');
  });
  it('Syntaxfehler', () => {
    for (const src of ['', '1+', '(1+2))', '2**3', 'sin()', '1..2', 'abc', '1+×2', '3=', '×5', '2^', 'sqrt(;2)', '()', '1 2ᴇ']) {
      const e = err(src);
      expect(e.code, src).toBe('SYNTAX');
      expect(e.message.startsWith('Syntaxfehler: '), src).toBe(true);
    }
    expect(err('sin(1;2)').message).toContain('benötigt 1 Argument');
    expect(err('1=1').message).toContain('SOLVE');
    expect(err('abc').message).toContain('Unbekanntes Zeichen');
    expect(err('1+').message).toContain('unvollständig');
    expect(err('').message).toContain('leer');
  });
  it('Syntaxfehler melden die Position', () => {
    expect(err('1+×2').pos).toBe(2);
    expect(err('12+3)').pos).toBe(4);
  });
  it('Argumentfehler', () => {
    expect(err('ggT(1.5;2)').code).toBe('ARG');
    expect(err('RanInt(5;1)').code).toBe('ARG');
    expect(err('sum(x;5;1)').code).toBe('ARG');
    expect(err('i').code).toBe('ARG');
    expect(err('i').message).toContain('Komplexe Zahlen');
    expect(err('2∠30').code).toBe('ARG');
    expect(err('1@m>kg').message).toContain('Größenart');
  });
  it('nicht definierte Objekte', () => {
    expect(err('MatA').code).toBe('UNDEF');
    expect(err('VctB+1').code).toBe('UNDEF');
    expect(err('$gibtsnicht').code).toBe('UNDEF');
  });
  it('fehlende schließende Klammern werden ergänzt', () => {
    expect(show('sin(30')).toBe('1/2');
    expect(show('2×(3+4')).toBe('14');
    expect(show('sqrt(16')).toBe('4');
    expect(show('((1+2)×3')).toBe('9');
  });
  it('errorMessage liefert auch für fremde Fehler deutschen Text', () => {
    expect(errorMessage(new Error('boom'))).toMatch(/^Fehler: /);
    expect(errorMessage(new RangeError('x'))).toContain('Überlauf');
  });
});

describe('SOLVE (Newton-Verfahren mit Startwert)', () => {
  const solve = (src: string, name: string, x0: number, c = ctx()) => solveFor(parse(src), name, x0, c).root.n;
  it('findet die Lösung in der Nähe des Startwerts', () => {
    expect(solve('x^2=4', 'x', 1)).toBe(2);
    expect(solve('x^2=4', 'x', -1)).toBe(-2);
    expect(solve('2x+3=7', 'x', 0)).toBe(2);
    expect(solve('x^3−2x−5', 'x', 2)).toBeCloseTo(2.0945514815, 9);
    expect(solve('e^x=5', 'x', 1)).toBeCloseTo(Math.log(5), 10);
    expect(solve('sin(x)=0.5', 'x', 10, ctx({ angle: 'DEG' }))).toBeCloseTo(30, 9);
    expect(solve('x=cos(x)', 'x', 1, ctx({ angle: 'RAD' }))).toBeCloseTo(0.7390851332, 9);
    expect(solve('sqrt(x)=3', 'x', 1)).toBe(9);
    expect(solve('1/x=4', 'x', 1)).toBe(0.25);
  });
  it('löst nach beliebigen Variablen und stellt den alten Wert wieder her', () => {
    const c = ctx({ vars: { B: Real.int(3), A: Real.int(99) } });
    expect(solveFor(parse('A B =12'), 'A', 1, c).root.n).toBe(4);
    expect((c.vars.A as Real).n).toBe(99);
  });
  it('meldet, wenn es keine Lösung gibt', () => {
    expect(() => solve('x^2+1=0', 'x', 1)).toThrow(/Keine Lösung/);
    expect(() => solve('e^x=-1', 'x', 0)).toThrow(/Keine Lösung/);
  });
  it('ermittelt die Variablen eines Ausdrucks', () => {
    expect([...collectVars(parse('A x^2+B x+C=y'))].sort()).toEqual(['A', 'B', 'C', 'x', 'y']);
    expect([...collectVars(parse('integral(x^2;0;A)+Ans'))]).toEqual(['A']);
  });
});
