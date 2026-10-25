import { DialogueNode, SAMPLE_DIALOGUE_NODES } from './dialogue';
import { INITIAL_SOULS } from '../store/charactersStore';
import { SAMPLE_RELATIONS } from './relations';
import {
  StoryAiError,
  effectiveDrafts,
  materialize,
  nextStepsPrompt,
  parseNextSteps,
  parsePolish,
  parseScene,
  speakerFor,
} from './storyAi';

const node = (id: string): DialogueNode => SAMPLE_DIALOGUE_NODES.find((n) => n.id === id)!;

describe('story composer AI', () => {
  it('puts the conversation and the speaker profile into the prompt', () => {
    const prompt = nextStepsPrompt('d2', SAMPLE_DIALOGUE_NODES, INITIAL_SOULS, SAMPLE_RELATIONS, 3, 'make it tense');
    expect(prompt).toContain('Player: Accept the challenge');
    expect(prompt).toContain('fierce orc of Ashgor');
    expect(prompt).toContain('make it tense');
    expect(prompt).toContain('First write "reply"');
  });

  it('finds the NPC who answers below a player option', () => {
    expect(speakerFor('d2', SAMPLE_DIALOGUE_NODES)).toBe('Grumhag');
  });

  it('turns options under a line into option and reply drafts', () => {
    const raw = JSON.stringify({ options: [{ option: 'Bow', reply: '“Good.”' }, { option: 'Laugh', reply: '“Bold.”' }] });
    const drafts = parseNextSteps(raw, node('d1'), 'Grumhag');
    expect(drafts.map((d) => d.kind)).toEqual(['choice', 'line', 'choice', 'line']);
    expect(drafts[0].parentId).toBe('d1');
    expect(drafts[1].parentKey).toBe(drafts[0].key);
  });

  it('requires a reply when the cursor is a player option', () => {
    const raw = JSON.stringify({ options: [{ option: 'Bow', reply: '“Good.”' }] });
    expect(() => parseNextSteps(raw, node('d2'), 'Grumhag')).toThrow(StoryAiError);
  });

  it('rejects answers that are not JSON', () => {
    expect(() => parseScene('Sure! Here is a scene', 'Wren')).toThrow(StoryAiError);
    expect(() => parsePolish('{"text":"  "}')).toThrow(StoryAiError);
  });

  it('drops excluded steps and everything under them when adding to the tome', () => {
    const raw = JSON.stringify({ opening: '“Hello.”', options: [{ option: 'Hi', reply: '“Hm.”' }, { option: 'Leave', reply: '“Go.”' }] });
    const drafts = parseScene(raw, 'Wren');
    drafts[1] = { ...drafts[1], include: false };
    expect(effectiveDrafts(drafts).map((d) => d.text)).toEqual(['“Hello.”', 'Leave', '“Go.”']);

    let n = 0;
    const nodes = materialize(drafts, () => `n${++n}`);
    expect(nodes.map((x) => [x.id, x.parentId])).toEqual([
      ['n1', null],
      ['n2', 'n1'],
      ['n3', 'n2'],
    ]);
    expect(nodes.every((x) => x.generated)).toBe(true);
  });
});
