import { parseCloudConfig } from './firebaseConfig';
import { cloudErrorMessage } from './authErrors';

const firebase = { apiKey: 'key', authDomain: 'demo.firebaseapp.com', projectId: 'demo', appId: '1:2:web:3' };

describe('cloud config', () => {
  it('accepts a complete config and defaults the stage', () => {
    const config = parseCloudConfig({ firebase });
    expect(config?.firebase.projectId).toBe('demo');
    expect(config?.stage).toBe('production');
    expect(config?.emulators).toBeNull();
  });

  it('rejects a config without the required keys', () => {
    expect(parseCloudConfig({ firebase: { ...firebase, apiKey: ' ' } })).toBeNull();
    expect(parseCloudConfig(null)).toBeNull();
    expect(parseCloudConfig({})).toBeNull();
  });

  it('drops unknown keys and fills emulator ports', () => {
    const config = parseCloudConfig({ stage: 'testing', firebase: { ...firebase, evil: 'x' }, emulators: { authPort: 'nope' } });
    expect(config?.firebase).not.toHaveProperty('evil');
    expect(config?.stage).toBe('testing');
    expect(config?.emulators).toEqual({ host: '127.0.0.1', authPort: 9099, firestorePort: 8080, storagePort: 9199 });
  });
});

describe('cloud error messages', () => {
  it('translates known Firebase codes', () => {
    expect(cloudErrorMessage({ code: 'auth/invalid-credential' })).toBe('The e-mail or password is wrong.');
  });

  it('falls back for unknown codes', () => {
    expect(cloudErrorMessage({ code: 'auth/whatever' }, 'Nope')).toBe('Nope');
  });
});
