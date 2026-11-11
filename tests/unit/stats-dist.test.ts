import { describe, it, expect } from 'vitest';
import {
  oneVar,
  twoVar,
  regression,
  normalPdf,
  normalCdf,
  normalCdfRange,
  normalInv,
  binomPmf,
  binomCdf,
  binomInv,
  poissonPmf,
  poissonCdf,
  poissonInv,
  erfc,
  lgamma,
  integrate,
  differentiate,
  solve,
  CalcError,
} from '../../src/core';

describe('Statistik mit einer Variablen', () => {
  it('Kennwerte einer einfachen Datenreihe', () => {
    const s = oneVar([1, 2, 3, 4, 5]);
    expect(s.n).toBe(5);
    expect(s.sum).toBe(15);
    expect(s.sumSq).toBe(55);
    expect(s.mean).toBe(3);
    expect(s.popVar).toBe(2);
    expect(s.popSd).toBeCloseTo(Math.SQRT2, 14);
    expect(s.sampleVar).toBe(2.5);
    expect(s.sampleSd).toBeCloseTo(1.5811388301, 9);
    expect([s.min, s.q1, s.median, s.q3, s.max]).toEqual([1, 1.5, 3, 4.5, 5]);
  });
  it('gerade Anzahl von Werten', () => {
    const s = oneVar([7, 1, 3, 5, 9, 11]);
    expect(s.median).toBe(6);
    expect(s.q1).toBe(3);
    expect(s.q3).toBe(9);
    expect(s.mean).toBe(6);
  });
  it('mit Häufigkeiten', () => {
    const s = oneVar([1, 2, 3], [2, 3, 5]);
    expect(s.n).toBe(10);
    expect(s.sum).toBe(23);
    expect(s.mean).toBe(2.3);
    expect(s.median).toBe(2.5);
    expect(s.q1).toBe(2);
    expect(s.q3).toBe(3);
    expect(s.popVar).toBeCloseTo(0.61, 12);
    // identisch zur ausgeschriebenen Liste
    const t = oneVar([1, 1, 2, 2, 2, 3, 3, 3, 3, 3]);
    expect(t.sampleSd).toBeCloseTo(s.sampleSd, 12);
  });
  it('ein einzelner Wert', () => {
    const s = oneVar([4]);
    expect(s.mean).toBe(4);
    expect(s.popSd).toBe(0);
    expect(Number.isNaN(s.sampleSd)).toBe(true);
    expect(s.median).toBe(4);
  });
  it('Fehlerfälle', () => {
    expect(() => oneVar([])).toThrow(/keine Daten/);
    expect(() => oneVar([1, 2], [1, -1])).toThrow(/negativ/);
    expect(() => oneVar([1, 2], [0, 0])).toThrow(CalcError);
  });
});

describe('Statistik mit zwei Variablen und Regression', () => {
  const xs = [1, 2, 3, 4, 5];
  const ys = [2, 4, 5, 4, 5];
  it('Kennwerte', () => {
    const s = twoVar(xs, ys);
    expect(s.n).toBe(5);
    expect(s.meanX).toBe(3);
    expect(s.meanY).toBe(4);
    expect(s.sumXY).toBe(66);
    expect(s.sumX2).toBe(55);
    expect(s.sumY2).toBe(86);
    expect(s.sampleSdY).toBeCloseTo(1.2247448714, 9);
    expect([s.minX, s.maxX, s.minY, s.maxY]).toEqual([1, 5, 2, 5]);
  });
  it('lineare Regression y = a + b·x', () => {
    const r = regression('linear', xs, ys);
    expect(r.a).toBeCloseTo(2.2, 12);
    expect(r.b).toBeCloseTo(0.6, 12);
    expect(r.r).toBeCloseTo(0.7745966692, 9);
    expect(r.predictY(6)).toBeCloseTo(5.8, 12);
    expect(r.predictX(4)[0]).toBeCloseTo(3, 12);
  });
  it('perfekte lineare Abhängigkeit', () => {
    const r = regression('linear', [0, 1, 2], [1, 3, 5]);
    expect(r.a).toBeCloseTo(1, 12);
    expect(r.b).toBeCloseTo(2, 12);
    expect(r.r).toBeCloseTo(1, 12);
    expect(regression('linear', [0, 1, 2], [5, 3, 1]).r).toBeCloseTo(-1, 12);
  });
  it('quadratische Regression', () => {
    const x = [-2, -1, 0, 1, 2, 3];
    const r = regression(
      'quadratic',
      x,
      x.map((t) => 1 + 2 * t + 3 * t * t),
    );
    expect(r.a).toBeCloseTo(1, 9);
    expect(r.b).toBeCloseTo(2, 9);
    expect(r.c).toBeCloseTo(3, 9);
    expect(r.r).toBeNull();
    expect(r.r2).toBeCloseTo(1, 12);
    expect(r.predictY(10)).toBeCloseTo(321, 6);
    const back = r.predictX(6).sort((p, q) => p - q);
    expect(back[0]).toBeCloseTo(-5 / 3, 8);
    expect(back[1]).toBeCloseTo(1, 8);
  });
  it('logarithmische Regression y = a + b·ln(x)', () => {
    const x = [1, 2, 4, 8];
    const r = regression(
      'log',
      x,
      x.map((t) => 2 + 3 * Math.log(t)),
    );
    expect(r.a).toBeCloseTo(2, 10);
    expect(r.b).toBeCloseTo(3, 10);
    expect(r.r).toBeCloseTo(1, 10);
    expect(r.predictX(2 + 3 * Math.log(5))[0]).toBeCloseTo(5, 9);
  });
  it('e-Funktion y = a·e^(b·x)', () => {
    const x = [0, 1, 2, 3];
    const r = regression(
      'exp',
      x,
      x.map((t) => 2 * Math.exp(0.5 * t)),
    );
    expect(r.a).toBeCloseTo(2, 10);
    expect(r.b).toBeCloseTo(0.5, 10);
    expect(r.predictY(4)).toBeCloseTo(2 * Math.exp(2), 8);
    expect(r.predictX(2 * Math.exp(1))[0]).toBeCloseTo(2, 9);
  });
  it('Exponentialfunktion y = a·b^x', () => {
    const x = [0, 1, 2, 3];
    const r = regression(
      'abexp',
      x,
      x.map((t) => 3 * 2 ** t),
    );
    expect(r.a).toBeCloseTo(3, 10);
    expect(r.b).toBeCloseTo(2, 10);
    expect(r.predictY(5)).toBeCloseTo(96, 8);
    expect(r.predictX(48)[0]).toBeCloseTo(4, 9);
  });
  it('Potenzfunktion y = a·x^b', () => {
    const x = [1, 2, 3, 4];
    const r = regression(
      'power',
      x,
      x.map((t) => 2 * t ** 1.5),
    );
    expect(r.a).toBeCloseTo(2, 10);
    expect(r.b).toBeCloseTo(1.5, 10);
    expect(r.predictX(2 * 9 ** 1.5)[0]).toBeCloseTo(9, 8);
  });
  it('inverse Regression y = a + b/x', () => {
    const x = [1, 2, 4, 5];
    const r = regression(
      'inverse',
      x,
      x.map((t) => 1 + 4 / t),
    );
    expect(r.a).toBeCloseTo(1, 10);
    expect(r.b).toBeCloseTo(4, 10);
    expect(r.predictY(8)).toBeCloseTo(1.5, 10);
    expect(r.predictX(3)[0]).toBeCloseTo(2, 10);
  });
  it('Regression mit Häufigkeiten entspricht ausgeschriebenen Daten', () => {
    const a = regression('linear', [1, 2, 3], [1, 3, 2], [2, 1, 3]);
    const b = regression('linear', [1, 1, 2, 3, 3, 3], [1, 1, 3, 2, 2, 2]);
    expect(a.a).toBeCloseTo(b.a, 12);
    expect(a.b).toBeCloseTo(b.b, 12);
    expect(a.r!).toBeCloseTo(b.r!, 12);
  });
  it('Fehlerfälle', () => {
    expect(() => regression('log', [-1, 2, 3], [1, 2, 3])).toThrow(/positiv/);
    expect(() => regression('exp', [1, 2, 3], [1, 0, 3])).toThrow(/positiv/);
    expect(() => regression('linear', [1], [1])).toThrow(/mindestens 2/);
    expect(() => regression('quadratic', [1, 2], [1, 2])).toThrow(/mindestens 3/);
    expect(() => regression('linear', [2, 2, 2], [1, 2, 3])).toThrow(/gleich/);
    expect(() => regression('inverse', [0, 1, 2], [1, 2, 3])).toThrow(CalcError);
    expect(() => twoVar([1, 2], [1])).toThrow(/gleich viele/);
  });
});

describe('Normalverteilung (gegen Tabellenwerte)', () => {
  it('Verteilungsfunktion Φ(z)', () => {
    const table: Array<[number, number]> = [
      [0, 0.5],
      [0.5, 0.6914624613],
      [1, 0.8413447461],
      [1.5, 0.9331927987],
      [1.96, 0.9750021049],
      [2, 0.9772498681],
      [2.58, 0.9950599842],
      [3, 0.9986501020],
      [-1, 0.1586552539],
      [-1.645, 0.0499849055],
      [-3, 0.001349898032],
    ];
    for (const [z, p] of table) expect(normalCdf(z), `Φ(${z})`).toBeCloseTo(p, 10);
  });
  it('weit im Schwanz bleibt die relative Genauigkeit erhalten', () => {
    expect(normalCdf(-6) / 9.865876450377e-10).toBeCloseTo(1, 9);
    expect(normalCdf(-10) / 7.619853024160e-24).toBeCloseTo(1, 8);
    expect(normalCdf(8)).toBe(1 - normalCdf(-8));
  });
  it('Dichte', () => {
    expect(normalPdf(0)).toBeCloseTo(0.3989422804, 10);
    expect(normalPdf(1)).toBeCloseTo(0.2419707245, 10);
    expect(normalPdf(100, 100, 15)).toBeCloseTo(0.02659615203, 10);
  });
  it('Intervallwahrscheinlichkeiten (Sigma-Regeln)', () => {
    expect(normalCdfRange(-1, 1)).toBeCloseTo(0.6826894921, 10);
    expect(normalCdfRange(-2, 2)).toBeCloseTo(0.9544997361, 10);
    expect(normalCdfRange(-3, 3)).toBeCloseTo(0.9973002039, 10);
    expect(normalCdfRange(85, 115, 100, 15)).toBeCloseTo(0.6826894921, 10);
    expect(normalCdfRange(-Infinity, 1.96)).toBeCloseTo(0.9750021049, 10);
    expect(normalCdfRange(2, Infinity)).toBeCloseTo(0.02275013195, 10);
  });
  it('Quantile (invers)', () => {
    expect(normalInv(0.5)).toBeCloseTo(0, 12);
    expect(normalInv(0.975)).toBeCloseTo(1.959963985, 9);
    expect(normalInv(0.95)).toBeCloseTo(1.644853627, 9);
    expect(normalInv(0.05)).toBeCloseTo(-1.644853627, 9);
    expect(normalInv(0.99)).toBeCloseTo(2.326347874, 9);
    expect(normalInv(0.001)).toBeCloseTo(-3.090232306, 9);
    expect(normalInv(0.975, 100, 15)).toBeCloseTo(129.3994598, 6);
    for (const p of [1e-8, 0.01, 0.3, 0.77, 0.9999]) expect(normalCdf(normalInv(p)) / p).toBeCloseTo(1, 10);
  });
  it('Fehlerfälle', () => {
    expect(() => normalCdf(1, 0, 0)).toThrow(/σ/);
    expect(() => normalPdf(1, 0, -1)).toThrow(/σ/);
    expect(() => normalInv(0)).toThrow(/zwischen 0 und 1/);
    expect(() => normalInv(1.2)).toThrow(CalcError);
    expect(() => normalCdfRange(2, 1)).toThrow(/untere Grenze/);
  });
  it('erfc und lgamma', () => {
    expect(erfc(0)).toBe(1);
    expect(erfc(0.5)).toBeCloseTo(0.4795001222, 10);
    expect(erfc(2.5) / 4.069520174450e-4).toBeCloseTo(1, 10);
    expect(erfc(-1)).toBeCloseTo(1.842700793, 9);
    expect(lgamma(1)).toBeCloseTo(0, 12);
    expect(lgamma(5)).toBeCloseTo(Math.log(24), 12);
    expect(lgamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 12);
    expect(lgamma(101)).toBeCloseTo(363.73937555556347, 9);
  });
});

describe('Binomialverteilung', () => {
  it('Einzelwahrscheinlichkeiten', () => {
    expect(binomPmf(3, 10, 0.5)).toBeCloseTo(0.1171875, 14);
    expect(binomPmf(0, 5, 0.2)).toBeCloseTo(0.32768, 14);
    expect(binomPmf(5, 5, 0.2)).toBeCloseTo(0.00032, 14);
    expect(binomPmf(2, 6, 1 / 6)).toBeCloseTo(0.200938786, 9);
    expect(binomPmf(7, 20, 0.3)).toBeCloseTo(0.1642619852, 9);
    expect(binomPmf(11, 10, 0.5)).toBe(0);
    expect(binomPmf(0, 10, 0)).toBe(1);
    expect(binomPmf(10, 10, 1)).toBe(1);
  });
  it('kumulierte Wahrscheinlichkeiten', () => {
    expect(binomCdf(3, 10, 0.5)).toBeCloseTo(0.171875, 14);
    expect(binomCdf(10, 20, 0.5)).toBeCloseTo(0.588098526, 9);
    expect(binomCdf(2, 6, 1 / 6)).toBeCloseTo(0.9377143347, 9);
    expect(binomCdf(20, 20, 0.5)).toBe(1);
    expect(binomCdf(-1, 20, 0.5)).toBe(0);
    expect(binomCdf(50, 100, 0.5)).toBeCloseTo(0.5397946187, 9);
  });
  it('große n (über Logarithmen)', () => {
    expect(binomPmf(5000, 10000, 0.5)).toBeCloseTo(0.0079786461, 9);
    let s = 0;
    for (let k = 0; k <= 2000; k++) s += binomPmf(k, 2000, 0.3);
    expect(s).toBeCloseTo(1, 9);
  });
  it('invers', () => {
    expect(binomInv(0.5, 10, 0.5)).toBe(5);
    expect(binomInv(0.171875, 10, 0.5)).toBe(3);
    expect(binomInv(0.18, 10, 0.5)).toBe(4);
    expect(binomInv(0.95, 20, 0.3)).toBe(9);
    expect(binomInv(1, 10, 0.5)).toBe(10);
  });
  it('Fehlerfälle', () => {
    expect(() => binomPmf(1, 10, 1.5)).toThrow(/zwischen 0 und 1/);
    expect(() => binomPmf(1, -1, 0.5)).toThrow(/natürliche Zahl/);
    expect(() => binomPmf(1.5, 10, 0.5)).toThrow(/ganzzahlig/);
    expect(() => binomCdf(1, 2.5, 0.5)).toThrow(CalcError);
  });
});

describe('Poisson-Verteilung', () => {
  it('Einzelwahrscheinlichkeiten', () => {
    expect(poissonPmf(2, 3)).toBeCloseTo(0.2240418077, 10);
    expect(poissonPmf(0, 2)).toBeCloseTo(0.1353352832, 10);
    expect(poissonPmf(5, 5)).toBeCloseTo(0.1754673698, 10);
    expect(poissonPmf(0, 0)).toBe(1);
    expect(poissonPmf(30, 25)).toBeCloseTo(0.04541278513, 9);
  });
  it('kumulierte Wahrscheinlichkeiten', () => {
    expect(poissonCdf(2, 3)).toBeCloseTo(0.4231900811, 10);
    expect(poissonCdf(0, 2)).toBeCloseTo(0.1353352832, 10);
    expect(poissonCdf(10, 5)).toBeCloseTo(0.9863047314, 10);
    expect(poissonCdf(-1, 5)).toBe(0);
  });
  it('invers', () => {
    expect(poissonInv(0.5, 3)).toBe(3);
    expect(poissonInv(0.4231900811, 3)).toBe(2);
    expect(poissonInv(0.99, 5)).toBe(11);
    expect(poissonInv(0, 5)).toBe(0);
  });
  it('Fehlerfälle', () => {
    expect(() => poissonPmf(1, -1)).toThrow(/negativ/);
    expect(() => poissonPmf(1.5, 2)).toThrow(/ganzzahlig/);
    expect(() => poissonInv(1, 2)).toThrow(CalcError);
  });
});

describe('Numerische Verfahren direkt', () => {
  it('Integration', () => {
    expect(integrate((x) => x * x, 0, 3)).toBeCloseTo(9, 12);
    expect(integrate(Math.sin, 0, Math.PI)).toBeCloseTo(2, 12);
    expect(integrate((x) => 1 / Math.sqrt(x), 0, 1)).toBeCloseTo(2, 6);
    expect(integrate((x) => Math.exp(-x * x), -8, 8)).toBeCloseTo(Math.sqrt(Math.PI), 12);
    expect(integrate((x) => Math.abs(x - 0.3), 0, 1)).toBeCloseTo(0.29, 10);
    expect(integrate((x) => x, 1, 1)).toBe(0);
    expect(integrate((x) => Math.cos(50 * x), 0, 1)).toBeCloseTo(Math.sin(50) / 50, 11);
  });
  it('Ableitung', () => {
    expect(differentiate((x) => x ** 3, 2)).toBeCloseTo(12, 9);
    expect(differentiate(Math.exp, 0)).toBeCloseTo(1, 10);
    expect(differentiate(Math.sqrt, 4)).toBeCloseTo(0.25, 10);
    expect(differentiate((x) => 5, 3)).toBe(0);
    expect(differentiate(Math.sin, 1000)).toBeCloseTo(Math.cos(1000), 7);
  });
  it('Nullstellensuche', () => {
    expect(solve((x) => x * x - 2, 1).root).toBeCloseTo(Math.SQRT2, 12);
    expect(solve((x) => x * x - 2, -1).root).toBeCloseTo(-Math.SQRT2, 12);
    expect(solve((x) => Math.cos(x) - x, 0).root).toBeCloseTo(0.7390851332151607, 12);
    expect(solve((x) => (x - 3) ** 3, 0).root).toBeCloseTo(3, 4);
    expect(solve((x) => Math.log(x) - 1, 5).root).toBeCloseTo(Math.E, 10);
    expect(() => solve((x) => x * x + 1, 0)).toThrow(/keine Lösung/);
  });
});
