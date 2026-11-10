# Roamgate for WoW Forever

Native, movable WoW spellbook windows for the Roamgate / Herdr agents on this
Linux machine. The work grimoire and Adventurer's Grimoire have carved borders,
gold trim, book emblems, parchment and WoW's gryphon action-bar end caps. Both use
the same local Roamgate system, with separate conversations and drafts.

## Open it

1. Fully restart WoW once after installation. New addon directories are discovered
   at game startup, not by `/reload`.
2. At character selection, enable **Roamgate** and all gray **Roamgate update** addons.
3. Log in and type **`/rg`**, or click the portal beside the minimap.
4. Select a session. The top right should say **Connected to this machine**.

The companion is installed as `roamgate-wow.service` and starts at login. It reads
the transport strip only while World of Warcraft is the focused window.

## Working from Azeroth

- **All workspaces** selects any Roamgate workspace. Every existing pane is
  included, including inactive terminals. Search by title, workspace, tab or agent;
  **Needs you** filters waiting agents. Terminals without a detected agent are
  readable and can be the project context for a new chat; prompts are not sent to
  a shell as if it were a model.
- The **HUD** shows the followed conversation, working/waiting counts and unread
  notifications. Click its thread, question badge, or activity button to open the
  relevant session. It never steals focus for an alert. **− / +** collapses or
  expands it; `/rg hud` hides or shows it. **Open workspace** and **Open grimoire**
  open the two books independently.
- **Files** browses the selected workspace's folders and text files. **Changes**
  lists working-tree changes and opens their patches. These use Roamgate's own
  workspace roots and read-only APIs. Slow reads load in the background. A preview
  is capped at 60,000 characters and a directory/change list at 500 entries.
- Selecting a chat opens **Live terminal** by default, showing the actual agent
  screen. **Conversation** fetches history only while that tab is selected, with
  a 15-second cache. A missing history identifier is explicitly shown as a
  terminal fallback; it is never matched to a different session by folder or title.
- Write a task and press **Enter** or **Send message**. **Shift+Enter** inserts a newline;
  **Escape** releases the keyboard. Drafts are kept separately for each session.
- Click **Questions** or the HUD's question badge to review a waiting request.
  Codex's queued follow-up tray opens with its own navigation shortcut; it never
  receives an automatic Enter. Changing work output does not invalidate this
  navigation. For a displayed Codex follow-up, the exact question, choices,
  selection and typed answer must stay unchanged; background work output can
  continue. Other permission dialogs retain the full-screen/state guard.
  Use the
  navigation/number buttons to select an option. **Confirm / Enter** asks you to
  review that selection before delivering Enter. **Cancel** sends Escape.
- For a text field in a question, **Paste answer** inserts your words. Review the
  result, then use **Confirm / Enter**. Pasting does not submit the answer. Answer
  drafts and ordinary message drafts are separate. A waiting question changes the
  ordinary Send action to **Review question**, preserving your task until you
  finish answering; it never silently pastes a work task into an answer field.
- **New chat** starts a chosen Codex, Claude, Hermes or OpenCode agent in the selected
  session's project and workspace. Choose the provider and model in the **New chat**
  row, write the first task, and press **Start chat**. Codex offers Astra, Sol,
  Terra and Luna; Claude offers Sonnet, Haiku, Opus and Fable. **Installed default**
  omits the model override. Hermes/OpenCode currently use their installed defaults.
  Work chats initially offer Codex/Astra, or Fable when first switching to Claude;
  each book remembers its own last choice for each provider
  in the addon's saved variables. These choices apply only to new conversations.
  Existing chats, Roamgate settings, provider configuration and effort defaults
  are unchanged. The existing desktop tab retains focus.
- **Stop** requests Escape in a working agent. Check its resulting status.

The minimap badge counts waiting agents. Sounds and chat notifications announce
new blocked/finished states; combat defers the notification. `/rg sound` toggles
sound. `/rg scale 0.85` adjusts the panel, and the bottom right corner resizes it.
The keybinding is under **Options → Keybindings → AddOns → Roamgate**.
**Alt+R** minimizes both the work window and Adventurer's Grimoire. Press it again
to restore whichever windows were open, with the same active book, drafts and
scroll positions. It leaves the HUD and minimap buttons available and does not
cancel a message already sending. It is assigned on first load if that key is
free; an existing binding is preserved. `/rg` and the portal minimap button still
toggle just the work window. Cached
conversations appear immediately on restore; action controls wait for a fresh
selection. Long text is split into bounded Unicode-safe blocks for native rendering.
When history is not linked, Conversation shows recent unwrapped terminal text and
labels the fallback above the content. Live terminal and Questions retain the
exact current screen.

## Adventurer's Grimoire

Open **`/rgg`**, **`/rg guide`**, **Alt+G** (assigned only if free), the HUD's
**Open grimoire** button, the **book icon beside the minimap portal**, or the
**Adventurer's Grimoire** button in the work window. This is a separate movable
window; opening it preserves your work chat and draft. Both windows may remain
open. The window you last interact with receives the detailed refreshes; the
other keeps its cached view. They share one outbound action at a time.

The left page's **Character** tab shows your level, class, race, location, and current
quest log. Choose a quest to prepare a question, or use **About my character**,
**Equipment & abilities**, or **What should I do next?**. These fill the draft;
they do not send it automatically. The right page has **Live reply**,
**Conversation**, **Questions**, and a **Context** preview.

**Open guide & ask** starts a chat in a dedicated **WoW Adventures** workspace
through Herdr, preserving desktop focus. The initial choice is **Claude / Sonnet**,
with a provider/model selector above the composer. **New conversation** reveals
the selector again and keeps a separate first-question draft. **Cancel new**
returns to the existing chat. Follow-ups stay with the selected conversation;
changing the new-chat choice never changes an existing agent's model.

The left page's **Chats** tab lists earlier conversations for this character,
including chats opened directly in its guide workspace in Roamgate. Search by
title, provider or workspace, then click a chat to reopen its live reply. Drafts
and scroll positions are kept separately. **Conversation** reads that pane's
Roamgate history using the existing cache; switching never sends a prompt.
The registry survives companion restarts and retains earlier chats when a new
one is created. Different characters have separate guide workspaces and history.
Closed panes can display their last locally saved view if one was captured;
they cannot receive messages or approvals. Reopen a closed agent in Roamgate
to continue it. This is a saved view, not a complete export of closed sessions.

Model flags are passed to the new process through Herdr's argument passthrough,
never through `/model` or a settings edit. See the
[Claude model configuration](https://code.claude.com/docs/en/model-config) and
[Codex command reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli).
Sonnet is the guide's practical starting choice; choose a different model for
your own needs before opening a new conversation.

Each submitted game question can include a fresh snapshot: character identity,
level/class/race/faction, zone and available map position, health and attributes,
equipped item names/IDs, and quest titles, IDs and objectives. The selected quest
comes first. Snapshot text is capped at 4,900 bytes and questions at 2,000 bytes.
Use **Character & quests: off** to withhold the snapshot. It is not continuously
transmitted; ordinary guide polling carries only the character routing ID.
Game chat, guild/party messages and bag contents are not collected. Unsupported
client APIs are handled with explicit omissions, using modern and legacy quest
API fallbacks.

WoW Forever may mark game values as secret. The collector drops those values
before formatting, comparison or arithmetic, and omits inaccessible table fields.
The snapshot tells the guide when protected details were omitted. Those values
are never decoded or sent to the companion; readable quest and character data
continue to work. See Blizzard's generated
[secret-value API documentation](https://github.com/Gethe/wow-ui-source/blob/classic/Interface/AddOns/Blizzard_APIDocumentationGenerated/FrameScriptDocumentation.lua).

If character collection fails, the Grimoire shows the error and keeps your
draft. **Character & quests: off** allows sending without collecting a snapshot;
answering an agent's question also works independently of character APIs.
Startup and send failures are reported in game chat and the Grimoire footer.

The guide mixes light in-world personality with practical advice, distinguishes
Forever from Classic/retail, and is instructed to verify version-specific facts
and acknowledge uncertainty. It advises rather than controlling the character.
New-agent startup may take several seconds; any startup question is shown for
your review with the same explicit confirmation controls. A failed startup keeps
the created pane available for inspection and preserves the draft.

The installer bundles the new Lua modules into the existing `UI.lua` entry point,
so this upgrade needs **`/reload`**, without new addon discovery or a full relaunch.

## Update limits

WoW addons cannot open HTTP/WebSocket connections. The Lua addon draws a compact
monochrome signal along the HUD's upper edge (up to 512×10 physical pixels during
a long message, usually a single two-pixel line). The companion reads it with `grim`, calls local
Roamgate/Herdr, and atomically writes load-on-demand Lua data addons. Each of those
can load once per UI session.

This installation has **2,048 update slots**. It loads one every second while
awaiting an acknowledgement or briefly after opening, selecting or navigating.
An open waiting question polls every three seconds. Otherwise the open panel
polls every five seconds for a working agent and 12
seconds for an idle one; the expanded HUD alone polls every 12 seconds, and both
hidden/collapsed every 30 seconds. That is about 2.8 hours of continuously watching
work, 6.8 hours idle or of expanded HUD use, or 17 hours collapsed, before
accounting for interaction bursts. Background notifications may take up to 12 or
30 seconds. Slow history/file requests do not block command acknowledgements.
The companion reuses terminal captures for two seconds during questions, five
seconds while working and 12
seconds while idle, invalidating them when agent state changes or an action is
handled. Question input always checks the current terminal again before sending.
The counter shows the
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
and the exact question content are checked before question input. These checks
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
and per-chat effort controls are not implemented in version 0.3.0. Use the
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
