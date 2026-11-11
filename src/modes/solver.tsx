/** Modus 9 (Gleichungen), Modus 10 (Ungleichungen) und Modus 11 (Verhältnis). */
import type { ComponentChildren, VNode } from 'preact';
import {
  Real,
  rMul,
  rDiv,
  solveLinear,
  solvePolynomial,
  quadraticVertex,
  solveInequality,
  scalarRow,
  realRow,
  rowToText,
  toCalcError,
  txt,
  type Scalar,
  type MRow,
  type ResultForm,
  type IneqOp,
  type Interval,
} from '../core';
import { app, numFormat, defaultForm, registerPersister } from '../ui/state';
import { CellForm } from '../ui/form';
import { CellBtn, FormulaBar, Segmented, ErrorBox, Row, Field } from '../ui/components';
import type { Chip, ModeDef } from './types';

const SUB = ['₁', '₂', '₃', '₄'];
const UNKNOWNS = ['x', 'y', 'z', 't'];
const COEF = ['a', 'b', 'c', 'd', 'e'];

/** Ergebnisdarstellung (S⇔D schaltet um). */
let form: ResultForm | null = null;
const curForm = (): ResultForm => form ?? defaultForm();
function toggleForm(): void {
  form = curForm() === 'decimal' ? (defaultForm() === 'decimal' ? 'exact' : defaultForm()) : 'decimal';
}

const val = (f: CellForm, k: string): Real => f.value(k) ?? Real.ZERO;
const anySet = (f: CellForm): boolean => [...f.cells.values()].some((c) => c.value !== null);
const power = (n: number): ComponentChildren => (n === 0 ? null : n === 1 ? <i>x</i> : <span><i>x</i><sup>{n}</sup></span>);

function ScalarLine({ label, z, id }: { label: ComponentChildren; z: Scalar; id: string }): VNode {
  const row = scalarRow(z, numFormat(), curForm(), 'rect', app.settings.angle);
  return (
    <div class="sol" data-testid={id} data-value={rowToText(row, app.settings.comma)}>
      <span class="sol-label">{label} =</span>
      <Row row={row} />
    </div>
  );
}

// ───────────────────────────── Gleichungen ─────────────────────────────

type EqKind = 'lin' | 'poly';
let eqKind: EqKind = 'poly';
let linN = 2;
let deg = 2;
const linForm = new CellForm();
const polyForm = new CellForm();

function eqGrid(): void {
  linForm.setGrid(Array.from({ length: linN }, (_, i) => Array.from({ length: linN + 1 }, (_, j) => `${i},${j}`)));
  polyForm.setGrid([Array.from({ length: deg + 1 }, (_, k) => `c${k}`)]);
}
eqGrid();

function LinResult(): VNode | null {
  if (!anySet(linForm)) return <p class="muted">Koeffizienten eingeben – jede Zahl mit = bestätigen.</p>;
  try {
    const A = Array.from({ length: linN }, (_, i) => Array.from({ length: linN }, (_, j) => val(linForm, `${i},${j}`)));
    const b = Array.from({ length: linN }, (_, i) => val(linForm, `${i},${linN}`));
    const sol = solveLinear(A, b);
    if (sol === 'none') return <div class="sol sol-note" data-testid="eq-none">Keine Lösung (L = { })</div>;
    if (sol === 'infinite') return <div class="sol sol-note" data-testid="eq-infinite">Unendlich viele Lösungen</div>;
    return (
      <div data-testid="eq-results">
        {sol.map((v, i) => (
          <ScalarLine key={i} id={`eq-${UNKNOWNS[i]}`} label={<i>{UNKNOWNS[i]}</i>} z={v} />
        ))}
      </div>
    );
  } catch (e) {
    return <ErrorBox message={toCalcError(e).message} />;
  }
}

function PolyResult(): VNode | null {
  if (!anySet(polyForm)) return <p class="muted">Koeffizienten eingeben – jede Zahl mit = bestätigen.</p>;
  const c = Array.from({ length: deg + 1 }, (_, k) => val(polyForm, `c${k}`));
  if (c[0].isZero()) return <p class="muted">Der Koeffizient a darf nicht 0 sein.</p>;
  try {
    const roots = solvePolynomial(c);
    const vertex = deg === 2 ? quadraticVertex(c[0], c[1], c[2]) : null;
    return (
      <div data-testid="eq-results">
        {roots.map((z, i) => (
          <ScalarLine
            key={i}
            id={`eq-x${i + 1}`}
            label={
              <span>
                <i>x</i>
                {roots.length > 1 ? SUB[i] : ''}
              </span>
            }
            z={z}
          />
        ))}
        {vertex && (
          <div class="sol sol-vertex" data-testid="eq-vertex" data-value={`${rowToText(realRow(vertex.x, numFormat(), curForm()), app.settings.comma)}|${rowToText(realRow(vertex.y, numFormat(), curForm()), app.settings.comma)}`}>
            <span class="sol-label">Scheitelpunkt ({vertex.kind === 'min' ? 'Minimum' : 'Maximum'})</span>
            <span>
              S(
              <Row row={realRow(vertex.x, numFormat(), curForm())} />
              {' | '}
              <Row row={realRow(vertex.y, numFormat(), curForm())} />)
            </span>
          </div>
        )}
      </div>
    );
  } catch (e) {
    return <ErrorBox message={toCalcError(e).message} />;
  }
}

function PolyInputs({ f, degree, rhs }: { f: CellForm; degree: number; rhs: ComponentChildren }): VNode {
  return (
    <div class="poly" data-testid="poly-inputs">
      {Array.from({ length: degree + 1 }, (_, k) => (
        <span class="poly-term" key={k}>
          <CellBtn form={f} k={`c${k}`} placeholder={COEF[k]} />
          <span class="poly-x">
            {power(degree - k)}
            {k < degree ? ' +' : ''}
          </span>
        </span>
      ))}
      <span class="poly-rhs">{rhs}</span>
    </div>
  );
}

function EquationView(): VNode {
  const f = eqKind === 'lin' ? linForm : polyForm;
  let label: ComponentChildren;
  if (eqKind === 'lin') {
    const [i, j] = linForm.active.split(',').map(Number);
    label = j === linN ? `Zeile ${i + 1}: rechte Seite` : `Zeile ${i + 1}: Koeffizient von ${UNKNOWNS[j]}`;
  } else label = COEF[Number(polyForm.active.slice(1))] ?? '';
  return (
    <div class="pane">
      <div class="tabs tabs-2">
        <Segmented
          name="eqkind"
          options={[
            { value: 'poly' as EqKind, label: 'Polynom' },
            { value: 'lin' as EqKind, label: 'Lineares System' },
          ]}
          value={eqKind}
          onChange={(k) => {
            f.commit();
            eqKind = k;
          }}
        />
        {eqKind === 'lin' ? (
          <Segmented
            name="size"
            options={[2, 3, 4].map((n) => ({ value: n, label: `${n} Unbek.` }))}
            value={linN}
            onChange={(n) => {
              linForm.commit();
              linN = n;
              eqGrid();
            }}
          />
        ) : (
          <Segmented
            name="size"
            options={[2, 3, 4].map((n) => ({ value: n, label: `Grad ${n}` }))}
            value={deg}
            onChange={(n) => {
              polyForm.commit();
              deg = n;
              eqGrid();
            }}
          />
        )}
      </div>
      <div class="pane-scroll">
        {eqKind === 'lin' ? (
          <div class="lgs" style={{ gridTemplateColumns: `repeat(${linN}, minmax(0, 1fr)) 14px minmax(0, 1fr)` }} data-testid="lgs-inputs">
            {UNKNOWNS.slice(0, linN).map((u) => (
              <span class="dgrid-h" key={u}>
                <i>{u}</i>
              </span>
            ))}
            <span />
            <span class="dgrid-h">=</span>
            {Array.from({ length: linN }, (_, i) => [
              ...Array.from({ length: linN }, (_, j) => <CellBtn key={`${i},${j}`} form={linForm} k={`${i},${j}`} placeholder="0" />),
              <span class="lgs-eq" key={`e${i}`}>
                =
              </span>,
              <CellBtn key={`${i},${linN}`} form={linForm} k={`${i},${linN}`} placeholder="0" />,
            ])}
          </div>
        ) : (
          <PolyInputs f={polyForm} degree={deg} rhs="= 0" />
        )}
        <div class="section-title">Lösung</div>
        {eqKind === 'lin' ? <LinResult /> : <PolyResult />}
      </div>
      <FormulaBar form={f} label={label} />
    </div>
  );
}

function formKey(f: CellForm, action: string): boolean {
  if (action === 'std' || action === 'mixedToggle') {
    toggleForm();
    return true;
  }
  if (action === 'dms' || action === 'fact') return true;
  return f.key(action);
}

function clearChip(f: CellForm): Chip {
  return {
    label: 'Eingaben löschen',
    id: 'clear',
    run: () => {
      f.cells.clear();
      f.cancel();
    },
  };
}
const formChip = (): Chip => ({
  label: curForm() === 'decimal' ? 'Dezimal' : 'Exakt',
  id: 'form',
  title: 'Darstellung umschalten (S⇔D)',
  run: toggleForm,
});

export const equationMode: ModeDef = {
  id: 'equation',
  title: 'Gleichungen',
  icon: 'x = ?',
  hint: 'LGS, Polynome Grad 2–4',
  View: EquationView,
  onKey: (a) => formKey(eqKind === 'lin' ? linForm : polyForm, a),
  chips: () => [formChip(), clearChip(eqKind === 'lin' ? linForm : polyForm)],
  compactKeys: () => true,
};

// ───────────────────────────── Ungleichungen ─────────────────────────────

let iDeg = 2;
let iOp: IneqOp = '>';
const ineqForm = new CellForm();
function ineqGrid(): void {
  ineqForm.setGrid([Array.from({ length: iDeg + 1 }, (_, k) => `c${k}`)]);
}
ineqGrid();

const OP_LABEL: Record<IneqOp, string> = { '>': '> 0', '<': '< 0', '>=': '≥ 0', '<=': '≤ 0' };

function num(r: Real): MRow {
  return realRow(r, numFormat(), curForm());
}

/** Bedingung für x als Formelzeile, z. B. „2 < x ≤ 5“. */
function conditionRow(iv: Interval): MRow {
  const x: MRow = [{ t: 'tok', id: 'x' }];
  if (iv.lo === null && iv.hi === null) return [txt('alle reellen Zahlen')];
  if (iv.lo !== null && iv.hi !== null && iv.lo === iv.hi) return [...x, txt(' = '), ...num(iv.lo)];
  const out: MRow = [];
  if (iv.lo !== null && iv.hi !== null) {
    out.push(...num(iv.lo), txt(iv.loClosed ? ' ≤ ' : ' < '), ...x, txt(iv.hiClosed ? ' ≤ ' : ' < '), ...num(iv.hi));
  } else if (iv.lo !== null) out.push(...x, txt(iv.loClosed ? ' ≥ ' : ' > '), ...num(iv.lo));
  else out.push(...x, txt(iv.hiClosed ? ' ≤ ' : ' < '), ...num(iv.hi!));
  return out;
}

/** Lösungsmenge in Intervallschreibweise, z. B. ]−∞; 2[ ∪ [3; ∞[ */
function setRow(ivs: Interval[]): MRow {
  if (ivs.length === 0) return [txt('L = { }')];
  if (ivs.length === 1 && ivs[0].lo === null && ivs[0].hi === null) return [txt('L = ℝ')];
  const out: MRow = [txt('L = ')];
  ivs.forEach((iv, i) => {
    if (i > 0) out.push(txt(' ∪ '));
    if (iv.lo !== null && iv.lo === iv.hi) {
      out.push(txt('{'), ...num(iv.lo), txt('}'));
      return;
    }
    out.push(txt(iv.loClosed ? '[' : ']'));
    if (iv.lo === null) out.push(txt('−∞'));
    else out.push(...num(iv.lo));
    out.push(txt('; '));
    if (iv.hi === null) out.push(txt('∞'));
    else out.push(...num(iv.hi));
    out.push(txt(iv.hiClosed ? ']' : '['));
  });
  return out;
}

function IneqResult(): VNode {
  if (!anySet(ineqForm)) return <p class="muted">Koeffizienten eingeben – jede Zahl mit = bestätigen.</p>;
  const c = Array.from({ length: iDeg + 1 }, (_, k) => val(ineqForm, `c${k}`));
  if (c[0].isZero()) return <p class="muted">Der Koeffizient a darf nicht 0 sein.</p>;
  try {
    const ivs = solveInequality(c, iOp);
    const set = setRow(ivs);
    return (
      <div data-testid="ineq-results" data-value={rowToText(set, app.settings.comma)}>
        {ivs.length === 0 ? (
          <div class="sol sol-note">Keine Lösung</div>
        ) : (
          ivs.map((iv, i) => (
            <div class="sol" key={i} data-testid={`ineq-${i}`} data-value={rowToText(conditionRow(iv), app.settings.comma)}>
              {i > 0 && <span class="sol-label">oder</span>}
              <Row row={conditionRow(iv)} />
            </div>
          ))
        )}
        <div class="sol sol-set">
          <Row row={set} />
        </div>
      </div>
    );
  } catch (e) {
    return <ErrorBox message={toCalcError(e).message} />;
  }
}

function IneqView(): VNode {
  return (
    <div class="pane">
      <div class="tabs tabs-2">
        <Segmented
          name="size"
          options={[2, 3, 4].map((n) => ({ value: n, label: `Grad ${n}` }))}
          value={iDeg}
          onChange={(n) => {
            ineqForm.commit();
            iDeg = n;
            ineqGrid();
          }}
        />
        <Segmented
          name="op"
          options={(Object.keys(OP_LABEL) as IneqOp[]).map((o) => ({ value: o, label: OP_LABEL[o] }))}
          value={iOp}
          onChange={(o) => {
            iOp = o;
          }}
        />
      </div>
      <div class="pane-scroll">
        <PolyInputs f={ineqForm} degree={iDeg} rhs={OP_LABEL[iOp]} />
        <div class="section-title">Lösungsmenge</div>
        <IneqResult />
      </div>
      <FormulaBar form={ineqForm} label={COEF[Number(ineqForm.active.slice(1))] ?? ''} />
    </div>
  );
}

export const ineqMode: ModeDef = {
  id: 'ineq',
  title: 'Ungleichungen',
  icon: 'x < ?',
  hint: 'Polynome Grad 2–4',
  View: IneqView,
  onKey: (a) => formKey(ineqForm, a),
  chips: () => [formChip(), clearChip(ineqForm)],
  compactKeys: () => true,
};

// ───────────────────────────── Verhältnis ─────────────────────────────

type RatioKind = 'cx' | 'xd';
let ratioKind: RatioKind = 'cx';
const ratioForm = new CellForm();
function ratioGrid(): void {
  ratioForm.setGrid([['a', 'b', ratioKind === 'cx' ? 'c' : 'd']]);
}
ratioGrid();

function RatioResult(): VNode {
  const a = ratioForm.value('a');
  const b = ratioForm.value('b');
  const third = ratioForm.value(ratioKind === 'cx' ? 'c' : 'd');
  if (!a || !b || !third) return <p class="muted">Drei Werte eingeben – jede Zahl mit = bestätigen.</p>;
  try {
    // a:b = c:x  →  x = b·c/a      a:b = x:d  →  x = a·d/b
    const x = ratioKind === 'cx' ? rDiv(rMul(b, third), a) : rDiv(rMul(a, third), b);
    return <ScalarLine id="ratio-x" label={<i>x</i>} z={x} />;
  } catch (e) {
    return <ErrorBox message={toCalcError(e).message} />;
  }
}

function RatioView(): VNode {
  const X = (
    <span class="ratio-x">
      <i>x</i>
    </span>
  );
  return (
    <div class="pane">
      <div class="tabs">
        <Segmented
          name="ratio"
          options={[
            { value: 'cx' as RatioKind, label: 'a : b = c : x' },
            { value: 'xd' as RatioKind, label: 'a : b = x : d' },
          ]}
          value={ratioKind}
          onChange={(k) => {
            ratioForm.commit();
            ratioKind = k;
            ratioGrid();
          }}
        />
      </div>
      <div class="pane-scroll">
        <div class="ratio" data-testid="ratio-inputs">
          <CellBtn form={ratioForm} k="a" placeholder="a" />
          <span>:</span>
          <CellBtn form={ratioForm} k="b" placeholder="b" />
          <span>=</span>
          {ratioKind === 'cx' ? <CellBtn form={ratioForm} k="c" placeholder="c" /> : X}
          <span>:</span>
          {ratioKind === 'cx' ? X : <CellBtn form={ratioForm} k="d" placeholder="d" />}
        </div>
        <div class="section-title">Ergebnis</div>
        <RatioResult />
      </div>
      <FormulaBar form={ratioForm} label={ratioForm.active} />
    </div>
  );
}

export const ratioMode: ModeDef = {
  id: 'ratio',
  title: 'Verhältnis',
  icon: 'a : b',
  hint: 'a : b = c : x',
  View: RatioView,
  onKey: (a) => formKey(ratioForm, a),
  chips: () => [formChip(), clearChip(ratioForm)],
  compactKeys: () => true,
};

registerPersister('solver', {
  save: () => ({
    eqKind,
    linN,
    deg,
    iDeg,
    iOp,
    ratioKind,
    lin: linForm.snapshot(),
    poly: polyForm.snapshot(),
    ineq: ineqForm.snapshot(),
    ratio: ratioForm.snapshot(),
  }),
  load: (d) => {
    const s = d as Record<string, unknown>;
    if (s.eqKind === 'lin' || s.eqKind === 'poly') eqKind = s.eqKind;
    if ([2, 3, 4].includes(s.linN as number)) linN = s.linN as number;
    if ([2, 3, 4].includes(s.deg as number)) deg = s.deg as number;
    if ([2, 3, 4].includes(s.iDeg as number)) iDeg = s.iDeg as number;
    if (['>', '<', '>=', '<='].includes(s.iOp as string)) iOp = s.iOp as IneqOp;
    if (s.ratioKind === 'cx' || s.ratioKind === 'xd') ratioKind = s.ratioKind;
    linForm.restore(s.lin as Record<string, MRow>);
    polyForm.restore(s.poly as Record<string, MRow>);
    ineqForm.restore(s.ineq as Record<string, MRow>);
    ratioForm.restore(s.ratio as Record<string, MRow>);
    eqGrid();
    ineqGrid();
    ratioGrid();
  },
  reset: () => {
    eqKind = 'poly';
    linN = 2;
    deg = 2;
    iDeg = 2;
    iOp = '>';
    ratioKind = 'cx';
    form = null;
    for (const f of [linForm, polyForm, ineqForm, ratioForm]) {
      f.cells.clear();
      f.cancel();
    }
    eqGrid();
    ineqGrid();
    ratioGrid();
  },
});
