# CLAUDE.md

## Project

- **Name:** wsaa-node
- **Purpose:** A Node.js client for AFIP's WSAA (Web Service de Autenticación y Autorización).
- **Type:** library
- **Stack:** TypeScript, Node.js
- **Deploy target:** npm (public registry)

## Commands

- **Install:** `npm install`
- **Test:** `npm test`
- **Lint:** `npm run lint`

## Version

- **Version file:** `package.json`
- **Doc format:** TSDoc

## Specs

- Specs are in `specs/`. Name each spec `NNN-feature-name.md`. Use `specs/TEMPLATE.md`.
- Use the `/spec` skill. It pushes the spec on a `build/NNN-name` branch, and the push starts the build agent.
- Shared agent rules are in `prompts/common.md` in `leanucci/workflows`.

## Node Package Rules

### Stack

- TypeScript in strict mode. Build to `dist/` with `tsc`.
- Vitest for tests.
- ESLint for lint.
- npm for packages. Commit `package-lock.json`.

### Scripts

`package.json` must have these scripts. CI runs each one:

- `lint`: ESLint with no warnings.
- `typecheck`: `tsc --noEmit`.
- `test`: Vitest in run mode (not watch mode).
- `build`: compile to `dist/`.

### Code

- Use TSDoc comments for exported functions, classes, and types.
- Keep secrets, certificates, and private keys out of the repo. Read them from environment variables or from files the caller provides.

### Release Policy

- Releases happen by hand, with the `/release` skill. Specs accumulate on `main` until then.
- The build agent never changes the version in `package.json`. Each entry it adds under
  `## [Unreleased]` in `CHANGELOG.md` starts with its severity in parentheses, from the spec's
  "Release" field: `(major)`, `(minor)`, or `(patch)`.
- `/release` computes the new version from the highest severity under `## [Unreleased]`, moves
  those entries under that version with today's date, and sets the version in `package.json`.

### Publish

- The package publishes to the public npm registry, under the name in `package.json`.
- Publish only when the `version` field in `package.json` changes. `release.yml` does this.
  `/release` is the only thing that changes it.
- `release.yml` stages the publish with npm trusted publishing (OIDC). It needs no npm token.
- A staged publish is not live. The owner approves it by hand, from their own machine, with
  `npm stage approve <stage-id>`. 2FA always applies to that step. No CI identity can do it.
  Find the stage ID with `npm stage list wsaa-node` if it is not in the job's log.
- After the owner approves the staged publish, the owner creates the `v<version>` tag and
  the GitHub release. `release.yml` does not do this.
- Set `"files"` in `package.json` to the built output only, for example `["dist"]`.
