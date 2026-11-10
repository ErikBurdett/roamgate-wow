# Roamgate WoW

Read the DHARMA tracker context and README before changing this integration.

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
- Run `dev-session run -- npm run check`. Use `npm run doctor` for read-only live
  checks. Mock Lua tests do not prove in-game layout or physical capture.
- `node scripts/install.mjs --service` prints the plan. Add `--install` to install;
  changes outside the project need the workstation's sandbox escalation.
