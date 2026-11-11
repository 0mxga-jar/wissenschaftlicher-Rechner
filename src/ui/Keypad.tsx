/** Bildschirmtastatur mit SHIFT-/ALPHA-Zweitbelegung. */
import type { ComponentChildren, VNode } from 'preact';
import { useRef } from 'preact/hooks';
import { app, haptic } from './state';

export interface KeyFace {
  action: string;
  label: ComponentChildren;
  /** Text für Screenreader */
  aria: string;
}

export interface KeyDef {
  id: string;
  cls: 'num' | 'op' | 'fn' | 'ctl' | 'eq' | 'del' | 'mod-shift' | 'mod-alpha' | 'nav';
  main: KeyFace;
  shift?: KeyFace;
  alpha?: KeyFace;
  repeat?: boolean;
}

const Box = (): VNode => <span class="ki-box" />;
const f = (action: string, label: ComponentChildren, aria?: string): KeyFace => ({
  action,
  label,
  aria: aria ?? (typeof label === 'string' ? label : action),
});

const Tri = ({ dir }: { dir: 'l' | 'r' | 'u' | 'd' }): VNode => {
  const rot = { u: 0, r: 90, d: 180, l: 270 }[dir];
  return (
    <svg viewBox="0 0 24 24" class="ki-tri" style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
      <path d="M12 6.5 L19 17 H5 Z" fill="currentColor" />
    </svg>
  );
};

const FracIcon = (): VNode => (
  <span class="ki-frac">
    <Box />
    <span class="ki-bar" />
    <Box />
  </span>
);

const CONTROL: KeyDef[] = [
  { id: 'shift', cls: 'mod-shift', main: f('shift', 'SHIFT', 'Shift') },
  { id: 'alpha', cls: 'mod-alpha', main: f('alpha', 'ALPHA', 'Alpha') },
  { id: 'left', cls: 'nav', main: f('left', <Tri dir="l" />, 'Cursor links'), repeat: true },
  { id: 'up', cls: 'nav', main: f('up', <Tri dir="u" />, 'Cursor hoch'), repeat: true },
  { id: 'down', cls: 'nav', main: f('down', <Tri dir="d" />, 'Cursor runter'), repeat: true },
  { id: 'right', cls: 'nav', main: f('right', <Tri dir="r" />, 'Cursor rechts'), repeat: true },
];

const FUNCTION_ROWS: KeyDef[][] = [
  [
    { id: 'cat', cls: 'ctl', main: f('cat', 'KAT', 'Katalog'), shift: f('const', 'KONST', 'Konstanten'), alpha: f('conv', 'UMR', 'Umrechnung') },
    { id: 'calc', cls: 'ctl', main: f('calc', 'CALC'), shift: f('solve', 'SOLVE'), alpha: f('t:=', '=', 'Gleichheitszeichen') },
    {
      id: 'int',
      cls: 'fn',
      main: f('p:int', <span>∫<Box /></span>, 'Integral'),
      shift: f('p:diff', <span class="ki-ddx">d/dx</span>, 'Ableitung'),
    },
    { id: 'sum', cls: 'fn', main: f('p:sum', 'Σ', 'Summe'), shift: f('p:prod', 'Π', 'Produkt') },
    { id: 'x', cls: 'fn', main: f('t:x', <i>x</i>, 'x'), shift: f('t:y', <i>y</i>, 'y'), alpha: f('t:z', <i>z</i>, 'z') },
    { id: 'inv', cls: 'fn', main: f('inv', <span><i>x</i><sup>−1</sup></span>, 'Kehrwert'), shift: f('t:!', <span><i>x</i>!</span>, 'Fakultät') },
  ],
  [
    {
      id: 'frac',
      cls: 'fn',
      main: f('p:frac', <FracIcon />, 'Bruch'),
      shift: f('p:mixed', <span class="ki-mixed"><Box /><FracIcon /></span>, 'Gemischter Bruch'),
    },
    { id: 'sqrt', cls: 'fn', main: f('p:sqrt', <span>√<Box /></span>, 'Quadratwurzel'), shift: f('cbrt', <span><sup>3</sup>√<Box /></span>, 'Kubikwurzel') },
    { id: 'sq', cls: 'fn', main: f('sq', <span><i>x</i><sup>2</sup></span>, 'Quadrat'), shift: f('cube', <span><i>x</i><sup>3</sup></span>, 'hoch 3') },
    {
      id: 'pow',
      cls: 'fn',
      main: f('p:pow', <span><i>x</i><sup><Box /></sup></span>, 'Potenz'),
      shift: f('p:root', <span><sup><Box /></sup>√<Box /></span>, 'n-te Wurzel'),
    },
    {
      id: 'log',
      cls: 'fn',
      main: f('t:log(', 'log'),
      shift: f('pow10', <span>10<sup><Box /></sup></span>, '10 hoch'),
      alpha: f('p:logb', <span>log<sub><Box /></sub></span>, 'Logarithmus zur Basis'),
    },
    { id: 'ln', cls: 'fn', main: f('t:ln(', 'ln'), shift: f('epow', <span><i>e</i><sup><Box /></sup></span>, 'e hoch') },
  ],
  [
    { id: 'neg', cls: 'fn', main: f('neg', '(−)', 'Vorzeichen minus'), shift: f('p:abs', <span>|<Box />|</span>, 'Betrag'), alpha: f('t:A', 'A') },
    { id: 'dms', cls: 'fn', main: f('dms', '°′″', 'Grad Minuten Sekunden'), shift: f('fact', 'FACT', 'Primfaktorzerlegung'), alpha: f('t:B', 'B') },
    { id: 'hyp', cls: 'fn', main: f('hyp', 'hyp', 'Hyperbelfunktionen'), alpha: f('t:C', 'C') },
    { id: 'sin', cls: 'fn', main: f('t:sin(', 'sin'), shift: f('t:asin(', <span>sin<sup>−1</sup></span>, 'Arkussinus'), alpha: f('t:D', 'D') },
    { id: 'cos', cls: 'fn', main: f('t:cos(', 'cos'), shift: f('t:acos(', <span>cos<sup>−1</sup></span>, 'Arkuskosinus'), alpha: f('t:E', 'E') },
    { id: 'tan', cls: 'fn', main: f('t:tan(', 'tan'), shift: f('t:atan(', <span>tan<sup>−1</sup></span>, 'Arkustangens'), alpha: f('t:F', 'F') },
  ],
  [
    { id: 'sto', cls: 'ctl', main: f('sto', 'STO', 'Speichern'), shift: f('rcl', 'RCL', 'Abrufen') },
    { id: 'lp', cls: 'fn', main: f('t:(', '(', 'Klammer auf'), shift: f('t:∠', '∠', 'Winkelzeichen') },
    { id: 'rp', cls: 'fn', main: f('t:)', ')', 'Klammer zu'), shift: f('t:;', ';', 'Semikolon'), alpha: f('t::', ':', 'Doppelpunkt') },
    { id: 'sd', cls: 'ctl', main: f('std', 'S⇔D', 'Exakt oder dezimal'), shift: f('mixedToggle', <span class="ki-small">a<sup>b</sup>⁄<sub>c</sub></span>, 'Gemischter Bruch umschalten') },
    { id: 'mplus', cls: 'ctl', main: f('mplus', 'M+', 'M plus'), shift: f('mminus', 'M−', 'M minus'), alpha: f('t:M', 'M') },
    { id: 'pi', cls: 'fn', main: f('t:π', 'π', 'Pi'), shift: f('t:e', <i>e</i>, 'Eulersche Zahl'), alpha: f('t:i', <i>i</i>, 'Imaginäre Einheit') },
  ],
];

const d = (n: string, shift?: KeyFace, alpha?: KeyFace): KeyDef => ({ id: n, cls: 'num', main: f(`t:${n}`, n), shift, alpha });

const NUMERIC_ROWS: KeyDef[][] = [
  [
    d('7'),
    d('8'),
    d('9'),
    { id: 'del', cls: 'del', main: f('del', 'DEL', 'Löschen'), repeat: true },
    { id: 'ac', cls: 'del', main: f('ac', 'AC', 'Alles löschen') },
  ],
  [
    d('4'),
    d('5'),
    d('6'),
    { id: 'mul', cls: 'op', main: f('t:×', '×', 'mal'), shift: f('t:nPr', 'nPr'), alpha: f('t:ggT(', 'ggT') },
    { id: 'div', cls: 'op', main: f('t:÷', '÷', 'geteilt'), shift: f('t:nCr', 'nCr'), alpha: f('t:÷R', '÷R', 'Division mit Rest') },
  ],
  [
    d('1'),
    d('2'),
    d('3'),
    { id: 'add', cls: 'op', main: f('t:+', '+', 'plus'), shift: f('t:Pol(', 'Pol'), alpha: f('t:kgV(', 'kgV') },
    { id: 'sub', cls: 'op', main: f('t:-', '−', 'minus'), shift: f('t:Rec(', 'Rec'), alpha: f('t:Int(', 'Int') },
  ],
  [
    d('0', f('t:Rnd(', 'Rnd')),
    { id: 'dot', cls: 'num', main: f('t:.', ',', 'Komma'), shift: f('t:Ran#', 'Ran#'), alpha: f('t:RanInt(', 'RanInt') },
    { id: 'exp', cls: 'num', main: f('t:ᴇ', <span class="ki-exp">×10<sup><i>x</i></sup></span>, 'mal zehn hoch') },
    { id: 'ans', cls: 'num', main: f('t:Ans', 'Ans'), shift: f('t:%', '%', 'Prozent'), alpha: f('t:PreAns', 'PreAns') },
    { id: 'exe', cls: 'eq', main: f('exe', '=', 'Ergebnis'), shift: f('approx', '≈', 'Dezimales Ergebnis') },
  ],
];

export const ALL_KEYS: KeyDef[] = [...CONTROL, ...FUNCTION_ROWS.flat(), ...NUMERIC_ROWS.flat()];

/** Liefert die Aktion einer Taste unter Berücksichtigung von SHIFT/ALPHA. */
export function resolveAction(key: KeyDef, shift: boolean, alpha: boolean): string {
  if (shift && key.shift) return key.shift.action;
  if (alpha && key.alpha) return key.alpha.action;
  return key.main.action;
}

interface KeyProps {
  def: KeyDef;
  onPress: (key: KeyDef) => void;
  comma: boolean;
  bare?: boolean;
}

function Key({ def, onPress, comma, bare }: KeyProps): VNode {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPointer = useRef(0);

  const btn = useRef<HTMLButtonElement>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    if (interval.current) clearInterval(interval.current);
    timer.current = null;
    interval.current = null;
    btn.current?.classList.remove('pressed');
  };
  const down = (ev: PointerEvent) => {
    if (ev.button !== undefined && ev.button > 0) return;
    ev.preventDefault();
    lastPointer.current = performance.now();
    // sichtbare Rückmeldung unabhängig vom :active-Verhalten des Browsers
    btn.current?.classList.add('pressed');
    haptic();
    onPress(def);
    if (def.repeat) {
      stop();
      timer.current = setTimeout(() => {
        interval.current = setInterval(() => onPress(def), 70);
      }, 420);
    }
  };
  const click = () => {
    // nur für Tastaturbedienung / Hilfstechnologien (Pointer wurde bereits verarbeitet)
    if (performance.now() - lastPointer.current < 700) return;
    onPress(def);
  };

  const active = (def.id === 'shift' && app.shift) || (def.id === 'alpha' && app.alpha);
  const mainLabel = def.id === 'dot' ? (comma ? ',' : '.') : def.main.label;
  const dim = (app.shift && !def.shift && def.cls !== 'mod-shift') || (app.alpha && !def.alpha && def.cls !== 'mod-alpha');
  return (
    <div class={`key-wrap${bare ? ' bare' : ''}`}>
      {!bare && (
        <div class="key-sec" aria-hidden="true">
          <span class={`sec-shift${app.shift && def.shift ? ' on' : ''}`}>{def.shift?.label}</span>
          <span class={`sec-alpha${app.alpha && def.alpha ? ' on' : ''}`}>{def.alpha?.label}</span>
        </div>
      )}
      <button
        type="button"
        ref={btn}
        class={`key k-${def.cls}${active ? ' active' : ''}${dim ? ' dim' : ''}`}
        data-key={def.id}
        aria-label={def.main.aria}
        aria-pressed={def.cls.startsWith('mod') ? active : undefined}
        onPointerDown={down}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onClick={click}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span class="key-label">{mainLabel}</span>
      </button>
    </div>
  );
}

export function Keypad({ onPress, compact = false }: { onPress: (key: KeyDef) => void; compact?: boolean }): VNode {
  const comma = app.settings.comma;
  return (
    <div
      class={`keypad${app.shift ? ' is-shift' : ''}${app.alpha ? ' is-alpha' : ''}${compact ? ' compact' : ''}`}
      role="group"
      aria-label="Tastatur"
    >
      <div class="kp-block kp-fn">
        <div class="kp-row kp-control">
          {CONTROL.map((k) => (
            <Key key={k.id} def={k} onPress={onPress} comma={comma} bare />
          ))}
        </div>
        {FUNCTION_ROWS.map((row, i) => (
          <div class="kp-row" key={i}>
            {row.map((k) => (
              <Key key={k.id} def={k} onPress={onPress} comma={comma} />
            ))}
          </div>
        ))}
      </div>
      <div class="kp-block kp-num">
        {NUMERIC_ROWS.map((row, i) => (
          <div class="kp-row" key={i}>
            {row.map((k) => (
              <Key key={k.id} def={k} onPress={onPress} comma={comma} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
