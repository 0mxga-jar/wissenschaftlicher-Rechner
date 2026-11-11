/** Modus 2: Komplexe Zahlen (a+bi und Polarform). */
import type { VNode } from 'preact';
import { calculate, type MRow } from '../core';
import { app, makeContext, registerPersister } from '../ui/state';
import { CalcSession } from '../ui/session';
import { SessionView, memoryKey, setAns } from './calc';
import type { Chip, ModeDef } from './types';

const session = new CalcSession({
  evaluate: (src) => calculate(src, makeContext({ complex: true })),
  onResult: setAns,
});

function View(): VNode {
  return <SessionView session={session} emptyHint="z. B. (1+2i)×(3−4i) oder 2∠30" />;
}

function onKey(action: string): boolean {
  if (action === 'calc' || action === 'solve') return false;
  if (memoryKey(session, action)) return true;
  return session.key(action);
}

function chips(): Chip[] {
  const polar = app.settings.complexForm === 'polar';
  return [
    { label: <i>i</i>, action: 't:i', id: 'i' },
    { label: '∠', action: 't:∠', id: 'angle' },
    {
      label: 'a+bi',
      id: 'rect',
      active: !polar,
      run: () => {
        app.settings.complexForm = 'rect';
      },
    },
    {
      label: 'r∠θ',
      id: 'polar',
      active: polar,
      run: () => {
        app.settings.complexForm = 'polar';
      },
    },
    { label: 'Abs', action: 't:Abs(', id: 'abs' },
    { label: 'Arg', action: 't:Arg(', id: 'arg' },
    { label: 'Conjg', action: 't:Conjg(', id: 'conjg' },
    { label: 'Re', action: 't:Re(', id: 're' },
    { label: 'Im', action: 't:Im(', id: 'im' },
    { label: ';', action: 't:;' },
  ];
}

registerPersister('complex', {
  save: () => session.snapshot(),
  load: (data) => {
    const d = data as { rows?: MRow[]; input?: MRow };
    session.clearAll();
    for (const row of d.rows ?? []) session.entries.push({ row, value: null, error: null });
    if (d.input && d.input.length) session.ed.root = d.input;
    session.ed.cur = [session.ed.root.length];
  },
  reset: () => session.clearAll(),
});

export const complexMode: ModeDef = {
  id: 'complex',
  title: 'Komplexe Zahlen',
  icon: 'a+bi',
  hint: 'Betrag, Argument, Polarform',
  View,
  onKey,
  chips,
  status: () => [app.settings.complexForm === 'polar' ? 'r∠θ' : 'a+bi'],
};
