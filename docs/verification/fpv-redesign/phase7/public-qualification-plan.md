# Public release browser acceptance

This bounded plan supplements the server-side body/hash audit with an actual browser journey. It uses a new, isolated agent-browser profile; existing local 9042/9043 profiles and unrelated user browser data remain untouched.

The first target is archive-06 v0.44.0, expected game source `fc789c71aa21a240c9966d874dd76e9daeb9f44b`. The publishing/build controller is a separate identity. The controller-input integration `604f5995` is not the game source of this immutable edition.

- Open the canonical HTTPS game URL directly and record version, URL, actual CSS viewport, DPR, browser build, and visible initial screen.
- Use ordinary visible controls to start a flight, make a cut, pause, retain a saved flight, reload, Continue, and Resume. Record actual instructions and HUD/board changes rather than assuming a successful click means the action completed.
- Change one visible preference in this test profile, then confirm it persists after reload. Read-only storage hashes may corroborate retention; no hidden save/profile injection is used.
- In Settings, activate Prepare offline play and then Check offline files. Retain the exact reported file count, byte count, build identity, scope, and result.
- Set the isolated browser's documented offline emulation on, reopen the canonical URL, verify the saved preference/flight and an ordinary running capture, and retain any errors. Restore networking afterwards. This is browser network emulation, not a physical device disconnected from its network.
- Verify the worker's visible/read-only registration scope is the immutable release directory. Do not delete caches, force activation, clear profiles, or rewrite saved data.

Archive-07 v0.45/v0.46 may be checked only after their exact public byte audits are confirmed. These journeys do not certify Safari, physical touch/controller/audio devices, operating-system installation prompts, or long-term browser storage retention. Screenshots and findings will carry the exact immutable edition identity rather than a newer source-preview label.
