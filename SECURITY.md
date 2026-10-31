# Security policy

## Supported versions

Only the latest release deployed to GitHub Pages receives security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately through
[GitHub security advisories](https://github.com/Grano22/congulatio/security/advisories/new). Do not open a public
issue for security problems.

Include what you found, how to reproduce it and what an attacker could do with it. You will get an answer within 7
days, and a fix or a mitigation plan within 30 days for confirmed issues. Credit is given in the changelog unless you
prefer to stay anonymous.

## Scope

- The web app in `src/`, its Firebase security rules (`firestore.rules`, `storage.rules`) and the deployment workflow.
- Out of scope: denial of service, social engineering, problems that need a compromised device or browser extension,
  and findings in third-party services (report those to Google Firebase or GitHub).

## How the app protects data

- Firestore and Storage rules restrict every record and portrait to its owner; see the README section on security
  rules and the end-to-end rules suite in `e2e/rules.e2e.mjs`.
- Firebase settings are never committed; they come from a git-ignored local environment file and from repository
  secrets in CI.
- A Content-Security-Policy limits scripts, frames and connections to the app itself and Google Firebase.
- Error reports are opt-in, stripped of addresses and tokens, carry no account id and expire after 12 months.
