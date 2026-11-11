/** Verzeichnis der zwölf Modi (Reihenfolge wie im Menü). */
import type { ModeId } from '../ui/state';
import type { ModeDef } from './types';
import { calcMode } from './calc';
import { complexMode } from './complex';
import { basenMode } from './basen';
import { matrixMode, vectorMode } from './linalg';
import { statsMode } from './stats';
import { distMode } from './dist';
import { tableMode } from './table';
import { equationMode, ineqMode, ratioMode } from './solver';
import { sheetMode } from './sheet';

export const MODE_ORDER: ModeId[] = [
  'calc',
  'complex',
  'basen',
  'matrix',
  'vector',
  'stats',
  'dist',
  'table',
  'equation',
  'ineq',
  'ratio',
  'sheet',
];

export const MODES: Record<ModeId, ModeDef> = {
  calc: calcMode,
  complex: complexMode,
  basen: basenMode,
  matrix: matrixMode,
  vector: vectorMode,
  stats: statsMode,
  dist: distMode,
  table: tableMode,
  equation: equationMode,
  ineq: ineqMode,
  ratio: ratioMode,
  sheet: sheetMode,
};
