# TODO

## Done

- [x] Characters gallery (Codex of Characters)
- [x] Picking a character in the gallery opens it in the Character tab
- [x] Character randomizer: one button for a coherent character with full name, balanced traits and an 8-bit portrait
- [x] Relation graph: characters, the routines they keep and the dialogue those routines fork into; walk from any
      sentence to the characters taking part
- [x] Dialogue variants and impact on economy, environment, attitudes and interests (common goals and obstacles)
- [x] Scenario simulation: pick a character and motivations, characters answer by their motives and the outcome is
      summed up
- [x] Simple low-poly 3D editor with ranged body proportions, presets, hair, avatar from the sculpt and Mixamo
      animations
- [x] Tome history with undo and redo, save, import, export (with or without history) and reset
- [x] Working header menus, layout presets, keyboard shortcuts, quick tour and About
- [x] Global tome search
- [x] Interactions ledger
- [x] Global and personal routines with a day planner
- [x] Removing dialogue steps with an impact preview, standalone scenes and richer dialogue filters
- [x] Custom attributes, click-to-copy tokens and a read-only inspector
- [x] Story AI in the composer (Chrome Prompt API)
- [x] GitHub Pages deployment
- [x] Tome saved in IndexedDB, one per owner (0.1.0)
- [x] Optional accounts (e-mail, Google, anonymous wanderer) with Firestore sync, portraits and storage limits (0.1.0)
- [x] Welcome and What's new dialog, CHANGELOG and version bookkeeping (0.1.0)
- [x] On-demand end-to-end tests on the Firebase emulators (0.1.0)
- [x] Installable PWA with offline shell and update prompt (0.2.0)
- [x] Autosave with settings, offline badge, unsaved/unsynced warnings, account menu (0.2.0)
- [x] GDPR privacy notice, cloud data and account deletion (0.2.0)

## Next

- [ ] Dialogue Threads navigator section
- [ ] Quest Board navigator section
- [ ] World Atlas navigator section
- [ ] Bring back the node-based dialogue editor (Dialogue Loom) or remove it
- [ ] Use attribute tokens such as `[[Aldric Blackwood.STR=78]]` inside dialogue text
- [ ] Enforce the per-user cloud limit (50 MiB for accounts) on the server: a Cloud Function keeping a usage counter
      that the security rules check, instead of the client-side check only
- [ ] Merge conflicting tomes per entity instead of newer-save-wins
- [ ] Sync the changeset between devices
- [ ] Run the e2e suite in a scheduled or manual GitHub Actions job
- [ ] Choose a license
- [ ] Remove the unused `primeng` and `@primeuix/themes` dependencies, or start using them
