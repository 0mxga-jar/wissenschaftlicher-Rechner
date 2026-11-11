/** Verzeichnis der Modi (weitere Modi folgen in den nächsten Meilensteinen). */
import type { ModeId } from '../ui/state';
import type { ModeDef } from './types';
import { calcMode } from './calc';

export const MODE_ORDER: ModeId[] = ['calc'];

export const MODES = { calc: calcMode } as unknown as Record<ModeId, ModeDef>;
