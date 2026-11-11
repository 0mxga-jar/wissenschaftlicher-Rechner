/** Physikalische Konstanten (CODATA 2018) und Einheitenumrechnung. */
import { CalcError } from './errors';

export interface PhysConst {
  id: string;
  symbol: string;
  name: string;
  value: number;
  unit: string;
  group: string;
}

export const CONST_GROUPS = ['Universell', 'Elektromagnetisch', 'Atom und Kern', 'Physikalisch-chemisch', 'Festgelegte Werte'];

export const CONSTANTS: PhysConst[] = [
  // Universell
  { id: 'c0', symbol: 'c₀', name: 'Lichtgeschwindigkeit im Vakuum', value: 299792458, unit: 'm/s', group: 'Universell' },
  { id: 'h', symbol: 'h', name: 'Planck-Konstante', value: 6.62607015e-34, unit: 'J·s', group: 'Universell' },
  { id: 'hbar', symbol: 'ħ', name: 'Reduzierte Planck-Konstante', value: 1.054571817e-34, unit: 'J·s', group: 'Universell' },
  { id: 'G', symbol: 'G', name: 'Gravitationskonstante', value: 6.6743e-11, unit: 'm³/(kg·s²)', group: 'Universell' },
  { id: 'eps0', symbol: 'ε₀', name: 'Elektrische Feldkonstante', value: 8.8541878128e-12, unit: 'F/m', group: 'Universell' },
  { id: 'mu0', symbol: 'μ₀', name: 'Magnetische Feldkonstante', value: 1.25663706212e-6, unit: 'N/A²', group: 'Universell' },
  { id: 'Z0', symbol: 'Z₀', name: 'Wellenwiderstand des Vakuums', value: 376.730313668, unit: 'Ω', group: 'Universell' },
  // Elektromagnetisch
  { id: 'qe', symbol: 'e', name: 'Elementarladung', value: 1.602176634e-19, unit: 'C', group: 'Elektromagnetisch' },
  { id: 'muB', symbol: 'μB', name: 'Bohrsches Magneton', value: 9.2740100783e-24, unit: 'J/T', group: 'Elektromagnetisch' },
  { id: 'muN', symbol: 'μN', name: 'Kernmagneton', value: 5.0507837461e-27, unit: 'J/T', group: 'Elektromagnetisch' },
  { id: 'Phi0', symbol: 'Φ₀', name: 'Magnetisches Flussquantum', value: 2.067833848e-15, unit: 'Wb', group: 'Elektromagnetisch' },
  { id: 'G0', symbol: 'G₀', name: 'Leitwertquantum', value: 7.748091729e-5, unit: 'S', group: 'Elektromagnetisch' },
  { id: 'KJ', symbol: 'KJ', name: 'Josephson-Konstante', value: 483597.8484e9, unit: 'Hz/V', group: 'Elektromagnetisch' },
  { id: 'RK', symbol: 'RK', name: 'Von-Klitzing-Konstante', value: 25812.80745, unit: 'Ω', group: 'Elektromagnetisch' },
  // Atom und Kern
  { id: 'mp', symbol: 'mp', name: 'Ruhemasse des Protons', value: 1.67262192369e-27, unit: 'kg', group: 'Atom und Kern' },
  { id: 'mn', symbol: 'mn', name: 'Ruhemasse des Neutrons', value: 1.67492749804e-27, unit: 'kg', group: 'Atom und Kern' },
  { id: 'me', symbol: 'me', name: 'Ruhemasse des Elektrons', value: 9.1093837015e-31, unit: 'kg', group: 'Atom und Kern' },
  { id: 'mmu', symbol: 'mμ', name: 'Ruhemasse des Myons', value: 1.883531627e-28, unit: 'kg', group: 'Atom und Kern' },
  { id: 'a0', symbol: 'a₀', name: 'Bohrscher Radius', value: 5.29177210903e-11, unit: 'm', group: 'Atom und Kern' },
  { id: 'alpha', symbol: 'α', name: 'Feinstrukturkonstante', value: 7.2973525693e-3, unit: '', group: 'Atom und Kern' },
  { id: 're', symbol: 'rₑ', name: 'Klassischer Elektronenradius', value: 2.8179403262e-15, unit: 'm', group: 'Atom und Kern' },
  { id: 'lambdaC', symbol: 'λc', name: 'Compton-Wellenlänge des Elektrons', value: 2.42631023867e-12, unit: 'm', group: 'Atom und Kern' },
  { id: 'gammaP', symbol: 'γp', name: 'Gyromagnetisches Verhältnis des Protons', value: 2.6752218744e8, unit: '1/(s·T)', group: 'Atom und Kern' },
  { id: 'lambdaCp', symbol: 'λcp', name: 'Compton-Wellenlänge des Protons', value: 1.32140985539e-15, unit: 'm', group: 'Atom und Kern' },
  { id: 'lambdaCn', symbol: 'λcn', name: 'Compton-Wellenlänge des Neutrons', value: 1.31959090581e-15, unit: 'm', group: 'Atom und Kern' },
  { id: 'Rinf', symbol: 'R∞', name: 'Rydberg-Konstante', value: 10973731.56816, unit: '1/m', group: 'Atom und Kern' },
  { id: 'mup', symbol: 'μp', name: 'Magnetisches Moment des Protons', value: 1.41060679736e-26, unit: 'J/T', group: 'Atom und Kern' },
  { id: 'mue', symbol: 'μe', name: 'Magnetisches Moment des Elektrons', value: -9.2847647043e-24, unit: 'J/T', group: 'Atom und Kern' },
  { id: 'mun', symbol: 'μn', name: 'Magnetisches Moment des Neutrons', value: -9.6623651e-27, unit: 'J/T', group: 'Atom und Kern' },
  { id: 'mumu', symbol: 'μμ', name: 'Magnetisches Moment des Myons', value: -4.4904483e-26, unit: 'J/T', group: 'Atom und Kern' },
  // Physikalisch-chemisch
  { id: 'u', symbol: 'u', name: 'Atomare Masseneinheit', value: 1.6605390666e-27, unit: 'kg', group: 'Physikalisch-chemisch' },
  { id: 'F', symbol: 'F', name: 'Faraday-Konstante', value: 96485.33212, unit: 'C/mol', group: 'Physikalisch-chemisch' },
  { id: 'NA', symbol: 'NA', name: 'Avogadro-Konstante', value: 6.02214076e23, unit: '1/mol', group: 'Physikalisch-chemisch' },
  { id: 'k', symbol: 'k', name: 'Boltzmann-Konstante', value: 1.380649e-23, unit: 'J/K', group: 'Physikalisch-chemisch' },
  { id: 'Vm', symbol: 'Vm', name: 'Molares Volumen des idealen Gases (0 °C, 101,325 kPa)', value: 22.41396954e-3, unit: 'm³/mol', group: 'Physikalisch-chemisch' },
  { id: 'R', symbol: 'R', name: 'Universelle Gaskonstante', value: 8.314462618, unit: 'J/(mol·K)', group: 'Physikalisch-chemisch' },
  { id: 'c1', symbol: 'c₁', name: 'Erste Strahlungskonstante', value: 3.741771852e-16, unit: 'W·m²', group: 'Physikalisch-chemisch' },
  { id: 'c2', symbol: 'c₂', name: 'Zweite Strahlungskonstante', value: 1.438776877e-2, unit: 'm·K', group: 'Physikalisch-chemisch' },
  { id: 'sigma', symbol: 'σ', name: 'Stefan-Boltzmann-Konstante', value: 5.670374419e-8, unit: 'W/(m²·K⁴)', group: 'Physikalisch-chemisch' },
  // Festgelegte Werte
  { id: 'g', symbol: 'g', name: 'Normfallbeschleunigung', value: 9.80665, unit: 'm/s²', group: 'Festgelegte Werte' },
  { id: 'atm', symbol: 'atm', name: 'Normdruck', value: 101325, unit: 'Pa', group: 'Festgelegte Werte' },
  { id: 't0', symbol: 'T₀', name: 'Nullpunkt der Celsius-Skala', value: 273.15, unit: 'K', group: 'Festgelegte Werte' },
];

const CONST_MAP = new Map(CONSTANTS.map((c) => [c.id, c]));

export function getConstant(id: string): PhysConst {
  const c = CONST_MAP.get(id);
  if (!c) throw new CalcError('UNDEF', `Die Konstante „${id}“ ist nicht bekannt.`);
  return c;
}

// ───────────────────────────── Einheiten ─────────────────────────────

export interface Unit {
  id: string;
  label: string;
  name: string;
  /** Faktor zur SI-Basiseinheit der Kategorie */
  factor: number;
  /** Verschiebung (nur Temperatur): SI = wert·factor + offset */
  offset?: number;
}

export interface UnitCategory {
  id: string;
  name: string;
  units: Unit[];
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: 'length',
    name: 'Länge',
    units: [
      { id: 'mm', label: 'mm', name: 'Millimeter', factor: 1e-3 },
      { id: 'cm', label: 'cm', name: 'Zentimeter', factor: 1e-2 },
      { id: 'm', label: 'm', name: 'Meter', factor: 1 },
      { id: 'km', label: 'km', name: 'Kilometer', factor: 1e3 },
      { id: 'in', label: 'in', name: 'Zoll', factor: 0.0254 },
      { id: 'ft', label: 'ft', name: 'Fuß', factor: 0.3048 },
      { id: 'yd', label: 'yd', name: 'Yard', factor: 0.9144 },
      { id: 'mile', label: 'mi', name: 'Meile', factor: 1609.344 },
      { id: 'nmile', label: 'sm', name: 'Seemeile', factor: 1852 },
      { id: 'pc', label: 'pc', name: 'Parsec', factor: 3.0856775814913673e16 },
      { id: 'ly', label: 'Lj', name: 'Lichtjahr', factor: 9.4607304725808e15 },
    ],
  },
  {
    id: 'area',
    name: 'Fläche',
    units: [
      { id: 'cm2', label: 'cm²', name: 'Quadratzentimeter', factor: 1e-4 },
      { id: 'm2', label: 'm²', name: 'Quadratmeter', factor: 1 },
      { id: 'a', label: 'a', name: 'Ar', factor: 100 },
      { id: 'ha', label: 'ha', name: 'Hektar', factor: 1e4 },
      { id: 'km2', label: 'km²', name: 'Quadratkilometer', factor: 1e6 },
      { id: 'acre', label: 'acre', name: 'Acre', factor: 4046.8564224 },
    ],
  },
  {
    id: 'volume',
    name: 'Volumen',
    units: [
      { id: 'mL', label: 'ml', name: 'Milliliter', factor: 1e-6 },
      { id: 'L', label: 'l', name: 'Liter', factor: 1e-3 },
      { id: 'm3', label: 'm³', name: 'Kubikmeter', factor: 1 },
      { id: 'galUS', label: 'gal(US)', name: 'US-Gallone', factor: 3.785411784e-3 },
      { id: 'galUK', label: 'gal(UK)', name: 'Britische Gallone', factor: 4.54609e-3 },
    ],
  },
  {
    id: 'mass',
    name: 'Masse',
    units: [
      { id: 'g', label: 'g', name: 'Gramm', factor: 1e-3 },
      { id: 'kg', label: 'kg', name: 'Kilogramm', factor: 1 },
      { id: 't', label: 't', name: 'Tonne', factor: 1e3 },
      { id: 'oz', label: 'oz', name: 'Unze', factor: 0.028349523125 },
      { id: 'lb', label: 'lb', name: 'Pfund (lb)', factor: 0.45359237 },
    ],
  },
  {
    id: 'speed',
    name: 'Geschwindigkeit',
    units: [
      { id: 'ms', label: 'm/s', name: 'Meter pro Sekunde', factor: 1 },
      { id: 'kmh', label: 'km/h', name: 'Kilometer pro Stunde', factor: 1 / 3.6 },
      { id: 'mph', label: 'mph', name: 'Meilen pro Stunde', factor: 0.44704 },
      { id: 'kn', label: 'kn', name: 'Knoten', factor: 1852 / 3600 },
    ],
  },
  {
    id: 'pressure',
    name: 'Druck',
    units: [
      { id: 'Pa', label: 'Pa', name: 'Pascal', factor: 1 },
      { id: 'hPa', label: 'hPa', name: 'Hektopascal', factor: 100 },
      { id: 'kPa', label: 'kPa', name: 'Kilopascal', factor: 1e3 },
      { id: 'bar', label: 'bar', name: 'Bar', factor: 1e5 },
      { id: 'atm', label: 'atm', name: 'Physikalische Atmosphäre', factor: 101325 },
      { id: 'mmHg', label: 'mmHg', name: 'Millimeter Quecksilbersäule', factor: 133.322387415 },
      { id: 'psi', label: 'lbf/in²', name: 'Pfund pro Quadratzoll', factor: 6894.757293168 },
      { id: 'kgfcm2', label: 'kgf/cm²', name: 'Technische Atmosphäre', factor: 98066.5 },
    ],
  },
  {
    id: 'energy',
    name: 'Energie',
    units: [
      { id: 'J', label: 'J', name: 'Joule', factor: 1 },
      { id: 'kJ', label: 'kJ', name: 'Kilojoule', factor: 1e3 },
      { id: 'cal', label: 'cal', name: 'Kalorie', factor: 4.184 },
      { id: 'kcal', label: 'kcal', name: 'Kilokalorie', factor: 4184 },
      { id: 'kWh', label: 'kWh', name: 'Kilowattstunde', factor: 3.6e6 },
      { id: 'eV', label: 'eV', name: 'Elektronenvolt', factor: 1.602176634e-19 },
      { id: 'kgfm', label: 'kgf·m', name: 'Kilopondmeter', factor: 9.80665 },
    ],
  },
  {
    id: 'power',
    name: 'Leistung',
    units: [
      { id: 'W', label: 'W', name: 'Watt', factor: 1 },
      { id: 'kW', label: 'kW', name: 'Kilowatt', factor: 1e3 },
      { id: 'PS', label: 'PS', name: 'Pferdestärke (metrisch)', factor: 735.49875 },
      { id: 'hp', label: 'hp', name: 'Horsepower (mechanisch)', factor: 745.6998715822702 },
    ],
  },
  {
    id: 'temperature',
    name: 'Temperatur',
    units: [
      { id: 'degC', label: '°C', name: 'Grad Celsius', factor: 1, offset: 273.15 },
      { id: 'degF', label: '°F', name: 'Grad Fahrenheit', factor: 5 / 9, offset: 459.67 * (5 / 9) },
      { id: 'K', label: 'K', name: 'Kelvin', factor: 1, offset: 0 },
    ],
  },
  {
    id: 'time',
    name: 'Zeit',
    units: [
      { id: 's', label: 's', name: 'Sekunde', factor: 1 },
      { id: 'min', label: 'min', name: 'Minute', factor: 60 },
      { id: 'hr', label: 'h', name: 'Stunde', factor: 3600 },
      { id: 'day', label: 'd', name: 'Tag', factor: 86400 },
      { id: 'yr', label: 'a', name: 'Jahr (365,25 d)', factor: 31557600 },
    ],
  },
];

function findUnit(id: string): { unit: Unit; cat: UnitCategory } | null {
  for (const cat of UNIT_CATEGORIES) {
    const unit = cat.units.find((u) => u.id === id);
    if (unit) return { unit, cat };
  }
  return null;
}

export function unitLabel(id: string): string {
  return findUnit(id)?.unit.label ?? id;
}

/** Rechnet einen Wert von der Einheit `from` in die Einheit `to` um. */
export function convertUnit(value: number, from: string, to: string): number {
  const f = findUnit(from);
  const t = findUnit(to);
  if (!f || !t) throw new CalcError('UNDEF', 'Unbekannte Einheit.');
  if (f.cat.id !== t.cat.id) {
    throw new CalcError('ARG', `${f.unit.label} und ${t.unit.label} gehören nicht zur selben Größenart.`);
  }
  if (from === to) return value;
  if (f.cat.id === 'temperature') {
    // exakte Formeln für die gängigen Paare (vermeidet Rundungsrauschen)
    const toK = (v: number, id: string) => (id === 'degC' ? v + 273.15 : id === 'degF' ? ((v + 459.67) * 5) / 9 : v);
    if (from === 'degC' && to === 'degF') return (value * 9) / 5 + 32;
    if (from === 'degF' && to === 'degC') return ((value - 32) * 5) / 9;
    const k = toK(value, from);
    return to === 'degC' ? k - 273.15 : to === 'degF' ? (k * 9) / 5 - 459.67 : k;
  }
  return (value * f.unit.factor) / t.unit.factor;
}
