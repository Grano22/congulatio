# Changelog

All notable changes to Congulatio are written down here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Every release also has a short, user-facing entry in
`src/app/domain/releaseNotes.ts`, which the welcome dialog shows to returning users.

## [Unreleased]

## [0.1.0] - 2026-10-31

### Added

- Optional accounts through Firebase Authentication: e-mail and password, Google, and anonymous "wanderer" sign-in.
  The app works fully without an account; a sign-in page and an account dialog explain the benefits.
- A wanderer can link an e-mail or Google account later and keep the same cloud ledger.
- Cloud sync of the saved tome to Firestore: one row per entity in `app_tables`, each stamped with `owner`, only
  changed rows are sent, deletions are synced, and the newer save wins a conflict as an undoable step.
- A brand-new account or wanderer starts with the tome that is open in the browser.
- Account & storage dialog: portrait upload to Firebase Storage (cropped and shrunk to 256 px), display name, cloud
  storage meter against a per-user limit (custom claim `storageQuota`, defaults 2 MiB for wanderers and 20 MiB for
  accounts), browser storage estimate with a request for persistent storage, sync status and sign-out.
- Sync status in the top bar and the status bar; File menu entries for the account dialog and syncing now.
- Welcome dialog for new visitors and a "What's new" dialog after each update (Help → What's new).
- Firebase settings are loaded at runtime from `firebase-config.json`, generated from `.env.local` locally or from
  GitHub secrets in the Pages workflow; local Firebase emulator support (`npm run emulators`,
  `npm run start:emulators`).
- Hardened `firestore.rules` and new `storage.rules`.
- On-demand end-to-end tests for the security rules and app flows on the emulators (`npm run e2e`).

### Changed

- The tome is saved in IndexedDB instead of `localStorage`, separately per account, so it survives reloads and
  closing the browser. A tome saved by 0.0.1 is moved over automatically.
- The workbench and the sign-in page load as separate routes, which keeps the initial bundle near 345 kB.

### Security

- Firestore rules now only let users read their own `app_tables` rows (any signed-in user could read every row
  before), stop other users from claiming row ids that start with someone else's uid, allow owners to delete their
  rows, and limit row and profile fields so nobody can give themselves an admin flag or a bigger quota.

## [0.0.1] - 2026-10-25

### Added

- Codex of characters, character forge with a coherent random soul generator and 8-bit portraits.
- Low-poly 3D sculptor with body presets, hair, Mixamo animations and avatars from the sculpt.
- Dialogue tree with filters, story composer with on-device Story AI, variants and world impact.
- Global and personal routines, interactions ledger, relations map and scenario simulation.
- Custom attributes, inspector with read-only mode, global search, menus, shortcuts and quick tour.
- Tome history with undo, redo, save, import and export; GitHub Pages deployment.

[Unreleased]: https://github.com/Grano22/congulatio/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Grano22/congulatio/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/Grano22/congulatio/releases/tag/v0.0.1
