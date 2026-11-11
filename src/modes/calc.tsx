/** Modus 1: Berechnungen (inkl. CALC und SOLVE). */
import type { VNode } from 'preact';
import {
  calculate,
  parse,
  collectVars,
  solveFor,
  toCalcError,
  CalcError,
  Real,
  rAdd,
  rSub,
  type Node,
  type Value,
  type MRow,
} from '../core';
import { MathView } from '../editor/MathView';
import { serialize, setCursor, isEmpty, cloneRow } from '../editor/model';
import { app, makeContext, update, toast, registerPersister, VAR_NAMES } from '../ui/state';
import { CalcSession } from '../ui/session';
import { CellForm } from '../ui/form';
import { ValueView, valueText, FormulaBar, Field, ErrorBox, RealView, Row, Segmented, realText } from '../ui/components';
import type { Chip, ModeDef } from './types';

function setAns(v: Value): void {
  let a: Value | null = null;
  if (v.kind === 'real' || v.kind === 'complex') a = v;
  else if (v.kind === 'pair') a = v.vals[0];
  if (!a) return;
  app.vars.PreAns = app.vars.Ans ?? Real.ZERO;
  app.vars.Ans = a;
}

export const calcSession = new CalcSession({
  evaluate: (src) => {
    const v = calculate(src, makeContext());
    if (v.kind === 'complex') {
      throw new CalcError('DOMAIN', 'Das Ergebnis ist nicht reell – dafür gibt es den Modus „Komplexe Zahlen“.');
    }
    return v;
  },
  onResult: setAns,
});

// ── Unteransichten CALC und SOLVE ──

interface Sub {
  kind: 'calc' | 'solve';
  node: Node;
  row: MRow;
  vars: string[];
  target: string;
  form: CellForm;
  result: { root: Real; residual: Real } | null;
  error: string | null;
}
let sub: Sub | null = null;

function openSub(kind: 'calc' | 'solve'): void {
  const s = calcSession;
  if (isEmpty(s.ed)) {
    toast(kind === 'calc' ? 'CALC: zuerst einen Ausdruck mit Variablen eingeben.' : 'SOLVE: zuerst eine Gleichung eingeben, z. B. x² = 2.');
    return;
  }
  let node: Node;
  try {
    node = parse(serialize(s.ed.root));
  } catch (e) {
    s.error = toCalcError(e);
    s.current = null;
    return;
  }
  const vars = [...collectVars(node)].sort((a, b) => VAR_NAMES.indexOf(a) - VAR_NAMES.indexOf(b));
  if (kind === 'calc' && node.t === 'eq') {
    toast('Gleichungen werden mit SOLVE gelöst (SHIFT + CALC).');
    return;
  }
  if (vars.length === 0) {
    if (kind === 'calc') s.execute();
    else toast('SOLVE: Die Gleichung enthält keine Variable.');
    return;
  }
  const form = new CellForm({
    onDone: () => runSub(),
  });
  form.setGrid(vars.map((v) => [v]));
  for (const v of vars) {
    const cur = app.vars[v];
    form.set(v, cur && cur.kind === 'real' ? cur : Real.ZERO);
  }
  const target = vars.includes('x') ? 'x' : vars[0];
  form.active = kind === 'solve' ? target : vars[0];
  sub = { kind, node, row: cloneRow(s.ed.root), vars, target, form, result: null, error: null };
  s.current = null;
  s.error = null;
}

function runSub(): void {
  if (!sub) return;
  const { form } = sub;
  if (form.typing && !form.commit()) return;
  for (const v of sub.vars) {
    const old = app.vars[v];
    const val = form.value(v) ?? Real.ZERO;
    // eine komplexe Variable bleibt erhalten, solange hier kein neuer Wert eingegeben wurde
    if (old && old.kind !== 'real' && val.isZero() && !form.cell(v).row) continue;
    app.vars[v] = val;
  }
  if (sub.kind === 'calc') {
    sub = null;
    calcSession.execute();
    return;
  }
  try {
    const x0 = form.value(sub.target)?.n ?? 0;
    const res = solveFor(sub.node, sub.target, x0, makeContext());
    sub.result = res;
    sub.error = null;
    app.vars[sub.target] = res.root;
    form.set(sub.target, res.root);
  } catch (e) {
    sub.result = null;
    sub.error = toCalcError(e).message;
  }
}

function SubView({ s }: { s: Sub }): VNode {
  return (
    <div class="pane sub-pane" data-testid={`sub-${s.kind}`}>
      <div class="pane-scroll">
        <div class="sub-head">
          <span class="badge">{s.kind === 'calc' ? 'CALC' : 'SOLVE'}</span>
          <Row row={s.row} class="sub-expr" />
        </div>
        {s.kind === 'solve' && s.vars.length > 1 && (
          <div class="sub-target">
            <span class="muted">Lösen nach</span>
            <Segmented
              name="solve-target"
              options={s.vars.map((v) => ({ value: v, label: <i>{v}</i> }))}
              value={s.target}
              onChange={(v) => {
                s.target = v;
                s.form.activate(v);
                s.result = null;
              }}
            />
          </div>
        )}
        <div class="fields">
          {s.vars.map((v) => (
            <Field
              key={v}
              form={s.form}
              k={v}
              label={
                <span>
                  <i>{v}</i>
                  {s.kind === 'solve' && v === s.target ? <span class="muted"> (Startwert)</span> : null}
                </span>
              }
            />
          ))}
        </div>
        {s.result && (
          <div class="sub-result" data-testid="solve-result" data-value={realText(s.result.root)}>
            <div class="sub-result-main">
              <i>{s.target}</i> = <RealView r={s.result.root} />
            </div>
            <div class="muted">
              L − R = <RealView r={s.result.residual} form="decimal" />
            </div>
          </div>
        )}
        {s.error && <ErrorBox message={s.error} />}
      </div>
      <FormulaBar form={s.form} label={<i>{s.form.active}</i>} />
    </div>
  );
}

// ── Hauptansicht ──

export function SessionView({
  session,
  renderValue,
  emptyHint,
}: {
  session: CalcSession;
  renderValue?: (v: Value) => VNode | null;
  emptyHint?: string;
}): VNode {
  const s = session;
  const shown = s.shown;
  const first = Math.max(0, s.entries.length - 12);
  const hist = s.entries.slice(first).map((e, k) => ({ e, i: first + k }));
  return (
    <div class="pane calc-pane">
      <div
        class="hist"
        ref={(el) => {
          if (el) el.scrollTop = el.scrollHeight;
        }}
      >
        {hist
          .filter(({ i }) => i !== s.current)
          .map(({ e, i }) => (
            <button
              type="button"
              class="hist-item"
              key={i}
              onClick={() => {
                s.loadEntry(i);
                update();
              }}
            >
              <span class="hist-expr">
                <Row row={e.row} />
                {e.note && <span class="hist-note">{e.note}</span>}
              </span>
              <span class="hist-val">{e.value && (renderValue?.(e.value) ?? <ValueView value={e.value} form={s.form === 'decimal' ? 'decimal' : 'exact'} />)}</span>
            </button>
          ))}
      </div>
      <div
        class="entry"
        data-testid="entry"
        ref={(el) => {
          // nach der Berechnung den Ausdruck wieder von Anfang an zeigen
          if (el && !s.editing) {
            el.scrollTop = 0;
            el.scrollLeft = 0;
          }
        }}
      >
        {isEmpty(s.ed) && s.editing && emptyHint ? <span class="entry-hint">{emptyHint}</span> : null}
        <MathView
          row={s.ed.root}
          cursor={s.editing ? s.ed.cur : null}
          comma={app.settings.comma}
          onPick={(p) => {
            if (!s.editing) s.key('left');
            setCursor(s.ed, p);
            update();
          }}
        />
        {shown?.note && <span class="hist-note">{shown.note}</span>}
      </div>
      <div class="result-area">
        {s.error ? (
          <ErrorBox message={s.error.message} />
        ) : shown && shown.value ? (
          <div
            class={`result kind-${shown.value.kind}`}
            data-testid="result"
            data-value={valueText(shown.value, s.form, s.view)}
          >
            {renderValue?.(shown.value) ?? <ValueView value={shown.value} form={s.form} view={s.view} />}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function View(): VNode {
  if (sub) return <SubView s={sub} />;
  return <SessionView session={calcSession} />;
}

/** STO, M+ und M− für eine Rechen-Sitzung (gemeinsam mit dem Komplex-Modus). */
export { setAns };

export function memoryKey(session: CalcSession, action: string): boolean {
  if (action === 'mplus' || action === 'mminus') {
    try {
      const v = session.valueOfInput();
      if (v.kind !== 'real') throw new CalcError('ARG', 'M+ und M− benötigen eine reelle Zahl.');
      const m = app.vars.M && app.vars.M.kind === 'real' ? app.vars.M : Real.ZERO;
      app.vars.M = action === 'mplus' ? rAdd(m, v) : rSub(m, v);
      session.record(v, action === 'mplus' ? 'M+' : 'M−');
    } catch (e) {
      session.error = toCalcError(e);
      session.current = null;
    }
    return true;
  }
  if (action.startsWith('sto:')) {
    const name = action.slice(4);
    try {
      const v = session.valueOfInput();
      const val = v.kind === 'pair' ? v.vals[0] : v;
      if (val.kind !== 'real' && val.kind !== 'complex') throw new CalcError('ARG', 'In Variablen lassen sich nur Zahlen speichern.');
      app.vars[name] = val;
      session.record(val, `→${name}`);
    } catch (e) {
      session.error = toCalcError(e);
      session.current = null;
    }
    return true;
  }
  return false;
}

function onKey(action: string): boolean {
  if (sub) {
    if (action === 'ac' && !sub.form.typing) {
      sub = null;
      return true;
    }
    if (action === 'calc' || action === 'solve') {
      runSub();
      return true;
    }
    if (action === 'std' || action === 'mixedToggle') return true;
    return sub.form.key(action);
  }
  if (action === 'calc' || action === 'solve') {
    openSub(action);
    return true;
  }
  if (memoryKey(calcSession, action)) return true;
  return calcSession.key(action);
}

function chips(): Chip[] {
  if (sub) {
    return [
      { label: sub.kind === 'solve' ? 'Lösen' : 'Berechnen', run: runSub, id: 'run' },
      {
        label: 'Zurück',
        run: () => {
          sub = null;
        },
        id: 'back',
      },
    ];
  }
  return [
    { label: ';', action: 't:;' },
    { label: '=', action: 't:=' },
    { label: '%', action: 't:%' },
    { label: 'x!', action: 't:!' },
    { label: '|▫|', action: 'p:abs' },
    { label: 'ⁿ√', action: 'p:root' },
    { label: 'logₐ', action: 'p:logb' },
    { label: 'd/dx', action: 'p:diff' },
    { label: 'ggT', action: 't:ggT(' },
    { label: 'kgV', action: 't:kgV(' },
    { label: '÷R', action: 't:÷R' },
    { label: 'Ran#', action: 't:Ran#' },
    { label: 'RanInt', action: 't:RanInt(' },
    { label: 'FACT', action: 'fact' },
    { label: '°′″', action: 'dms' },
  ];
}

registerPersister('calc', {
  save: () => calcSession.snapshot(),
  load: (data) => {
    const d = data as { rows?: MRow[]; input?: MRow };
    calcSession.clearAll();
    // Verlauf ohne Ergebnisse wiederherstellen (wird beim Abrufen neu berechnet)
    for (const row of d.rows ?? []) calcSession.entries.push({ row, value: null, error: null });
    if (d.input && d.input.length) calcSession.ed.root = d.input;
    calcSession.ed.cur = [calcSession.ed.root.length];
  },
  reset: () => {
    calcSession.clearAll();
    sub = null;
  },
});

export const calcMode: ModeDef = {
  id: 'calc',
  title: 'Berechnungen',
  icon: '±',
  hint: 'Rechnen, Funktionen, SOLVE',
  View,
  onKey,
  chips,
};
