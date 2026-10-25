

## Dev environment tips

### DOS

* Always commit new things using conventional commits like: `feat: <description>`
* Commit early and often: one small conventional commit per logical change, as soon as it builds and the tests pass

### DON'TS

* Using any comments is strictly disallowed

## Project facts

* Angular 22 standalone app with NgRx Signals; three.js powers the Sculptor
* User-facing documentation is `README.md` (Polish); keep it in sync when features change
* Pure domain logic lives in `src/app/domain` and is unit tested; UI components stay thin
* Every tome change goes through the stores in `src/app/store` so `TomeHistory` records it for undo, save and export
* Menus, keyboard shortcuts and the quick tour shortcut table all come from `src/app/layout/commands.ts`
* Keep the initial bundle under 500 kB: load non-default tabs, dialogs and heavy libraries with `@defer`

## Commands

* `npm start` runs the dev server on http://localhost:4200
* `npm run test:ci` runs the unit tests once
* `npm run build` builds into `dist/congulatio/browser`
* `npm run build:pages` builds with the GitHub Pages base href
* Pushing to `master` deploys to GitHub Pages through `.github/workflows/deploy-pages.yml`

## Change impact map

Read `docs/glossary.md` for what each concept means. This map says where every concept lives and what else must
change with it. Before finishing any change, walk the relevant checklist below and grep for the identifiers named.

### Entities in the tome and who touches them

All references between entities are by id, except dialogue speakers (see Known gaps).

| Entity | Type and helpers | Store | Referenced by (id fields) | Read or edited in |
| --- | --- | --- | --- | --- |
| Soul | `RandomCharacter` in `domain/randomCharacter.ts`; face `domain/pixelFace.ts`; build `domain/build.ts`; hair `domain/hair.ts`; rig `domain/figureRig.ts`; attributes `domain/attributes.ts` | `store/charactersStore.ts` (`INITIAL_SOULS`, `selectedId`) | bonds `fromId`/`toId`; routines `participantIds`, `ownerId`; interactions `sourceId`/`targetId`; dialogue `speaker` (by first name); focus `{kind:'soul'}` | `characters-galery`, `layout/remove-soul-dialog.ts`, `character-editor` (`FORGE_FIELDS`), `sculptor`, `inspector`, `character-routines`, `interactions-editor`, `relation-graph`, `scenario-simulator`, `story-ai`, `routines-almanac` (counts), `dialogue-list` (participants), `domain/search.ts`, `layout/status-bar.ts` |
| Dialogue step | `DialogueNode` and `interactionOf`, `impactOf`, `flattenDialogueTree` in `domain/dialogue.ts`; removal and scene status in `domain/dialogueRemoval.ts` | `store/dialoguesStore.ts` | `parentId` (tree); routine forks `dialogueId`; interactions `dialogueId`; focus `{kind:'dialogue'}` | `dialogue-workbench`, `dialogue-list`, `dialogue-impact`, `story-ai`, `layout/remove-dialogue-dialog.ts`, `relation-graph`, `scenario-simulator` (scenarios = roots), `inspector`, `interactions-editor` and `character-routines` (dialogue pickers), `domain/simulation.ts`, `domain/storyAi.ts`, `domain/search.ts` |
| Bond | `CharacterRelation` in `domain/relations.ts` | `store/relationsStore.ts` (`relations`) | nothing refers to a bond by id | `relation-graph` (bind, sever), `inspector`, `domain/simulation.ts` (tone), `domain/storyAi.ts` (prompt context), `domain/search.ts` |
| Routine | `Routine`, `RoutineFork`, `TIME_SLOTS`, `slotOf`, `scopeOf`, `validateRoutine` in `domain/relations.ts` | `store/relationsStore.ts` (`routines`, `addRoutine`, `joinRoutine`, …) | focus `{kind:'routine'}` | `routines-almanac` (global), `character-routines` (personal and joining), `relation-graph`, `inspector`, `dialogue-list` (scene title and status), `scenario-simulator` (scenario labels), `domain/dialogueRemoval.ts` (cuts forks), `domain/relations.ts` `sceneParticipants`, `domain/search.ts` |
| Interaction | `Interaction`, `INTERACTION_KIND_INFO`, `validateInteraction`, `PLAYER_ID` in `domain/interactions.ts` | `store/interactionsStore.ts` | focus `{kind:'interaction'}` | `interactions-editor`, `inspector`, `dialogue-list` (scene status), `domain/dialogueRemoval.ts` (unlinks), `domain/search.ts` |
| Custom attribute | `CustomAttribute`, `validateCustomAttribute`, `attributeRows`, `attributeToken` in `domain/attributes.ts` | `store/attributesStore.ts` | soul `customAttributes[defId]` | `attribute-ledger`, `inspector` |

Do not confuse the interaction ledger (`Interaction`, `domain/interactions.ts`) with the dialogue step interaction
type (`InteractionKind`, `domain/dialogue.ts`). They share a word and nothing else.

### Tome-wide plumbing (touch all of these when the tome shape changes)

1. `domain/tome.ts`: `TomeSnapshot`, `sameSnapshot`, `describeChange` (add a `describeList` line), `validateSnapshot`
   (new lists must default to `[]` so older files still open).
2. `store/tomeHistory.ts`: inject the store, add it to `current`, `restore` and `INITIAL_TOME`.
3. The store needs a `replaceAll` method.
4. `store/tomeHistory.spec.ts`: the `empty` snapshot literal; add a test that an older file without the new list opens.
5. `README.md` data model table and tome file example; `docs/glossary.md` concept map and deletion table.

### Checklist: adding a field to an existing entity

- Type in its `domain/` file; keep it optional if old tomes and saved data lack it.
- Every form that creates or edits the entity (see "Read or edited in" above) and the inspector view for it.
- `domain/search.ts` haystack and `sub` text if the field is searchable.
- `domain/tome.ts` `validateSnapshot` only if the field is required.
- Sample data (`INITIAL_SOULS`, `SAMPLE_*` constants) if the UI looks empty without it.
- If a soul field is edited in the forge, add it to `FORGE_FIELDS` in `character-editor/character-editor.ts`; if it is
  edited elsewhere, leave it out so the forge never overwrites it.

### Checklist: adding a new entity type to the tome

- Domain type, validation and sample data in `src/app/domain`, with a spec.
- A `signalStore` in `src/app/store` with `replaceAll`.
- All of "Tome-wide plumbing" above.
- Focus: add the kind to `FocusKind` in `store/workspaceStore.ts`, a view in `inspector`, and handle it in
  `relation-graph` `focusFor` / `nodeIdFor` if it appears on the map.
- Search: `SearchKind`, `SEARCH_TAGS`, `KIND_ORDER`, `SearchTarget` and the index builder in `domain/search.ts`; the
  `go()` switch in `layout/global-search.ts`; a tag colour in `layout/global-search.css`; `domain/search.spec.ts`.
- Deletion: decide what happens to everything that references it and implement it in the same change (see below).
- Docs: README feature list, glossary, quick tour text in `layout/shell-dialogs.ts`.

### Checklist: removing or renaming something

Removing must clean up every reference in the same tome change, so one undo restores everything.

| When you remove | Also update |
| --- | --- |
| A soul | always go through `planSoulRemoval` / `applySoulRemoval` in `domain/soulRemoval.ts` (bonds, interactions, personal routines, leaving global routines, chosen scenes with their forks and interaction links) and the `remove-soul` dialog; never call `CharactersStore.remove` directly. Anything new that references a soul must be added to that plan and to the dialog. |
| A dialogue step | use `planRemoval` / `applyRemoval` in `domain/dialogueRemoval.ts`: descendants, detached roots, routine forks, interaction links |
| A routine | nothing references a routine by id except focus; its forks go with it |
| An interaction | focus only |
| A custom attribute | soul values in `customAttributes` may stay (ignored) or be cleaned; never leave a definition referenced by UI state |
| A bond | nothing else |

When you rename a soul's first name, the dialogue steps that use the old name as `speaker` no longer match the soul.

Removing a feature or UI section: also remove its tab or navigator entry, commands and menu items, quick tour step,
search kind, focus handling, README and glossary sections, and its specs.

### Checklist: UI wiring

- **New main tab:** `EditorTabId` in `store/workspaceStore.ts`; the `tabs` array in `app.ts`; an `@case` with `@defer`
  in `app.html`; `TAB_ORDER` in `layout/commands.ts` (this renumbers the Alt+number shortcuts, so update the README
  shortcut table); `View > Go to` in `layout/main-menu.ts`; a quick tour step in `layout/shell-dialogs.ts`.
- **New left-pane section:** `NavigatorId`, `NAVIGATORS` and `DEFAULT_HEIGHTS` in `navigator/navigator.ts`; an `@case`
  in `navigator/navigator.html`.
- **New command or shortcut:** add it to `all` in `layout/commands.ts` (menus, shortcuts, search actions and the quick
  tour shortcut table all read from there); place it in `MENUS` in `layout/main-menu.ts`; check the chord does not
  clash with an existing one; update the README shortcut table.
- **New dialog:** add the name to `ShellDialog` in `store/shellStore.ts` and render it from `layout/shell-dialogs.html`
  (that component is lazy loaded on the first dialog).
- **Edits from the inspector:** guard every edit method with `if (this.readonly()) return;` and render controls with
  `[disabled]="readonly()"`.

### Known gaps

- Dialogue speakers and scene participants match souls by `firstName` (`domain/relations.ts` `sceneParticipants`,
  `domain/simulation.ts`, `domain/storyAi.ts`, `story-ai-panel.ts`, `scenario-simulator.ts`).
- Precedence of interactions over routines and of personal over global routines is a design rule only (see the
  glossary); nothing enforces it yet.
- Attribute tokens are plain text and do not follow later changes.
