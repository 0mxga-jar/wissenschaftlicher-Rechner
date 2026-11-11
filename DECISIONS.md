# Entscheidungen

Kurzprotokoll der Entscheidungen, die beim Bau von **Rechenwerk** autonom getroffen wurden.

## Name und Gestaltung
- **Name „Rechenwerk“** – eigener Name, eigenes Icon, eigenes Tastenlayout. Keine Marken, Logos oder
  Gehäuse-Nachbildungen anderer Hersteller; nur die *Funktionsweise* (Natural Display, Modi-Menü,
  SHIFT/ALPHA) orientiert sich an üblichen Oberstufen-Schulrechnern.
- Ein separater Frontend-Design-Skill war in der Arbeitsumgebung nicht verfügbar; das Design folgt
  daher eigenen Leitlinien (dunkles Standard-Theme, getöntes Display, IBM Plex Sans/Mono, farblich
  gruppierte Tasten, große Touch-Flächen).

## Technik
- **Vite + TypeScript + Preact** (3 kB) für die Oberfläche; keine Server-Komponente.
- **Eigener 2D-Formeleditor statt MathLive.** Gründe: MathLive bringt eine eigene virtuelle
  Tastatur, eigene Schriften und LaTeX als Zwischenformat mit; für eine Taschenrechner-Bedienung
  (eigene Tasten, Cursor-Navigation wie am Schulrechner, vollständig offline, kleines Bundle) ist ein
  schlanker Struktur-Editor robuster und exakt steuerbar.
- **Eigener Rechenkern statt math.js.** Exakte Arithmetik über BigInt-Brüche und Ausdrücke der Form
  Σ c·√r·π (damit Bruch-, Wurzel- und π-Ergebnisse wie am Schulrechner). Alles andere rechnet mit
  `double` und wird auf 10 signifikante Stellen angezeigt.
- **Trennung:** `src/core` (reiner Rechenkern, keine DOM-Abhängigkeit, voll getestet), `src/editor`
  (Formeleditor-Modell), `src/ui` (Tastatur, Display, Dialoge), `src/modes` (die zwölf Modi).
- **Relativer Vite-Basispfad (`base: './'`).** Derselbe Build funktioniert unverändert unter
  GitHub Pages (`/<repo>/`), Netlify (`/`) und in jedem Unterordner – kein Repo-Name im Build.
- **Service Worker selbst geschrieben** (kleines Vite-Plugin erzeugt `sw.js` mit Dateiliste und
  Versions-Hash) statt Workbox – keine zusätzliche Abhängigkeit, vollständiger Offline-Cache.
- **`display: standalone`** im Manifest: Start ohne Browser-Leisten („Vollbild“), die Statusleiste des
  Telefons (Uhr, Akku) bleibt sichtbar. Funktioniert identisch auf iOS und Android.

## Rechenregeln
- Dezimaltrennzeichen intern immer Punkt; die Anzeige mit **Dezimalkomma** ist einstellbar (Standard:
  Komma). Funktionsargumente werden mit **Semikolon** getrennt.
- **Implizite Multiplikation bindet stärker als × und ÷** (wie bei aktuellen Schulrechnern):
  `1÷2π` = 1/(2π), `6÷2(1+2)` = 1.
- `−2²` = −4 (Vorzeichen bindet schwächer als die Potenz).
- Dezimalzahlen werden exakt als Brüche gelesen: `0,1 + 0,2` ergibt genau `3/10` bzw. `0,3`.
- Exakte Ergebnisse werden angezeigt, solange Zähler/Nenner/Radikanden unter 10 Stellen bleiben und
  höchstens drei Summanden nötig sind; sonst dezimal.
- Fix/Sci runden kaufmännisch auf Dezimalbasis (2,675 → 2,68), nicht binär.
- Zahlbereich: voller `double`-Bereich (bis ca. 1,8·10³⁰⁸); Fakultät bis 170!.
- `0^0` und `tan 90°` sind Fehler („Mathematischer Fehler“), fehlende schließende Klammern am Ende
  werden ergänzt.
- Physikalische Konstanten nach **CODATA 2018**.
- Basis-N rechnet mit vorzeichenbehafteten 32-Bit-Ganzzahlen (Zweierkomplement) in allen Basen.
- SOLVE: Newton-Verfahren ab Startwert, mit automatischen Ausweichstrategien (weitere Startwerte,
  Vorzeichenwechsel-Suche + Bisektion), wenn Newton nicht konvergiert.
- Polynomgleichungen: rationale Nullstellen und quadratische Restfaktoren exakt (Wurzeln, komplexe
  Lösungen), sonst numerisch (Durand-Kerner mit Newton-Nachiteration). Mehrfache Lösungen werden nur
  einmal ausgegeben.
