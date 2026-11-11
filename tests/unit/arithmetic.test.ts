import { describe, it, expect } from 'vitest';
import { Real, Pair, calculate, dmsRow, rowToText, factorRow } from '../../src/core';
import { ctx, show, dec, num } from './helpers';

describe('Grundrechenarten und Rangfolge', () => {
  const cases: Array<[string, string]> = [
    ['1+2*3', '7'],
    ['(1+2)*3', '9'],
    ['10-4-3', '3'],
    ['2^10', '1024'],
    ['-2^2', '−4'],
    ['(-2)^2', '4'],
    ['2^3^2', '512'],
    ['2^{3}^{2}', '64'],
    ['2^-1', '1/2'],
    ['2×−3', '−6'],
    ['3−−2', '5'],
    ['2(3+4)', '14'],
    ['(1+2)(3+4)', '21'],
    ['6÷2(1+2)', '1'],
    ['2×3!', '12'],
    ['2^3!', '64'],
    ['100÷8', '25/2'],
    ['7−10', '−3'],
  ];
  for (const [src, want] of cases) {
    it(`${src} = ${want}`, () => expect(show(src)).toBe(want));
  }
});

describe('Exakte Brüche', () => {
  const cases: Array<[string, string]> = [
    ['1/2+1/3', '5/6'],
    ['3/4×2/3', '1/2'],
    ['1/3−1/3', '0'],
    ['(1/2)/(3/4)', '2/3'],
    ['0.1+0.2', '3/10'],
    ['0.25', '1/4'],
    ['1.5×4', '6'],
    ['((1)/(2))+((1)/(4))', '3/4'],
    ['mixed(2;1;3)', '7/3'],
    ['-mixed(1;1;2)', '−3/2'],
    ['50%', '1/2'],
    ['200×15%', '30'],
  ];
  for (const [src, want] of cases) {
    it(`${src} = ${want}`, () => expect(show(src)).toBe(want));
  }
  it('Dezimaldarstellung von 1/3 und 2/3 (Rundung der letzten Stelle)', () => {
    expect(dec('1/3')).toBe('0,3333333333');
    expect(dec('2/3')).toBe('0,6666666667');
  });
  it('0,1 + 0,2 ergibt dezimal genau 0,3', () => expect(dec('0.1+0.2')).toBe('0,3'));
  it('gemischter Bruch', () => {
    expect(show('7/2', 'mixed')).toBe('3 1/2');
    expect(show('-7/2', 'mixed')).toBe('−3 1/2');
    expect(show('1/2', 'mixed')).toBe('1/2');
  });
  it('sehr große Brüche fallen auf Dezimaldarstellung zurück', () => {
    expect(show('12345678901/3')).toBe('4115226300');
    expect(show('1/12345678901')).toBe('8,100000073×10⁻¹¹');
  });
});

describe('Exakte Wurzeln und π', () => {
  const cases: Array<[string, string]> = [
    ['sqrt(8)', '2√2'],
    ['sqrt(16)', '4'],
    ['sqrt(4/9)', '2/3'],
    ['sqrt(1/2)', '√2/2'],
    ['1/sqrt(2)', '√2/2'],
    ['sqrt(2)×sqrt(8)', '4'],
    ['sqrt(12)+sqrt(27)', '5√3'],
    ['(1+sqrt(2))^2', '3+2√2'],
    ['1/(1+sqrt(2))', '√2−1'],
    ['(1+sqrt(5))/2', '(1+√5)/2'],
    ['sqrt(2)+sqrt(3)', '√2+√3'],
    ['sqrt(0)', '0'],
    ['sqrt(0.25)', '1/2'],
    ['cbrt(27)', '3'],
    ['cbrt(-8)', '−2'],
    ['nroot(4;16)', '2'],
    ['nroot(3;1/8)', '1/2'],
    ['8^(1/3)', '2'],
    ['4^(3/2)', '8'],
    ['2^(1/2)', '√2'],
    ['(-8)^(1/3)', '−2'],
    ['2pi', '2π'],
    ['pi/2', 'π/2'],
    ['3pi/4+pi/4', 'π'],
    ['pi−pi', '0'],
    ['sqrt(2)pi', '√2π'],
  ];
  for (const [src, want] of cases) {
    it(`${src} = ${want}`, () => expect(show(src)).toBe(want));
  }
  it('Dezimalwerte', () => {
    expect(dec('sqrt(2)')).toBe('1,414213562');
    expect(dec('pi')).toBe('3,141592654');
    expect(dec('pi×pi')).toBe('9,869604401');
    expect(dec('1/2pi')).toBe('0,1591549431');
    expect(dec('e')).toBe('2,718281828');
    expect(dec('sqrt(3)^3')).toBe('5,196152423');
  });
});

describe('Logarithmen und Exponentialfunktionen', () => {
  const cases: Array<[string, string]> = [
    ['log(1000)', '3'],
    ['log(0.001)', '−3'],
    ['log(2;8)', '3'],
    ['logb(2;1024)', '10'],
    ['logb(1/2;8)', '−3'],
    ['ln(1)', '0'],
    ['ln(e)', '1'],
    ['e^0', '1'],
    ['10^3', '1000'],
    ['ln(e^5)', '5'],
  ];
  for (const [src, want] of cases) {
    it(`${src} = ${want}`, () => expect(show(src)).toBe(want));
  }
  it('Dezimalwerte', () => {
    expect(dec('ln(2)')).toBe('0,6931471806');
    expect(dec('log(2)')).toBe('0,3010299957');
    expect(dec('e^1')).toBe('2,718281828');
    expect(dec('10^2.5')).toBe('316,227766');
    expect(dec('e^-1')).toBe('0,3678794412');
  });
});

describe('Kombinatorik, Teilbarkeit, Rundungsfunktionen', () => {
  const cases: Array<[string, string]> = [
    ['5!', '120'],
    ['0!', '1'],
    ['10!', '3628800'],
    ['nPr(5;2)', '20'],
    ['nCr(5;2)', '10'],
    ['nCr(49;6)', '13983816'],
    ['10𝐂3', '120'],
    ['10𝐏3', '720'],
    ['ggT(12;18)', '6'],
    ['ggT(12;18;30)', '6'],
    ['kgV(4;6)', '12'],
    ['kgV(4;6;10)', '60'],
    ['Int(-3.7)', '−3'],
    ['Intg(-3.7)', '−4'],
    ['Int(3.7)', '3'],
    ['Abs(-5)', '5'],
    ['abs(-1/2)', '1/2'],
    ['Rest(17;5)', '2'],
  ];
  for (const [src, want] of cases) {
    it(`${src} = ${want}`, () => expect(show(src)).toBe(want));
  }
  it('große Fakultäten in Exponentialdarstellung', () => {
    expect(dec('69!')).toBe('1,711224524×10⁹⁸');
    expect(dec('20!')).toBe('2,432902008×10¹⁸');
  });
  it('Division mit Rest', () => {
    const v = calculate('17÷R5', ctx()) as Pair;
    expect(v.kind).toBe('pair');
    expect(v.vals[0].n).toBe(3);
    expect(v.vals[1].n).toBe(2);
    const w = calculate('-7÷R2', ctx()) as Pair;
    expect(w.vals.map((x) => x.n)).toEqual([-4, 1]);
  });
  it('Zufallszahlen liegen im erwarteten Bereich', () => {
    const c = ctx({ random: () => 0.5 });
    expect(num('Ran#', c)).toBe(0.5);
    expect(num('RanInt(1;6)', c)).toBe(4);
    const d = ctx();
    for (let i = 0; i < 50; i++) {
      const r = num('RanInt(1;6)', d);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(6);
      expect(Number.isInteger(r)).toBe(true);
    }
  });
  it('Primfaktorzerlegung', () => {
    expect(rowToText(factorRow(Real.int(360)))).toBe('2³×3²×5');
    expect(rowToText(factorRow(Real.int(97)))).toBe('97');
    expect(rowToText(factorRow(Real.int(1)))).toBe('1');
    expect(rowToText(factorRow(Real.int(1001)))).toBe('7×11×13');
    expect(rowToText(factorRow(Real.int(2147483647)))).toBe('2147483647');
    expect(() => factorRow(Real.rat(1, 2))).toThrow(/natürliche Zahl/);
  });
});

describe('Grad-Minuten-Sekunden und Exponentialschreibweise', () => {
  it('DMS-Eingabe', () => {
    expect(show('1°30°')).toBe('3/2');
    expect(dec('12°34°56°')).toBe('12,58222222');
    expect(show('-1°30°')).toBe('−3/2');
    expect(show('2°')).toBe('2');
  });
  it('DMS-Ausgabe', () => {
    expect(rowToText(dmsRow(Real.rat(3, 2)))).toBe('1°30′0″');
    expect(rowToText(dmsRow(Real.num(12.582222222222)))).toBe('12°34′56″');
    expect(rowToText(dmsRow(Real.rat(-1, 8)))).toBe('−0°7′30″');
    expect(rowToText(dmsRow(Real.num(2.9999999999)))).toBe('3°0′0″');
  });
  it('×10^x', () => {
    expect(show('1.5ᴇ3')).toBe('1500');
    expect(show('2ᴇ-3')).toBe('1/500');
    expect(dec('6.02ᴇ23')).toBe('6,02×10²³');
    expect(dec('Ansᴇ2', ctx({ vars: { Ans: Real.int(7) } }))).toBe('700');
  });
});

describe('Variablen, Konstanten, Einheiten', () => {
  it('Variablen und Ans', () => {
    const c = ctx({ vars: { A: Real.int(3), B: Real.rat(1, 2), Ans: Real.int(10) } });
    expect(show('2A', 'exact', c)).toBe('6');
    expect(show('A B ', 'exact', c)).toBe('3/2');
    expect(show('A^2+B', 'exact', c)).toBe('19/2');
    expect(show('Ans+1', 'exact', c)).toBe('11');
    expect(show('2Ans', 'exact', c)).toBe('20');
    expect(show('C', 'exact', c)).toBe('0');
  });
  it('physikalische Konstanten', () => {
    expect(show('$c0')).toBe('299792458');
    expect(dec('$NA')).toBe('6,02214076×10²³');
    expect(dec('$g')).toBe('9,80665');
    expect(dec('$h')).toBe('6,62607015×10⁻³⁴');
    expect(dec('$me×$c0^2')).toBe('8,187105777×10⁻¹⁴');
  });
  it('Einheitenumrechnung', () => {
    expect(dec('1@in>cm')).toBe('2,54');
    expect(dec('100@degC>degF')).toBe('212');
    expect(dec('32@degF>degC')).toBe('0');
    expect(dec('0@degC>K')).toBe('273,15');
    expect(dec('1@mile>km')).toBe('1,609344');
    expect(dec('36@kmh>ms')).toBe('10');
    expect(dec('1@atm>Pa')).toBe('101325');
    expect(dec('1@kWh>kJ')).toBe('3600');
    expect(dec('2×5@ft>m')).toBe('3,048');
  });
});

describe('Summen, Produkte, Ableitung, Integral', () => {
  it('Σ und Π', () => {
    expect(show('sum(x;1;100)')).toBe('5050');
    expect(show('sum(1/x;1;4)')).toBe('25/12');
    expect(show('sum(x^2;1;10)')).toBe('385');
    expect(show('prod(x;1;5)')).toBe('120');
    expect(show('prod((x+1)/x;1;9)')).toBe('10');
    expect(show('sum(2;3;3)')).toBe('2');
  });
  it('die Laufvariable x wird nach der Summe wiederhergestellt', () => {
    const c = ctx({ vars: { x: Real.int(7) } });
    expect(show('sum(x;1;3)+x', 'exact', c)).toBe('13');
  });
  it('bestimmtes Integral', () => {
    expect(dec('integral(x^2;0;3)')).toBe('9');
    expect(dec('integral(sin(x);0;pi)', ctx({ angle: 'RAD' }))).toBe('2');
    expect(dec('integral(1/x;1;e)')).toBe('1');
    expect(dec('integral(e^(-x^2);-6;6)')).toBe('1,772453851');
    expect(dec('integral(sqrt(x);0;1)')).toBe('0,6666666667');
    expect(dec('integral(x;2;0)')).toBe('−2');
    expect(dec('integral(abs(x);-1;1)')).toBe('1');
  });
  it('numerische Ableitung', () => {
    expect(dec('diff(x^3;2)')).toBe('12');
    expect(dec('diff(sin(x);0)', ctx({ angle: 'RAD' }))).toBe('1');
    expect(dec('diff(e^x;1)')).toBe('2,718281828');
    expect(dec('diff(ln(x);4)')).toBe('0,25');
    expect(dec('diff(x^2−3x;1.5)')).toBe('0');
  });
});
