/** Gemeinsame Anzeige-Bausteine: Werte, Formelzeile, Zahlenfelder, Umschalter. */
import type { ComponentChildren, VNode } from 'preact';
import {
  realRow,
  scalarRow,
  dmsRow,
  factorRow,
  rowToText,
  hasExactForm,
  type MRow,
  type Real,
  type ResultForm,
  type Value,
} from '../core';
import { MathView } from '../editor/MathView';
import { setCursor } from '../editor/model';
import { app, numFormat, defaultForm, update } from './state';
import type { CellForm } from './form';
import type { ResultView } from './session';

/** Formelzeile mit den aktuellen Anzeigeeinstellungen. */
export function Row({ row, class: cls }: { row: MRow; class?: string }): VNode {
  return <MathView row={row} comma={app.settings.comma} class={cls} />;
}

/** Reelle Zahl in der Standarddarstellung (oder der angegebenen). */
export function RealView({ r, form, class: cls }: { r: Real; form?: ResultForm; class?: string }): VNode {
  return <Row row={realRow(r, numFormat(), form ?? defaultForm())} class={cls} />;
}

/** Zahl als reiner Text (für data-Attribute und kompakte Listen). */
export function realText(r: Real, form?: ResultForm): string {
  return rowToText(realRow(r, numFormat(), form ?? defaultForm()), app.settings.comma);
}

/** Wird der Wert in dieser Darstellung exakt (=) oder gerundet (≈) angezeigt? */
function isExactShown(r: Real, form: ResultForm): boolean {
  if (form !== 'decimal' && r.ex && (hasExactForm(r) || r.ex.isInteger())) return true;
  const q = r.rat();
  if (!q) return false;
  // endliche Dezimalzahl mit höchstens 10 Stellen?
  let d = q.d;
  while (d % 2n === 0n) d /= 2n;
  while (d % 5n === 0n) d /= 5n;
  if (d !== 1n) return false;
  const digits = (q.n < 0n ? -q.n : q.n).toString().length;
  return digits <= 10 && q.d.toString().length <= 11 && app.settings.numMode !== 'fix' && app.settings.numMode !== 'sci';
}

export function valueRows(value: Value, form: ResultForm, view: ResultView = 'std'): { rows: MRow[]; exact: boolean } {
  const fmt = numFormat();
  const s = app.settings;
  switch (value.kind) {
    case 'real':
      if (view === 'dms') return { rows: [dmsRow(value)], exact: false };
      if (view === 'fact') {
        try {
          return { rows: [factorRow(value)], exact: true };
        } catch {
          /* nicht zerlegbar → normale Anzeige */
        }
      }
      return { rows: [realRow(value, fmt, form)], exact: isExactShown(value, form) };
    case 'complex':
      return {
        rows: [scalarRow(value, fmt, form, s.complexForm, s.angle)],
        exact: s.complexForm === 'rect' && isExactShown(value.re, form) && isExactShown(value.im, form),
      };
    case 'pair':
      return {
        rows: value.vals.map((v, i) => [
          { t: 'txt', s: `${value.labels[i]} = ` },
          ...realRow(v, fmt, form),
        ]),
        exact: value.vals.every((v) => isExactShown(v, form)),
      };
    default:
      return { rows: [], exact: true };
  }
}

/** Text eines Wertes (für Tests und Screenreader). */
export function valueText(value: Value, form: ResultForm, view: ResultView = 'std'): string {
  if (value.kind === 'matrix') {
    return value.d.map((r) => r.map((x) => rowToText(realRow(x, numFormat(), form), app.settings.comma)).join(' ')).join(' | ');
  }
  if (value.kind === 'vector') {
    return value.d.map((x) => rowToText(realRow(x, numFormat(), form), app.settings.comma)).join(' ');
  }
  return valueRows(value, form, view)
    .rows.map((r) => rowToText(r, app.settings.comma))
    .join(' ; ');
}

/** Matrix oder Vektor als Zahlengitter mit Klammern. */
export function GridView({ rows, class: cls, form }: { rows: Real[][]; class?: string; form?: ResultForm }): VNode {
  return (
    <span class={`gridv${cls ? ` ${cls}` : ''}`}>
      <span class="gridv-body" style={{ gridTemplateColumns: `repeat(${rows[0]?.length ?? 1}, auto)` }}>
        {rows.flatMap((r, i) =>
          r.map((x, j) => (
            <span class="gridv-cell" key={`${i}-${j}`}>
              <RealView r={x} form={form} />
            </span>
          )),
        )}
      </span>
    </span>
  );
}

/** Ergebnisanzeige für beliebige Werte. */
export function ValueView({ value, form, view = 'std' }: { value: Value; form: ResultForm; view?: ResultView }): VNode {
  if (value.kind === 'matrix') return <GridView rows={value.d} form={form} />;
  if (value.kind === 'vector') return <GridView rows={value.d.map((x) => [x])} form={form} class="gridv-vec" />;
  const { rows, exact } = valueRows(value, form, view);
  return (
    <span class="value">
      {rows.map((r, i) => (
        <span class="value-line" key={i}>
          <span class="value-eq" aria-hidden="true">
            {exact ? '=' : '≈'}
          </span>
          <Row row={r} />
        </span>
      ))}
    </span>
  );
}

// ───────────────────────────── Formularbausteine ─────────────────────────────

/** Eingabezeile eines Formulars: zeigt die laufende Eingabe des aktiven Feldes. */
export function FormulaBar({ form, label, hint }: { form: CellForm; label?: ComponentChildren; hint?: string }): VNode {
  const c = form.active ? form.cell(form.active) : null;
  return (
    <div class={`fbar${form.error ? ' has-error' : ''}`} data-testid="fbar">
      <div class="fbar-main" onPointerDown={() => (form.typing ? undefined : (form.startEdit(), update()))}>
        <span class="fbar-label">{label ?? form.active} =</span>
        <span class="fbar-input">
          {form.typing ? (
            <MathView
              row={form.ed.root}
              cursor={form.ed.cur}
              comma={app.settings.comma}
              onPick={(p) => {
                setCursor(form.ed, p);
                update();
              }}
            />
          ) : c && c.row ? (
            <span class="fbar-current">
              <Row row={c.row} />
            </span>
          ) : c && c.value ? (
            <span class="fbar-current">
              <RealView r={c.value} />
            </span>
          ) : (
            <span class="fbar-hint">{hint ?? 'Wert eingeben, dann ='}</span>
          )}
        </span>
      </div>
      {form.error && (
        <div class="fbar-error" role="alert" data-testid="fbar-error">
          {form.error}
        </div>
      )}
    </div>
  );
}

/** Ein Zahlenfeld eines Formulars. */
export function CellBtn({
  form,
  k,
  class: cls,
  placeholder,
  children,
}: {
  form: CellForm;
  k: string;
  class?: string;
  placeholder?: string;
  children?: ComponentChildren;
}): VNode {
  const c = form.cells.get(k);
  const active = form.active === k;
  return (
    <button
      type="button"
      class={`cell${active ? ' active' : ''}${cls ? ` ${cls}` : ''}`}
      data-cell={k}
      data-value={c?.value ? realText(c.value) : ''}
      ref={active ? (el) => el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }) : undefined}
      onPointerDown={(e) => {
        e.preventDefault();
        form.activate(k);
        update();
      }}
    >
      {children ?? (c?.value ? <RealView r={c.value} /> : <span class="cell-empty">{placeholder ?? ''}</span>)}
    </button>
  );
}

/** Beschriftetes Feld (Label links, Wert rechts). */
export function Field({ form, k, label, placeholder }: { form: CellForm; k: string; label: ComponentChildren; placeholder?: string }): VNode {
  return (
    <div class="field">
      <span class="field-label">{label}</span>
      <CellBtn form={form} k={k} placeholder={placeholder ?? '—'} />
    </div>
  );
}

export interface Option<T extends string | number> {
  value: T;
  label: ComponentChildren;
  title?: string;
}

/** Umschalter mit mehreren Optionen. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  name,
  class: cls,
}: {
  options: Array<Option<T>>;
  value: T;
  onChange: (v: T) => void;
  name?: string;
  class?: string;
}): VNode {
  return (
    <div class={`seg${cls ? ` ${cls}` : ''}`} role="radiogroup" data-seg={name}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          class={`seg-btn${o.value === value ? ' on' : ''}`}
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          data-opt={String(o.value)}
          onClick={() => {
            onChange(o.value);
            update();
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Ergebniszeile mit Bezeichnung (z. B. in Statistik und Verteilungen). */
export function ResultLine({ label, children, testid }: { label: ComponentChildren; children: ComponentChildren; testid?: string }): VNode {
  return (
    <div class="rline" data-testid={testid}>
      <span class="rline-label">{label}</span>
      <span class="rline-value">{children}</span>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }): VNode {
  const i = message.indexOf(': ');
  return (
    <div class="errbox" role="alert" data-testid="error">
      <strong>{i > 0 ? message.slice(0, i) : 'Fehler'}</strong>
      <span>{i > 0 ? message.slice(i + 2) : message}</span>
    </div>
  );
}

/** Zähler mit − und + (z. B. Dimension einer Matrix, Nachkommastellen). */
export function Stepper({ value, min, max, onChange, name }: { value: number; min: number; max: number; onChange: (v: number) => void; name: string }): VNode {
  const set = (v: number) => {
    onChange(Math.max(min, Math.min(max, v)));
    update();
  };
  return (
    <div class="stepper" data-stepper={name}>
      <button type="button" aria-label="weniger" onClick={() => set(value - 1)} disabled={value <= min}>
        −
      </button>
      <span class="stepper-val">{value}</span>
      <button type="button" aria-label="mehr" onClick={() => set(value + 1)} disabled={value >= max}>
        +
      </button>
    </div>
  );
}

