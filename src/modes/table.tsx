/** Modus 8: Wertetabelle für f(x) und g(x) mit kleinem Funktionsgraphen. */
import type { VNode } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import {
  parse,
  calculate,
  buildTable,
  numericFn,
  formatNumber,
  CalcError,
  toCalcError,
  Real,
  decimalRow,
  realRow,
  type Node,
  type MRow,
  type TableRow,
} from '../core';
import { serialize } from '../editor/model';
import { app, makeContext, numFormat, defaultForm, registerPersister } from '../ui/state';
import { CellForm } from '../ui/form';
import { CellBtn, FormulaBar, Segmented, ErrorBox, Row } from '../ui/components';
import type { Chip, ModeDef } from './types';

type Tab = 'def' | 'table' | 'graph';
let tab: Tab = 'def';
const nodes: { f: Node | null; g: Node | null } = { f: null, g: null };

const form = new CellForm({
  commitRow: (key, row) => {
    if (key === 'f' || key === 'g') {
      if (!row) {
        nodes[key] = null;
        form.set(key, null);
        return;
      }
      const node = parse(serialize(row));
      if (node.t === 'eq') throw new CalcError('SYNTAX', 'Bitte nur den Funktionsterm eingeben (ohne „=“).');
      nodes[key] = node;
      form.set(key, null, row);
      return;
    }
    if (!row) throw new CalcError('ARG', 'Dieser Wert wird benötigt.');
    const v = calculate(serialize(row), makeContext());
    if (v.kind !== 'real') throw new CalcError('ARG', 'Hier wird eine reelle Zahl erwartet.');
    if (key === 'step' && v.isZero()) throw new CalcError('ARG', 'Die Schrittweite darf nicht 0 sein.');
    form.set(key, v, row);
  },
});
form.setGrid([['f'], ['g'], ['start'], ['end'], ['step']]);

function defaults(): void {
  form.cells.clear();
  nodes.f = null;
  nodes.g = null;
  form.set('start', Real.int(-5));
  form.set('end', Real.int(5));
  form.set('step', Real.ONE);
}
defaults();

const LABELS: Record<string, VNode> = {
  f: <span><i>f</i>(<i>x</i>)</span>,
  g: <span><i>g</i>(<i>x</i>)</span>,
  start: <span>Start</span>,
  end: <span>Ende</span>,
  step: <span>Schritt</span>,
};

function range(): { start: Real; end: Real; step: Real } {
  return {
    start: form.value('start') ?? Real.int(-5),
    end: form.value('end') ?? Real.int(5),
    step: form.value('step') ?? Real.ONE,
  };
}

function DefTab(): VNode {
  return (
    <div class="pane-scroll">
      <div class="fields">
        {(['f', 'g'] as const).map((k) => (
          <div class="field" key={k}>
            <span class={`field-label fn-label fn-${k}`}>{LABELS[k]} =</span>
            <CellBtn form={form} k={k} class="cell-expr">
              {form.cell(k).row ? <Row row={form.cell(k).row!} /> : <span class="cell-empty">Term in x eingeben</span>}
            </CellBtn>
          </div>
        ))}
      </div>
      <div class="section-title">Bereich</div>
      <div class="range3">
        {(['start', 'end', 'step'] as const).map((k) => (
          <label class="range3-item" key={k}>
            <span class="muted">{LABELS[k]}</span>
            <CellBtn form={form} k={k} />
          </label>
        ))}
      </div>
    </div>
  );
}

function cellText(v: TableRow['f']): VNode {
  if (v === null) return <span class="muted">—</span>;
  if (v instanceof CalcError) return <span class="tbl-err" title={v.message}>FEHLER</span>;
  return <Row row={decimalRow(v, numFormat())} />;
}

function TableTab(): VNode {
  if (!nodes.f && !nodes.g) return <Empty />;
  const { start, end, step } = range();
  let rows: TableRow[];
  try {
    rows = buildTable(nodes.f, nodes.g, start, end, step, makeContext());
  } catch (e) {
    return (
      <div class="pane-scroll">
        <ErrorBox message={toCalcError(e).message} />
      </div>
    );
  }
  const both = !!nodes.f && !!nodes.g;
  return (
    <div class="pane-scroll tbl-wrap">
      <table class="tbl" data-testid="table">
        <thead>
          <tr>
            <th>
              <i>x</i>
            </th>
            {nodes.f && <th class="fn-f">{LABELS.f}</th>}
            {nodes.g && <th class="fn-g">{LABELS.g}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} class={both ? 'two' : ''}>
              <td>
                <Row row={realRow(r.x, numFormat(), defaultForm() === 'decimal' ? 'decimal' : 'exact')} />
              </td>
              {nodes.f && <td>{cellText(r.f)}</td>}
              {nodes.g && <td>{cellText(r.g)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty(): VNode {
  return (
    <div class="pane-scroll">
      <p class="muted">Zuerst unter „Funktionen“ einen Term für f(x) oder g(x) eingeben.</p>
    </div>
  );
}

// ───────────────────────────── Graph ─────────────────────────────

const W = 340;
const H = 196;
const ML = 40;
const MR = 10;
const MT = 8;
const MB = 22;
const SAMPLES = 260;

function niceTicks(lo: number, hi: number, target: number): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  }
  return out;
}

interface Series {
  key: 'f' | 'g';
  ys: number[];
}

function sample(node: Node | null, xs: number[]): number[] {
  if (!node) return [];
  const ctx = makeContext({ vars: { ...app.vars } });
  const fn = numericFn(node, ctx);
  return xs.map((x) => {
    try {
      const y = fn(x);
      return Number.isFinite(y) ? y : NaN;
    } catch {
      return NaN;
    }
  });
}

function Graph(): VNode {
  const { start, end, step } = range();
  const a = Math.min(start.n, end.n);
  const b = Math.max(start.n, end.n);
  const [hover, setHover] = useState<number | null>(null);
  const fSrc = form.cell('f').row;
  const gSrc = form.cell('g').row;

  const model = useMemo(() => {
    const xs = Array.from({ length: SAMPLES + 1 }, (_, i) => a + ((b - a) * i) / SAMPLES);
    const series: Series[] = [];
    if (nodes.f) series.push({ key: 'f', ys: sample(nodes.f, xs) });
    if (nodes.g) series.push({ key: 'g', ys: sample(nodes.g, xs) });
    const all = series.flatMap((s) => s.ys).filter(Number.isFinite).sort((p, q) => p - q);
    let lo = -1;
    let hi = 1;
    if (all.length > 0) {
      const min = all[0];
      const max = all[all.length - 1];
      const p2 = all[Math.floor(all.length * 0.03)];
      const p98 = all[Math.ceil(all.length * 0.97) - 1];
      // Ausreißer (Polstellen) abschneiden, wenn sie den Bereich dominieren
      if (max - min > 6 * (p98 - p2) && p98 > p2) {
        lo = p2;
        hi = p98;
      } else {
        lo = min;
        hi = max;
      }
      if (lo === hi) {
        lo -= 1;
        hi += 1;
      }
      const pad = (hi - lo) * 0.07;
      lo -= pad;
      hi += pad;
    }
    return { xs, series, lo, hi };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fSrc, gSrc, a, b, app.settings.angle]);

  if (model.series.length === 0) return <Empty />;
  if (!(b > a)) {
    return (
      <div class="pane-scroll">
        <ErrorBox message="Bereichsfehler: Start und Ende müssen verschieden sein." />
      </div>
    );
  }
  const { xs, series, lo, hi } = model;
  const px = (x: number): number => ML + ((x - a) / (b - a)) * (W - ML - MR);
  const py = (y: number): number => {
    const t = (y - lo) / (hi - lo);
    return MT + (1 - Math.max(-1.5, Math.min(2.5, t))) * (H - MT - MB);
  };
  const path = (ys: number[]): string => {
    let d = '';
    let pen = false;
    const mid = (lo + hi) / 2;
    for (let i = 0; i < ys.length; i++) {
      const y = ys[i];
      if (!Number.isFinite(y)) {
        pen = false;
        continue;
      }
      if (pen && i > 0) {
        const prev = ys[i - 1];
        // Sprung über die Bildmitte hinweg: Polstelle – Linie unterbrechen
        if (Math.abs(y - prev) > 0.8 * (hi - lo) && (y - mid) * (prev - mid) < 0) pen = false;
      }
      d += `${pen ? 'L' : 'M'}${px(xs[i]).toFixed(1)} ${py(y).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const xt = niceTicks(a, b, 5);
  const yt = niceTicks(lo, hi, 4);
  const tickFmt = { mode: 'norm1' as const, digits: 0, comma: app.settings.comma };
  const label = (v: number): string => formatNumber(Number(v.toPrecision(6)), tickFmt);
  const count = Math.floor((b - a) / Math.abs(step.n) + 1e-9) + 1;
  const dots: number[] = count <= 41 ? Array.from({ length: count }, (_, k) => a + k * Math.abs(step.n)) : [];
  const dotY = (s: Series, x: number): number => s.ys[Math.round(((x - a) / (b - a)) * SAMPLES)];

  const hi_i = hover === null ? null : Math.max(0, Math.min(SAMPLES, Math.round(((hover - a) / (b - a)) * SAMPLES)));
  const move = (ev: PointerEvent) => {
    const rect = (ev.currentTarget as SVGElement).getBoundingClientRect();
    const sx = ((ev.clientX - rect.left) / rect.width) * W;
    const x = a + ((sx - ML) / (W - ML - MR)) * (b - a);
    setHover(Math.max(a, Math.min(b, x)));
  };
  const readFmt = { ...numFormat(), mode: 'norm1' as const };
  const fmtVal = (v: number): string => (Number.isFinite(v) ? formatNumber(Number(v.toPrecision(8)), readFmt) : 'nicht definiert');

  return (
    <div class="pane-scroll graph" data-testid="graph">
      <div class="graph-legend" data-testid="graph-legend">
        {hi_i !== null && (
          <span class="graph-x">
            <i>x</i> = <b>{fmtVal(xs[hi_i])}</b>
          </span>
        )}
        {series.map((s) => (
          <span class="graph-key" key={s.key}>
            <span class={`graph-swatch s-${s.key}`} />
            <span class="graph-name">{LABELS[s.key]}</span>
            {hi_i !== null && <b>{fmtVal(s.ys[hi_i])}</b>}
          </span>
        ))}
      </div>
      <svg
        class="graph-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Funktionsgraph"
        onPointerDown={move}
        onPointerMove={move}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id="plot-clip">
            <rect x={ML} y={MT} width={W - ML - MR} height={H - MT - MB} />
          </clipPath>
        </defs>
        {yt.map((v) => (
          <g key={`y${v}`}>
            <line class={v === 0 ? 'g-axis' : 'g-grid'} x1={ML} x2={W - MR} y1={py(v)} y2={py(v)} />
            <text class="g-tick" x={ML - 5} y={py(v) + 3} text-anchor="end">
              {label(v)}
            </text>
          </g>
        ))}
        {xt.map((v) => (
          <g key={`x${v}`}>
            <line class={v === 0 ? 'g-axis' : 'g-grid'} x1={px(v)} x2={px(v)} y1={MT} y2={H - MB} />
            <text class="g-tick" x={px(v)} y={H - MB + 13} text-anchor="middle">
              {label(v)}
            </text>
          </g>
        ))}
        <g clip-path="url(#plot-clip)">
          {series.map((s) => (
            <path key={s.key} class={`g-line s-${s.key}`} d={path(s.ys)} />
          ))}
          {series.map((s) =>
            dots.map((x, k) => {
              const y = dotY(s, x);
              return Number.isFinite(y) ? <circle key={`${s.key}${k}`} class={`g-dot s-${s.key}`} cx={px(x)} cy={py(y)} r="2.6" /> : null;
            }),
          )}
          {hi_i !== null && <line class="g-cross" x1={px(xs[hi_i])} x2={px(xs[hi_i])} y1={MT} y2={H - MB} />}
          {hi_i !== null &&
            series.map((s) =>
              Number.isFinite(s.ys[hi_i]) ? <circle key={s.key} class={`g-dot g-hover s-${s.key}`} cx={px(xs[hi_i])} cy={py(s.ys[hi_i])} r="4.2" /> : null,
            )}
        </g>
      </svg>
      <p class="graph-hint muted">Graph antippen oder darüberstreichen, um Werte abzulesen. Punkte = Zeilen der Wertetabelle.</p>
    </div>
  );
}

function View(): VNode {
  return (
    <div class="pane">
      <div class="tabs">
        <Segmented
          name="tab"
          options={[
            { value: 'def' as Tab, label: 'Funktionen' },
            { value: 'table' as Tab, label: 'Tabelle' },
            { value: 'graph' as Tab, label: 'Graph' },
          ]}
          value={tab}
          onChange={(t) => {
            if (form.typing && !form.commit()) return;
            tab = t;
          }}
        />
      </div>
      {tab === 'def' ? <DefTab /> : tab === 'table' ? <TableTab /> : <Graph />}
      {tab === 'def' && <FormulaBar form={form} label={LABELS[form.active]} hint={form.active === 'f' || form.active === 'g' ? 'z. B. x² − 2x' : undefined} />}
    </div>
  );
}

function onKey(action: string): boolean {
  if (['std', 'mixedToggle', 'dms', 'fact'].includes(action)) return true;
  if (tab !== 'def') {
    if (action === 'ac' || action === 'exe') {
      tab = 'def';
      return true;
    }
    return ['left', 'right', 'up', 'down', 'del'].includes(action);
  }
  return form.key(action);
}

function chips(): Chip[] {
  const go = (t: Tab, label: string): Chip => ({
    label,
    id: `go-${t}`,
    active: tab === t,
    run: () => {
      if (form.typing && !form.commit()) return;
      tab = t;
    },
  });
  return [
    go('table', 'Tabelle ›'),
    go('graph', 'Graph ›'),
    {
      label: 'Alles löschen',
      id: 'clear',
      run: () => {
        defaults();
        form.cancel();
        tab = 'def';
      },
    },
  ];
}

registerPersister('table', {
  save: () => ({ cells: form.snapshot() }),
  load: (d) => {
    const s = d as { cells?: Record<string, MRow> };
    defaults();
    for (const [k, row] of Object.entries(s.cells ?? {})) {
      try {
        form.active = k;
        form.opts.commitRow!(k, row);
      } catch {
        /* fehlerhafte Einträge überspringen */
      }
    }
    form.active = 'f';
  },
  reset: () => {
    defaults();
    form.cancel();
    form.active = 'f';
    tab = 'def';
  },
});

export const tableMode: ModeDef = {
  id: 'table',
  title: 'Wertetabelle',
  icon: 'f(x)',
  hint: 'f(x), g(x) und Graph',
  View,
  onKey,
  chips,
  compactKeys: () => tab !== 'def' || !(form.active === 'f' || form.active === 'g'),
};
