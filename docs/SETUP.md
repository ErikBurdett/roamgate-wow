# Setup

[Project](../README.md) · [Agent instructions](AGENT_SETUP.md) · [Troubleshooting](TROUBLESHOOTING.md)

## 1. Check the platform

The alpha capture adapter requires **Linux + Hyprland + Wine/XWayland** and a
focused window titled `World of Warcraft`. The tested client is WoW Forever
1.60.1.70862 / interface 16001. The game must run on the same machine and under
the same desktop user as the companion. Other platforms require a new capture
adapter; changing the `.toc` number alone is not a port.

Install these through your distribution or existing development environment:

| Tool | Purpose |
| --- | --- |
| Git | Clone/update the project |
| Node.js 22+ and npm | Run the companion and install its locked dependency |
| Lua 5.1 (`lua5.1` command) | Run the addon contract tests |
| `hyprctl` | Locate the focused game window |
| `grim` | Capture the small signal region |
| `systemctl`, `systemd-analyze` | User service and unit-file validation |

Check with `node --version`, `npm --version`, `lua5.1 -v`, and
`command -v hyprctl grim systemctl systemd-analyze`. No root access is needed
for the addon installer; installing missing OS packages may require it.

## 2. Make Herdr and Roamgate work first

Follow the upstream [Roamgate quick start](https://github.com/powerfooI/roamgate#quick-start)
and [deployment guide](https://github.com/powerfooI/roamgate/blob/main/docs/DEPLOYMENT.md),
or [Herdr's instructions](https://herdr.dev). This repository does not bundle
either program or install provider CLIs for you.

For an existing setup, these are read-only checks:

```bash
herdr --version
herdr agent list
roamgate doctor
```

Do not replace or downgrade an existing server. If Herdr has not been set up,
upstream provides `roamgate herdr setup`; review its behavior before using it.
Start Roamgate according to its own guide and confirm its browser client can
read a local workspace and agent session. Sign in to any provider CLI you want
to use through that provider's normal login flow, and verify it in Roamgate first.

The tested combination is **Herdr 0.9.1 / protocol 22 and Roamgate 0.8.15**.
Those are a compatibility baseline, not an instruction to downgrade. Newer
versions should be checked before relying on approvals or delivery.

The companion expects the standard local profile/socket at
`~/.config/herdr/herdr.sock` and Roamgate configuration under `~/.config/roamgate`.
It reads an existing `ROAMGATE_PASSWORD`/legacy `HERDR_GUI_PASSWORD` from
`roamgate.env`, or the generated `auth-token`. Do not paste credentials into
this repository, chat, screenshots or shell command arguments.

By default it connects to `http://127.0.0.1:8787`. If your existing Roamgate uses
a different local port, pass `--origin http://127.0.0.1:PORT` to this installer's
plan and install commands. This changes only the companion's destination.
Remote hosts, HTTPS proxies and credentials in URLs are rejected. Custom socket
locations and custom config homes are not currently supported.

## 3. Get and check this repository

Clone this repository using its GitHub **Code** URL, or download its source ZIP,
then open a terminal in the extracted folder. Choose a stable folder you will
keep: the service uses this checkout and its `node_modules` directory.

```bash
npm ci --ignore-scripts
npm run check
```

Tests use fake adapters and temporary directories. They do not require a running
game or provider account, and do not send messages to real agents. Source ZIPs
can run the checks too; the optional `--history` publication audit needs a Git clone.

## 4. Locate the actual addon directory

Find the client directory used by your launcher. For a Wine prefix it may look
like this, but **do not assume this example matches your machine**:

```text
<wine-prefix>/drive_c/Program Files (x86)/World of Warcraft/_forever_/Interface/AddOns
```

Lutris, Bottles and other launchers may keep the prefix elsewhere. Launch the
client once if necessary. The chosen `Interface/AddOns` directory must exist;
the installer refuses to create a game tree at a mistyped path.

```bash
WOW_ADDONS="/absolute/path/to/World of Warcraft/_forever_/Interface/AddOns"
node scripts/install.mjs --addon-dir "$WOW_ADDONS" --service
```

That prints a plan without changing anything. Check the destination, local
origin, mode and update-slot count. The default is **interactive** with 2,048
slots. Add `--read-only` to both commands if you want to inspect chats without
sending, approving or creating anything.

## 5. Install

```bash
node scripts/install.mjs --addon-dir "$WOW_ADDONS" --install --service
systemctl --user status roamgate-wow.service
npm run doctor
```

The installer writes only its owned addon/update directories, this checkout's
`.local-data`, and `~/.config/systemd/user/roamgate-wow.service`. It backs up an
owned addon before updating, preserves existing update data, and refuses addon
or service directories owned by another checkout. It never restarts Herdr or
Roamgate or changes their model settings. Agent/model choices apply only when
you deliberately create a new conversation.

The service starts at user login. It must share your graphical session. With
multiple Wayland/Hyprland sessions, export the intended session to the user
service manager from a terminal in that session:

```bash
systemctl --user import-environment WAYLAND_DISPLAY HYPRLAND_INSTANCE_SIGNATURE XDG_RUNTIME_DIR
systemctl --user restart roamgate-wow.service
```

For a **foreground companion**, omit `--service` from both installer commands
and run `npm start` in a terminal. Keep that terminal open; Ctrl+C stops the
companion. Do not run it alongside the user service. Systemd is unnecessary for
foreground runtime, though the full development checks use its unit parser.

## First launch

1. Fully exit and relaunch WoW after the first install. `/reload` cannot discover
   the 2,048 newly created addon directories.
2. At character selection, enable **Roamgate** and every gray **Roamgate update**
   addon. Do not disable those update entries to tidy the list.
3. Log in, type `/rg`, and keep WoW focused. Wait for **Connected to this machine**.
4. Check that your own workspaces and sessions appear. Click a known chat and
   compare its live terminal with Roamgate outside the game.
5. When ready, send a harmless question yourself. Keep WoW focused until the
   companion acknowledges it; verify it arrived once in the intended chat.
6. Open `/rgg`. Check your character/quest page. Choose a provider/model, type a
   game question, and send it yourself to create the guide workspace.

An agent performing setup must stop before steps 5–6 and let you initiate them.
Do not test delivery by approving a real tool request. See [usage](USAGE.md) for
the difference between **Paste answer** and **Confirm / Enter**.

`npm run doctor` checks connections and the optical signal without sending input.
`wowFocused: false` is expected while your terminal has focus. A successful
doctor run alone does not prove the in-game signal or message round trip.

## Updates

Wait for any pending delivery to finish. Update the same checkout, then:

```bash
git pull --ff-only
npm ci --ignore-scripts
npm run check
node scripts/install.mjs --service
node scripts/install.mjs --install --service
```

Saved addon path, slot count, local origin and mode are preserved unless you
explicitly override them. To leave read-only mode, add `--interactive` to the
plan and install commands. Review unexpected changes before installing.

- Ordinary source/UI update with unchanged slots: **`/reload` out of combat**.
- First install or changed slot count (`--slots N`, 16–4096): **full WoW relaunch**.
- Reinstalling while a message is pending is discouraged; the action journal
  prevents automatic replay, but an uncertain receipt still needs inspection.

Do not move the checkout without migrating its owner marker and service path.
See [troubleshooting](TROUBLESHOOTING.md) rather than deleting ownership checks.

## Stop or remove

```bash
systemctl --user disable --now roamgate-wow.service
```

Disable Roamgate and its update addons in the game. To remove the files, first
confirm the installed `Roamgate/.roamgate-wow-owner.json` points to this checkout.
Remove only that owned `Roamgate` directory and the `RoamgateData0001` through
the recorded final slot directory. Remove only this addon's user service file,
then run `systemctl --user daemon-reload`. Leave Herdr and Roamgate alone.

Keep `.local-data/adventurer` if you want the guide bindings/saved views, and
WoW's saved variables if you want drafts and window positions. Back these up
privately; do not upload them. Installation backups live in
`.local-data/backups`. Deleting the checkout deletes those local records.

For staging/build inspection only, use `npm run package`. Its `dist/AddOns`
output is not a complete distribution: the companion and configured ownership
are still required. Install from a source checkout using the normal installer.
