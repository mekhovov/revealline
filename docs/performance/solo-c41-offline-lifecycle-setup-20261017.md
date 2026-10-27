# c41 offline and native background setup outcomes

The exact tooling dispatch `c41a02216c0811952232a387fd1743e09452c269` did not produce a native offline or background/return observation. Both failures are retained; neither is gameplay, performance or physical-device evidence.

| Run                             | Retained result                                                                                                                                                         | Artifact identity                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Offline `39015298590`           | Failed before artifact acquisition or browser launch. The single candidate row is `not-run`; the profile inventory is empty.                                            | `12094398961`, 179496 bytes, SHA256 `e3ebb3e3e51c0ca2fa07479f838249c0baa0e6a3cd0e4c12e1e5c216052bae7d` |
| Native background `39015298892` | Full a6 archive/source/CSP admission passed and all three intake commands closed normally. Preparation then failed resolving `/usr/bin/xdpyinfo`; the row is `not-run`. | `12094404053`, 241293 bytes, SHA256 `a97f4cac8028ce336b8ad3eacf4ae360b7d86a16992bbcec78b2111831847905` |

Small exact-source API/run/artifact receipts, complete ZIP SHA/CRC verification and every member readback are retained under `.cache/solo-followup/remote-final-c41-offline-audio-cocoa-lifecycle/{offline,lifecycle}-retained/`. They contain 45/27 members and 572929/742394 logical bytes respectively. No large production archive was downloaded locally. Offline has no browser-owner completion claim because it failed before that owner existed; background only has the three successful intake-owner receipts, with no native row credited.

## Offline-v3

The V2 offline declaration put `run-solo-remote-correctness.mjs` and `solo-remote-archive.py` in `adapterInputs`. The common runner copied those inputs exclusively, then attempted its two unconditional exclusive copies with the same names. Its second runner copy failed with `EEXIST`. The original summary SHA256 is `62738eac6c200bcbd02271cd423612b83270f2a0cc6cca51e32b7e4a957bcbb3`.

The separate V3 declaration moves only these two references to `fixedEvidenceInputs`. A strict admission object binds the failed V2 manifest, run and tooling; it preserves the earlier a7e verifier-closure successor chain. Both hashes remain mandatory: the existing contract step verifies the actual bounded source bytes before starting the common runner, and mode preparation verifies both source and the runner's retained copies before any display/browser preparation. Missing, altered, truncated, expanded or symlinked bytes fail. Duplicate flattened evidence names and undeclared fixed-copy references fail admission. The common runner and its exclusive writes are unchanged.

The one-shot event edge is the current c41 head. Candidate a6, normal8b artifact admission, installed Starter recipe, actual offline transport, both native-state witnesses, cache/SW checks, first/Next replay, profile preservation and every original timeout/resource limit remain unchanged. This is a new declared observation, not a retry of the retained V2 result. The added preflight receipt is capped at 4096 bytes and remains inside the existing 28 MiB aggregate setup retention budget.

The historical V2 test now verifies only its changed offline-adapter reference against `fixtures/solo-remote-offline/c41-evidence-source.json`. All three witness entries (adapter, original manifest and workflow) were independently derived from the actual c41 Git blobs/tree; the witness is SHA-bound in its test. The executed V2 files remain unchanged. Other unchanged current helper references continue to be checked directly. Altered witness/source authority is rejected.

## Native lifecycle-v2

The separate lifecycle-v2 workflow installs `x11-utils` explicitly within the existing ten-minute dependency step, with a 120-second package-command timeout and ten-second termination reserve. Before artifact acquisition it records exact `x11-utils`, `xvfb` and `xauth` package versions, checks all four required display executables, hashes their bytes, and records `xdpyinfo -version`. This replaces the unused baseline dependency-log slot within the existing 24 MiB setup evidence ceiling. The adapter still performs its owned actual-display preflight after artifact admission; there is no fallback or removed display check.

The declaration binds the failed original lifecycle manifest and summary SHA256 `43809e719324c40661c923921c2f23894f736c24bfec2628a69e70ef7d7b13aa`. It changes only setup provenance and the once-only c41 event edge. The original real hidden/visible event authority, ten-second frozen checkpoint, explicit Resume, monotonic tick bound, final checkpoint-bound same-engine replay, resource limits and 100-minute job/98-minute step budget remain intact. A visible browser remains unobserved; no synthetic visibility, WebKit background or actual iPhone suspension claim is added.

## Validation

Focused successor and fixed-evidence contracts passed 13/13. Two isolated copied-closure runs initially exposed missing _test-side_ cross-declaration observer files; those failures remain retained as `offline-confined.tap` and `lifecycle-confined.tap`. The explicit support closures now include both declarations' readback dependencies. The complete final copied suites, with a loader that rejects workspace source fallback, passed:

- Offline: 88 passed, five platform/explicit native-observation skips, no failures (93 total).
- Lifecycle: 56 passed, four Linux-only owner skips, no failures (60 total).

The tools-only copies contain 230 files/4421290 bytes and 186 files/3766467 bytes respectively before the final workflow metadata refresh. All four source-verifier dynamic roots and the actual synthetic verifier smoke execute in these suites. Synthetic archive tests, fault injection and host tests do not supply native gameplay credit. Scoped lint, formatting and diff checks are required before the reviewed commit; the final committed source/hash receipt will be retained alongside the copied-suite outputs.
