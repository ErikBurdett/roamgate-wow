# Architecture

This is a local WoW addon plus a Node.js companion, using existing authenticated
Roamgate/Herdr sessions. No server endpoint is opened by the companion.

## Code map

| Area | Responsibility |
| --- | --- |
| `addon/Roamgate/Core.lua` | Startup, selection, notifications, window/keybinding lifecycle |
| `UI.lua`, `Guide.lua`, `Models.lua`, `Theme.lua` | Work book, guide/history, new-chat choices, native theme |
| `Character.lua` | Best-effort character/quest snapshot; secret values omitted before operations |
| `Transport.lua` | Length-prefixed requests, optical frames, update loading, one pending action |
| `bridge/desktop.mjs` | Hyprland window discovery and `grim` capture; platform porting boundary |
| `bridge/protocol.mjs` | Checksums, reassembly, UTF-8 validation, RGB/monochrome calibration |
| `bridge/controller.mjs` | Target proofs, at-most-once journal, snapshots and read caches |
| `bridge/herdr.mjs`, `roamgate.mjs` | Literal CLI arguments and local authenticated RPC |
| `bridge/guide.mjs` | Character/workspace bindings, guide history and saved views |
| `bridge/models.mjs` | Explicit supported new-chat model IDs/aliases; no provider-settings writes |
| `bridge/config.mjs` | Saved install config and local-origin validation |
| `scripts/install.mjs`, `options.mjs`, `unit.mjs` | Installer planning/preflight, updates, optional user service |
| `scripts/bundle.mjs` | Combine UI modules into the already-discovered `UI.lua` entry point |

## Round trip

1. Lua creates a nonce and a request with a monotonically increasing action ID.
   Work and guide surfaces share one outbound action, while retaining separate
   selections and drafts. New-chat provider/model fields are frozen with it.
2. The addon draws a small monochrome strip. The focused-window adapter captures
   only a narrow region. Checksums and bounds reject unrelated pixels before
   requests reach the controller.
3. The companion records an action as uncertain **before** a mutation. Duplicate
   frames and restarts cannot automatically repeat that action. It validates the
   pane/terminal/agent identity, view age, and current question where applicable.
4. Herdr receives literal prompt text or a reviewed key. New chats use unfocused
   tab/workspace creation. Only the new process receives `--model`; selecting a
   new-chat model never issues `/model` to an existing process.
5. The companion atomically writes a nonce-tagged snapshot to load-on-demand data
   addons. Lua loads each slot once and matches acknowledgements to the pending
   ID. `/reload` permits the same slots to be loaded again with a new nonce.

The parser accepts legacy 10/12-field requests and current 14-field requests.
This lets the companion update before the user reloads the UI. The installer
does not blank an already published snapshot when updating code.

## Caches and history

Live terminals are the default. Polling varies with visibility, status and
pending actions; it does not continuously fetch full conversation history.
History is fetched only for Conversation views, cached for 15 seconds, and
resolved by exact pane identity. Slow optional history/file calls do not hold
up message acknowledgements. See [usage](USAGE.md#update-limits) for intervals.

Guide chats are bound per character to dedicated workspaces. Explicit selection
can discover other panes in those guide workspaces, never an arbitrary work pane
or another character's workspace. Closed chats can display a saved local view,
without input authorization. Drafts/window state live in WoW saved variables;
bindings, journal and saved views live under ignored `.local-data`.

## Porting

A different desktop needs an adapter that identifies the correct focused game
window and returns the strip image at the right scale. Windows/macOS capture is
not implemented. Do not replace capture with game-memory inspection or input
injection. A different WoW build also needs API, protected-value, layout and
addon-discovery verification; changing the interface number is insufficient.

Other Roamgate/Herdr versions may change CLI/RPC contracts. Verify them against
the installed version and official upstream sources, using fake adapters for
mutations. Keep at-most-once delivery, identity checks,
question guards and explicit confirmation. There is no transaction spanning an
independent controller's simultaneous approval; do not overclaim that guarantee.
