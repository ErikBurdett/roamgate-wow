# Using Roamgate in WoW

[Back to the project](../README.md) · [Setup](SETUP.md) · [Troubleshooting](TROUBLESHOOTING.md)

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
  row, write the first task, and press **Start chat**. Codex choices come from its
  local model catalog. Claude includes its standard aliases; extra IDs can be
  configured locally. **Installed default** omits the model override.
  Hermes/OpenCode currently use their installed defaults.
  New users start with Codex / Installed default; upgrades retain saved selections;
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
through Herdr, preserving desktop focus. New users start with **Claude / Installed default**,
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
Choose a model before opening a new conversation, or use the provider's installed
default. Existing Sonnet, Astra, Fable or other saved selections remain intact.
See [model discovery and customization](MODELS.md) for available choices and limits.

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
