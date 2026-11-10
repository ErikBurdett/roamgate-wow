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
| Git (optional) | Clone/update source; unnecessary for a release archive |
| Node.js 22+ and npm | Run the companion/setup; source downloads need `npm ci` |
| Lua 5.1 (`lua5.1` command), contributors only | Run addon contract tests |
| `hyprctl` | Locate the focused game window |
| `grim` | Capture the small signal region |
| `systemctl`, `systemd-analyze` (service mode) | User service and unit-file validation |

The setup checker reports missing tools with suggested fixes. No root access is needed
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

## 3. Get the project

Choose a stable folder you will keep: it owns your local configuration, guide
history and installed runtime snapshots.

- **Complete release:** download `roamgate-wow-VERSION.tar.gz` and its matching
  `.sha256` file from the same release. Verify with `sha256sum -c FILE.sha256`,
  then extract the archive. The companion, addon sources, installer, runtime
  dependency, documentation and licenses are included. Node and the external
  programs in sections 1–2 are still required.
- **Git clone / GitHub source ZIP:** open a terminal in the project folder and
  run `npm ci --omit=dev --ignore-scripts`. These downloads do not bundle dependencies.

The complete bundle can be verified again after extraction with
`node scripts/verify-release.mjs`. See [release packaging](RELEASING.md).
Contributor tests are optional for normal installation; they require Lua 5.1
and the tools in [CONTRIBUTING.md](../CONTRIBUTING.md).

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
npm run setup -- --addon-dir "$WOW_ADDONS"
```

That checks dependencies, the graphical session, Herdr and the authenticated
local Roamgate connection, then prints a plan without changing anything. It sends
no prompts or answers. Check the destination, local
origin, mode and update-slot count. The default is **interactive** with 2,048
slots. Add `--read-only` to both commands if you want to inspect chats without
sending, approving or creating anything.

For machine-readable output, use `node scripts/setup.mjs --json --addon-dir "$WOW_ADDONS"`.
It exits nonzero when a required check fails. The JSON includes each check's status,
a suggested fix and the exact installer arguments. Check your game build manually;
setup does not infer a compatible client from a directory name.

## 5. Install

```bash
npm run setup -- --addon-dir "$WOW_ADDONS" --install
systemctl --user status roamgate-wow.service
npm run doctor
```

The installer writes only its owned addon/update directories, this checkout's
`.local-data`, and `~/.config/systemd/user/roamgate-wow.service`. It backs up an
owned addon before updating, preserves existing update data, and refuses addon
or service directories owned by another checkout. Each install also freezes a
matching companion/addon version with dependencies and hashes under
`.local-data/installations`; the service runs that version. It never restarts Herdr or
Roamgate or changes their model settings. Agent/model choices apply only when
you deliberately create a new conversation.

The service starts at user login. It must share your graphical session. With
multiple Wayland/Hyprland sessions, export the intended session to the user
service manager from a terminal in that session:

```bash
systemctl --user import-environment WAYLAND_DISPLAY HYPRLAND_INSTANCE_SIGNATURE XDG_RUNTIME_DIR
systemctl --user restart roamgate-wow.service
```

For a **foreground companion**, add `--foreground` to both setup commands
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

Wait for pending delivery to finish. Stop a foreground companion with Ctrl+C
before installing; a managed service is stopped/restarted by the installer.
Update the same project folder. For a Git clone:

```bash
git pull --ff-only
npm ci --ignore-scripts
npm run setup
npm run setup -- --install
```

For release archives, extract the next verified archive to a temporary folder,
then copy its shipped files over the existing project folder. Retain `.local-data`;
never replace it with another installation's records. Run setup from the original
folder. If using foreground mode, retain `--foreground` on both commands.

Saved addon path, slot count, local origin and mode are preserved unless you
explicitly override them. To leave read-only mode, add `--interactive` to the
plan and install commands. Review unexpected changes before installing.
Editing/pulling source alone does not update a versioned runtime; install it.

- Ordinary source/UI update with unchanged slots: **`/reload` out of combat**.
- First install or changed slot count (`--slots N`, 16–4096): **full WoW relaunch**.
- Reinstalling while a message is pending is discouraged; the action journal
  prevents automatic replay, but an uncertain receipt still needs inspection.

Do not move the checkout without migrating its owner marker and service path.
See [troubleshooting](TROUBLESHOOTING.md) rather than deleting ownership checks.

## Rollback

Versioned installs from 0.4 onward retain a complete companion/addon pair:

```bash
npm run rollback -- --list
npm run rollback -- --to INSTALLATION_ID
npm run rollback -- --to INSTALLATION_ID --apply
```

Review the plan first. Applying it verifies all snapshot hashes, restores that
version's addon and runtime, and restores its slot count, path, mode, origin and
service mode. It does not revert your source checkout or change provider settings.
Guide history, action receipts, WoW drafts and saved variables are retained.
Stop a foreground companion first; a managed companion is handled automatically.
Use `/reload` for unchanged slots, or fully restart WoW if the slot count changed.

Legacy `.local-data/backups` contain addon-only copies and cannot restore a
matching old companion. They are not offered as complete rollback targets.
Snapshots are kept until you deliberately remove them; keep the active snapshot.

## Stop or remove

To stop just the companion temporarily, use `systemctl --user stop roamgate-wow.service`
or Ctrl+C for foreground mode. To remove this integration:

```bash
npm run uninstall
npm run uninstall -- --apply
```

The first command prints the exact ownership/preservation plan. The second stops
only this project's companion, removes its owned service and moves its owned addon
folders into a private `.roamgate-recovery-*` directory beside `AddOns`.
Unexpected files, symlinks or foreign ownership cause a refusal. If removal fails,
it attempts to restore the moved files and prior service state.

Exit/relaunch WoW after removal. Keep the project folder and WoW saved variables
if you want drafts, guide history, model choices and window positions. Herdr and
Roamgate, including their actual agent chats, remain untouched. The uninstall
receipt is in `.local-data/uninstall-receipt.json`; recovery folders may contain
private conversation views and must not be published. They are retained on disk
until you deliberately delete them.

To reinstall, use setup in the same project folder, or select a verified rollback
target. Do not delete journals to retry an uncertain message; inspect its actual
target first. Model menus and customization are documented in [MODELS.md](MODELS.md).
