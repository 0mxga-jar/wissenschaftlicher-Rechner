import { describe, it, expect } from 'vitest';
import { CONSTANTS, getConstant, UNIT_CATEGORIES, convertUnit } from '../../src/core';

const c = (id: string): number => getConstant(id).value;
/** relative Abweichung */
const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe('Physikalische Konstanten (CODATA 2018) sind untereinander konsistent', () => {
  const pi = Math.PI;
  const checks: Array<[string, () => number, () => number, number]> = [
    ['ħ = h/2π', () => c('hbar'), () => c('h') / (2 * pi), 1e-9],
    ['ε₀·μ₀·c² = 1', () => c('eps0') * c('mu0') * c('c0') ** 2, () => 1, 1e-9],
    ['Z₀ = μ₀·c', () => c('Z0'), () => c('mu0') * c('c0'), 1e-9],
    ['α = e²/(4π·ε₀·ħ·c)', () => c('alpha'), () => c('qe') ** 2 / (4 * pi * c('eps0') * c('hbar') * c('c0')), 1e-9],
    ['F = NA·e', () => c('F'), () => c('NA') * c('qe'), 1e-9],
    ['R = NA·k', () => c('R'), () => c('NA') * c('k'), 1e-9],
    ['Φ₀ = h/2e', () => c('Phi0'), () => c('h') / (2 * c('qe')), 1e-9],
    ['G₀ = 2e²/h', () => c('G0'), () => (2 * c('qe') ** 2) / c('h'), 1e-9],
    ['KJ = 2e/h', () => c('KJ'), () => (2 * c('qe')) / c('h'), 1e-9],
    ['RK = h/e²', () => c('RK'), () => c('h') / c('qe') ** 2, 1e-9],
    ['μB = e·ħ/2mₑ', () => c('muB'), () => (c('qe') * c('hbar')) / (2 * c('me')), 1e-9],
    ['μN = e·ħ/2mp', () => c('muN'), () => (c('qe') * c('hbar')) / (2 * c('mp')), 1e-9],
    ['a₀ = ħ/(mₑ·c·α)', () => c('a0'), () => c('hbar') / (c('me') * c('c0') * c('alpha')), 1e-9],
    ['rₑ = α²·a₀', () => c('re'), () => c('alpha') ** 2 * c('a0'), 1e-9],
    ['λc = h/(mₑ·c)', () => c('lambdaC'), () => c('h') / (c('me') * c('c0')), 1e-9],
    ['λcp = h/(mp·c)', () => c('lambdaCp'), () => c('h') / (c('mp') * c('c0')), 1e-9],
    ['λcn = h/(mn·c)', () => c('lambdaCn'), () => c('h') / (c('mn') * c('c0')), 1e-9],
    ['R∞ = α²·mₑ·c/2h', () => c('Rinf'), () => (c('alpha') ** 2 * c('me') * c('c0')) / (2 * c('h')), 1e-9],
    ['c₁ = 2π·h·c²', () => c('c1'), () => 2 * pi * c('h') * c('c0') ** 2, 1e-9],
    ['c₂ = h·c/k', () => c('c2'), () => (c('h') * c('c0')) / c('k'), 1e-9],
    ['σ = 2π⁵k⁴/(15h³c²)', () => c('sigma'), () => (2 * pi ** 5 * c('k') ** 4) / (15 * c('h') ** 3 * c('c0') ** 2), 1e-9],
    ['Vm = R·T₀/p₀', () => c('Vm'), () => (c('R') * c('t0')) / c('atm'), 1e-9],
    ['γp = 2μp/ħ', () => c('gammaP'), () => (2 * c('mup')) / c('hbar'), 1e-9],
    ['u·NA ≈ 1 g/mol', () => c('u') * c('NA'), () => 1e-3, 1e-8],
    ['mp/mₑ', () => c('mp') / c('me'), () => 1836.15267343, 1e-9],
    ['mn/mₑ', () => c('mn') / c('me'), () => 1838.68366173, 1e-9],
    ['mμ/mₑ', () => c('mmu') / c('me'), () => 206.768283, 1e-8],
    ['μₑ/μB (g-Faktor)', () => c('mue') / c('muB'), () => -1.00115965218, 1e-9],
    ['μp/μN', () => c('mup') / c('muN'), () => 2.79284734463, 1e-9],
    ['μn/μN', () => c('mun') / c('muN'), () => -1.91304273, 1e-8],
    ['μμ/μB', () => c('mumu') / c('muB'), () => -4.84197047e-3, 1e-8],
  ];
  for (const [name, a, b, tol] of checks) {
    it(name, () => expect(rel(a(), b())).toBeLessThan(tol));
  }
  it('exakt festgelegte Werte', () => {
    expect(c('c0')).toBe(299792458);
    expect(c('h')).toBe(6.62607015e-34);
    expect(c('qe')).toBe(1.602176634e-19);
    expect(c('k')).toBe(1.380649e-23);
    expect(c('NA')).toBe(6.02214076e23);
    expect(c('g')).toBe(9.80665);
    expect(c('atm')).toBe(101325);
    expect(c('G')).toBe(6.6743e-11);
  });
  it('jede Konstante hat eine eindeutige Kennung, Namen und Gruppe', () => {
    expect(new Set(CONSTANTS.map((k) => k.id)).size).toBe(CONSTANTS.length);
    expect(CONSTANTS.length).toBe(42);
    for (const k of CONSTANTS) {
      expect(k.name.length).toBeGreaterThan(3);
      expect(Number.isFinite(k.value)).toBe(true);
    }
  });
});

describe('Einheitenumrechnung', () => {
  it('Hin- und Rückumrechnung ergibt in jeder Größenart den Ausgangswert', () => {
    for (const cat of UNIT_CATEGORIES) {
      for (const a of cat.units) {
        for (const b of cat.units) {
          const back = convertUnit(convertUnit(12.5, a.id, b.id), b.id, a.id);
          expect(Math.abs(back - 12.5), `${a.id} → ${b.id}`).toBeLessThan(1e-9);
        }
      }
    }
  });
  it('bekannte Umrechnungen', () => {
    expect(convertUnit(1, 'in', 'cm')).toBeCloseTo(2.54, 12);
    expect(convertUnit(1, 'mile', 'km')).toBeCloseTo(1.609344, 12);
    expect(convertUnit(1, 'ft', 'm')).toBeCloseTo(0.3048, 12);
    expect(convertUnit(1, 'nmile', 'm')).toBeCloseTo(1852, 9);
    expect(convertUnit(1, 'acre', 'm2')).toBeCloseTo(4046.8564224, 7);
    expect(convertUnit(1, 'galUS', 'L')).toBeCloseTo(3.785411784, 9);
    expect(convertUnit(1, 'galUK', 'L')).toBeCloseTo(4.54609, 9);
    expect(convertUnit(1, 'lb', 'kg')).toBeCloseTo(0.45359237, 12);
    expect(convertUnit(1, 'oz', 'g')).toBeCloseTo(28.349523125, 9);
    expect(convertUnit(90, 'kmh', 'ms')).toBeCloseTo(25, 12);
    expect(convertUnit(1, 'atm', 'hPa')).toBeCloseTo(1013.25, 9);
    expect(convertUnit(760, 'mmHg', 'atm')).toBeCloseTo(1, 6);
    expect(convertUnit(1, 'cal', 'J')).toBeCloseTo(4.184, 12);
    expect(convertUnit(1, 'kWh', 'J')).toBeCloseTo(3.6e6, 6);
    expect(convertUnit(1, 'PS', 'kW')).toBeCloseTo(0.73549875, 10);
    expect(convertUnit(-40, 'degC', 'degF')).toBeCloseTo(-40, 12);
    expect(convertUnit(98.6, 'degF', 'degC')).toBeCloseTo(37, 10);
    expect(convertUnit(300, 'K', 'degC')).toBeCloseTo(26.85, 10);
    expect(convertUnit(0, 'K', 'degF')).toBeCloseTo(-459.67, 9);
    expect(convertUnit(1, 'day', 'min')).toBeCloseTo(1440, 9);
    expect(convertUnit(1, 'ha', 'm2')).toBeCloseTo(10000, 9);
  });
  it('unterschiedliche Größenarten lassen sich nicht umrechnen', () => {
    expect(() => convertUnit(1, 'm', 'kg')).toThrow(/Größenart/);
    expect(() => convertUnit(1, 'xyz', 'kg')).toThrow(/Unbekannte Einheit/);
  });
});
