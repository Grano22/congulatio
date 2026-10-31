import { Dices, Workflow } from 'lucide';
import type { IconNode } from 'lucide';
import type { ViewModeId } from '../domain/viewModes';

export const VIEW_MODE_ICONS: Record<ViewModeId, IconNode> = {
  'npc-flow': Workflow,
  dnd: Dices,
};
