# Verification summary

Compatibility baseline: WoW Forever 1.60.1.70862 / interface 16001;
Herdr 0.9.1 / protocol 22; Roamgate 0.8.15; Linux / Hyprland / Wine.

Recorded automated results at this revision: **51 Node tests and 104 Lua
checks passed**. Tests use temporary files and fake agent adapters. They cover
transport integrity, session routing, delivery guards and the addon contract.
They do not send prompts or approve requests in real agent sessions.

Live validation is limited to the development installation. Automated Lua mocks
do not establish native rendering, provider entitlement or end-to-end operation
on another computer. Follow the README for the supported platform and setup.

