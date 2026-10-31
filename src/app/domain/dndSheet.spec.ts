import { INITIAL_SOULS } from '../store/charactersStore';
import { abilityModifier, abilityScore, buildDndSheet, dndClassFor, formatModifier, hitPoints, proficiencyBonus } from './dndSheet';

describe('dndSheet', () => {
  it('maps the 1–100 attribute range onto 3–20 ability scores', () => {
    expect(abilityScore(1)).toBe(3);
    expect(abilityScore(100)).toBe(20);
    expect(abilityScore(50)).toBe(11);
    expect(abilityScore(-40)).toBe(3);
  });

  it('uses the 5e modifier and proficiency tables', () => {
    expect([1, 8, 9, 10, 11, 12, 20].map(abilityModifier)).toEqual([-5, -1, -1, 0, 0, 1, 5]);
    expect([1, 4, 5, 9, 13, 17, 20].map(proficiencyBonus)).toEqual([2, 2, 3, 4, 5, 6, 6]);
    expect(formatModifier(3)).toBe('+3');
    expect(formatModifier(0)).toBe('+0');
    expect(formatModifier(-2)).toBe('−2');
  });

  it('picks the class from the best ability', () => {
    expect(dndClassFor({ STR: 10, DEX: 16, CON: 12, INT: 10, WIS: 10, CHA: 10 })).toBe('DEX');
    expect(dndClassFor({ STR: 14, DEX: 14, CON: 14, INT: 14, WIS: 14, CHA: 14 })).toBe('STR');
  });

  it('adds average hit points per level after the first', () => {
    expect(hitPoints(1, 10, 2)).toBe(12);
    expect(hitPoints(5, 8, 1)).toBe(9 + 4 * 6);
    expect(hitPoints(3, 6, -5)).toBe(3);
  });

  it('builds a full sheet for a codex soul', () => {
    const sheet = buildDndSheet(INITIAL_SOULS[2]);
    expect(sheet.name).toBe('Grumhag Skullmaw');
    expect(sheet.species).toBe('Orc');
    expect(sheet.level).toBe(15);
    expect(sheet.proficiencyBonus).toBe(5);
    expect(sheet.abilities).toHaveLength(6);
    expect(sheet.skills).toHaveLength(18);
    expect(sheet.skills.filter((s) => s.proficient).length).toBeGreaterThanOrEqual(2);
    const perception = sheet.skills.find((s) => s.id === 'perception')!;
    expect(sheet.passivePerception).toBe(10 + perception.bonus);
    expect(sheet.hitDice.startsWith('15d')).toBe(true);
  });

  it('clamps out-of-range levels', () => {
    expect(buildDndSheet({ ...INITIAL_SOULS[0], level: 40 }).level).toBe(20);
    expect(buildDndSheet({ ...INITIAL_SOULS[0], level: 0 }).level).toBe(1);
  });
});
