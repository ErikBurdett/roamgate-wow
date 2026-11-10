# Roamgate for WoW Forever

A native, movable WoW panel for the Roamgate / Herdr agents on this Linux machine.
It uses WoW's own frames, gold headings, dark panels, blue workspace labels and a
minimap portal. It does not embed a browser or run a second set of agents.

## Open it

1. Fully restart WoW once after installation. New addon directories are discovered
   at game startup, not by `/reload`.
2. At character selection, enable **Roamgate** and all gray **Roamgate update** addons.
3. Log in and type **`/rg`**, or click the portal beside the minimap.
4. Select a session. The top right should say **Connected to this machine**.

The companion is installed as `roamgate-wow.service` and starts at login. It reads
the transport strip only while World of Warcraft is the focused window.

## Working from Azeroth

- **All workspaces** selects any Roamgate workspace. All 48 existing panes are
  included, including inactive terminals. Search by title, workspace, tab or agent;
  **Needs you** filters waiting agents. Terminals without a detected agent are
  readable and can be the project context for a new chat; prompts are not sent to
  a shell as if it were a model.
- The **HUD** shows the followed conversation, working/waiting counts and unread
  notifications. Click its thread, question badge, or activity button to open the
  relevant session. It never steals focus for an alert. **− / +** collapses or
  expands it; `/rg hud` hides or shows it.
- **Files** browses the selected workspace's folders and text files. **Changes**
  lists working-tree changes and opens their patches. These use Roamgate's own
  workspace roots and read-only APIs. Slow reads load in the background. A preview
  is capped at 60,000 characters and a directory/change list at 500 entries.
- **Conversation** displays history supplied by Roamgate. **Live terminal** displays
  the actual agent screen. A missing history identifier is explicitly shown as a
  terminal fallback; it is never matched to a different session by folder or title.
- Write a task and press **Enter** or **Send message**. **Shift+Enter** inserts a newline;
  **Escape** releases the keyboard. Drafts are kept separately for each session.
- A blocked agent opens **Questions** with its exact terminal screen. Use the
  navigation/number buttons to select an option. **Confirm / Enter** asks you to
  review that selection before delivering Enter. **Cancel** sends Escape.
- For a text field in a question, **Paste answer** inserts your words. Review the
  result, then use **Confirm / Enter**. Pasting does not submit the answer.
- **New chat** starts a chosen Codex, Claude, Hermes or OpenCode agent in the selected
  session's project and workspace. Write the first task, choose the agent, and
  press **Start chat**. The existing desktop tab retains focus. Agent defaults come
  from its installed configuration; this version does not select model or effort.
- **Stop** requests Escape in a working agent. Check its resulting status.

The minimap badge counts waiting agents. Sounds and chat notifications announce
new blocked/finished states; combat defers the notification. `/rg sound` toggles
sound. `/rg scale 0.85` adjusts the panel, and the bottom right corner resizes it.
The keybinding is under **Options → Keybindings → AddOns → Roamgate**.

## Update limits

WoW addons cannot open HTTP/WebSocket connections. The Lua addon draws a compact
monochrome signal along the HUD's upper edge (up to 512×10 physical pixels during
a long message, usually a single two-pixel line). The companion reads it with `grim`, calls local
Roamgate/Herdr, and atomically writes load-on-demand Lua data addons. Each of those
can load once per UI session.

This installation has **2,048 update slots**. It loads one about every six seconds
while open, four seconds while an action awaits acknowledgement, 12 seconds with
the expanded HUD alone, and 30 seconds when both are hidden/collapsed. That is
about 3.4 hours of continuous open-panel use, 6.8 hours of expanded HUD use, or 17
hours collapsed. Background notifications may take up to 12 or 30 seconds. The counter shows the
remaining budget; **Reload UI** resets it, and is disabled during combat or a
pending action. Do not manually reload while waiting for delivery confirmation.
Keep the game foregrounded until an action is acknowledged.

## Scope and trust

Messages, question controls, new chats and stop requests use the same local Herdr
session as Roamgate. The companion pins Roamgate's local profile by its Herdr
socket path, rather than following a selected remote machine. No port is opened
by this companion. It never sends keys to WoW or reads game memory.

Every mutation is journaled before sending. Repeated optical frames and a
companion restart cannot automatically repeat that action. If a crash occurs
after submission but before acknowledgement, delivery is marked uncertain; review
the session before manually retrying. Session identity, a short-lived view proof,
and the exact question screen are checked before question input. These checks
reduce stale approvals; the terminal API does not provide a transactional
compare-and-send operation, so another controller must not answer the same prompt
at the same instant.

Installed WoW addons share a trust boundary: another addon can read this addon's
globals or draw its optical strip. Use only addons you trust. The strip contains
plain message data, so hide that corner when streaming sensitive work. Conversation
snapshots are local plaintext files in the AddOns directory; the companion writes
them with private permissions. Roamgate credentials stay in the existing private
Roamgate configuration and are never copied to the addon or journal.

File/diff editing, image attachments, voice, remote machines, worktree management,
and provider-specific model pickers are not implemented in version 0.1.0. Use the
existing Roamgate client for those operations. This release targets Forever
**1.60.1 / interface 16001** on this machine's **Hyprland / Wine** setup.

## Development and operations

```sh
npm ci --ignore-scripts
dev-session run -- npm run check
npm run doctor
node scripts/install.mjs --stage dist/AddOns
node scripts/install.mjs --service                 # inspect the install plan
node scripts/install.mjs --install --service       # install and enable
systemctl --user status roamgate-wow.service
journalctl --user -u roamgate-wow.service -n 30
```

`--addon-dir /absolute/path/to/AddOns` overrides detection. `--slots N` selects
16–4096 slots at install time; changing the count needs a full game restart.
`--read-only` disables all actions in both the UI and companion. Installation
refuses to replace unowned addon directories or service files and backs up an
owned addon before updating it. The source checkout is the service runtime;
keep it and its `node_modules` directory in place.

Private runtime state is in `.local-data/` (gitignored): config, action journal,
process lock, diagnostic status and installation backups. Only this companion
service is intentionally persistent. Tests use the workstation's `dev-session`
wrapper and remove their own scratch directories.

See [verification notes](docs/verification.md) for what has actually been tested.

To stop the companion: `systemctl --user disable --now roamgate-wow.service`.
Disable **Roamgate** and its data addons in WoW to stop the in-game UI and signal.
Source and drafts are preserved. No other service needs to be stopped.

## References and assets

The transport design was researched against the author's [T3 WoW explanation](https://www.curseforge.com/wow/addons/t3-wow)
and the [T3 WoW release repository](https://github.com/MatiasCiccone/t3wow-releases).
This is an independent implementation; no T3 source or images are included.
Roamgate's [history types](https://github.com/powerfooI/roamgate/blob/main/server/src/agent/session-history.ts)
and the installed Herdr 0.9.1 CLI/schema define the integration.

WoW supplies the interface textures and standard fonts at runtime. The bundled
terminal face is unmodified Liberation Mono, distributed under its included
[SIL Open Font License](addon/Roamgate/Media/FONT-LICENSE.txt).
