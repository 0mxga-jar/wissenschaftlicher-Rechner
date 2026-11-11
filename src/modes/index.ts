/** Verzeichnis der Modi (Modi 7–12 folgen im nächsten Meilenstein). */
import type { ModeId } from '../ui/state';
import type { ModeDef } from './types';
import { calcMode } from './calc';
import { complexMode } from './complex';
import { basenMode } from './basen';
import { matrixMode, vectorMode } from './linalg';
import { statsMode } from './stats';

export const MODE_ORDER: ModeId[] = ['calc', 'complex', 'basen', 'matrix', 'vector', 'stats'];

export const MODES = {
  calc: calcMode,
  complex: complexMode,
  basen: basenMode,
  matrix: matrixMode,
  vector: vectorMode,
  stats: statsMode,
} as unknown as Record<ModeId, ModeDef>;
