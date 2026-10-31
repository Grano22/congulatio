export type Release = {
  version: string;
  date: string;
  title: string;
  highlights: string[];
};

export const RELEASES: Release[] = [
  {
    version: '0.1.0',
    date: '2026-10-31',
    title: 'Your tome, kept safe and everywhere',
    highlights: [
      'Saves now go to the browser’s built-in database, so the tome survives reloads and closing the browser.',
      'Optional accounts: sign in with e-mail or Google, or start as an anonymous wanderer. No account is needed to work.',
      'Signed-in tomes sync to the cloud and open on any device; when two devices disagree the newer save wins and Undo brings the other back.',
      'Account & storage shows how much cloud space your tome and portrait use and how much your plan allows.',
      'Upload a portrait for your account; it is cropped and shrunk before it is stored.',
      'A brand-new account starts with the tome you already have open.',
    ],
  },
  {
    version: '0.0.1',
    date: '2026-10-25',
    title: 'The first forge',
    highlights: [
      'Codex of characters with a coherent random soul generator and 8-bit portraits.',
      'Low-poly 3D sculptor with Mixamo animations and avatars from the sculpt.',
      'Branching dialogue tree, routines, interactions, relations map and scenario simulation.',
      'Tome history with undo, redo, save, import and export.',
    ],
  },
];

const parts = (version: string): number[] => version.split('.').map((p) => Number.parseInt(p, 10) || 0);

export function compareVersions(a: string, b: string): number {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff) return Math.sign(diff);
  }
  return 0;
}

export function releasesSince(seen: string | null, current: string, releases: Release[] = RELEASES): Release[] {
  const upToCurrent = releases.filter((r) => compareVersions(r.version, current) <= 0);
  if (!seen) return upToCurrent.slice(0, 1);
  return upToCurrent.filter((r) => compareVersions(r.version, seen) > 0);
}
