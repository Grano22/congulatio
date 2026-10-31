# End-to-end tests

> **Heavy lifting — run on demand only.** These tests download and start the Firebase emulators (Java required),
> start an Angular dev server and drive headless Chrome. A full run takes a minute or two. They are **not** part of
> `npm run test:ci` and do not run in the GitHub Pages workflow.

## What they cover

| Suite | File | Checks |
| --- | --- | --- |
| Security rules | `rules.e2e.mjs` | Two emulator users try to read, overwrite, squat on, hand over and delete each other's `app_tables` rows, touch profiles and `admin_tables`, and upload avatars that are someone else's, too large or not images |
| App flows | `app.e2e.mjs` | Login redirect, wanderer sign-in, save and push to Firestore, storage meter, avatar upload, reload, linking an e-mail, a second device pulling the tome, sign-out and offline mode |

## Running

```bash
npm run e2e            # starts the emulators, a dev server on :4300, runs both suites, stops everything
npm run e2e -- rules   # only the security rules suite
npm run e2e -- app     # only the app flows
```

Already running `npm run emulators` and `npm run start:emulators`? Attach to them instead:

```bash
E2E_BASE_URL=http://localhost:4200 node e2e/run.mjs
```

## Safety

- The tests only ever talk to the **local emulators** of a `demo-*` project (`demo-congulatio`). `support.mjs`
  refuses to run if the project id does not start with `demo-` or a host is not local, so they can never touch a real
  Firebase project, even with `.env.local` filled in.
- They need no secrets; nothing in this folder reads `.env.local` or GitHub secrets.
- `run.mjs` serves the app with `ng serve --configuration emulators`, which takes the demo settings from
  `e2e/fixtures/firebase-config.json` and never reads or writes your own generated settings file.

## Requirements

- Java 11+ for the Firestore and Storage emulators.
- Chrome or Chromium. Set `CHROME_PATH` if it is not in a standard location.
- Ports 4300, 4400, 8080, 9099 and 9199 free (or set `E2E_PORT` for the dev server).
