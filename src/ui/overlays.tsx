/** Überlagerte Dialoge: Modus-Menü, Einstellungen, Katalog, Konstanten, Umrechnung, Variablen. */
import type { ComponentChildren, VNode } from 'preact';
import { useState } from 'preact/hooks';
import { CONSTANTS, CONST_GROUPS, UNIT_CATEGORIES, formatNumber, Real, type NumMode } from '../core';
import { app, update, resetAll, applyTheme, numFormat, VAR_NAMES, toast, type ModeId, type Settings } from './state';
import { Segmented, RealView, Row, Stepper } from './components';
import { scalarRow } from '../core';
import { pressAction, setMode } from './input';
import { MODES, MODE_ORDER } from '../modes';

function close(): void {
  app.overlay = null;
  update();
}

function Sheet({ title, children, testid, wide }: { title: string; children: ComponentChildren; testid: string; wide?: boolean }): VNode {
  return (
    <div class="overlay" data-testid={testid} onClick={(e) => e.target === e.currentTarget && close()}>
      <section class={`sheet${wide ? ' sheet-full' : ''}`} role="dialog" aria-label={title}>
        <header class="sheet-head">
          <h2>{title}</h2>
          <button type="button" class="sheet-close" aria-label="Schließen" data-testid="overlay-close" onClick={close}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </header>
        <div class="sheet-body">{children}</div>
      </section>
    </div>
  );
}

// ───────────────────────────── Menü ─────────────────────────────

function Menu(): VNode {
  return (
    <Sheet title="Modus wählen" testid="menu" wide>
      <div class="menu-grid">
        {MODE_ORDER.map((id: ModeId, i) => {
          const m = MODES[id];
          return (
            <button
              type="button"
              key={id}
              class={`menu-tile${app.mode === id ? ' on' : ''}`}
              data-mode={id}
              onClick={() => setMode(id)}
            >
              <span class="menu-num">{i + 1}</span>
              <span class="menu-icon" aria-hidden="true">
                {m.icon}
              </span>
              <span class="menu-title">{m.title}</span>
              <span class="menu-hint">{m.hint}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

// ───────────────────────────── Einstellungen ─────────────────────────────

function SetRow({ label, hint, children }: { label: string; hint?: string; children: ComponentChildren }): VNode {
  return (
    <div class="set-row">
      <div class="set-label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div class="set-ctl">{children}</div>
    </div>
  );
}

function Setup(): VNode {
  const s = app.settings;
  const [confirm, setConfirm] = useState<null | 'settings' | 'memory' | 'all'>(null);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    s[k] = v;
    if (k === 'theme') applyTheme();
  };
  const sample = formatNumber(1234.56789, numFormat());
  return (
    <Sheet title="Einstellungen" testid="setup" wide>
      <div class="set-group">
        <SetRow label="Winkeleinheit" hint="Grad · Bogenmaß · Neugrad">
          <Segmented
            name="angle"
            options={[
              { value: 'DEG', label: 'DEG' },
              { value: 'RAD', label: 'RAD' },
              { value: 'GRA', label: 'GRA' },
            ]}
            value={s.angle}
            onChange={(v) => set('angle', v)}
          />
        </SetRow>
        <SetRow label="Zahlenformat" hint={`Beispiel: ${sample}`}>
          <Segmented
            name="numMode"
            options={[
              { value: 'norm1' as NumMode, label: 'Norm 1' },
              { value: 'norm2' as NumMode, label: 'Norm 2' },
              { value: 'fix' as NumMode, label: 'Fix' },
              { value: 'sci' as NumMode, label: 'Sci' },
            ]}
            value={s.numMode}
            onChange={(v) => set('numMode', v)}
          />
        </SetRow>
        {s.numMode === 'fix' && (
          <SetRow label="Nachkommastellen (Fix)">
            <Stepper name="fix" value={s.fixDigits} min={0} max={9} onChange={(v) => set('fixDigits', v)} />
          </SetRow>
        )}
        {s.numMode === 'sci' && (
          <SetRow label="Signifikante Stellen (Sci)">
            <Stepper name="sci" value={s.sciDigits} min={1} max={10} onChange={(v) => set('sciDigits', v)} />
          </SetRow>
        )}
        <SetRow label="Dezimaltrennzeichen">
          <Segmented
            name="comma"
            options={[
              { value: 'comma', label: 'Komma 1,5' },
              { value: 'point', label: 'Punkt 1.5' },
            ]}
            value={s.comma ? 'comma' : 'point'}
            onChange={(v) => set('comma', v === 'comma')}
          />
        </SetRow>
      </div>
      <div class="set-group">
        <SetRow label="Ergebnisformat" hint="Exakt: Bruch, Wurzel, π – mit S⇔D umschaltbar">
          <Segmented
            name="resultForm"
            options={[
              { value: 'exact', label: 'Exakt' },
              { value: 'decimal', label: 'Dezimal' },
            ]}
            value={s.resultForm}
            onChange={(v) => set('resultForm', v)}
          />
        </SetRow>
        <SetRow label="Brüche">
          <Segmented
            name="fraction"
            options={[
              { value: 'improper', label: 'unecht 7/2' },
              { value: 'mixed', label: 'gemischt 3½' },
            ]}
            value={s.fraction}
            onChange={(v) => set('fraction', v)}
          />
        </SetRow>
        <SetRow label="Komplexe Ergebnisse">
          <Segmented
            name="complexForm"
            options={[
              { value: 'rect', label: 'a+bi' },
              { value: 'polar', label: 'r∠θ' },
            ]}
            value={s.complexForm}
            onChange={(v) => set('complexForm', v)}
          />
        </SetRow>
      </div>
      <div class="set-group">
        <SetRow label="Design">
          <Segmented
            name="theme"
            options={[
              { value: 'dark', label: 'Dunkel' },
              { value: 'light', label: 'Hell' },
            ]}
            value={s.theme}
            onChange={(v) => set('theme', v)}
          />
        </SetRow>
        <SetRow label="Haptisches Feedback" hint="Vibration beim Tastendruck (wo verfügbar)">
          <Segmented
            name="haptics"
            options={[
              { value: 'on', label: 'An' },
              { value: 'off', label: 'Aus' },
            ]}
            value={s.haptics ? 'on' : 'off'}
            onChange={(v) => set('haptics', v === 'on')}
          />
        </SetRow>
      </div>
      <div class="set-group">
        <div class="set-label">
          <span>Zurücksetzen</span>
        </div>
        {confirm === null ? (
          <div class="reset-row">
            <button type="button" class="btn" data-reset="settings" onClick={() => setConfirm('settings')}>
              Einstellungen
            </button>
            <button type="button" class="btn" data-reset="memory" onClick={() => setConfirm('memory')}>
              Speicher
            </button>
            <button type="button" class="btn btn-danger" data-reset="all" onClick={() => setConfirm('all')}>
              Alles
            </button>
          </div>
        ) : (
          <div class="reset-confirm">
            <p>
              {confirm === 'settings'
                ? 'Alle Einstellungen auf Standard zurücksetzen?'
                : confirm === 'memory'
                  ? 'Variablen, Verlauf und alle eingegebenen Daten löschen?'
                  : 'Einstellungen und alle Daten vollständig zurücksetzen?'}
            </p>
            <div class="reset-row">
              <button type="button" class="btn" onClick={() => setConfirm(null)}>
                Abbrechen
              </button>
              <button
                type="button"
                class="btn btn-danger"
                data-testid="reset-confirm"
                onClick={() => {
                  resetAll(confirm);
                  setConfirm(null);
                  toast('Zurückgesetzt.');
                }}
              >
                Zurücksetzen
              </button>
            </div>
          </div>
        )}
      </div>
      <p class="about">
        Rechenwerk {__APP_VERSION__} · wissenschaftlicher Schulrechner als Offline-App. Alle Berechnungen laufen auf diesem Gerät.
      </p>
    </Sheet>
  );
}

// ───────────────────────────── Katalog ─────────────────────────────

interface CatItem {
  label: string;
  desc: string;
  action: string;
}

const CATALOG: Array<{ title: string; items: CatItem[] }> = [
  {
    title: 'Analysis',
    items: [
      { label: '∫', desc: 'Bestimmtes Integral', action: 'p:int' },
      { label: 'd/dx', desc: 'Ableitung an einer Stelle', action: 'p:diff' },
      { label: 'Σ', desc: 'Summe über x', action: 'p:sum' },
      { label: 'Π', desc: 'Produkt über x', action: 'p:prod' },
    ],
  },
  {
    title: 'Potenzen, Wurzeln, Logarithmen',
    items: [
      { label: '|x|', desc: 'Betrag', action: 'p:abs' },
      { label: 'ⁿ√', desc: 'n-te Wurzel', action: 'p:root' },
      { label: '∛', desc: 'Kubikwurzel', action: 'cbrt' },
      { label: 'logₐ', desc: 'Logarithmus zur Basis a', action: 'p:logb' },
      { label: '10ˣ', desc: 'Zehnerpotenz', action: 'pow10' },
      { label: 'eˣ', desc: 'e-Funktion', action: 'epow' },
      { label: 'a b/c', desc: 'Gemischter Bruch', action: 'p:mixed' },
    ],
  },
  {
    title: 'Hyperbelfunktionen',
    items: [
      { label: 'sinh', desc: 'Sinus hyperbolicus', action: 't:sinh(' },
      { label: 'cosh', desc: 'Kosinus hyperbolicus', action: 't:cosh(' },
      { label: 'tanh', desc: 'Tangens hyperbolicus', action: 't:tanh(' },
      { label: 'sinh⁻¹', desc: 'Areasinus', action: 't:asinh(' },
      { label: 'cosh⁻¹', desc: 'Areakosinus', action: 't:acosh(' },
      { label: 'tanh⁻¹', desc: 'Areatangens', action: 't:atanh(' },
    ],
  },
  {
    title: 'Winkel und Koordinaten',
    items: [
      { label: '°', desc: 'Winkelangabe in Grad', action: 't:@deg' },
      { label: 'ʳ', desc: 'Winkelangabe im Bogenmaß', action: 't:@rad' },
      { label: 'ᵍ', desc: 'Winkelangabe in Neugrad', action: 't:@gra' },
      { label: '°′″', desc: 'Grad, Minuten, Sekunden', action: 'dms' },
      { label: 'Pol(', desc: 'Kartesisch → polar: Pol(x;y)', action: 't:Pol(' },
      { label: 'Rec(', desc: 'Polar → kartesisch: Rec(r;θ)', action: 't:Rec(' },
    ],
  },
  {
    title: 'Wahrscheinlichkeit',
    items: [
      { label: 'x!', desc: 'Fakultät', action: 't:!' },
      { label: 'nPr', desc: 'Permutationen', action: 't:nPr' },
      { label: 'nCr', desc: 'Kombinationen (Binomialkoeffizient)', action: 't:nCr' },
      { label: 'Ran#', desc: 'Zufallszahl 0,000 … 0,999', action: 't:Ran#' },
      { label: 'RanInt(', desc: 'Ganze Zufallszahl: RanInt(a;b)', action: 't:RanInt(' },
    ],
  },
  {
    title: 'Ganze Zahlen und Runden',
    items: [
      { label: 'ggT(', desc: 'Größter gemeinsamer Teiler', action: 't:ggT(' },
      { label: 'kgV(', desc: 'Kleinstes gemeinsames Vielfaches', action: 't:kgV(' },
      { label: '÷R', desc: 'Division mit Rest', action: 't:÷R' },
      { label: 'Rest(', desc: 'Rest der Division: Rest(a;b)', action: 't:Rest(' },
      { label: 'FACT', desc: 'Primfaktorzerlegung des Ergebnisses', action: 'fact' },
      { label: 'Int(', desc: 'Ganzzahliger Anteil', action: 't:Int(' },
      { label: 'Intg(', desc: 'Abrunden auf ganze Zahl', action: 't:Intg(' },
      { label: 'Rnd(', desc: 'Auf Anzeigeformat runden', action: 't:Rnd(' },
      { label: '%', desc: 'Prozent', action: 't:%' },
    ],
  },
  {
    title: 'Komplexe Zahlen',
    items: [
      { label: 'i', desc: 'Imaginäre Einheit', action: 't:i' },
      { label: '∠', desc: 'Polarform r∠θ', action: 't:∠' },
      { label: 'Abs(', desc: 'Betrag', action: 't:Abs(' },
      { label: 'Arg(', desc: 'Argument (Winkel)', action: 't:Arg(' },
      { label: 'Conjg(', desc: 'Konjugiert komplexe Zahl', action: 't:Conjg(' },
      { label: 'Re(', desc: 'Realteil', action: 't:Re(' },
      { label: 'Im(', desc: 'Imaginärteil', action: 't:Im(' },
    ],
  },
  {
    title: 'Matrizen und Vektoren',
    items: [
      { label: 'det(', desc: 'Determinante', action: 't:det(' },
      { label: 'Trn(', desc: 'Transponierte', action: 't:Trn(' },
      { label: 'Inv(', desc: 'Inverse Matrix', action: 't:Inv(' },
      { label: 'Identity(', desc: 'Einheitsmatrix', action: 't:Identity(' },
      { label: 'Rref(', desc: 'Reduzierte Zeilenstufenform', action: 't:Rref(' },
      { label: 'DotP(', desc: 'Skalarprodukt', action: 't:DotP(' },
      { label: 'CrossP(', desc: 'Kreuzprodukt', action: 't:CrossP(' },
      { label: 'Angle(', desc: 'Winkel zwischen Vektoren', action: 't:Angle(' },
      { label: 'UnitV(', desc: 'Einheitsvektor', action: 't:UnitV(' },
    ],
  },
  {
    title: 'Sonstiges',
    items: [
      { label: ';', desc: 'Trennzeichen für Argumente', action: 't:;' },
      { label: '=', desc: 'Gleichheitszeichen (für SOLVE)', action: 't:=' },
      { label: 'PreAns', desc: 'Vorletztes Ergebnis', action: 't:PreAns' },
      { label: 'Summe(', desc: 'Summe eines Zellbereichs', action: 't:Summe(' },
      { label: 'Mittel(', desc: 'Mittelwert eines Zellbereichs', action: 't:Mittel(' },
      { label: 'Min(', desc: 'Kleinster Wert', action: 't:Min(' },
      { label: 'Max(', desc: 'Größter Wert', action: 't:Max(' },
    ],
  },
];

function insert(action: string): void {
  app.overlay = null;
  pressAction(action);
}

function Catalog(): VNode {
  return (
    <Sheet title="Katalog" testid="catalog" wide>
      {CATALOG.map((g) => (
        <div class="cat-group" key={g.title}>
          <h3>{g.title}</h3>
          <div class="cat-list">
            {g.items.map((it) => (
              <button type="button" class="cat-item" key={it.action} data-action={it.action} onClick={() => insert(it.action)}>
                <span class="cat-label">{it.label}</span>
                <span class="cat-desc">{it.desc}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  );
}

function Hyp(): VNode {
  const items: Array<[string, string]> = [
    ['sinh', 't:sinh('],
    ['cosh', 't:cosh('],
    ['tanh', 't:tanh('],
    ['sinh⁻¹', 't:asinh('],
    ['cosh⁻¹', 't:acosh('],
    ['tanh⁻¹', 't:atanh('],
  ];
  return (
    <Sheet title="Hyperbelfunktionen" testid="hyp">
      <div class="hyp-grid">
        {items.map(([label, action]) => (
          <button type="button" class="btn btn-big" key={action} data-action={action} onClick={() => insert(action)}>
            {label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

// ───────────────────────────── Konstanten und Umrechnung ─────────────────────────────

function Constants(): VNode {
  const fmt = { ...numFormat(), mode: 'norm1' as NumMode };
  return (
    <Sheet title="Physikalische Konstanten" testid="const" wide>
      {CONST_GROUPS.map((g) => (
        <div class="cat-group" key={g}>
          <h3>{g}</h3>
          <div class="cat-list">
            {CONSTANTS.filter((c) => c.group === g).map((c) => (
              <button type="button" class="cat-item const-item" key={c.id} data-const={c.id} onClick={() => insert(`t:$${c.id}`)}>
                <span class="cat-label">{c.symbol}</span>
                <span class="cat-desc">
                  {c.name}
                  <small>
                    {formatNumber(c.value, fmt)} {c.unit}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <p class="about">Werte nach CODATA 2018.</p>
    </Sheet>
  );
}

function Conversion(): VNode {
  const [cat, setCat] = useState(UNIT_CATEGORIES[0].id);
  const category = UNIT_CATEGORIES.find((c) => c.id === cat)!;
  const [from, setFrom] = useState(category.units[0].id);
  const [to, setTo] = useState(category.units[1].id);
  const pickCat = (id: string) => {
    const c = UNIT_CATEGORIES.find((x) => x.id === id)!;
    setCat(id);
    setFrom(c.units[0].id);
    setTo(c.units[1].id);
  };
  const fromU = category.units.find((u) => u.id === from) ?? category.units[0];
  const toU = category.units.find((u) => u.id === to) ?? category.units[1];
  return (
    <Sheet title="Einheiten umrechnen" testid="conv" wide>
      <div class="chip-wrap">
        {UNIT_CATEGORIES.map((c) => (
          <button type="button" key={c.id} class={`chip${c.id === cat ? ' on' : ''}`} data-cat={c.id} onClick={() => pickCat(c.id)}>
            {c.name}
          </button>
        ))}
      </div>
      <div class="conv-cols">
        <div>
          <h3>Von</h3>
          {category.units.map((u) => (
            <button type="button" key={u.id} class={`conv-unit${u.id === fromU.id ? ' on' : ''}`} data-from={u.id} onClick={() => setFrom(u.id)}>
              <b>{u.label}</b> <span>{u.name}</span>
            </button>
          ))}
        </div>
        <div>
          <h3>Nach</h3>
          {category.units.map((u) => (
            <button type="button" key={u.id} class={`conv-unit${u.id === toU.id ? ' on' : ''}`} data-to={u.id} onClick={() => setTo(u.id)}>
              <b>{u.label}</b> <span>{u.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div class="sheet-foot">
        <span class="muted">
          Der Umrechner wird hinter die Zahl gesetzt, z. B. 5 {fromU.label}▸{toU.label}.
        </span>
        <button
          type="button"
          class="btn btn-primary"
          data-testid="conv-insert"
          disabled={fromU.id === toU.id}
          onClick={() => insert(`t:@${fromU.id}>${toU.id}`)}
        >
          {fromU.label} ▸ {toU.label} einfügen
        </button>
      </div>
    </Sheet>
  );
}

// ───────────────────────────── Variablen ─────────────────────────────

function Vars({ purpose }: { purpose: 'sto' | 'rcl' }): VNode {
  const s = app.settings;
  return (
    <Sheet title={purpose === 'sto' ? 'Speichern in … (STO)' : 'Variable abrufen (RCL)'} testid="vars">
      <div class="var-grid">
        {VAR_NAMES.map((name) => {
          const v = app.vars[name] ?? Real.ZERO;
          return (
            <button
              type="button"
              class="var-item"
              key={name}
              data-var={name}
              onClick={() => {
                app.overlay = null;
                if (purpose === 'sto') pressAction(`sto:${name}`);
                else pressAction(`t:${name}`);
              }}
            >
              <span class="var-name">{name}</span>
              <span class="var-val">
                {v.kind === 'real' ? (
                  <RealView r={v} />
                ) : v.kind === 'complex' ? (
                  <Row row={scalarRow(v, numFormat(), 'exact', s.complexForm, s.angle)} />
                ) : (
                  '0'
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div class="sheet-foot">
        <span class="muted">{purpose === 'sto' ? 'Der aktuelle Wert wird in der gewählten Variablen abgelegt.' : 'Die Variable wird an der Cursorposition eingefügt.'}</span>
        <button
          type="button"
          class="btn"
          data-testid="vars-clear"
          onClick={() => {
            for (const n of VAR_NAMES) delete app.vars[n];
            toast('Alle Variablen gelöscht.');
          }}
        >
          Alle löschen
        </button>
      </div>
    </Sheet>
  );
}

export function OverlayHost(): VNode | null {
  const o = app.overlay;
  if (!o) return null;
  switch (o.kind) {
    case 'menu':
      return <Menu />;
    case 'setup':
      return <Setup />;
    case 'catalog':
      return <Catalog />;
    case 'const':
      return <Constants />;
    case 'conv':
      return <Conversion />;
    case 'hyp':
      return <Hyp />;
    case 'vars':
      return <Vars purpose={o.purpose} />;
    default:
      return null;
  }
}
