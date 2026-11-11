/** Zentrale Tastenverarbeitung: Bildschirmtastatur, Kontextleiste und Hardware-Tastatur. */
import { app, update, toast, type ModeId } from './state';
import { resolveAction, type KeyDef } from './Keypad';
import { MODES } from '../modes';

export function pressKey(key: KeyDef): void {
  pressAction(resolveAction(key, app.shift, app.alpha));
}

export function setMode(id: ModeId): void {
  app.mode = id;
  app.overlay = null;
  app.keypadHidden = false;
  app.fnKeys = null;
  update();
}

export function pressAction(action: string): void {
  if (action === 'shift') {
    app.shift = !app.shift;
    app.alpha = false;
    update();
    return;
  }
  if (action === 'alpha') {
    app.alpha = !app.alpha;
    app.shift = false;
    update();
    return;
  }
  app.shift = false;
  app.alpha = false;
  switch (action) {
    case 'menu':
      app.overlay = { kind: 'menu' };
      break;
    case 'setup':
      app.overlay = { kind: 'setup' };
      break;
    case 'cat':
      app.overlay = { kind: 'catalog' };
      break;
    case 'const':
      app.overlay = { kind: 'const' };
      break;
    case 'conv':
      app.overlay = { kind: 'conv' };
      break;
    case 'hyp':
      app.overlay = { kind: 'hyp' };
      break;
    case 'sto':
      app.overlay = { kind: 'vars', purpose: 'sto' };
      break;
    case 'rcl':
      app.overlay = { kind: 'vars', purpose: 'rcl' };
      break;
    default: {
      const mode = MODES[app.mode];
      let handled = false;
      try {
        handled = mode.onKey(action);
      } catch (e) {
        console.error(e);
        toast('Diese Aktion konnte nicht ausgeführt werden.');
        handled = true;
      }
      if (!handled) hintUnavailable(action);
    }
  }
  update();
}

function hintUnavailable(action: string): void {
  const names: Record<string, string> = {
    calc: 'CALC',
    solve: 'SOLVE',
    mplus: 'M+',
    mminus: 'M−',
    std: 'S⇔D',
    mixedToggle: 'Gemischter Bruch',
    dms: '°′″',
    fact: 'FACT',
  };
  const n = action.startsWith('sto:') ? 'STO' : names[action];
  if (n) toast(`${n} ist in diesem Modus nicht verfügbar.`);
}

const KEYMAP: Record<string, string> = {
  Enter: 'exe',
  '=': 'exe',
  Backspace: 'del',
  Delete: 'del',
  Escape: 'ac',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  '+': 't:+',
  '-': 't:-',
  '*': 't:×',
  '/': 't:÷',
  '(': 't:(',
  ')': 't:)',
  '.': 't:.',
  ',': 't:.',
  ';': 't:;',
  '!': 't:!',
  '%': 't:%',
  '^': 'p:pow',
  x: 't:x',
  y: 't:y',
  z: 't:z',
  p: 't:π',
  e: 't:e',
  i: 't:i',
  s: 't:sin(',
  c: 't:cos(',
  t: 't:tan(',
  l: 't:ln(',
  r: 'p:sqrt',
  f: 'p:frac',
  A: 't:A',
  B: 't:B',
  C: 't:C',
  D: 't:D',
  E: 't:E',
  F: 't:F',
  M: 't:M',
};

/** Hardware-Tastatur (für Tests am Desktop). */
export function installKeyboard(): void {
  window.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (app.overlay) {
      if (ev.key === 'Escape') {
        app.overlay = null;
        update();
      }
      return;
    }
    let action: string | undefined;
    if (/^[0-9]$/.test(ev.key)) action = `t:${ev.key}`;
    else action = KEYMAP[ev.key];
    if (!action) return;
    ev.preventDefault();
    pressAction(action);
  });
}
