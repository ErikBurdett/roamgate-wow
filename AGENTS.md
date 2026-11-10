# Roamgate WoW

Read README.md first. For installation tasks, follow docs/AGENT_SETUP.md and
docs/SETUP.md. For code changes, follow CONTRIBUTING.md and docs/ARCHITECTURE.md.
Also honor any instructions owned by the user's workstation; this repository
does not require a particular tracker, shell distribution or agent product.

- Preserve the user's running Herdr and Roamgate services. Restart only this
  project's companion when deploying its code.
- Never exercise mutations against an existing agent as a test. Use fake Herdr
  adapters for automated tests; a live message/approval requires the user's own
  explicit action.
- Keep target identity, fresh question checks, at-most-once journaling, and
  explicit Enter confirmation. No global Yes buttons or auto-approval.
- Do not inject input into WoW, inspect game memory, or use in-game chat as a
  transport. The optical strip is a local signal, not a security boundary between
  installed addons.
- Keep `.local-data`, captured screens, runtime conversation snapshots and
  credentials out of git. Never print credentials in diagnostics.
- Run `npm ci --ignore-scripts` and `npm run check`. If the workstation provides
  a managed test runner (such as `dev-session`), use it. Use `npm run doctor`
  for read-only live checks. Mock Lua tests do not prove in-game rendering,
  model entitlement, or physical capture.
- `node scripts/install.mjs --service` prints the plan. Add `--install` to install;
  changes outside the project need the workstation's sandbox escalation.
- Preserve saved install paths, slot counts, modes and ports on updates. Never
  edit existing Roamgate, Herdr, Codex or Claude settings to make a test pass.
- First installs must use the user's actual WoW Forever Interface/AddOns path.
  Do not assume the example Wine prefix exists or claim Windows/macOS support.
- Do not publish screenshots, logs, release artifacts or git history containing
  private conversations or credentials. Run `npm run check:public -- --history`
  before a first publication, and describe the scanner's limits honestly.
