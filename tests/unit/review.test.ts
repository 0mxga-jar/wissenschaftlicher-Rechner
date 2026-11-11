/** Regressionstests zu den Befunden der unabhängigen Code-Durchsicht. */
import { describe, it, expect } from 'vitest';
import {
  Real,
  Cx,
  parse,
  solveFor,
  solvePolynomial,
  solveInequality,
  integrate,
  differentiate,
  solve,
  formatScalar,
  formatReal,
  DEFAULT_FORMAT,
  evalBaseN,
  binomInv,
  binomSf,
  poissonSf,
  regression,
  type Interval,
} from '../../src/core';
import { ctx, show, dec, num } from './helpers';

const R = (...a: number[]) => a.map((x) => Real.num(x));
const roots = (...a: number[]) => solvePolynomial(R(...a)).map((z) => formatScalar(z, DEFAULT_FORMAT, 'exact'));
const droots = (...a: number[]) => solvePolynomial(R(...a)).map((z) => formatScalar(z, DEFAULT_FORMAT, 'decimal'));
const fmt = (iv: Interval[]) =>
  iv
    .map((i) => {
      const lo = i.lo ? formatReal(i.lo, DEFAULT_FORMAT, 'exact') : '−∞';
      const hi = i.hi ? formatReal(i.hi, DEFAULT_FORMAT, 'exact') : '∞';
      return `${i.loClosed ? '[' : '('}${lo};${hi}${i.hiClosed ? ']' : ')'}`;
    })
    .join(' ∪ ');

describe('Polynomlöser: mehrfache Nullstellen', () => {
  it('dreifache und vierfache Nullstellen', () => {
    expect(roots(1, 3, 3, 1)).toEqual(['−1']);
    expect(roots(1, -6, 12, -8)).toEqual(['2']);
    expect(roots(1, -4, 6, -4, 1)).toEqual(['1']);
    expect(roots(16, -32, 24, -8, 1)).toEqual(['1/2']);
    expect(roots(1, 0, 0, 0)).toEqual(['0']);
  });
  it('Quadrate irreduzibler quadratischer Faktoren', () => {
    // (x²−2x−1)²
    expect(roots(1, -4, 2, 4, 1)).toEqual(['1−√2', '1+√2']);
    // (x²+x+1)²
    expect(roots(1, 2, 3, 2, 1)).toEqual(['−1/2+√3/2i', '−1/2−√3/2i']);
    // (x−1)²(x²+1)
    expect(roots(1, -2, 2, -2, 1)).toEqual(['1', 'i', '−i']);
    // (x−1)²(x−2)
    expect(roots(1, -4, 5, -2)).toEqual(['1', '2']);
  });
  it('alle Produkte kleiner ganzzahliger Linearfaktoren (Grad 3 und 4)', () => {
    const mul = (p: number[], r: number): number[] => {
      const out = new Array(p.length + 1).fill(0);
      p.forEach((c, i) => {
        out[i] += c;
        out[i + 1] -= c * r;
      });
      return out;
    };
    for (let a = -3; a <= 3; a++) {
      for (let b = a; b <= 3; b++) {
        for (let c = b; c <= 3; c++) {
          const want = [...new Set([a, b, c])].map((v) => (v < 0 ? `−${-v}` : String(v)));
          expect(roots(...mul(mul(mul([1], a), b), c)), `${a},${b},${c}`).toEqual(want);
          for (let d = c; d <= 3; d++) {
            const w4 = [...new Set([a, b, c, d])].map((v) => (v < 0 ? `−${-v}` : String(v)));
            expect(roots(...mul(mul(mul(mul([2], a), b), c), d)), `${a},${b},${c},${d}`).toEqual(w4);
          }
        }
      }
    }
  });
  it('numerische Doppelnullstelle (nicht rationale Koeffizienten)', () => {
    const z = solvePolynomial([Real.ONE, Real.approx(-2 * Math.SQRT2), Real.int(2)]);
    expect(z).toHaveLength(1);
    expect((z[0] as Real).n).toBeCloseTo(Math.SQRT2, 12);
    // (x−π)³ numerisch
    const p = Math.PI;
    const t = solvePolynomial([Real.ONE, Real.approx(-3 * p), Real.approx(3 * p * p), Real.approx(-p * p * p)]);
    expect(t).toHaveLength(1);
    expect((t[0] as Real).n).toBeCloseTo(p, 9);
  });
  it('Ungleichungen mit mehrfachen Nullstellen', () => {
    expect(fmt(solveInequality(R(1, 3, 3, 1), '>'))).toBe('(−1;∞)');
    expect(fmt(solveInequality(R(1, -4, 6, -4, 1), '<='))).toBe('[1;1]');
    expect(fmt(solveInequality(R(1, -6, 12, -8), '>='))).toBe('[2;∞)');
    expect(fmt(solveInequality(R(1, -4, 6, -4, 1), '>'))).toBe('(−∞;1) ∪ (1;∞)');
  });
});

describe('Polynomlöser: stark unterschiedliche Größenordnungen', () => {
  it('kleine Nullstellen neben großen Koeffizienten', () => {
    expect(droots(1, 0, -3e12, 2e12)).toEqual(['−1732051,141', '0,6666666667', '1732050,474']);
    expect(roots(1, 0, 0, -1e30)[0]).toBe('1×10¹⁰');
    expect(droots(1, 0, 1e7, -1)[0]).toBe('1×10⁻⁷');
    expect(droots(1, -1e10, 1)).toEqual(['1×10⁻¹⁰', '1×10¹⁰']);
    expect(droots(1, 1e8, 1)).toEqual(['−100000000', '−1×10⁻⁸']);
  });
  it('exakte Wurzelausdrücke bleiben auch bei Auslöschung numerisch richtig', () => {
    // √(10¹⁴+1) − 10⁷ = 1/(√(10¹⁴+1) + 10⁷) ≈ 5·10⁻⁸ (in double-Arithmetik gingen 14 Stellen verloren)
    expect(dec('sqrt(10^14+1)−10^7')).toBe('5×10⁻⁸');
    expect(dec('(sqrt(10^12+4)−10^6)/2')).toBe('1×10⁻⁶');
    expect(num('(1+sqrt(2))^20×(1−sqrt(2))^20')).toBe(1);
    expect(num('sqrt(2)×sqrt(2)−2')).toBe(0);
    expect(dec('1000001×pi−1000000×pi−pi+1/10^15')).toBe('1×10⁻¹⁵');
  });
});

describe('Numerische Ableitung: Schrittweite', () => {
  const RAD = () => ctx({ angle: 'RAD' });
  it('nahe an Polstellen, Knicken und Rändern des Definitionsbereichs', () => {
    expect(num('diff(1/x;0.001)')).toBeCloseTo(-1e6, 2);
    expect(num('diff(Intg(x);1.999)')).toBe(0);
    expect(num('diff(abs(x);0.001)')).toBeCloseTo(1, 10);
    expect(num('diff(sqrt(x);0.002)')).toBeCloseTo(0.5 / Math.sqrt(0.002), 6);
    expect(num('diff(ln(x);0.0001)')).toBeCloseTo(1e4, 3);
  });
  it('tan nahe 90° (DEG)', () => {
    const want = (Math.PI / 180) / Math.cos((89.9 * Math.PI) / 180) ** 2;
    expect(num('diff(tan(x);89.9)') / want).toBeCloseTo(1, 7);
  });
  it('kurze Perioden bei großem x', () => {
    expect(num('diff(sin(x);1ᴇ6)', RAD())).toBeCloseTo(Math.cos(1e6), 6);
    expect(num('diff(sin(x);360000)')).toBeCloseTo(Math.PI / 180, 9);
  });
  it('Standardfälle bleiben genau', () => {
    expect(differentiate((x) => x ** 3, 2)).toBeCloseTo(12, 9);
    expect(differentiate(Math.exp, 0)).toBeCloseTo(1, 10);
    expect(differentiate((x) => x * x - 3 * x, 1.5)).toBe(0);
    expect(differentiate((x) => x ** 5, 100)).toBeCloseTo(5e8, 0);
    expect(differentiate((x) => 1e-20 * x, 3)).toBeCloseTo(1e-20, 30);
  });
});

describe('SOLVE: große und kleine Größenordnungen', () => {
  const s = (src: string, x0 = 0, c = ctx()) => solveFor(parse(src), 'x', x0, c).root.n;
  it('lineare Gleichungen mit großen Konstanten', () => {
    expect(s('3ᴇ8=x×5ᴇ-7')).toBeCloseTo(6e14, -3);
    expect(s('2x=6.02ᴇ23') / 3.01e23).toBeCloseTo(1, 12);
    expect(s('x+5=1ᴇ15')).toBeCloseTo(1e15 - 5, 0);
    expect(s('3.3ᴇ-19=6.626ᴇ-34x') / (3.3e-19 / 6.626e-34)).toBeCloseTo(1, 10);
    expect(s('1/x=1ᴇ8') / 1e-8).toBeCloseTo(1, 9);
  });
  it('keine unkonvergierten Zwischenwerte', () => {
    expect(s('e^x=1ᴇ-40')).toBeCloseTo(Math.log(1e-40), 8);
    expect(s('10^x=1ᴇ-50')).toBeCloseTo(-50, 8);
  });
  it('doppelte Nullstellen werden sauber gerundet', () => {
    expect(s('x^2−2x+1', 3)).toBe(1);
    expect(s('sin(x)=1', 50)).toBe(90);
    expect(solve((x) => (x - 3) ** 2, 0).root).toBeCloseTo(3, 6);
  });
  it('Polstellen werden nicht als Lösung ausgegeben', () => {
    expect(() => s('1/x=0', 1)).toThrow(/Keine Lösung/);
    expect(() => s('tan(x)=1ᴇ300', 80)).toThrow();
  });
});

describe('Integration: Nullergebnisse, Singularitäten, Divergenz', () => {
  const RAD = () => ctx({ angle: 'RAD' });
  it('Integrale mit Wert 0 liefern exakt 0', () => {
    expect(num('integral(cos(x);0;pi)', RAD())).toBe(0);
    expect(num('integral(sin(x);0;2pi)', RAD())).toBe(0);
    expect(num('integral(sin(x);0;360)')).toBe(0);
    expect(num('integral(x^3;-2;2)')).toBe(0);
  });
  it('integrierbare Singularität an der Grenze 0', () => {
    expect(integrate((x) => 1 / Math.sqrt(x), 0, 1)).toBeCloseTo(2, 9);
    expect(integrate((x) => Math.log(x), 0, 1)).toBeCloseTo(-1, 9);
    expect(integrate((x) => 1 / Math.sqrt(-x), -4, 0)).toBeCloseTo(4, 9);
  });
  it('divergente Integrale werden gemeldet', () => {
    expect(() => integrate(Math.tan, 0, Math.PI / 2)).toThrow();
    expect(() => integrate((x) => 1 / x, 0, 1)).toThrow();
    expect(() => integrate((x) => 1 / (x * x), -1, 1)).toThrow();
  });
});

describe('weitere Befunde', () => {
  it('komplexe Potenzen mit großem ganzzahligem Exponenten bleiben exakt', () => {
    const c = ctx({ complex: true });
    expect(show('i^1000', 'exact', c)).toBe('1');
    expect(show('i^257', 'exact', c)).toBe('i');
    expect(show('(1+i)^20', 'exact', c)).toBe('−1024');
    expect(show('i^-1001', 'exact', c)).toBe('−i');
  });
  it('gemischter Bruch mit negativem ganzen Anteil', () => {
    expect(show('mixed(-1;2;3)')).toBe('−5/3');
    expect(show('mixed(1;2;3)')).toBe('5/3');
    expect(show('mixed(0;2;3)')).toBe('2/3');
  });
  it('Basis-N: kleinste 32-Bit-Zahl ist eingebbar', () => {
    expect(evalBaseN('−2147483648', 10)).toBe(-2147483648);
    expect(evalBaseN('-2147483648+1', 10)).toBe(-2147483647);
    expect(() => evalBaseN('2147483648', 10)).toThrow(/32 Bit/);
    expect(() => evalBaseN('2147483648−1', 10)).toThrow(/32 Bit/);
    expect(evalBaseN('80000000', 16)).toBe(-2147483648);
  });
  it('Verteilungen: obere Schwänze und Grenzfälle', () => {
    expect(binomInv(1, 1000, 0.5)).toBe(1000);
    expect(binomSf(60, 60, 0.5)).toBeCloseTo(0.5 ** 60, 30);
    expect(binomSf(0, 10, 0.3)).toBe(1);
    expect(binomSf(8, 10, 0.5)).toBeCloseTo(56 / 1024, 14);
    expect(poissonSf(0, 3)).toBe(1);
    expect(poissonSf(3, 3)).toBeCloseTo(1 - 0.42319008112684353, 12);
    // weit im Schwanz: P(X ≥ 60) ≈ P(X = 60)·(1 + 3/61 + …)
    const p60 = (Math.exp(-3) * 3 ** 60) / [...Array(60)].reduce((acc: number, _v, i) => acc * (i + 1), 1);
    expect(poissonSf(60, 3) / p60).toBeGreaterThan(1.04);
    expect(poissonSf(60, 3) / p60).toBeLessThan(1.06);
  });
  it('Regression ignoriert Zeilen mit Häufigkeit 0', () => {
    const r = regression('log', [-1, 1, 2, 4], [9, 2, 2 + 3 * Math.log(2), 2 + 3 * Math.log(4)], [0, 1, 1, 1]);
    expect(r.b).toBeCloseTo(3, 10);
  });
  it('exakte Winkel werden vor der Umrechnung exakt reduziert', () => {
    expect(dec('sin(10^22+30)')).toBe(dec('sin(310)'));
    // 10²⁰ ≡ 280 (mod 360), also cos(340°) = cos(20°)
    expect(dec('cos(10^20+60)')).toBe('0,9396926208');
    expect(dec('sin(123456789012345678901×pi+pi/7)', ctx({ angle: 'RAD' }))).toBe(dec('sin(pi+pi/7)', ctx({ angle: 'RAD' })));
  });
  it('Matrizen mit sehr kleinen (nicht exakten) Einträgen sind nicht automatisch singulär', () => {
    const c = ctx({ complex: false });
    c.mats.A = { kind: 'matrix', rows: 2, cols: 2, d: [[Real.approx(1e-20), Real.ZERO], [Real.ZERO, Real.approx(2e-20)]] } as never;
    expect(num('det(MatA)', c)).toBeCloseTo(2e-40, 50);
  });
});
void Cx;

describe('Sitzung: Befunde der Durchsicht', () => {
  it('STO und M+ aktualisieren Ans; 10^x nach einer Ziffer multipliziert', async () => {
    const { CalcSession, editorKey } = await import('../../src/ui/session');
    const { createEditor, serialize } = await import('../../src/editor/model');
    const { calculate, createContext } = await import('../../src/core');
    const vars: Record<string, never> = {};
    const s = new CalcSession({
      evaluate: (src) => calculate(src, createContext({ vars })),
      onResult: (v) => {
        (vars as Record<string, unknown>).Ans = v;
      },
    });
    for (const c of '5') s.key(`t:${c}`);
    s.key('exe');
    for (const c of '3+4') s.key(`t:${c}`);
    s.record(s.valueOfInput(), '→A'); // entspricht STO
    s.key('t:+');
    s.key('t:1');
    s.key('exe');
    expect((s.shown!.value as Real).n).toBe(8);
    const ed = createEditor();
    editorKey(ed, 't:5');
    editorKey(ed, 'pow10');
    editorKey(ed, 't:2');
    expect(serialize(ed.root)).toBe('5*10^{2}');
    const ed2 = createEditor();
    editorKey(ed2, 'pow10');
    editorKey(ed2, 't:3');
    expect(serialize(ed2.root)).toBe('10^{3}');
  });
  it('FACT bei zu großen Zahlen wirft nicht', async () => {
    const { CalcSession } = await import('../../src/ui/session');
    const { calculate, createContext } = await import('../../src/core');
    const s = new CalcSession({ evaluate: (src) => calculate(src, createContext()) });
    for (const c of '2') s.key(`t:${c}`);
    s.key('p:pow');
    for (const c of '50') s.key(`t:${c}`);
    s.key('exe');
    s.key('fact');
    expect(s.view).toBe('std');
  });
  it('programmatisch gesetzte Felder überstehen Speichern und Laden', async () => {
    const { CellForm } = await import('../../src/ui/form');
    const f = new CellForm();
    f.setGrid([['a', 'b']]);
    f.set('a', Real.rat(3, 7));
    f.set('b', Real.approx(Math.E));
    const g = new CellForm();
    g.restore(JSON.parse(JSON.stringify(f.snapshot())));
    expect(g.value('a')!.rat()!.toString()).toBe('3/7');
    expect(g.num('b')).toBe(Math.E);
  });
  it('vierfache numerische Nullstelle', () => {
    const p = Math.PI;
    const q = solvePolynomial([Real.ONE, Real.approx(-4 * p), Real.approx(6 * p * p), Real.approx(-4 * p ** 3), Real.approx(p ** 4)]);
    expect(q).toHaveLength(1);
    expect((q[0] as Real).n).toBeCloseTo(p, 9);
  });
});
