# Changelog

This project is alpha software. Entries describe implemented behavior; see
[verification notes](docs/verification.md) for the limits of test evidence.

## 0.4.0-alpha.1 — 2026-11-10

- Complete versioned release bundles with locked runtime dependencies, licenses,
  per-file hashes and an external SHA-256 checksum.
- Setup preflight with human/JSON output and optional install; normal users do not
  need Lua or development tools.
- Versioned companion/addon snapshots, verified rollback, and owned uninstall
  with private recovery copies; retain drafts, guide history and action receipts.
- Portable new-chat model choices from a local catalog and optional overrides.
  Fresh installs use Installed default; existing saved selections are preserved.
- Scrollable model menus and a single version source with consistency checks.
- Installer recovery removes obsolete addon code and preserves prior service state.

### Public alpha preparation

- Public README, human setup guide and agent installation playbook.
- Usage, troubleshooting, architecture, contribution and privacy documentation.
- GitHub checks on Node 22/24, issue forms and a PR template.
- Installer help and strict option validation; saved path, slots, mode and origin
  survive updates. Missing game directories fail before installation.
- Optional local Roamgate port; service PATH includes user-local tool locations.
- Public-file, common credential-pattern, git-history and Markdown-link checks.

## 0.3.0 — 2026-11-09

- Provider/model choice for new chats in both books; existing chats/defaults unchanged.
- Claude/Sonnet as the Grimoire's initial new-chat choice.
- Persistent per-character guide history, workspace chat discovery, separate
  drafts and read-only saved views for closed chats.

## 0.2.0 — 2026-11-09

- Separate Adventurer's Grimoire with optional character/quest context.
- Spellbook theme, HUD and minimap entry points, shared Alt+R minimize/restore.
- Queued-question review, guarded answer handling and protected-value filtering.
- Live terminal default, cached navigation and reduced polling.

## Initial alpha — 2026-11-09

- Local optical companion transport with nonce/identity checks and action journal.
- Workspace/chat navigation, terminal/history views, files/diffs and agent controls.
