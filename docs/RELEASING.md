# Release packaging

The complete release is `dist/roamgate-wow-VERSION.tar.gz` and a matching
`.sha256` file. It contains addon sources, companion code, setup/recovery scripts,
locked production dependencies, docs, tests and licenses. It does not bundle Node,
Herdr, Roamgate, provider CLIs, a game client or OS capture tools.

## Build

1. Update `package.json` and run `npm run version:sync`. Commit the generated
   addon metadata and lockfile too; `npm run check:version` rejects divergence.
2. Run `npm ci --ignore-scripts`, `npm run check`, and
   `npm run check:public -- --history`. Review history for private material.
   The pattern scanner is not a complete secret or personal-data audit.
3. Run `npm run package` with npm, GNU tar and registry access available.
   The builder copies an explicit source allowlist, installs production dependencies
   from the lockfile with lifecycle scripts disabled, records per-file SHA-256
   hashes, and writes the archive plus its external checksum. Temporary build
   files are removed even on failure. No install or service action is performed.
4. Verify a fresh extraction, run checks on Node 22 and 24, and rehearse installation,
   updates, rollback and removal against temporary game folders. The automated
   lifecycle tests use fixtures, never your live WoW or agents.
5. Commit the release source. Push and wait for actual GitHub CI results before
   tagging/publishing. Attach only the complete archive and matching checksum to
   the release. State tested versions, alpha/platform limits and any unverified
   native UI behavior. Do not label local checks as hosted CI.

Use `npm run stage:addon` only for inspecting the generated addon and 2,048 update
slots under `dist/AddOns`; that folder alone is not an installable distribution.
The complete archive's installer generates the user's selected slot count.

## Verify a download

Download both files from the same trusted release, in one directory. Replace
VERSION below with the release version:

```bash
sha256sum -c roamgate-wow-VERSION.sha256
tar -xzf roamgate-wow-VERSION.tar.gz
cd roamgate-wow-VERSION
node scripts/verify-release.mjs
```

The manifest covers every shipped file, including licenses and dependencies,
except the manifest itself. The external checksum covers the whole archive.
These detect changes/corruption; they are not a publisher signature. Run the
manifest check on a fresh extraction before setup/tests add local state.

## Public contents

Never copy from a real game AddOns tree when making a release: update `Data.lua`
files can contain chats. Keep `.local-data`, installation snapshots, recovery
folders, SavedVariables, screen captures and authentication data out of archives.
Use synthetic conversations for public screenshots; real in-game rendering must
be described separately from mock tests. WoW textures are referenced at runtime;
no standalone game asset files are bundled. Documentation screenshots can include
in-game visuals for illustration, with the notice in THIRD_PARTY_NOTICES.md.
The font and bundled dependency retain their licenses.

The repository's GitHub workflow checks Node 22 and 24 and builds/verifies the
complete archive on Node 24. A release archive can be
built locally before publication; no GitHub repository creation or publishing is
performed by `npm run package`.
