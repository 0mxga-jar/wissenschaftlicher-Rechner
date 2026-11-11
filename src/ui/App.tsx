/** App-Gerüst: Kopfzeile, Anzeige, Kontextleiste, Tastatur, Dialoge. */
import type { VNode } from 'preact';
import { app, useApp, update, formatLabel, haptic } from './state';
import { Keypad } from './Keypad';
import { pressKey, pressAction } from './input';
import { OverlayHost } from './overlays';
import { MODES } from '../modes';
import type { Chip } from '../modes/types';

const ANGLES = ['DEG', 'RAD', 'GRA'] as const;

function Chips({ chips }: { chips: Chip[] }): VNode {
  return (
    <div class="chips" data-testid="chips">
      {chips.map((c, i) => (
        <button
          type="button"
          key={c.id ?? i}
          class={`chip${c.active ? ' on' : ''}`}
          data-chip={c.id ?? c.action ?? String(i)}
          title={c.title}
          onPointerDown={(e) => {
            e.preventDefault();
            haptic();
            if (c.run) {
              app.shift = false;
              app.alpha = false;
              c.run();
              update();
            } else if (c.action) pressAction(c.action);
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function App(): VNode {
  useApp();
  const mode = MODES[app.mode] ?? MODES.calc;
  const showFn = app.fnKeys ?? !(mode.compactKeys?.() ?? false);
  const chips: Chip[] = [...(mode.chips?.() ?? [])];
  if (mode.compactKeys) {
    chips.unshift({
      id: 'fn-keys',
      label: (
        <span class="chip-fn">
          f(x)
          <svg viewBox="0 0 12 12" aria-hidden="true" class={showFn ? 'up' : ''}>
            <path d="M2.5 4.5 L6 8 L9.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      ),
      title: 'Funktionstasten ein- oder ausblenden',
      active: showFn,
      run: () => {
        app.fnKeys = !showFn;
      },
    });
  }
  const m = app.vars.M;
  const hasM = !!m && !(m.kind === 'real' && m.isZero());
  const View = mode.View;
  return (
    <div class={`app mode-${mode.id}${app.keypadHidden ? ' kp-hidden' : ''}`}>
      <header class="topbar">
        <button type="button" class="tb-btn tb-menu" data-testid="menu-button" onClick={() => pressAction('menu')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <span>MENU</span>
        </button>
        <h1 class="tb-title" data-testid="mode-title">
          {mode.title}
        </h1>
        <button
          type="button"
          class={`tb-btn tb-icon${app.keypadHidden ? ' on' : ''}`}
          data-testid="keypad-toggle"
          aria-label={app.keypadHidden ? 'Tastatur einblenden' : 'Tastatur ausblenden'}
          onClick={() => {
            app.keypadHidden = !app.keypadHidden;
            update();
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="6" width="18" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8" />
            <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </button>
        <button type="button" class="tb-btn tb-icon" data-testid="setup-button" aria-label="Einstellungen" onClick={() => pressAction('setup')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8" />
            <path
              d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </header>
      <main class="display" data-testid="display">
        <div class="statusline">
          <button
            type="button"
            class="st st-btn"
            data-testid="ind-angle"
            aria-label="Winkeleinheit umschalten"
            onClick={() => {
              const i = ANGLES.indexOf(app.settings.angle);
              app.settings.angle = ANGLES[(i + 1) % 3];
              update();
            }}
          >
            {app.settings.angle}
          </button>
          <button type="button" class="st st-btn" data-testid="ind-format" onClick={() => pressAction('setup')}>
            {formatLabel()}
          </button>
          {mode.status?.().map((t) => (
            <span class="st" key={t}>
              {t}
            </span>
          ))}
          <span class="st-space" />
          {hasM && (
            <span class="st st-m" data-testid="ind-m">
              M
            </span>
          )}
          {app.shift && (
            <span class="st st-shift" data-testid="ind-shift">
              SHIFT
            </span>
          )}
          {app.alpha && (
            <span class="st st-alpha" data-testid="ind-alpha">
              ALPHA
            </span>
          )}
        </div>
        <View />
      </main>
      <Chips chips={chips} />
      <Keypad onPress={pressKey} compact={!showFn} />
      <OverlayHost />
      {app.toast && (
        <div class="toast" role="status" data-testid="toast">
          {app.toast}
        </div>
      )}
    </div>
  );
}
