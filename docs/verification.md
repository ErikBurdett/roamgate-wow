# Verification summary

Compatibility baseline: WoW Forever 1.60.1.70862 / interface 16001;
Herdr 0.9.1 / protocol 22; Roamgate 0.8.15; Linux / Hyprland / Wine.

Recorded automated results at this revision: **61 Node tests and 105 Lua
checks passed**. Tests use temporary files and fake agent adapters. They cover
transport integrity, session routing, delivery guards and the addon contract.
They do not send prompts or approve requests in real agent sessions.

Live validation is limited to the development installation. Automated Lua mocks
do not establish native rendering, provider entitlement or end-to-end operation
on another computer. Follow the README for the supported platform and setup.

The complete release was checked on Node 22 and 24. Temporary game directories
exercised installation, updates, rollback, removal and reinstall. Bundle hashes
and licenses were verified; generated runtime data is excluded from releases.
GitHub workflow results are available through the repository's Actions page.

