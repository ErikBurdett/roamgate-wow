# Agent-assisted installation

This is the installation playbook for a coding agent acting on the user's machine.
Read [AGENTS.md](../AGENTS.md) and [SETUP.md](SETUP.md). Honor the user's existing
workstation instructions and approval requirements.

## Establish the supported environment

1. Identify the OS, desktop compositor, game build and launcher/prefix. The
   supported alpha needs Linux, Hyprland, Wine/XWayland and WoW Forever interface
   16001. If unsupported, explain the missing adapter; do not disguise it by
   changing the TOC or claim that installation succeeded.
2. Locate the actual `Interface/AddOns` directory from the user's game launcher
   or known prefix. Read before asking for information already available locally.
   Do not recursively scan the entire home directory for private content.
3. Check Node 22+, npm, `grim`, `hyprctl` and the user service manager.
   Lua 5.1 is only needed for contributor tests, not ordinary setup.
   Install missing dependencies using the host's normal package workflow only
   within the user's authorization. Never use `sudo npm install` here.
4. Inspect `herdr --version`, `herdr agent list` and `roamgate doctor` without
   printing transcripts or credentials. Preserve all running sessions. For a
   missing upstream installation, follow its official setup guide from SETUP.md;
   do not replace a functioning setup or silently upgrade it.
5. Confirm the existing Roamgate local origin and standard Herdr socket/config
   layout. Read only the needed non-secret fields. Let the user complete provider
   login and any MFA themselves; never request API keys in this chat.

## Validate and install

From the project folder, use the complete release bundle's included dependency,
or run `npm ci --omit=dev --ignore-scripts` for a source clone/ZIP. Verify a complete
archive before extraction using its SHA-256 file, then `node scripts/verify-release.mjs`.
Never substitute private installed addon files for the public source package.

```bash
node scripts/setup.mjs --json --addon-dir /actual/Interface/AddOns
```

Parse the JSON; check `ready`, the individual checks and the proposed arguments.
Include `--origin` for an existing custom local port and `--foreground` when the
user prefers a terminal companion. Resolve failed checks before applying that
same setup command with `--install`. Confirm the game build manually: directory
presence is not a compatibility test.

When changing code or preparing releases, run `npm run check` with the development
tools installed. Use a host-managed runner when provided. Tests use fake adapters
and temporary directories; never substitute a real agent for a fixture.

Installation may require the host sandbox's approval to write outside the repo.
Explain that actual requirement if approval is needed; do not invent a second
approval step when the user already authorized installation.

For an existing install, preserve `.local-data/config.json`, the action journal,
guide history and WoW saved variables. Do not remove an ownership marker to
bypass a refusal. A checkout move needs deliberate migration or restoration of
the original checkout, not an unreviewed recursive deletion.

Only `roamgate-wow.service` may be restarted by this workflow. Do not restart
Herdr/Roamgate, change provider settings, install global keybindings, or open
network ports. Use the documented foreground mode if the user chooses it.

Recovery uses `npm run rollback -- --list` / `--to ID` or `npm run uninstall`.
Review their plans before using `--apply`. Retain the journal, guide records and
saved variables; keep snapshot/recovery folders private. Snapshot rollback begins
with 0.4 installs, not legacy addon-only backups. Do not apply recovery to test it
against the user's live installation; use temporary fixtures.

## Verify without sending work

- Check `systemctl --user is-active roamgate-wow.service` for service installs.
- Run `npm run doctor`; inspect which checks actually passed. No messages or
  approvals are sent by doctor. Do not call a false `wowFocused` result a capture
  failure if your terminal currently has focus.
- Confirm the installed version and intended slot count. For the first install,
  tell the user to fully restart the game and enable all update addons.
- Ask the user to keep WoW focused while checking the connection. Do not inject
  keyboard/mouse input into WoW or inspect its memory to automate this step.
- Let the user initiate a harmless message and new guide conversation. Never
  send a synthetic task, use a real permission prompt as a test, or auto-confirm
  a queued question. Do not claim those round trips passed without evidence.

## Handoff

Report the installed version, game addon path, companion mode and whether the
service is active. State what was tested and what still needs the user's game
interaction. Give the exact next action:

- **First install / changed slots:** fully relaunch WoW, enable Roamgate and every
  update addon, then `/rg`.
- **Ordinary update:** `/reload` out of combat, after pending delivery completes.
- **Work window:** `/rg`; **guide:** `/rgg`; **both windows:** Alt+R if free.

Point to [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for missing chats, stalled sends,
question handling, and secret game values. Do not attach `.local-data`, full
provider configuration, unredacted logs or private screenshots to a public issue.
