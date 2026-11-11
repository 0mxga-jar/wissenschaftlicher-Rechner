/** Modus 3: Basis-N (DEC/HEX/BIN/OCT mit Logikoperatoren). */
import type { VNode } from 'preact';
import { evalBaseN, formatBaseN, BASE_NAMES, Real, type Base, type MRow, type Value } from '../core';
import { serialize } from '../editor/model';
import { registerPersister } from '../ui/state';
import { CalcSession } from '../ui/session';
import { SessionView } from './calc';
import type { Chip, ModeDef } from './types';

let base: Base = 10;
let ans = 0;

const session = new CalcSession({
  serialize: (row) => serialize(row).replace(/([A-F]) /g, '$1'),
  evaluate: (src) => Real.int(evalBaseN(src, base, ans)),
  onResult: (v) => {
    if (v.kind === 'real') ans = v.n;
  },
});

const group = (s: string, n: number): string => {
  const out: string[] = [];
  for (let i = s.length; i > 0; i -= n) out.unshift(s.slice(Math.max(0, i - n), i));
  return out.join(' ');
};

function show(v: number, b: Base): string {
  const s = formatBaseN(v, b);
  if (b === 2) return group(s, 4);
  if (b === 16) return group(s, 4);
  return s;
}

function renderValue(v: Value): VNode | null {
  if (v.kind !== 'real') return null;
  const n = v.n;
  return (
    <span class="bn-result" data-base={base} data-value={formatBaseN(n, base)}>
      <span class="bn-main">
        <span class="bn-tag">{BASE_NAMES[base]}</span>
        <span class="bn-digits">{show(n, base)}</span>
      </span>
    </span>
  );
}

function View(): VNode {
  const shown = session.shown;
  const n = shown && shown.value && shown.value.kind === 'real' ? shown.value.n : null;
  return (
    <div class="pane">
      <SessionView session={session} renderValue={renderValue} emptyHint="Ganzzahlen, z. B. FF + 1 oder 5 and 3" />
      {n !== null && !session.error && (
        <div class="bn-all" data-testid="bn-all">
          {([10, 16, 2, 8] as Base[])
            .filter((b) => b !== base)
            .map((b) => (
              <span class="bn-line" key={b} data-base={b}>
                <span class="bn-tag">{BASE_NAMES[b]}</span>
                <span class="bn-digits">{show(n, b)}</span>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

function onKey(action: string): boolean {
  if (['std', 'mixedToggle', 'dms', 'fact', 'calc', 'solve', 'mplus', 'mminus'].includes(action)) return false;
  if (action.startsWith('sto:')) return false;
  return session.key(action);
}

function chips(): Chip[] {
  const baseChip = (b: Base): Chip => ({
    label: BASE_NAMES[b],
    id: `base-${b}`,
    active: base === b,
    run: () => {
      base = b;
    },
  });
  const out: Chip[] = [baseChip(10), baseChip(16), baseChip(2), baseChip(8)];
  if (base === 16) for (const h of 'ABCDEF') out.push({ label: h, action: `t:${h}`, id: `hex-${h}` });
  out.push(
    { label: 'and', action: 't:and', id: 'and' },
    { label: 'or', action: 't:or', id: 'or' },
    { label: 'xor', action: 't:xor', id: 'xor' },
    { label: 'xnor', action: 't:xnor', id: 'xnor' },
    { label: 'Not', action: 't:Not(', id: 'not' },
    { label: 'Neg', action: 't:Neg(', id: 'neg' },
    { label: 'd…', action: 't:bd', id: 'pd', title: 'Dezimalzahl eingeben' },
    { label: 'h…', action: 't:bh', id: 'ph', title: 'Hexadezimalzahl eingeben' },
    { label: 'b…', action: 't:bb', id: 'pb', title: 'Binärzahl eingeben' },
    { label: 'o…', action: 't:bo', id: 'po', title: 'Oktalzahl eingeben' },
  );
  return out;
}

registerPersister('basen', {
  save: () => ({ base, ...session.snapshot() }),
  load: (data) => {
    const d = data as { base?: Base; rows?: MRow[]; input?: MRow };
    if (d.base === 2 || d.base === 8 || d.base === 10 || d.base === 16) base = d.base;
    session.clearAll();
    for (const row of d.rows ?? []) session.entries.push({ row, value: null, error: null });
    if (d.input && d.input.length) session.ed.root = d.input;
    session.ed.cur = [session.ed.root.length];
  },
  reset: () => {
    base = 10;
    ans = 0;
    session.clearAll();
  },
});

export const basenMode: ModeDef = {
  id: 'basen',
  title: 'Basis-N',
  icon: '1010',
  hint: 'DEC · HEX · BIN · OCT',
  View,
  onKey,
  chips,
  status: () => [BASE_NAMES[base]],
};
