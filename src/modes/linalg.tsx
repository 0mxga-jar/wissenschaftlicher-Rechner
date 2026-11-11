/** Modus 4 (Matrizen bis 4×4) und Modus 5 (Vektoren 2D/3D). */
import type { VNode } from 'preact';
import { calculate, Mat, Vec, Real, type MRow, type Value } from '../core';
import { makeContext, registerPersister, toast } from '../ui/state';
import { CalcSession } from '../ui/session';
import { CellForm } from '../ui/form';
import { CellBtn, FormulaBar, Segmented, Stepper } from '../ui/components';
import { SessionView, setAns } from './calc';
import type { Chip, ModeDef } from './types';

const NAMES = ['A', 'B', 'C', 'D'] as const;
type Name = (typeof NAMES)[number];
type Tab = 'calc' | Name;

// ───────────────────────────── Matrizen ─────────────────────────────

const mDims: Record<Name, { rows: number; cols: number }> = {
  A: { rows: 2, cols: 2 },
  B: { rows: 2, cols: 2 },
  C: { rows: 3, cols: 3 },
  D: { rows: 3, cols: 3 },
};
const mForms: Record<Name, CellForm> = { A: new CellForm(), B: new CellForm(), C: new CellForm(), D: new CellForm() };
let matAns: Mat | null = null;
let mTab: Tab = 'calc';

function mGrid(name: Name): void {
  const { rows, cols } = mDims[name];
  mForms[name].setGrid(Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => `${i},${j}`)));
}
NAMES.forEach(mGrid);

function toMat(name: Name): Mat {
  const { rows, cols } = mDims[name];
  const f = mForms[name];
  return new Mat(
    Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => f.value(`${i},${j}`) ?? Real.ZERO)),
  );
}

function storeMat(name: Name, m: Mat): void {
  mDims[name] = { rows: m.rows, cols: m.cols };
  const f = mForms[name];
  f.cells.clear();
  m.d.forEach((r, i) => r.forEach((x, j) => f.set(`${i},${j}`, x)));
  mGrid(name);
}

const mSession = new CalcSession({
  evaluate: (src) => {
    const mats: Record<string, Mat> = {};
    for (const n of NAMES) mats[n] = toMat(n);
    if (matAns) mats.Ans = matAns;
    return calculate(src, makeContext({ mats }));
  },
  onResult: (v) => {
    if (v.kind === 'matrix') matAns = v;
    else setAns(v);
  },
  ansToken: (v) => (v.kind === 'matrix' ? 'MatAns' : 'Ans'),
});

function Tabs({ tab, prefix, onChange }: { tab: Tab; prefix: string; onChange: (t: Tab) => void }): VNode {
  return (
    <div class="tabs">
      <Segmented
        name="tab"
        options={[{ value: 'calc' as Tab, label: 'Rechnen' }, ...NAMES.map((n) => ({ value: n as Tab, label: `${prefix}${n}` }))]}
        value={tab}
        onChange={onChange}
      />
    </div>
  );
}

function MatrixEditor({ name }: { name: Name }): VNode {
  const d = mDims[name];
  const f = mForms[name];
  const [i, j] = f.active.split(',').map(Number);
  return (
    <>
      <div class="pane-scroll">
        <div class="dims">
          <span class="muted">Zeilen</span>
          <Stepper
            name="rows"
            value={d.rows}
            min={1}
            max={4}
            onChange={(v) => {
              d.rows = v;
              mGrid(name);
            }}
          />
          <span class="muted">Spalten</span>
          <Stepper
            name="cols"
            value={d.cols}
            min={1}
            max={4}
            onChange={(v) => {
              d.cols = v;
              mGrid(name);
            }}
          />
        </div>
        <div class="mgrid" style={{ gridTemplateColumns: `repeat(${d.cols}, minmax(0, 1fr))` }} data-testid="matrix-grid">
          {Array.from({ length: d.rows }, (_, r) =>
            Array.from({ length: d.cols }, (_, c) => <CellBtn key={`${r},${c}`} form={f} k={`${r},${c}`} placeholder="0" />),
          )}
        </div>
      </div>
      <FormulaBar form={f} label={`Mat${name}(${i + 1};${j + 1})`} hint="Zahl eingeben, dann =" />
    </>
  );
}

function MatrixView(): VNode {
  return (
    <div class="pane">
      <Tabs
        tab={mTab}
        prefix="Mat"
        onChange={(t) => {
          if (mTab !== 'calc') mForms[mTab].commit();
          mTab = t;
        }}
      />
      {mTab === 'calc' ? <SessionView session={mSession} emptyHint="z. B. MatA × MatB oder det(MatA)" /> : <MatrixEditor name={mTab} />}
    </div>
  );
}

function matrixKey(action: string): boolean {
  if (mTab !== 'calc') {
    if (['std', 'mixedToggle', 'dms', 'fact'].includes(action)) return true;
    return mForms[mTab].key(action);
  }
  if (['calc', 'solve', 'mplus', 'mminus', 'dms', 'fact'].includes(action) || action.startsWith('sto:')) return false;
  return mSession.key(action);
}

function matrixChips(): Chip[] {
  if (mTab !== 'calc') {
    const name = mTab;
    return [
      {
        label: 'Leeren',
        id: 'clear',
        run: () => {
          mForms[name].cells.clear();
          mForms[name].cancel();
        },
      },
      {
        label: 'Einheitsmatrix',
        id: 'identity',
        run: () => {
          const d = mDims[name];
          if (d.rows !== d.cols) {
            toast('Die Einheitsmatrix gibt es nur für quadratische Matrizen.');
            return;
          }
          const f = mForms[name];
          f.cells.clear();
          for (let i = 0; i < d.rows; i++) for (let j = 0; j < d.cols; j++) f.set(`${i},${j}`, i === j ? Real.ONE : Real.ZERO);
        },
      },
      {
        label: 'Rechnen ›',
        id: 'to-calc',
        run: () => {
          mForms[name].commit();
          mTab = 'calc';
        },
      },
    ];
  }
  const out: Chip[] = NAMES.map((n) => ({ label: `Mat${n}`, action: `t:Mat${n}`, id: `Mat${n}` }));
  out.push(
    { label: 'MatAns', action: 't:MatAns', id: 'MatAns' },
    { label: 'det', action: 't:det(', id: 'det' },
    { label: 'Trn', action: 't:Trn(', id: 'trn' },
    { label: 'Inv', action: 't:Inv(', id: 'inv' },
    { label: 'Identity', action: 't:Identity(', id: 'identity' },
    { label: 'Rref', action: 't:Rref(', id: 'rref' },
  );
  const shown = mSession.shown?.value;
  if (shown && shown.kind === 'matrix') {
    for (const n of NAMES) {
      out.push({
        label: `Erg.→Mat${n}`,
        id: `store-${n}`,
        run: () => {
          storeMat(n, shown);
          toast(`Ergebnis in Mat${n} gespeichert.`);
        },
      });
    }
  }
  return out;
}

registerPersister('matrix', {
  save: () => ({
    dims: mDims,
    cells: Object.fromEntries(NAMES.map((n) => [n, mForms[n].snapshot()])),
    session: mSession.snapshot(),
  }),
  load: (data) => {
    const d = data as { dims?: typeof mDims; cells?: Record<string, Record<string, MRow>>; session?: { rows?: MRow[] } };
    for (const n of NAMES) {
      const dim = d.dims?.[n];
      if (dim && dim.rows >= 1 && dim.rows <= 4 && dim.cols >= 1 && dim.cols <= 4) mDims[n] = { rows: dim.rows, cols: dim.cols };
      mForms[n].restore(d.cells?.[n]);
      mGrid(n);
    }
    mSession.clearAll();
    for (const row of d.session?.rows ?? []) mSession.entries.push({ row, value: null, error: null });
  },
  reset: () => {
    for (const n of NAMES) {
      mForms[n].cells.clear();
      mForms[n].cancel();
    }
    mDims.A = { rows: 2, cols: 2 };
    mDims.B = { rows: 2, cols: 2 };
    mDims.C = { rows: 3, cols: 3 };
    mDims.D = { rows: 3, cols: 3 };
    NAMES.forEach(mGrid);
    matAns = null;
    mTab = 'calc';
    mSession.clearAll();
  },
});

export const matrixMode: ModeDef = {
  id: 'matrix',
  title: 'Matrizen',
  icon: '[ ]',
  hint: 'bis 4×4: det, Inverse …',
  View: MatrixView,
  onKey: matrixKey,
  chips: matrixChips,
  compactKeys: () => mTab !== 'calc',
};

// ───────────────────────────── Vektoren ─────────────────────────────

const vDims: Record<Name, number> = { A: 3, B: 3, C: 2, D: 2 };
const vForms: Record<Name, CellForm> = { A: new CellForm(), B: new CellForm(), C: new CellForm(), D: new CellForm() };
let vctAns: Vec | null = null;
let vTab: Tab = 'calc';
const COMP = ['x', 'y', 'z'];

function vGrid(name: Name): void {
  vForms[name].setGrid(Array.from({ length: vDims[name] }, (_, i) => [String(i)]));
}
NAMES.forEach(vGrid);

function toVec(name: Name): Vec {
  return new Vec(Array.from({ length: vDims[name] }, (_, i) => vForms[name].value(String(i)) ?? Real.ZERO));
}
function storeVec(name: Name, v: Vec): void {
  vDims[name] = v.dim;
  const f = vForms[name];
  f.cells.clear();
  v.d.forEach((x, i) => f.set(String(i), x));
  vGrid(name);
}

const vSession = new CalcSession({
  evaluate: (src) => {
    const vcts: Record<string, Vec> = {};
    for (const n of NAMES) vcts[n] = toVec(n);
    if (vctAns) vcts.Ans = vctAns;
    return calculate(src, makeContext({ vcts }));
  },
  onResult: (v: Value) => {
    if (v.kind === 'vector') vctAns = v;
    else setAns(v);
  },
  ansToken: (v) => (v.kind === 'vector' ? 'VctAns' : 'Ans'),
});

function VectorEditor({ name }: { name: Name }): VNode {
  const f = vForms[name];
  const dim = vDims[name];
  return (
    <>
      <div class="pane-scroll">
        <div class="dims">
          <span class="muted">Dimension</span>
          <Segmented
            name="dim"
            options={[
              { value: 2, label: '2D' },
              { value: 3, label: '3D' },
            ]}
            value={dim}
            onChange={(v) => {
              vDims[name] = v;
              vGrid(name);
            }}
          />
        </div>
        <div class="vgrid" data-testid="vector-grid">
          {Array.from({ length: dim }, (_, i) => (
            <div class="field" key={i}>
              <span class="field-label">
                <i>{COMP[i]}</i>
              </span>
              <CellBtn form={f} k={String(i)} placeholder="0" />
            </div>
          ))}
        </div>
      </div>
      <FormulaBar form={f} label={`Vct${name} · ${COMP[Number(f.active)] ?? ''}`} hint="Zahl eingeben, dann =" />
    </>
  );
}

function VectorView(): VNode {
  return (
    <div class="pane">
      <Tabs
        tab={vTab}
        prefix="Vct"
        onChange={(t) => {
          if (vTab !== 'calc') vForms[vTab].commit();
          vTab = t;
        }}
      />
      {vTab === 'calc' ? <SessionView session={vSession} emptyHint="z. B. VctA • VctB oder VctA × VctB" /> : <VectorEditor name={vTab} />}
    </div>
  );
}

function vectorKey(action: string): boolean {
  if (vTab !== 'calc') {
    if (['std', 'mixedToggle', 'dms', 'fact'].includes(action)) return true;
    return vForms[vTab].key(action);
  }
  if (['calc', 'solve', 'mplus', 'mminus', 'fact'].includes(action) || action.startsWith('sto:')) return false;
  return vSession.key(action);
}

function vectorChips(): Chip[] {
  if (vTab !== 'calc') {
    const name = vTab;
    return [
      {
        label: 'Leeren',
        id: 'clear',
        run: () => {
          vForms[name].cells.clear();
          vForms[name].cancel();
        },
      },
      {
        label: 'Rechnen ›',
        id: 'to-calc',
        run: () => {
          vForms[name].commit();
          vTab = 'calc';
        },
      },
    ];
  }
  const out: Chip[] = NAMES.map((n) => ({ label: `Vct${n}`, action: `t:Vct${n}`, id: `Vct${n}` }));
  out.push(
    { label: 'VctAns', action: 't:VctAns', id: 'VctAns' },
    { label: '• Skalarprodukt', action: 't:•', id: 'dot' },
    { label: 'Abs', action: 't:Abs(', id: 'abs' },
    { label: 'Angle', action: 't:Angle(', id: 'angle' },
    { label: 'UnitV', action: 't:UnitV(', id: 'unitv' },
    { label: 'DotP', action: 't:DotP(', id: 'dotp' },
    { label: 'CrossP', action: 't:CrossP(', id: 'crossp' },
    { label: ';', action: 't:;' },
  );
  const shown = vSession.shown?.value;
  if (shown && shown.kind === 'vector') {
    for (const n of NAMES) {
      out.push({
        label: `Erg.→Vct${n}`,
        id: `store-${n}`,
        run: () => {
          storeVec(n, shown);
          toast(`Ergebnis in Vct${n} gespeichert.`);
        },
      });
    }
  }
  return out;
}

registerPersister('vector', {
  save: () => ({
    dims: vDims,
    cells: Object.fromEntries(NAMES.map((n) => [n, vForms[n].snapshot()])),
    session: vSession.snapshot(),
  }),
  load: (data) => {
    const d = data as { dims?: Record<string, number>; cells?: Record<string, Record<string, MRow>>; session?: { rows?: MRow[] } };
    for (const n of NAMES) {
      if (d.dims?.[n] === 2 || d.dims?.[n] === 3) vDims[n] = d.dims[n];
      vForms[n].restore(d.cells?.[n]);
      vGrid(n);
    }
    vSession.clearAll();
    for (const row of d.session?.rows ?? []) vSession.entries.push({ row, value: null, error: null });
  },
  reset: () => {
    for (const n of NAMES) {
      vForms[n].cells.clear();
      vForms[n].cancel();
    }
    vDims.A = 3;
    vDims.B = 3;
    vDims.C = 2;
    vDims.D = 2;
    NAMES.forEach(vGrid);
    vctAns = null;
    vTab = 'calc';
    vSession.clearAll();
  },
});

export const vectorMode: ModeDef = {
  id: 'vector',
  title: 'Vektoren',
  icon: '(x y z)',
  hint: 'Skalar-, Kreuzprodukt, Winkel',
  View: VectorView,
  onKey: vectorKey,
  chips: vectorChips,
  compactKeys: () => vTab !== 'calc',
};
