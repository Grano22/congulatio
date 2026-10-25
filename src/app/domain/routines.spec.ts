import { Routine, inferSlot, slotOf, validateRoutine } from './relations';

const routine = (over: Partial<Routine>): Routine => ({
  id: 'r',
  name: 'Watch',
  schedule: 'Every night',
  participantIds: [],
  forks: [],
  ...over,
});

describe('routines', () => {
  it('infers the time slot from the schedule text', () => {
    expect(inferSlot('Dusk, every Moonday')).toBe('dusk');
    expect(inferSlot('Midnight')).toBe('midnight');
    expect(inferSlot('Dawn, on market days')).toBe('dawn');
    expect(inferSlot('whenever it rains')).toBe('morning');
  });

  it('prefers an explicit slot over the schedule text', () => {
    expect(slotOf(routine({ schedule: 'At dawn', slot: 'evening' }))).toBe('evening');
  });

  it('rejects blank names, missing owners and duplicate names', () => {
    const others = [routine({ name: 'Night Watch' })];
    expect(validateRoutine({ ...routine({ name: ' ' }) }, [])).toContain('needs a name');
    expect(validateRoutine({ ...routine({ scope: 'personal' }) }, [])).toContain('soul to belong to');
    expect(validateRoutine({ ...routine({ name: 'night watch' }) }, others)).toContain('already exists');
  });

  it('allows the same personal routine name for different souls', () => {
    const others = [routine({ name: 'Prayer', scope: 'personal', ownerId: 'a' })];
    expect(validateRoutine(routine({ name: 'Prayer', scope: 'personal', ownerId: 'b' }), others)).toBeNull();
  });

  it('requires every fork to point at a dialogue step', () => {
    expect(validateRoutine(routine({ forks: [{ id: 'f', label: 'Knock', dialogueId: '' }] }), [])).toContain('Every fork');
  });
});
