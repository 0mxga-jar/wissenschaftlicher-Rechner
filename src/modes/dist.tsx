/** Modus 7: Verteilungen (Normal-, Binomial-, Poisson-Verteilung). */
import type { ComponentChildren, VNode } from 'preact';
import {
  normalPdf,
  normalCdfRange,
  normalInv,
  binomPmf,
  binomCdf,
  binomInv,
  poissonPmf,
  poissonCdf,
  poissonInv,
  Real,
  decimalRow,
  toCalcError,
  type MRow,
} from '../core';
import { numFormat, registerPersister } from '../ui/state';
import { CellForm } from '../ui/form';
import { Field, FormulaBar, Segmented, ResultLine, ErrorBox, Row } from '../ui/components';
import type { Chip, ModeDef } from './types';

type Dist = 'normal' | 'binom' | 'poisson';
type Kind = 'pd' | 'cd' | 'inv';

let dist: Dist = 'normal';
let kind: Kind = 'cd';
const form = new CellForm();

function defaults(): void {
  form.cells.clear();
  form.set('n.mu', Real.ZERO);
  form.set('n.sigma', Real.ONE);
}
defaults();

interface FieldDef {
  k: string;
  label: ComponentChildren;
  placeholder?: string;
}

function fields(): FieldDef[] {
  if (dist === 'normal') {
    const tail: FieldDef[] = [
      { k: 'n.mu', label: 'Erwartungswert μ' },
      { k: 'n.sigma', label: 'Standardabw. σ' },
    ];
    if (kind === 'pd') return [{ k: 'n.x', label: <i>x</i> }, ...tail];
    if (kind === 'cd')
      return [
        { k: 'n.lo', label: 'Untere Grenze', placeholder: '−∞' },
        { k: 'n.hi', label: 'Obere Grenze', placeholder: '+∞' },
        ...tail,
      ];
    return [{ k: 'n.area', label: 'Fläche P(X ≤ x)' }, ...tail];
  }
  if (dist === 'binom') {
    const tail: FieldDef[] = [
      { k: 'b.n', label: 'Anzahl n' },
      { k: 'b.p', label: 'Trefferwahrsch. p' },
    ];
    if (kind === 'inv') return [{ k: 'b.area', label: 'Fläche P(X ≤ x)' }, ...tail];
    return [{ k: 'b.x', label: <span>Treffer <i>x</i></span> }, ...tail];
  }
  if (kind === 'inv') return [{ k: 'p.area', label: 'Fläche P(X ≤ x)' }, { k: 'p.mu', label: 'Erwartungswert μ' }];
  return [
    { k: 'p.x', label: <i>x</i> },
    { k: 'p.mu', label: 'Erwartungswert μ' },
  ];
}

function regrid(): void {
  form.setGrid(fields().map((f) => [f.k]));
  form.focusFirstEmpty();
}
regrid();

interface Out {
  label: ComponentChildren;
  value: number;
  id: string;
}

function compute(): Out[] | string | null {
  const g = (k: string): number | null => form.num(k);
  const need = (...ks: string[]): number[] | null => {
    const vs = ks.map(g);
    return vs.some((v) => v === null) ? null : (vs as number[]);
  };
  try {
    if (dist === 'normal') {
      const ms = need('n.mu', 'n.sigma');
      if (!ms) return null;
      const [mu, sigma] = ms;
      if (kind === 'pd') {
        const x = g('n.x');
        if (x === null) return null;
        return [{ id: 'p', label: 'Dichte f(x)', value: normalPdf(x, mu, sigma) }];
      }
      if (kind === 'cd') {
        const lo = g('n.lo') ?? -Infinity;
        const hi = g('n.hi') ?? Infinity;
        if (lo === -Infinity && hi === Infinity && !form.value('n.lo') && !form.value('n.hi')) return null;
        const label =
          lo === -Infinity ? 'P(X ≤ obere Grenze)' : hi === Infinity ? 'P(X ≥ untere Grenze)' : 'P(untere ≤ X ≤ obere)';
        return [{ id: 'p', label, value: normalCdfRange(lo, hi, mu, sigma) }];
      }
      const a = g('n.area');
      if (a === null) return null;
      return [{ id: 'x', label: <i>x</i>, value: normalInv(a, mu, sigma) }];
    }
    if (dist === 'binom') {
      const np = need('b.n', 'b.p');
      if (!np) return null;
      const [n, p] = np;
      if (kind === 'inv') {
        const a = g('b.area');
        if (a === null) return null;
        const k = binomInv(a, n, p);
        return [
          { id: 'x', label: <span>kleinstes <i>x</i> mit P(X ≤ x) ≥ Fläche</span>, value: k },
          { id: 'check', label: 'P(X ≤ x)', value: binomCdf(k, n, p) },
        ];
      }
      const x = g('b.x');
      if (x === null) return null;
      const extra: Out[] = [
        { id: 'mu', label: 'Erwartungswert μ = n·p', value: n * p },
        { id: 'sigma', label: 'Standardabw. σ', value: Math.sqrt(n * p * (1 - p)) },
      ];
      if (kind === 'pd') return [{ id: 'p', label: 'P(X = x)', value: binomPmf(x, n, p) }, ...extra];
      const le = binomCdf(x, n, p);
      const lt = binomCdf(x - 1, n, p);
      return [
        { id: 'p', label: 'P(X ≤ x)', value: le },
        { id: 'ge', label: 'P(X ≥ x)', value: 1 - lt },
        { id: 'lt', label: 'P(X < x)', value: lt },
        { id: 'gt', label: 'P(X > x)', value: 1 - le },
        ...extra,
      ];
    }
    const mu = g('p.mu');
    if (mu === null) return null;
    if (kind === 'inv') {
      const a = g('p.area');
      if (a === null) return null;
      const k = poissonInv(a, mu);
      return [
        { id: 'x', label: <span>kleinstes <i>x</i> mit P(X ≤ x) ≥ Fläche</span>, value: k },
        { id: 'check', label: 'P(X ≤ x)', value: poissonCdf(k, mu) },
      ];
    }
    const x = g('p.x');
    if (x === null) return null;
    if (kind === 'pd') return [{ id: 'p', label: 'P(X = x)', value: poissonPmf(x, mu) }];
    const le = poissonCdf(x, mu);
    const lt = poissonCdf(x - 1, mu);
    return [
      { id: 'p', label: 'P(X ≤ x)', value: le },
      { id: 'ge', label: 'P(X ≥ x)', value: 1 - lt },
      { id: 'lt', label: 'P(X < x)', value: lt },
      { id: 'gt', label: 'P(X > x)', value: 1 - le },
    ];
  } catch (e) {
    return toCalcError(e).message;
  }
}

const clean = (v: number): number => (Math.abs(v) < 1e-15 ? 0 : Number(v.toPrecision(13)));

function View(): VNode {
  const res = compute();
  const active = fields().find((f) => f.k === form.active);
  return (
    <div class="pane">
      <div class="tabs tabs-2">
        <Segmented
          name="dist"
          options={[
            { value: 'normal' as Dist, label: 'Normal' },
            { value: 'binom' as Dist, label: 'Binomial' },
            { value: 'poisson' as Dist, label: 'Poisson' },
          ]}
          value={dist}
          onChange={(d) => {
            form.commit();
            dist = d;
            regrid();
          }}
        />
        <Segmented
          name="kind"
          options={[
            { value: 'pd' as Kind, label: dist === 'normal' ? 'Dichte' : 'P(X = x)' },
            { value: 'cd' as Kind, label: 'Kumulativ' },
            { value: 'inv' as Kind, label: 'Invers' },
          ]}
          value={kind}
          onChange={(k) => {
            form.commit();
            kind = k;
            regrid();
          }}
        />
      </div>
      <div class="pane-scroll">
        <div class="fields">
          {fields().map((f) => (
            <Field key={f.k} form={form} k={f.k} label={f.label} placeholder={f.placeholder} />
          ))}
        </div>
        <div class="section-title">Ergebnis</div>
        {res === null ? (
          <p class="muted">Bitte alle Werte eingeben (jeweils mit = bestätigen).</p>
        ) : typeof res === 'string' ? (
          <ErrorBox message={res} />
        ) : (
          <div data-testid="dist-results">
            {res.map((o) => (
              <ResultLine key={o.id} label={o.label} testid={`dist-${o.id}`}>
                <Row row={decimalRow(new Real(clean(o.value), null), numFormat())} />
              </ResultLine>
            ))}
          </div>
        )}
      </div>
      <FormulaBar form={form} label={active?.label ?? ''} />
    </div>
  );
}

function onKey(action: string): boolean {
  if (['std', 'mixedToggle', 'dms', 'fact'].includes(action)) return true;
  return form.key(action);
}

function chips(): Chip[] {
  return [
    {
      label: 'Standardnormal (μ=0, σ=1)',
      id: 'std-normal',
      run: () => {
        form.set('n.mu', Real.ZERO);
        form.set('n.sigma', Real.ONE);
      },
    },
    {
      label: 'Eingaben löschen',
      id: 'clear',
      run: () => {
        defaults();
        form.focusFirstEmpty();
      },
    },
  ];
}

registerPersister('dist', {
  save: () => ({ dist, kind, cells: form.snapshot() }),
  load: (d) => {
    const s = d as { dist?: Dist; kind?: Kind; cells?: Record<string, MRow> };
    if (s.dist === 'normal' || s.dist === 'binom' || s.dist === 'poisson') dist = s.dist;
    if (s.kind === 'pd' || s.kind === 'cd' || s.kind === 'inv') kind = s.kind;
    defaults();
    const keep = new Map(form.cells);
    form.restore(s.cells);
    keep.forEach((c, k) => {
      if (!form.cells.has(k)) form.cells.set(k, c);
    });
    regrid();
  },
  reset: () => {
    dist = 'normal';
    kind = 'cd';
    defaults();
    form.cancel();
    regrid();
  },
});

export const distMode: ModeDef = {
  id: 'dist',
  title: 'Verteilungen',
  icon: 'P(X)',
  hint: 'Normal, Binomial, Poisson',
  View,
  onKey,
  chips,
  compactKeys: () => true,
};
