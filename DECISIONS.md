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

## Bedienkonzept
- **MENU und Einstellungen in der Kopfzeile**, Statusanzeigen (DEG/RAD/GRA, Zahlenformat, M, SHIFT/ALPHA)
  im Display wie bei einem echten Rechner. Antippen von „DEG“ schaltet die Winkeleinheit direkt um.
- **Tastenlayout** eigenständig: Steuerzeile (SHIFT, ALPHA, Cursor), vier Funktionszeilen, Ziffernblock
  mit DEL/AC und Operatoren rechts. SHIFT = gelb, ALPHA = violett.
- **Kontextleiste** über der Tastatur mit den Zusatzfunktionen des jeweiligen Modus (z. B. i und ∠,
  MatA…MatD, and/or/xor, Summe/Mittel) – so bleibt die Tastatur in allen Modi gleich.
- **Formular-Modi** (Matrizen-Editor, Statistik, Verteilungen, Gleichungen, Ungleichungen, Verhältnis,
  Tabellenkalkulation): Felder werden angetippt, die Eingabe erscheint in einer Formelzeile und wird mit
  „=“ übernommen (wie am Schulrechner). Dort sind die Funktionstasten standardmäßig eingeklappt
  (Taste „f(x)“), damit auf dem Handy mehr Platz für Daten und Ergebnisse bleibt.
- **STO/RCL** öffnen eine Variablenliste mit den aktuellen Werten statt einer blinden Tastenfolge.
- **hyp** öffnet eine kleine Auswahl der sechs Hyperbelfunktionen.
- In der **Tabellenkalkulation** springt „=“ nach unten, in allen anderen Formularen zum nächsten Feld.
- **Querformat:** Display links, Tastatur (Funktions- und Ziffernblock nebeneinander) rechts.
- Der Graph der Wertetabelle verwendet ein auf Farbfehlsichtigkeit geprüftes Farbpaar (Blau/Orange),
  Legende, Ablesen per Fingertipp und die Wertetabelle als gleichwertige Tabellenansicht.

## Lieferung
- `dist/` und `release/rechenwerk-dist.zip` liegen **mit im Repository**, damit der fertige Build ohne
  Entwicklungsumgebung heruntergeladen und z. B. per Drag & Drop bei Netlify veröffentlicht werden kann.
- Der GitHub-Actions-Workflow testet und baut auf jedem Branch, veröffentlicht aber nur vom
  Standard-Branch (oder bei manuellem Start) auf GitHub Pages.
- Anzeige-Schrift: IBM Plex Mono, die Ziffer 0 jedoch ohne Punkt (Glyphe aus IBM Plex Sans mit
  identischer Breite) – eine gepunktete Null wäre im Schulkontext missverständlich.

## Qualitätssicherung
- Rund 390 Unit-Tests (Vitest) für Rechenkern, Editor und Bedienlogik; 134 End-to-End-Tests
  (Playwright) auf 375×812 und 412×915 inklusive Layout-Prüfung, Querformat, kleinem Display und
  Offline-Betrieb.
- Vor dem Abschluss lief eine **unabhängige Code-Durchsicht** mit ausgeführten Stichproben
  (Fuzzing gegen Referenzwerte). Ihre zwölf bestätigten Befunde sind behoben und als Regressionstests
  in `tests/unit/review.test.ts` festgehalten, unter anderem:
  - Polynomlöser: mehrfache Nullstellen (quadratfreier Teil über den ggT mit der Ableitung, numerisch
    über die (k−1)-te Ableitung) und stark unterschiedliche Größenordnungen der Koeffizienten.
  - Numerische Ableitung: mehrere Schrittweiten, Auswahl nach Fehlerschätzung inkl. Rundungsrauschen
    (richtig auch nahe Polstellen, an Knicken und bei großem |x|).
  - SOLVE: Steigung mit anpassender Schrittweite, Schrittweitenhalbierung, Lösung wird nur
    akzeptiert, wenn der nächste Newton-Schritt verschwindet (keine Scheinlösungen an Polstellen).
  - Integration: Ergebnis 0 ohne Rundungsrauschen, Tanh-Sinh-Quadratur für Randsingularitäten,
    divergente Integrale werden gemeldet.
  - Exakte Wurzelausdrücke werden bei Auslöschung mit 60 Stellen nachgerechnet
    (z. B. √(10¹⁴+1) − 10⁷).
  - STO und M+ setzen Ans; per Schaltfläche gefüllte Matrizen/Vektoren werden mitgespeichert.
- Die physikalischen Konstanten konnten in der Arbeitsumgebung nicht online gegen die NIST-Tabelle
  geprüft werden (kein Netzzugriff auf physics.nist.gov). Stattdessen prüfen 31 Tests ihre gegenseitige
  Konsistenz (z. B. ħ = h/2π, α = e²/(4πε₀ħc), σ = 2π⁵k⁴/(15h³c²), R∞ = α²mₑc/2h).
