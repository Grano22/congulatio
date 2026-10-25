import { Component } from '@angular/core';
import { BadgeCheck, Filter, GitBranch, Maximize2, MessageSquare, Minus, Plus, Zap } from 'lucide';
import type { IconNode } from 'lucide';
import { RpgPanel } from '../ui/rpg-panel';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';

type NodeKind = 'line' | 'choice' | 'action';

/**
 * Static placeholder graph — the loom will render real nodes from the
 * dialogue store later.
 */
interface LoomNode {
  id: string;
  kind: NodeKind;
  title: string;
  text: string;
  /** node centre, in % of the canvas */
  x: number;
  y: number;
}

const SAMPLE_NODES: LoomNode[] = [
  { id: 'n1', kind: 'line', title: 'Greeting', text: '“So, a challenger comes to my hall…”', x: 20, y: 26 },
  { id: 'n2', kind: 'choice', title: 'Choice', text: 'The visitor may…', x: 48, y: 58 },
  { id: 'n3', kind: 'line', title: 'Offer Reward', text: '“Take this coin, and my blessing.”', x: 78, y: 26 },
  { id: 'n4', kind: 'action', title: 'Demand Tribute', text: '“Kneel, or leave through the mud.”', x: 78, y: 80 },
];

const KIND_LABEL: Record<NodeKind, string> = {
  line: 'Dialogue',
  choice: 'Choice',
  action: 'Action',
};

@Component({
  selector: 'app-dialogue-editor',
  imports: [RpgPanel, RpgButton, LucideIcon],
  styleUrl: './dialogue-editor.css',
  templateUrl: './dialogue-editor.html',
})
export class DialogueEditor {
  protected readonly nodes = SAMPLE_NODES;
  protected readonly kindLabel = KIND_LABEL;
  protected readonly tools: { label: string; icon: IconNode }[] = [
    { label: 'Line', icon: MessageSquare },
    { label: 'Choice', icon: GitBranch },
    { label: 'Condition', icon: Filter },
    { label: 'Action', icon: Zap },
  ];
  protected readonly plusIcon = Plus;
  protected readonly minusIcon = Minus;
  protected readonly maximizeIcon = Maximize2;
  protected readonly badgeCheckIcon = BadgeCheck;

  // wires connect node centres (same % space as the nodes)
  protected readonly wires: string[] = [
    'M 20 26 C 20 44, 48 40, 48 58', // n1 → n2
    'M 48 58 C 48 38, 78 44, 78 26', // n2 → n3
    'M 48 58 C 48 74, 78 66, 78 80', // n2 → n4
  ];
}