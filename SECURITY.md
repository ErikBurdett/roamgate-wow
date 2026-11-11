# Privacy and security

The companion can send input to real agents using your existing local Roamgate
and Herdr access. Its trust boundary includes other software and WoW addons
running under your desktop user. Do not treat the optical signal as authentication
against another installed addon.

## Data and access

- The companion accepts only a local HTTP Roamgate origin, and pins its local
  connection by the expected Herdr socket. It opens no network listener.
- Existing Roamgate credentials are read from its private configuration. They
  are never copied into Lua, action journals or diagnostics intentionally.
- The on-screen strip contains plain request data. Another addon or screen
  recorder can observe it. Avoid showing that corner while streaming private work.
- Conversation snapshots are local plaintext in generated AddOns files. Drafts
  and window state live in WoW SavedVariables. `.local-data` contains routing,
  action receipts, saved guide views and install backups. Uninstall also retains
  private recovery copies beside AddOns. Protect these like chat
  history; they are not encrypted exports.
- Grimoire context is attached only when sending with context enabled. It includes
  readable character/equipment/location/quest data. Protected game values are
  omitted before formatting or arithmetic. Game chat and bag contents are not
  collected. The guide provides advice and does not control gameplay.

## Delivery and approval boundaries

The companion journals before mutation, checks identity/freshness and checks the
actual current question before sending answer input. Uncertain deliveries are
not automatically retried. Pasting an answer and sending Enter are separate
operations. Closed or cached views cannot authorize actions.

These checks reduce stale input but cannot atomically lock a prompt against an
independent controller changing it between inspection and delivery. Do not
simultaneously answer the same prompt through multiple controllers.

## Reporting

Never post credentials, private transcripts, `.local-data`, `WTF`, SavedVariables,
or complete service logs in an issue. Use a minimal synthetic reproduction and
redacted version/status details. If the repository's GitHub **Security → Report
a vulnerability** option is available, use it for sensitive reports; otherwise
ask the maintainer for a private channel without posting exploit details or
private data publicly. No response-time or supported-version guarantee is made
for this alpha.

`npm run check:public -- --history` is a release hygiene aid. It checks selected
known credential patterns and file paths, and requires GitHub no-reply identities
for commit authors and committers. It cannot detect all secrets, personal
information or readable screenshot content. Keep public verification notes to
technical results and limitations; omit chat quotes and personal workspace details.
Manual review remains necessary before publishing.
