# Contributing

This is an alpha. Small fixes, reproducible bugs and verified portability work
are welcome. Read [AGENTS.md](AGENTS.md) and the [architecture](docs/ARCHITECTURE.md)
before changing the transport or question handling.

## Development

Use Node 22+, npm, Lua 5.1, Git and `systemd-analyze` on Linux:

```bash
npm ci --ignore-scripts
npm run check
```

No running WoW, Herdr, Roamgate, cloud account, tracker or custom test runner is
required. The tests use fake adapters, temporary directories and native Lua
stubs. A host-managed runner such as `dev-session` is optional unless required
by your workstation instructions. Do not install a live companion just to run CI.

`npm run check` validates versions, Node tests, the Lua contract harness and
public-file/link checks. GitHub Actions is configured for Node 22 and 24. The
systemd test validates a unit file without starting a service. `npm run package`
builds a complete distributable archive; `npm run stage:addon` stages just the
addon and update slots under ignored `dist/` for inspection. Neither deploys it.

## Changes and review

- Use your GitHub no-reply address for this repository's commit author and committer
  identity. Set it with `git config --local user.email YOUR_GITHUB_NOREPLY_ADDRESS`;
  this does not change other projects. The history publication check rejects
  personal email addresses in commit metadata.
- Keep changes focused and explain the user-visible problem and resulting behavior.
- Add meaningful tests for routing, delivery, installer behavior or protected
  values. Avoid tests that only repeat an implementation detail.
- Preserve old packet formats during rolling companion/UI updates.
- Never test by sending tasks or approvals to someone else's live agents.
- Preserve existing provider settings and deliberate Enter confirmation.
- Update setup/usage documentation and [CHANGELOG.md](CHANGELOG.md) when behavior changes.
- Report actual in-game verification separately from mock test results. UI and
  physical-pixel changes need native-client evidence, using synthetic/redacted
  content before screenshots are shared.

Model discovery is in `bridge/models.mjs`; the Lua fallback menu is in
`addon/Roamgate/Models.lua`. Keep Installed default available and preserve saved
choices. Catalog entries are hints, not proof of account entitlement.
See [local model configuration](docs/MODELS.md).

`package.json` is the version source. After changing it, run `npm run version:sync`
to update the lockfile and addon metadata. Checks reject mismatched versions.
The release process and archive verification are in [RELEASING.md](docs/RELEASING.md).

## Preparing a public release

1. Run `npm run check` and `npm run check:public -- --history` in the actual clone.
2. Review current files and git history for private material. The checker catches
   selected credential patterns, private/generated paths and broken local links;
   it is not a complete secret or personal-data audit.
3. Build and verify the complete release, then rehearse its installation into a
   temporary game tree. Check Node 22 and 24 and the rollback/removal paths.
4. Keep `.local-data`, logs, game snapshots and real chat screenshots out of commits
   and release archives. Distribute source, not a copy of the installed addon
   directory containing published runtime data.
5. Use the existing MIT license and include the font license/notices. Do not add
   game textures or third-party artwork without distribution permission.
6. Describe tested versions and unverified paths in release notes. Public GitHub
   CI must actually run before calling it green; local success is not hosted CI.

Use issues for redacted reproducible bugs and pull requests for code changes.
Read [SECURITY.md](SECURITY.md) before reporting a sensitive problem.
