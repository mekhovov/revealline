# Team earned-picture recovery browser harness

Prepared, not started. Exact Git source `628e95daf403082768cdcf900a8ea1d1ef4629a2` / tree `304acdf23c8ef9c465e61e8338b43a69aebfdca5` with the same four pinned runtime overrides as the existing earned-picture browser candidate. `runtime-overrides.json` is byte-identical to that prior binding and references its four existing immutable copies; this directory does not duplicate those bodies.

The server binds only `127.0.0.1:60389`. Its optional HTTP fault allowlist contains exactly:

- First Connection: `game/presentation/compiled/assets/53f1206a11a8791892f5c844c0641529acbc2c09c8d558676d0d801d72113850.png` (52,720 bytes).
- Relay Yard: `game/presentation/compiled/assets/d76f309d8385cd5d20fc2fff72b7f3abc19299cccdde767d76dd9f4a4960929d.png` (38,090 bytes).

Both original PNG bodies are 1152×576 and were checked against exact Git identities without saving additional media copies. No gameplay, DOM, storage, private page state or timing API is injected. The original four candidate files are untouched.

`faults.json` starts empty, so initial presentation and the lobby can load normally. After owner review, choose an explicit example from `fault-examples/` for the next read. Delays remain bounded at greater than zero and at most 30 seconds; only those two paths can be delayed or return HTTP 503. Unknown fields, extra paths, duplicate failure paths and invalid delay values are rejected. Both example delay configurations use 20 seconds. Each request captures its fault configuration before any delay; changing the file cannot alter an already-pending response.

The unchanged base server budgets remain 32 MiB cache, 64 MiB maximum file, **1,000,000 bytes** of request log (the prior helper's stricter value below 1 MiB), and 2,000 request events. Host/path checks, hash-verified Git bodies, no-store responses and exclusive log/binding creation remain. Git subprocesses explicitly disable lazy fetching. Python syntax was compiled in memory only.

After review the owner may start:

```sh
python3 /Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/p08a-team-earned-picture-browser-recovery/serve.py --commit 628e95daf403082768cdcf900a8ea1d1ef4629a2
```

Open `http://127.0.0.1:60389/game/couch/relay-rescue.html` through ordinary UI. Let initial presentation finish before arming a recovery fault: the same PNG can be used by presentation preloading, so failing it during initial startup is different evidence from failing a subsequent arena-picture preparation. Inspect the actual request log to confirm the intended URL and lifecycle. `readPicture` performs a fresh original fetch, but a retained accepted image may intentionally bypass a new read; a fault with no matching request does not prove a recovery branch. Do not manufacture a win or clear private caches to force that branch.

No browser/server/HTTP request, source modification, build, test suite, staging, commit or release action has occurred during preparation. This packet permits review, not automatic execution or public acceptance.
