export type Release = {
  version: string;
  date: string;
  title: string;
  highlights: string[];
};

export const RELEASES: Release[] = [
  {
    version: '0.4.0',
    date: '2026-10-31',
    title: 'Roll for initiative',
    highlights: [
      'New view modes in View → View mode or the switch above the stage: Game NPC Flow Design (the default) and Dungeons & Dragons (beta).',
      'The D&D view shows only tabletop parts: characters, a new 5e-style character sheet, the sculptor and the relations map. Dialogues stay in the NPC Flow view.',
      'Print a character sheet on A4 or save it as a PDF, or print a two-sided playing card for the table.',
      'Themes: each view brings its own look (Forge or Dragonfire), or pick one yourself in View → Theme.',
      'Sidebar panes now share the height equally when you open another one, and narrow sidebars keep every pane and close button in view.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-10-31',
    title: 'Sturdier, safer and easier to use',
    highlights: [
      'If something breaks, a recovery screen lets you save your work and reload, keep working, or report the problem.',
      'Problems are listed in Help → Problems & error reports. Nothing is sent unless you tick the consent box, and reports carry no name, e-mail or account id.',
      'A part that fails to load now shows a clear message with a Reload button instead of an empty space.',
      'Better keyboard and screen reader support: a skip link, clearer labels and larger tap targets, checked against WCAG 2.2 AA.',
      'Stricter security: a Content-Security-Policy, tighter cloud rules and automatic dependency checks.',
      'Richer link previews when you share Congulatio.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-10-31',
    title: 'Install it, work offline, never lose a line',
    highlights: [
      'Install Congulatio as an app (File → Install) and open it without a connection; you are told when an update is ready.',
      'Autosave writes your edits to this browser every 30 seconds and when you switch away; change or turn it off in Edit → Settings (Ctrl/⌘+Alt+P).',
      'A clear Offline badge appears when the connection drops, and signed-in users see when changes are waiting to reach the cloud.',
      'The page asks before closing while edits are unsaved or not yet synced.',
      'Click your account icon to sign in, sign out or sync right away.',
      'A privacy notice (Help → Privacy & your data) explains how your data is handled, and you can delete your cloud data or account at any time.',
      'Accounts now get 50 MiB of cloud storage.',
    ],
  },
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
