import type { ComponentChildren, VNode } from 'preact';
import type { ModeId } from '../ui/state';

export interface Chip {
  label: ComponentChildren;
  /** Tastenaktion, die ausgelöst wird … */
  action?: string;
  /** … oder eine eigene Funktion */
  run?: () => void;
  active?: boolean;
  id?: string;
  title?: string;
}

export interface ModeDef {
  id: ModeId;
  /** Titel in der Kopfzeile und im Menü */
  title: string;
  /** Symbol im Menü */
  icon: ComponentChildren;
  /** Kurzbeschreibung im Menü */
  hint: string;
  View: () => VNode;
  /** Tastenaktion verarbeiten; true, wenn behandelt */
  onKey: (action: string) => boolean;
  /** Kontextleiste über der Tastatur */
  chips?: () => Chip[];
  /** true: Der Modus braucht meist nur Ziffern – Funktionstasten standardmäßig einklappen (Hochformat). */
  compactKeys?: () => boolean;
  /** Zusätzliche Statusanzeigen in der Kopfzeile des Displays */
  status?: () => string[];
}
