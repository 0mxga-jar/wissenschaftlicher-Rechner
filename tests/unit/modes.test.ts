import { describe, it, expect } from 'vitest';
import {
  Real,
  Mat,
  Vec,
  Cx,
  calculate,
  formatReal,
  formatScalar,
  DEFAULT_FORMAT,
  solvePolynomial,
  quadraticVertex,
  solveInequality,
  solveLinear,
  evalBaseN,
  formatBaseN,
  computeSheet,
  shiftFormula,
  buildTable,
  parse,
  CalcError,
  type Scalar,
  type Interval,
} from '../../src/core';
import { ctx, show, err } from './helpers';

const CPLX = (angle: 'DEG' | 'RAD' | 'GRA' = 'DEG') => ctx({ complex: true, angle });
const cshow = (src: string, angle: 'DEG' | 'RAD' | 'GRA' = 'DEG') => show(src, 'exact', CPLX(angle));

describe('Komplexe Zahlen', () => {
  const cases: Array<[string, string]> = [
    ['(1+2i)(3−4i)', '11+2i'],
    ['(1+i)/(1−i)', 'i'],
    ['i^2', '−1'],
    ['i^3', '−i'],
    ['i^4', '1'],
    ['1/i', '−i'],
    ['(1+i)^2', '2i'],
    ['(1+i)/2', '1/2+1/2i'],
    ['sqrt(-4)', '2i'],
    ['sqrt(-2)', '√2i'],
    ['sqrt(i)', '√2/2+√2/2i'],
    ['sqrt(3+4i)', '2+i'],
    ['Abs(3+4i)', '5'],
    ['abs(1+i)', '√2'],
    ['Arg(1+i)', '45'],
    ['Arg(i)', '90'],
    ['Arg(-1)', '180'],
    ['Arg(-1−i)', '−135'],
    ['Conjg(2+3i)', '2−3i'],
    ['Re(2+3i)', '2'],
    ['Im(2+3i)', '3'],
    ['2∠30', '√3+i'],
    ['1∠90', 'i'],
    ['2∠180', '−2'],
    ['(2+3i)−(2+3i)', '0'],
    ['(2+3i)+(1−3i)', '3'],
    ['(-8)^(1/3)', '−2'],
    ['(1+2i)^-1', '1/5−2/5i'],
    ['2i×3i', '−6'],
    ['sum(i^x;1;4)', '0'],
  ];
  for (const [src, want] of cases) {
    it(`${src} = ${want}`, () => expect(cshow(src)).toBe(want));
  }
  it('Polarform der Ausgabe', () => {
    const c = CPLX();
    const z = calculate('1+i', c) as Scalar;
    expect(formatScalar(z, DEFAULT_FORMAT, 'exact', 'polar', 'DEG')).toBe('√2∠45');
    const w = calculate('-2i', c) as Scalar;
    expect(formatScalar(w, DEFAULT_FORMAT, 'exact', 'polar', 'DEG')).toBe('2∠−90');
    expect(formatScalar(z, DEFAULT_FORMAT, 'decimal', 'polar', 'RAD')).toBe('1,414213562∠0,7853981634');
  });
  it('Euler-Identität und komplexe Funktionen', () => {
    expect(cshow('e^(i×pi)', 'RAD')).toBe('−1');
    expect(show('ln(-1)', 'decimal', CPLX('RAD'))).toBe('3,141592654i');
    expect(show('e^(1+i)', 'decimal', CPLX('RAD'))).toBe('1,468693940+2,287355287i'.replace('1,468693940', '1,46869394'));
    expect(show('(1+i)^0.5', 'decimal', CPLX('RAD'))).toBe('1,098684113+0,4550898606i');
    expect(show('sin(i)', 'decimal', CPLX('RAD'))).toBe('1,175201194i');
  });
  it('Argument im Bogenmaß', () => {
    expect(cshow('Arg(1+i)', 'RAD')).toBe('π/4');
    expect(cshow('2∠(pi/2)', 'RAD')).toBe('2i');
  });
  it('komplexe Zahl mal Matrix ist nicht erlaubt', () => {
    const c = ctx({ complex: true, mats: { A: Mat.fromNumbers([[1]]) } });
    expect(err('i×MatA', c).code).toBe('ARG');
  });
});

describe('Matrizen', () => {
  const mctx = () =>
    ctx({
      mats: {
        A: Mat.fromNumbers([
          [1, 2],
          [3, 4],
        ]),
        B: Mat.fromNumbers([
          [0, 1],
          [1, 0],
        ]),
        C: Mat.fromNumbers([
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 10],
        ]),
        D: Mat.fromNumbers([
          [2, 0, 0, 1],
          [0, 3, 0, 0],
          [0, 0, 4, 0],
          [1, 0, 0, 5],
        ]),
      },
    });
  const m = (src: string): string[][] => {
    const v = calculate(src, mctx());
    if (v.kind !== 'matrix') throw new Error('keine Matrix');
    return v.d.map((r) => r.map((x) => formatReal(x, DEFAULT_FORMAT, 'exact')));
  };
  it('Addition und Subtraktion', () => {
    expect(m('MatA+MatB')).toEqual([
      ['1', '3'],
      ['4', '4'],
    ]);
    expect(m('MatA−MatA')).toEqual([
      ['0', '0'],
      ['0', '0'],
    ]);
  });
  it('Multiplikation', () => {
    expect(m('MatA×MatB')).toEqual([
      ['2', '1'],
      ['4', '3'],
    ]);
    expect(m('MatB×MatA')).toEqual([
      ['3', '4'],
      ['1', '2'],
    ]);
    expect(m('2MatA')).toEqual([
      ['2', '4'],
      ['6', '8'],
    ]);
    expect(m('MatA÷2')).toEqual([
      ['1/2', '1'],
      ['3/2', '2'],
    ]);
    expect(m('MatA×Identity(2)')).toEqual(m('MatA'));
  });
  it('Determinante', () => {
    const c = mctx();
    expect(show('det(MatA)', 'exact', c)).toBe('−2');
    expect(show('det(MatB)', 'exact', c)).toBe('−1');
    expect(show('det(MatC)', 'exact', c)).toBe('−3');
    expect(show('det(MatD)', 'exact', c)).toBe('108');
    expect(show('det(MatA×MatB)', 'exact', c)).toBe('2');
    expect(show('det(Identity(4))', 'exact', c)).toBe('1');
  });
  it('Inverse (exakt mit Brüchen)', () => {
    expect(m('MatA^-1')).toEqual([
      ['−2', '1'],
      ['3/2', '−1/2'],
    ]);
    expect(m('Inv(MatA)')).toEqual(m('MatA^-1'));
    expect(m('MatC×MatC^-1')).toEqual([
      ['1', '0', '0'],
      ['0', '1', '0'],
      ['0', '0', '1'],
    ]);
    expect(m('MatD^-1×MatD')).toEqual(m('Identity(4)'));
  });
  it('Transponierte und Potenzen', () => {
    expect(m('Trn(MatA)')).toEqual([
      ['1', '3'],
      ['2', '4'],
    ]);
    expect(m('MatA^2')).toEqual([
      ['7', '10'],
      ['15', '22'],
    ]);
    expect(m('MatA^3')).toEqual([
      ['37', '54'],
      ['81', '118'],
    ]);
    expect(m('MatA^0')).toEqual(m('Identity(2)'));
    expect(m('MatA^-2')).toEqual(m('(MatA^-1)^2'));
    expect(m('MatA^{2}')).toEqual(m('MatA×MatA'));
  });
  it('Zeilenstufenform', () => {
    expect(m('Rref(MatA)')).toEqual(m('Identity(2)'));
  });
  it('Fehlerfälle', () => {
    const c = mctx();
    c.mats.S = Mat.fromNumbers([
      [1, 2],
      [2, 4],
    ]);
    expect(err('MatA+MatC', c).code).toBe('DIM');
    expect(err('MatA×MatC', c).code).toBe('DIM');
    expect(err('MatA^0.5', c).code).toBe('ARG');
    expect(err('MatA+1', c).code).toBe('ARG');
    expect(() => calculate('Inv(MatA−MatA)', c)).toThrow(/nicht invertierbar/);
    c.mats.A = Mat.fromNumbers([[1, 2, 3]]);
    expect(err('det(MatA)', c).code).toBe('DIM');
  });
});

describe('Vektoren', () => {
  const vctx = () =>
    ctx({
      vcts: {
        A: Vec.fromNumbers([1, 2, 3]),
        B: Vec.fromNumbers([4, 5, 6]),
        C: Vec.fromNumbers([3, 4]),
        D: Vec.fromNumbers([1, 0]),
      },
    });
  const v = (src: string): string[] => {
    const r = calculate(src, vctx());
    if (r.kind !== 'vector') throw new Error('kein Vektor');
    return r.d.map((x) => formatReal(x, DEFAULT_FORMAT, 'exact'));
  };
  it('Addition, Subtraktion, Vielfache', () => {
    expect(v('VctA+VctB')).toEqual(['5', '7', '9']);
    expect(v('VctB−VctA')).toEqual(['3', '3', '3']);
    expect(v('2VctA')).toEqual(['2', '4', '6']);
    expect(v('VctA÷2')).toEqual(['1/2', '1', '3/2']);
    expect(v('-VctC')).toEqual(['−3', '−4']);
  });
  it('Skalarprodukt', () => {
    expect(show('VctA•VctB', 'exact', vctx())).toBe('32');
    expect(show('DotP(VctA;VctB)', 'exact', vctx())).toBe('32');
    expect(show('VctC•VctD', 'exact', vctx())).toBe('3');
  });
  it('Kreuzprodukt', () => {
    expect(v('VctA×VctB')).toEqual(['−3', '6', '−3']);
    expect(v('CrossP(VctB;VctA)')).toEqual(['3', '−6', '3']);
    expect(v('VctC×VctD')).toEqual(['0', '0', '−4']);
  });
  it('Betrag, Winkel, Einheitsvektor', () => {
    expect(show('Abs(VctA)', 'exact', vctx())).toBe('√14');
    expect(show('Abs(VctC)', 'exact', vctx())).toBe('5');
    expect(show('Angle(VctD;VctC−VctC+VctD×0+VctD)', 'exact', vctx())).toBe('0');
    expect(v('UnitV(VctC)')).toEqual(['3/5', '4/5']);
    const c = vctx();
    c.vcts.A = Vec.fromNumbers([1, 0]);
    c.vcts.B = Vec.fromNumbers([1, 1]);
    expect(show('Angle(VctA;VctB)', 'exact', c)).toBe('45');
    c.vcts.B = Vec.fromNumbers([0, 5]);
    expect(show('Angle(VctA;VctB)', 'exact', c)).toBe('90');
    c.angle = 'RAD';
    expect(show('Angle(VctA;VctB)', 'exact', c)).toBe('π/2');
  });
  it('Fehlerfälle', () => {
    expect(err('VctA+VctC', vctx()).code).toBe('DIM');
    expect(err('VctA•VctC', vctx()).code).toBe('DIM');
    expect(err('UnitV(VctA−VctA)', vctx()).code).toBe('DIV0');
    expect(err('VctA+1', vctx()).code).toBe('ARG');
  });
  it('Matrix mal Vektor', () => {
    const c = vctx();
    c.mats.A = Mat.fromNumbers([
      [0, -1],
      [1, 0],
    ]);
    const r = calculate('MatA×VctC', c) as Vec;
    expect(r.d.map((x) => x.n)).toEqual([-4, 3]);
  });
});

describe('Polynomgleichungen', () => {
  const R = (...a: Array<number | [number, number]>) => a.map((x) => (Array.isArray(x) ? Real.rat(x[0], x[1]) : Real.num(x)));
  const roots = (...a: Array<number | [number, number]>) =>
    solvePolynomial(R(...a)).map((z) => formatScalar(z, DEFAULT_FORMAT, 'exact'));
  it('quadratische Gleichungen – exakt', () => {
    expect(roots(1, -5, 6)).toEqual(['2', '3']);
    expect(roots(1, 0, -2)).toEqual(['−√2', '√2']);
    expect(roots(1, -2, 1)).toEqual(['1']);
    expect(roots(2, 3, -2)).toEqual(['−2', '1/2']);
    expect(roots(1, 1, -1)).toEqual(['(−1−√5)/2', '(√5−1)/2'].map((s) => s.replace('(−1−√5)/2', '−(1+√5)/2')));
    expect(roots(1, 0, 0)).toEqual(['0']);
    expect(roots([1, 2], [-1, 3], 0)).toEqual(['0', '2/3']);
  });
  it('quadratische Gleichungen mit komplexen Lösungen', () => {
    expect(roots(1, 1, 1)).toEqual(['−1/2+√3/2i', '−1/2−√3/2i']);
    expect(roots(1, 2, 5)).toEqual(['−1+2i', '−1−2i']);
    expect(roots(1, 0, 4)).toEqual(['2i', '−2i']);
  });
  it('kubische Gleichungen', () => {
    expect(roots(1, -6, 11, -6)).toEqual(['1', '2', '3']);
    expect(roots(2, -3, -3, 2)).toEqual(['−1', '1/2', '2']);
    expect(roots(1, 0, 0, -1)).toEqual(['1', '−1/2+√3/2i', '−1/2−√3/2i']);
    expect(roots(1, 0, -2, 0)).toEqual(['−√2', '0', '√2']);
    expect(roots(1, -3, 3, -1)).toEqual(['1']);
    const numeric = solvePolynomial(R(1, 0, 0, -2));
    expect(numeric).toHaveLength(3);
    expect((numeric[0] as Real).n).toBeCloseTo(Math.cbrt(2), 12);
    expect((numeric[1] as Cx).re.n).toBeCloseTo(-Math.cbrt(2) / 2, 12);
    expect((numeric[1] as Cx).im.n).toBeCloseTo((Math.cbrt(2) * Math.sqrt(3)) / 2, 12);
  });
  it('Gleichungen vierten Grades', () => {
    expect(roots(1, 0, -5, 0, 4)).toEqual(['−2', '−1', '1', '2']);
    expect(roots(1, 0, 0, 0, -1)).toEqual(['−1', '1', 'i', '−i']);
    expect(roots(1, 0, -5, 0, 6)).toEqual(['−√3', '−√2', '√2', '√3']);
    expect(roots(1, -3, -3, 11, -6)).toEqual(['−2', '1', '3']);
    expect(roots(1, -10, 35, -50, 24)).toEqual(['1', '2', '3', '4']);
    const z = solvePolynomial(R(1, 0, 0, 0, 4));
    expect(z.map((r) => formatScalar(r, DEFAULT_FORMAT, 'decimal'))).toEqual(['−1+i', '−1−i', '1+i', '1−i']);
    const g = solvePolynomial(R(1, 1, 1, 1, 1));
    expect(g).toHaveLength(4);
    for (const r of g) expect(Math.hypot((r as Cx).re.n, (r as Cx).im.n)).toBeCloseTo(1, 12);
  });
  it('nicht rationale Koeffizienten werden numerisch gelöst', () => {
    const z = solvePolynomial([Real.ONE, Real.approx(-Math.PI - 1), Real.PI]);
    expect((z[0] as Real).n).toBeCloseTo(1, 12);
    expect((z[1] as Real).n).toBeCloseTo(Math.PI, 12);
  });
  it('führender Koeffizient 0 ist ein Fehler', () => {
    expect(() => solvePolynomial(R(0, 1, 2))).toThrow(CalcError);
  });
  it('Scheitelpunkt', () => {
    const v = quadraticVertex(Real.int(1), Real.int(-4), Real.int(3));
    expect([v.x.n, v.y.n, v.kind]).toEqual([2, -1, 'min']);
    const w = quadraticVertex(Real.int(-2), Real.int(4), Real.int(1));
    expect([w.x.n, w.y.n, w.kind]).toEqual([1, 3, 'max']);
    const u = quadraticVertex(Real.int(3), Real.int(1), Real.int(0));
    expect(formatReal(u.x, DEFAULT_FORMAT, 'exact')).toBe('−1/6');
    expect(formatReal(u.y, DEFAULT_FORMAT, 'exact')).toBe('−1/12');
  });
});

describe('Lineare Gleichungssysteme', () => {
  const sys = (A: number[][], b: number[]) => {
    const r = solveLinear(
      A.map((row) => row.map((x) => Real.num(x))),
      b.map((x) => Real.num(x)),
    );
    return typeof r === 'string' ? r : r.map((x) => formatReal(x, DEFAULT_FORMAT, 'exact'));
  };
  it('2 Unbekannte', () => {
    expect(
      sys(
        [
          [1, 1],
          [1, -1],
        ],
        [3, 1],
      ),
    ).toEqual(['2', '1']);
    expect(
      sys(
        [
          [2, 3],
          [4, -1],
        ],
        [1, 1],
      ),
    ).toEqual(['2/7', '1/7']);
  });
  it('3 und 4 Unbekannte', () => {
    expect(
      sys(
        [
          [1, 1, 1],
          [2, -1, 1],
          [1, 2, -1],
        ],
        [6, 3, 2],
      ),
    ).toEqual(['1', '2', '3']);
    expect(
      sys(
        [
          [1, 1, 1, 1],
          [1, -1, 1, -1],
          [1, 2, 3, 4],
          [2, 1, 0, 1],
        ],
        [10, -2, 30, 8],
      ),
    ).toEqual(['1', '2', '3', '4']);
  });
  it('keine bzw. unendlich viele Lösungen', () => {
    expect(
      sys(
        [
          [1, 1],
          [2, 2],
        ],
        [1, 3],
      ),
    ).toBe('none');
    expect(
      sys(
        [
          [1, 1],
          [2, 2],
        ],
        [1, 2],
      ),
    ).toBe('infinite');
    expect(
      sys(
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        [1, 2, 4],
      ),
    ).toBe('none');
  });
  it('Pivotisierung bei führender Null', () => {
    expect(
      sys(
        [
          [0, 1],
          [1, 0],
        ],
        [5, 7],
      ),
    ).toEqual(['7', '5']);
  });
});

describe('Ungleichungen', () => {
  const R = (...a: number[]) => a.map((x) => Real.num(x));
  const fmt = (iv: Interval[]) =>
    iv
      .map((i) => {
        const lo = i.lo ? formatReal(i.lo, DEFAULT_FORMAT, 'exact') : '−∞';
        const hi = i.hi ? formatReal(i.hi, DEFAULT_FORMAT, 'exact') : '∞';
        return `${i.loClosed ? '[' : '('}${lo};${hi}${i.hiClosed ? ']' : ')'}`;
      })
      .join(' ∪ ');
  it('quadratisch', () => {
    expect(fmt(solveInequality(R(1, -5, 6), '>'))).toBe('(−∞;2) ∪ (3;∞)');
    expect(fmt(solveInequality(R(1, -5, 6), '<'))).toBe('(2;3)');
    expect(fmt(solveInequality(R(1, -5, 6), '>='))).toBe('(−∞;2] ∪ [3;∞)');
    expect(fmt(solveInequality(R(1, -5, 6), '<='))).toBe('[2;3]');
    expect(fmt(solveInequality(R(-1, 0, 2), '>'))).toBe('(−√2;√2)');
  });
  it('ohne reelle Nullstellen', () => {
    expect(fmt(solveInequality(R(1, 0, 1), '>'))).toBe('(−∞;∞)');
    expect(fmt(solveInequality(R(1, 0, 1), '<'))).toBe('');
    expect(fmt(solveInequality(R(1, 0, 1), '<='))).toBe('');
  });
  it('doppelte Nullstelle', () => {
    expect(fmt(solveInequality(R(1, -2, 1), '<='))).toBe('[1;1]');
    expect(fmt(solveInequality(R(1, -2, 1), '>'))).toBe('(−∞;1) ∪ (1;∞)');
    expect(fmt(solveInequality(R(1, -2, 1), '>='))).toBe('(−∞;∞)');
    expect(fmt(solveInequality(R(1, -2, 1), '<'))).toBe('');
  });
  it('Grad 3 und 4', () => {
    expect(fmt(solveInequality(R(1, 0, -1, 0), '>'))).toBe('(−1;0) ∪ (1;∞)');
    expect(fmt(solveInequality(R(1, 0, -1, 0), '<='))).toBe('(−∞;−1] ∪ [0;1]');
    expect(fmt(solveInequality(R(1, 0, -5, 0, 4), '<'))).toBe('(−2;−1) ∪ (1;2)');
    expect(fmt(solveInequality(R(1, 0, -5, 0, 4), '>='))).toBe('(−∞;−2] ∪ [−1;1] ∪ [2;∞)');
    // (x−1)²(x−2) ≥ 0  →  {1} ∪ [2; ∞)
    expect(fmt(solveInequality(R(1, -4, 5, -2), '>='))).toBe('[1;1] ∪ [2;∞)');
    // (x−1)²(x+2)(x−3) ≤ 0  →  [−2; 3]
    expect(fmt(solveInequality(R(1, -3, -3, 11, -6), '<='))).toBe('[−2;3]');
    expect(fmt(solveInequality(R(1, -3, -3, 11, -6), '<'))).toBe('(−2;1) ∪ (1;3)');
  });
});

describe('Basis-N', () => {
  it('Zahlen in verschiedenen Basen', () => {
    expect(evalBaseN('FF', 16)).toBe(255);
    expect(evalBaseN('1010+101', 2)).toBe(15);
    expect(evalBaseN('17', 8)).toBe(15);
    expect(evalBaseN('hFF+d1', 10)).toBe(256);
    expect(evalBaseN('b101+o17', 10)).toBe(20);
    expect(evalBaseN('FFFFFFFF', 16)).toBe(-1);
    expect(evalBaseN('(2+3)×4', 10)).toBe(20);
    expect(evalBaseN('Ans+1', 10, 41)).toBe(42);
  });
  it('ganzzahlige Division und Vorzeichen', () => {
    expect(evalBaseN('7÷2', 10)).toBe(3);
    expect(evalBaseN('−7÷2', 10)).toBe(-3);
    expect(evalBaseN('Neg(5)', 10)).toBe(-5);
    expect(evalBaseN('3−5', 10)).toBe(-2);
  });
  it('logische Operatoren', () => {
    expect(evalBaseN('A and 6', 16)).toBe(2);
    expect(evalBaseN('5 or 3', 10)).toBe(7);
    expect(evalBaseN('5 xor 3', 10)).toBe(6);
    expect(evalBaseN('5 xnor 3', 10)).toBe(-7);
    expect(evalBaseN('Not(0)', 10)).toBe(-1);
    expect(evalBaseN('1 or 2 and 3', 10)).toBe(3);
    expect(evalBaseN('1100 and 1010 or 1', 2)).toBe(9);
  });
  it('Ausgabe', () => {
    expect(formatBaseN(255, 16)).toBe('FF');
    expect(formatBaseN(8, 8)).toBe('10');
    expect(formatBaseN(5, 2)).toBe('101');
    expect(formatBaseN(-1, 16)).toBe('FFFFFFFF');
    expect(formatBaseN(-1, 2)).toBe('1'.repeat(32));
    expect(formatBaseN(-5, 10)).toBe('−5');
    expect(formatBaseN(-8, 8)).toBe('37777777770');
  });
  it('Fehlerfälle', () => {
    expect(() => evalBaseN('2147483647+1', 10)).toThrow(/32 Bit/);
    expect(() => evalBaseN('8', 8)).toThrow(/OCT-System nicht erlaubt/);
    expect(() => evalBaseN('102', 2)).toThrow(/BIN-System/);
    expect(() => evalBaseN('1÷0', 10)).toThrow(/Division durch 0/);
    expect(() => evalBaseN('', 10)).toThrow(/leer/);
    expect(() => evalBaseN('1+', 10)).toThrow(/unvollständig/);
    expect(() => evalBaseN('1,5', 10)).toThrow(/nicht erlaubt/);
    expect(() => evalBaseN('4294967296', 10)).toThrow(/32 Bit/);
  });
});

describe('Tabellenkalkulation und Wertetabelle', () => {
  const grid = (cells: Record<string, string>): string[][] => {
    const g = Array.from({ length: 6 }, () => Array.from({ length: 5 }, () => ''));
    for (const [k, v] of Object.entries(cells)) g[parseInt(k.slice(1), 10) - 1][k.charCodeAt(0) - 65] = v;
    return g;
  };
  const val = (res: ReturnType<typeof computeSheet>, name: string) => {
    const c = res[parseInt(name.slice(1), 10) - 1][name.charCodeAt(0) - 65];
    if (c === null) return null;
    return 'error' in c ? c.error.code : formatReal(c.value, DEFAULT_FORMAT, 'exact');
  };
  it('Formeln mit Zellbezügen', () => {
    const r = computeSheet(grid({ A1: '5', A2: '7', A3: '=A1+A2', B1: '=Summe(A1:A3)', B2: '=Mittel(A1:A2)', B3: '=2A3^2' }), ctx());
    expect(val(r, 'A3')).toBe('12');
    expect(val(r, 'B1')).toBe('24');
    expect(val(r, 'B2')).toBe('6');
    expect(val(r, 'B3')).toBe('288');
    expect(val(r, 'C1')).toBe(null);
  });
  it('Min, Max und Bereiche über mehrere Spalten', () => {
    const r = computeSheet(grid({ A1: '3', B1: '9', A2: '1/2', B2: '-4', C1: '=Min(A1:B2)', C2: '=Max(A1:B2)', C3: '=Summe(A1:B2;10)' }), ctx());
    expect(val(r, 'C1')).toBe('−4');
    expect(val(r, 'C2')).toBe('9');
    expect(val(r, 'C3')).toBe('37/2');
  });
  it('Abhängigkeiten in beliebiger Reihenfolge und leere Zellen als 0', () => {
    const r = computeSheet(grid({ A1: '=B1+1', B1: '=C1+1', C1: '=D5+1' }), ctx());
    expect(val(r, 'A1')).toBe('3');
  });
  it('Zirkelbezug und Fehlerfortpflanzung', () => {
    const r = computeSheet(grid({ A1: '=B1', B1: '=A1', C1: '1/0', C2: '=C1+1', D1: '=A1+1' }), ctx());
    expect(val(r, 'A1')).toBe('CIRC');
    expect(val(r, 'B1')).toBe('CIRC');
    expect(val(r, 'C1')).toBe('DIV0');
    expect(val(r, 'C2')).toBe('DIV0');
    expect(val(r, 'D1')).toBe('CIRC');
  });
  it('Variablen und Funktionen in Zellen', () => {
    const r = computeSheet(grid({ A1: 'sqrt(16)', A2: '=A1×A ', A3: '=sin(30)+A1' }), ctx({ vars: { A: Real.int(3) } }));
    expect(val(r, 'A1')).toBe('4');
    expect(val(r, 'A2')).toBe('12');
    expect(val(r, 'A3')).toBe('9/2');
  });
  it('Formeln beim Kopieren verschieben', () => {
    expect(shiftFormula('=A1+B2', 0, 1)).toBe('=A2+B3');
    expect(shiftFormula('=Summe(A1:A3)', 1, 0)).toBe('=Summe(B1:B3)');
    expect(shiftFormula('=E45', 1, 1)).toBe('=E45');
  });
  it('Wertetabelle', () => {
    const f = parse('x^2');
    const g = parse('1/x');
    const rows = buildTable(f, g, Real.int(-1), Real.int(1), Real.rat(1, 2), ctx());
    expect(rows.map((r) => r.x.n)).toEqual([-1, -0.5, 0, 0.5, 1]);
    expect(rows.map((r) => (r.f as Real).n)).toEqual([1, 0.25, 0, 0.25, 1]);
    expect(rows[2].g).toBeInstanceOf(CalcError);
    expect((rows[3].g as Real).n).toBe(2);
    expect(buildTable(f, null, Real.int(1), Real.int(5), Real.int(1), ctx())).toHaveLength(5);
    expect(buildTable(f, null, Real.int(0), Real.int(1), Real.rat(1, 10), ctx())).toHaveLength(11);
  });
  it('Wertetabelle – Fehlerfälle', () => {
    const f = parse('x');
    expect(() => buildTable(f, null, Real.int(1), Real.int(5), Real.ZERO, ctx())).toThrow(/Schrittweite/);
    expect(() => buildTable(f, null, Real.int(1), Real.int(1000), Real.int(1), ctx())).toThrow(/höchstens/);
    expect(() => buildTable(f, null, Real.int(5), Real.int(1), Real.int(1), ctx())).toThrow(CalcError);
  });
});
