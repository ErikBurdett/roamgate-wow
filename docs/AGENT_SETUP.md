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
3. Check Node 22+, npm, Lua 5.1, `grim`, `hyprctl` and the user service manager.
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

From this checkout:

```bash
npm ci --ignore-scripts
npm run check
node scripts/install.mjs --help
```

If the workstation has a managed runner, run the checks inside it; for example,
`dev-session run -- npm run check`. Otherwise the ordinary command is sufficient.
Tests create/remove their own scratch directories and use fake agent adapters.

Run the installer with the discovered absolute `--addon-dir` and `--service`,
without `--install`, to inspect the plan. Include `--origin` only if the user's
existing Roamgate uses a different local port. Check the destination, mode,
slot count and ownership before applying that same plan with `--install`.
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
