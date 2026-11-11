/** Modus 6: Statistik (1 und 2 Variablen, Regressionen). */
import type { ComponentChildren, VNode } from 'preact';
import {
  oneVar,
  twoVar,
  regression,
  REG_INFO,
  Real,
  decimalRow,
  toCalcError,
  type RegType,
  type MRow,
  type OneVarStats,
  type TwoVarStats,
  type Regression,
} from '../core';
import { numFormat, registerPersister } from '../ui/state';
import { CellForm } from '../ui/form';
import { CellBtn, FormulaBar, Segmented, ResultLine, ErrorBox, Row } from '../ui/components';
import type { Chip, ModeDef } from './types';

type Kind = 'one' | 'two';
type Tab = 'data' | 'stats' | 'reg';

let kind: Kind = 'one';
let freqOn = false;
let regType: RegType = 'linear';
let tab: Tab = 'data';
let count = 0;

const form = new CellForm({ onChange: () => sync() });
const estForm = new CellForm();
estForm.setGrid([['ex'], ['ey']]);

const rowOf = (key: string): number => parseInt(key.slice(1), 10);

function columns(): string[] {
  const c = ['x'];
  if (kind === 'two') c.push('y');
  if (freqOn) c.push('f');
  return c;
}

function rebuild(): void {
  const cols = columns();
  form.setGrid(Array.from({ length: count + 1 }, (_, i) => cols.map((c) => `${c}${i}`)));
}

function rowEmpty(i: number): boolean {
  return ['x', 'y', 'f'].every((c) => !form.value(`${c}${i}`));
}

/** Zeilenzahl an die vorhandenen Daten anpassen. */
function sync(): void {
  while (!rowEmpty(count)) count++;
  while (count > 0 && rowEmpty(count - 1)) count--;
  rebuild();
}

function deleteRow(i: number): void {
  if (i >= count) return;
  for (let r = i; r < count; r++) {
    for (const c of ['x', 'y', 'f']) {
      const next = form.cells.get(`${c}${r + 1}`);
      if (next && (next.value || next.row)) form.cells.set(`${c}${r}`, next);
      else form.cells.delete(`${c}${r}`);
    }
  }
  for (const c of ['x', 'y', 'f']) form.cells.delete(`${c}${count}`);
  form.cancel();
  sync();
}

function data(): { xs: number[]; ys: number[]; fs: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  const fs: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = form.num(`x${i}`);
    const y = form.num(`y${i}`);
    if (x === null && y === null) continue;
    xs.push(x ?? 0);
    ys.push(y ?? 0);
    fs.push(freqOn ? (form.num(`f${i}`) ?? 1) : 1);
  }
  return { xs, ys, fs };
}

rebuild();

function Num({ v }: { v: number | null | undefined }): VNode {
  if (v === null || v === undefined || !Number.isFinite(v)) return <span class="muted">—</span>;
  return <Row row={decimalRow(new Real(v, null), numFormat())} />;
}

function Line({ label, v, id }: { label: ComponentChildren; v: number | null | undefined; id: string }): VNode {
  return (
    <ResultLine label={label} testid={`stat-${id}`}>
      <Num v={v} />
    </ResultLine>
  );
}

function DataTab(): VNode {
  const cols = columns();
  const head: Record<string, ComponentChildren> = { x: <i>x</i>, y: <i>y</i>, f: 'Häufigk.' };
  return (
    <div class="pane-scroll stat-data">
      <div class="dgrid" style={{ gridTemplateColumns: `34px repeat(${cols.length}, minmax(0, 1fr))` }} data-testid="stat-grid">
        <span class="dgrid-h">#</span>
        {cols.map((c) => (
          <span class="dgrid-h" key={c}>
            {head[c]}
          </span>
        ))}
        {Array.from({ length: count + 1 }, (_, i) => [
          <span class="dgrid-n" key={`n${i}`}>
            {i + 1}
          </span>,
          ...cols.map((c) => <CellBtn key={`${c}${i}`} form={form} k={`${c}${i}`} placeholder={i === count ? '+' : c === 'f' ? '1' : '0'} />),
        ])}
      </div>
    </div>
  );
}

function StatsTab(): VNode {
  const { xs, ys, fs } = data();
  try {
    if (kind === 'one') {
      const s: OneVarStats = oneVar(xs, fs);
      return (
        <div class="pane-scroll" data-testid="stat-results">
          <Line id="n" label="Anzahl n" v={s.n} />
          <Line id="mean" label={<span>Mittelwert x̄</span>} v={s.mean} />
          <Line id="sum" label="Summe Σx" v={s.sum} />
          <Line id="sumsq" label="Σx²" v={s.sumSq} />
          <Line id="popsd" label="Standardabw. σx (Grundgesamtheit)" v={s.popSd} />
          <Line id="sd" label="Standardabw. sx (Stichprobe)" v={s.sampleSd} />
          <Line id="popvar" label="Varianz σ²x" v={s.popVar} />
          <Line id="var" label="Varianz s²x" v={s.sampleVar} />
          <Line id="min" label="Minimum" v={s.min} />
          <Line id="q1" label="Unteres Quartil Q₁" v={s.q1} />
          <Line id="med" label="Median" v={s.median} />
          <Line id="q3" label="Oberes Quartil Q₃" v={s.q3} />
          <Line id="max" label="Maximum" v={s.max} />
        </div>
      );
    }
    const s: TwoVarStats = twoVar(xs, ys, fs);
    return (
      <div class="pane-scroll" data-testid="stat-results">
        <Line id="n" label="Anzahl n" v={s.n} />
        <Line id="meanx" label="Mittelwert x̄" v={s.meanX} />
        <Line id="meany" label="Mittelwert ȳ" v={s.meanY} />
        <Line id="sumx" label="Σx" v={s.sumX} />
        <Line id="sumy" label="Σy" v={s.sumY} />
        <Line id="sumx2" label="Σx²" v={s.sumX2} />
        <Line id="sumy2" label="Σy²" v={s.sumY2} />
        <Line id="sumxy" label="Σxy" v={s.sumXY} />
        <Line id="popsdx" label="σx" v={s.popSdX} />
        <Line id="sdx" label="sx" v={s.sampleSdX} />
        <Line id="popsdy" label="σy" v={s.popSdY} />
        <Line id="sdy" label="sy" v={s.sampleSdY} />
        <Line id="minx" label="min x / max x" v={s.minX} />
        <Line id="maxx" label="" v={s.maxX} />
        <Line id="miny" label="min y / max y" v={s.minY} />
        <Line id="maxy" label="" v={s.maxY} />
      </div>
    );
  } catch (e) {
    return (
      <div class="pane-scroll">
        <ErrorBox message={toCalcError(e).message} />
      </div>
    );
  }
}

function RegTab(): VNode {
  const { xs, ys, fs } = data();
  let reg: Regression | null = null;
  let error: string | null = null;
  try {
    reg = regression(regType, xs, ys, fs);
  } catch (e) {
    error = toCalcError(e).message;
  }
  const ex = estForm.num('ex');
  const ey = estForm.num('ey');
  const safe = (f: () => number | undefined): number | null => {
    try {
      const v = f();
      return v === undefined || !Number.isFinite(v) ? null : v;
    } catch {
      return null;
    }
  };
  const xhat = reg && ey !== null ? reg.predictX(ey).filter(Number.isFinite) : [];
  return (
    <div class="pane-scroll" data-testid="stat-reg">
      <Segmented
        name="regtype"
        class="seg-scroll"
        options={(Object.keys(REG_INFO) as RegType[]).map((t) => ({ value: t, label: REG_INFO[t].name }))}
        value={regType}
        onChange={(t) => {
          regType = t;
        }}
      />
      <div class="reg-formula">{REG_INFO[regType].formula}</div>
      {error ? (
        <ErrorBox message={error} />
      ) : (
        reg && (
          <>
            <Line id="a" label="a" v={reg.a} />
            <Line id="b" label="b" v={reg.b} />
            {reg.c !== undefined && <Line id="c" label="c" v={reg.c} />}
            {reg.r !== null && <Line id="r" label="Korrelationskoeffizient r" v={reg.r} />}
            <Line id="r2" label="Bestimmtheitsmaß r²" v={reg.r2} />
            <div class="section-title">Schätzwerte</div>
            <div class="est">
              <span class="field-label">
                <i>x</i> =
              </span>
              <CellBtn form={estForm} k="ex" placeholder="x eingeben" />
              <span class="est-out" data-testid="stat-yhat">
                ŷ = <Num v={ex !== null ? safe(() => reg!.predictY(ex)) : null} />
              </span>
            </div>
            <div class="est">
              <span class="field-label">
                <i>y</i> =
              </span>
              <CellBtn form={estForm} k="ey" placeholder="y eingeben" />
              <span class="est-out" data-testid="stat-xhat">
                x̂ ={' '}
                {xhat.length === 0 ? (
                  <Num v={null} />
                ) : (
                  xhat.map((v, i) => (
                    <span key={i}>
                      {i > 0 ? ' ; ' : ''}
                      <Num v={v} />
                    </span>
                  ))
                )}
              </span>
            </div>
          </>
        )
      )}
    </div>
  );
}

function View(): VNode {
  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'data', label: 'Daten' },
    { value: 'stats', label: 'Kennwerte' },
  ];
  if (kind === 'two') tabs.push({ value: 'reg', label: 'Regression' });
  if (kind === 'one' && tab === 'reg') tab = 'stats';
  return (
    <div class="pane">
      <div class="tabs">
        <Segmented
          name="tab"
          options={tabs}
          value={tab}
          onChange={(t) => {
            form.commit();
            estForm.commit();
            tab = t;
          }}
        />
      </div>
      {tab === 'data' ? <DataTab /> : tab === 'stats' ? <StatsTab /> : <RegTab />}
      {tab === 'data' && (
        <FormulaBar
          form={form}
          label={
            <span>
              {form.active[0] === 'f' ? 'Häufigkeit' : <i>{form.active[0]}</i>}
              <sub>{rowOf(form.active) + 1}</sub>
            </span>
          }
          hint="Wert eingeben, dann ="
        />
      )}
      {tab === 'reg' && <FormulaBar form={estForm} label={<i>{estForm.active === 'ex' ? 'x' : 'y'}</i>} hint="Wert für die Schätzung" />}
    </div>
  );
}

function onKey(action: string): boolean {
  if (['std', 'mixedToggle', 'dms', 'fact'].includes(action)) return true;
  if (tab === 'data') return form.key(action);
  if (tab === 'reg') return estForm.key(action);
  if (action === 'ac' || action === 'exe') {
    tab = 'data';
    return true;
  }
  return ['left', 'right', 'up', 'down', 'del'].includes(action);
}

function chips(): Chip[] {
  const out: Chip[] = [
    {
      label: '1 Variable',
      id: 'one',
      active: kind === 'one',
      run: () => {
        form.commit();
        kind = 'one';
        rebuild();
      },
    },
    {
      label: '2 Variablen',
      id: 'two',
      active: kind === 'two',
      run: () => {
        form.commit();
        kind = 'two';
        rebuild();
      },
    },
    {
      label: 'Häufigkeit',
      id: 'freq',
      active: freqOn,
      run: () => {
        form.commit();
        freqOn = !freqOn;
        rebuild();
      },
    },
  ];
  if (tab === 'data') {
    out.push(
      {
        label: 'Zeile löschen',
        id: 'delrow',
        run: () => deleteRow(rowOf(form.active)),
      },
      {
        label: 'Alles löschen',
        id: 'clear',
        run: () => {
          form.cells.clear();
          form.cancel();
          count = 0;
          rebuild();
        },
      },
    );
  }
  return out;
}

registerPersister('stats', {
  save: () => ({ kind, freqOn, regType, cells: form.snapshot() }),
  load: (d) => {
    const s = d as { kind?: Kind; freqOn?: boolean; regType?: RegType; cells?: Record<string, MRow> };
    kind = s.kind === 'two' ? 'two' : 'one';
    freqOn = !!s.freqOn;
    if (s.regType && REG_INFO[s.regType]) regType = s.regType;
    form.restore(s.cells);
    count = 0;
    sync();
  },
  reset: () => {
    kind = 'one';
    freqOn = false;
    regType = 'linear';
    tab = 'data';
    count = 0;
    form.cells.clear();
    form.cancel();
    estForm.cells.clear();
    estForm.cancel();
    rebuild();
  },
});

export const statsMode: ModeDef = {
  id: 'stats',
  title: 'Statistik',
  icon: 'x̄ σ',
  hint: 'Kennwerte, Regression',
  View,
  onKey,
  chips,
  status: () => [kind === 'one' ? '1-VAR' : '2-VAR'],
  compactKeys: () => true,
};
