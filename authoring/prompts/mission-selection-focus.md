# Mission selection focus regression prompt

Inspect the actual Missions card handler before changing focus. Reproduce a click on its nested artwork/status label, since the host can replace cards and detach that clicked subtree before a bubbling listener runs. Preserve actual event propagation and native focus loss in the test boundary.

Model native microtask checkpoints between listener callbacks as well as ordinary JavaScript dispatch. A microtask queued by a capture listener can run before the target handler, so capture ownership early but queue restoration from the matching bubbling phase after host mutation. Capture the initiating card before mutation; use the shared operation-focus lease rather than giving every repaint permission to focus a default. Restore only the connected selected card for that mission in the same open dialog. Prove newer focus, Back, close/reopen, backgrounding and destroy retire it. Keep the app's replacement confirmation, explicit Deploy and simulation unchanged.

Record accepted source and runtime hashes, the genuine baseline failure, focused and relevant regression results, fixture corrections, and separate native/physical-device limits. Update this contract if production navigation ownership changes.

Extend the standard-controller journey from selected-card focus through D-pad traversal to Deploy and South/A activation. Preserve neutral-input gating and assert the actual running flight. Model missing native readiness notifications explicitly rather than enabling a disabled button in the fixture; keep live host getters intact when wrapping its API.
