import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APP_VERSION } from '../layout/app-version';
import { RELEASES, compareVersions, releasesSince } from './releaseNotes';

const root = process.cwd();

describe('release notes', () => {
  it('orders versions numerically', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBe(1);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.0.1', '0.1.0')).toBe(-1);
  });

  it('shows only the latest release to a brand-new visitor', () => {
    expect(releasesSince(null, RELEASES[0].version).map((r) => r.version)).toEqual([RELEASES[0].version]);
  });

  it('shows every release newer than the one last seen', () => {
    const releases = [
      { version: '0.3.0', date: '', title: '', highlights: [] },
      { version: '0.2.0', date: '', title: '', highlights: [] },
      { version: '0.1.0', date: '', title: '', highlights: [] },
    ];
    expect(releasesSince('0.1.0', '0.3.0', releases).map((r) => r.version)).toEqual(['0.3.0', '0.2.0']);
    expect(releasesSince('0.3.0', '0.3.0', releases)).toEqual([]);
  });

  it('lists releases newest first with highlights', () => {
    for (let i = 1; i < RELEASES.length; i++) expect(compareVersions(RELEASES[i - 1].version, RELEASES[i].version)).toBe(1);
    for (const r of RELEASES) expect(r.highlights.length).toBeGreaterThan(0);
  });
});

describe('version bookkeeping', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string };
  const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');

  it('keeps package.json, APP_VERSION and the latest release note in step', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(RELEASES[0].version).toBe(pkg.version);
  });

  it('has a CHANGELOG entry for every release note', () => {
    for (const r of RELEASES) expect(changelog).toContain(`## [${r.version}] - ${r.date}`);
  });
});
