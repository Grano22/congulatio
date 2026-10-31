import { DEFAULT_SETTINGS, readSettings } from './settingsStore';

describe('settings', () => {
  it('falls back to defaults for missing or damaged values', () => {
    expect(readSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(readSettings({ autosave: 'yes', autosaveSeconds: 7, warnBeforeLeaving: null })).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid choices', () => {
    expect(readSettings({ autosave: false, autosaveSeconds: 300, warnBeforeLeaving: false })).toEqual({
      autosave: false,
      autosaveSeconds: 300,
      warnBeforeLeaving: false,
    });
  });
});
