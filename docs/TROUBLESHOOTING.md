# Troubleshooting

[Setup](SETUP.md) · [Usage](USAGE.md)

Start with `npm run doctor` and, for a service install,
`systemctl --user status roamgate-wow.service`. The last companion log lines are
available with `journalctl --user -u roamgate-wow.service -n 30 --no-pager`.
Review/redact diagnostics before sharing them.

| Symptom | Check and next step |
| --- | --- |
| Addon does not appear | Check the actual client/prefix path. Fully relaunch after first install, then enable Roamgate and all update entries. |
| Waiting for companion / empty chats | Check companion, Herdr and Roamgate status. Keep WoW foregrounded with the HUD visible. The companion pauses capture when another app is focused. |
| `wowFocused: false` | Expected while using a terminal. The adapter requires a mapped XWayland window titled exactly `World of Warcraft`; other client titles/adapters are not implemented. |
| Focused but signal not detected | Check the HUD/strip is visible at the game's top left and not covered. Confirm Hyprland/`grim`, monitor scaling and client resolution. Include these details in a redacted bug report. |
| Roamgate login/profile error | Verify the browser client works, the local origin/port is correct, and the standard local Herdr profile/socket exists. Do not regenerate or print credentials to troubleshoot. |
| Service cannot find `herdr` or `grim` | Compare your shell's `command -v` results with the service's environment. Re-run the installer from the working shell to regenerate its PATH; restart only the WoW companion. |
| Cannot select a unique desktop session | Import the intended graphical environment into the user service manager as shown in SETUP.md, then restart the companion. |
| Stale view / disabled Send | Wait for a fresh selected-session response while WoW is focused. Cached and closed-session views cannot authorize actions. |
| No acknowledgement / uncertain delivery | The draft is retained. Inspect the target in Roamgate before retrying. Do not repeatedly press Send or reload with an action pending. Duplicate optical frames are journaled once. |
| Update slots used | Use `/reload` out of combat, after pending delivery finishes. This resets the existing slots without restarting WoW. |
| Conversation has terminal text | Roamgate may not have a linked session-history identifier. Live terminal still works; the work window labels the fallback. History is never guessed from a folder/title. |
| Question is queued but not visible | Click Questions or Open question. Review the tray. Paste answer only pastes text; Confirm / Enter is a separate action. |
| “Question changed” | Review the latest question/selection. The guard intentionally rejects stale answers; do not bypass it to make an approval go through. |
| Grimoire Enter does nothing | Check the footer, connection and whether a question is waiting. Turn Character & quests off if context collection failed; the draft remains. `/console scriptErrors 1` can expose Lua errors. |
| Character details are missing | Some game values are protected and deliberately omitted. Readable quest data may still work. Do not unwrap secret values or inspect game memory. |
| New model/chat startup failed | Inspect the created pane in Roamgate; it may have a startup question or unavailable model. Avoid creating duplicates. Use a model supported by your account or Installed default for the next new chat. |
| Earlier guide chat is closed | Chats can show its last saved view, if captured. Reopen the closed agent in Roamgate to continue it. A saved view is not a full session export. |
| Alt+R/Alt+G do not work | Existing keybindings are preserved. Assign them under Options → Keybindings → AddOns → Roamgate, or use `/rg` and `/rgg`. |
| Ownership mismatch | The addon/service belongs to a different checkout. Restore that checkout or deliberately migrate it with backups. Do not delete ownership checks blindly. |

## Reporting a bug

Include the addon commit/version, client build/interface, Linux distribution,
Hyprland/Wine versions, Node/Herdr/Roamgate versions, and a minimal reproduction.
Distinguish **connected**, **signal detected**, **message acknowledged**, and
**message actually visible in the intended agent**; they are different checks.

For UI errors include the Lua error text and which window/action caused it.
For a screenshot, crop/redact chats, character/account names, paths and tokens.
Do not upload `WTF`, SavedVariables, `.local-data`, or whole service logs.

## Recovery boundaries

The installer saves addon backups in `.local-data/backups` and complete versioned
runtimes in `.local-data/installations`. Use the [rollback plan](SETUP.md#rollback)
before restoring a matching companion/addon pair. Uninstall keeps its recovery
files beside AddOns; these contain private views and must not be published.
Keep the current checkout, journal and guide registry together. If an action was recorded as
uncertain, neither restarting nor changing the nonce is proof it was not sent.
Inspect the actual target first. Do not delete `actions.json` to force retries.

Roamgate and Herdr own the actual agent processes. Troubleshooting the WoW
interface should not require killing those processes or changing their settings.
