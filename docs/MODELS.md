# Model choices

Each book remembers its own provider/model for **new conversations**. Work starts
with Codex and the guide starts with Claude. For a fresh install, both select
**Installed default**, which sends no model flag. Upgrading preserves existing
choices, including Sonnet, Astra or Fable. Existing chats and provider defaults
are never changed by these selectors.

## Where choices come from

- Codex: visible entries in `$CODEX_HOME/models_cache.json`, or
  `~/.codex/models_cache.json` when `CODEX_HOME` is unset. If no readable catalog
  exists, Installed default remains available.
- Claude: Installed default and the standard `sonnet`, `opus`, `haiku` aliases.
  A local `claude --help` check adds `fable` only if that CLI advertises it.
- Hermes/OpenCode: installed defaults only in this alpha.
- Optional local additions: `.local-data/models.json` in this project folder.

The companion reads these at startup. It does not query provider billing or
change configuration files. A cached/listed model is not proof that your account
can use it; verify uncertain choices in the provider CLI or Roamgate. If startup
fails, inspect the new pane before creating another chat.

## Add locally available model IDs

Create `.local-data/models.json` with only IDs your installed CLI accepts:

```json
{
  "codex": [{"id": "your-model-id", "label": "My coding model"}],
  "claude": [{"id": "sonnet", "label": "Sonnet"}]
}
```

`your-model-id` is a placeholder to replace. Entries add choices or relabel an
existing ID. IDs allow letters, digits, dots, underscores and hyphens, up to 100
characters; labels are limited to 100 characters and cannot contain controls.
Malformed configuration fails visibly at startup rather than silently choosing
another model. There are at most 99 named choices per provider, plus Installed
default; the in-game menu scrolls.

Restart only `roamgate-wow.service` (or your foreground companion) to refresh the
catalog. No provider settings or existing agents are restarted. A saved choice
that is no longer advertised remains visible but cannot create a new chat until
you select an available choice or add its valid ID locally. No fallback happens
silently. This file is private and ignored by git.
