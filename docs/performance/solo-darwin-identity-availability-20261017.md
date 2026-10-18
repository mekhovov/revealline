# Darwin identity availability diagnostic — 17 October 2026

The Cocoa owner preflight remains failed. This new one-shot diagnostic observes whether a different read-only identity API is available on the hosted macOS runner. It grants no process ownership, signalling, media, gameplay or performance qualification. The existing production inventory, common runner and game are unchanged.

## Retained failed observation

Run `39015298580`, tooling `c41a02216c0811952232a387fd1743e09452c269`, failed the original global `PROC_PIDTBSDINFO` inspection with `EPERM` for PID 12928 (`result=0`, expected 136 bytes). The caller UID/EUID was 501. A later non-authoritative `ps` hint described UID 0 `/usr/libexec/sysdiagnosed`, PPID 1. That later hint cannot establish the original process identity because the PID could have exited or been reused. No browser or media was launched.

The complete five-member artifact `12094876420` is 3,621 bytes, SHA-256 `1c37aa4bf3f4165dcc976180fa53a8dcd8205f9126d3af04dc1a326e661270b1`. API identity, archive hash, all ZIP CRCs and every member readback passed. Raw receipt: `.cache/solo-followup/remote-final-c41-offline-audio-cocoa-lifecycle/cocoa-retained/receipt.json`. The original workflow and failed result remain unchanged.

## Why filtering to one UID is insufficient

Apple's published [`proc_info.c`](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/bsd/kern/proc_info.c) implements `PROC_UID_ONLY` using effective UID and `PROC_RUID_ONLY` separately. It exempts short BSD and unique-identifier queries from the same-user check applied to the full BSD query, while other security policy can still deny inspection. This supports testing availability; it does not guarantee the hosted kernel exposes the API.

The existing spawn contract does not confine future descendants to a UID. Apple's [`posix_spawn` documentation](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/posix_spawn.2.html) describes ordinary identity inheritance and set-user-ID executable behavior. A privileged executable or later credential change means an effective-UID filter could omit an owned descendant. A union with real-UID filtering is also not a proof of descendant completeness. Therefore this diagnostic retains the global list and records both filtered lists only as sequential, non-atomic membership hints. No arbitrary permission-denied entry is skipped as healthy.

## Narrow new observation

The C helper uses the public SDK's short-BSD structure and the private selector 17 / 56-byte unique-identifier layout documented in Apple's pinned [`proc_info_private.h`](https://github.com/apple-oss-distributions/xnu/blob/f6217f891ac0bb64f3d375211650a4c1ff8ca1ea/bsd/sys/proc_info_private.h). The private definition is absent from the local public SDK. The referenced Apple source is an ABI research reference, not a verified source match for the hosted kernel. An unsupported, denied, zero-without-exit-error or short result stays failed/unsupported.

For every positive global PID, the helper reads unique identity, short BSD, short BSD, then unique identity again. It requires stable PID, parent/group, effective/real/saved UID, unique identifier, parent identifier and identity version. Changed results remain explicit. Only a zero/negative read with `ESRCH` or `ENOENT` is recorded as disappearance. Every enumerated PID has one row; truncated, duplicate, negative or saturated lists fail. The exact unsigned 64-bit identifiers remain strings in JSON.

The entire native snapshot helper process is bounded by three seconds, 16,384 PID slots, 8 MiB stdout and 64 KiB retained stderr. The JSON report is at most 1 MiB; it contains counts and at most 64 exceptional rows, while the full bounded native output remains separately hashed and retained. The wrapper retains compiler/SDK/arguments, exact C/MJS and binary identities, stdout/stderr, command status, parse failures and binary-change failures. It requires a fresh output directory and exclusive writes. A successful availability label still carries `ownershipQualification: false`, `mediaObservations: 0` and `performanceQualification: false`.

The separate macOS 15 workflow is enabled only for PR 1544, same repository, `synchronize`, immediately after `c41a02216c0811952232a387fd1743e09452c269`. Its ten-minute job contains seven explicit step minutes (two checkout, one Node setup, two mocked controls, one compile/observation, one failure-safe upload), leaving three minutes of scheduling/closure reserve. It neither installs nor launches browsers. There is no automatic retry or fallback to the original failed observation.

## Controls and limits of the evidence

The six focused tests passed locally, including a compile against the actual SDK with deterministic mocked libproc functions. Twelve mock cases cover effective-UID omission, foreign-UID omission, explicit disappearance, permission denial, zero without errno, short reads with exit errno, PID recycling, parent/UID changes, malformed enumeration and duplicate/negative PIDs. Other controls reject truncated rows and command timeout/capping, and exercise all 16,383 admissible rows with a bounded summary. The source wrapper calls these mocked functions only; no actual local process inventory or browser was launched.

Raw focused TAP: `.cache/solo-followup/c41-offline-lifecycle-successors/cocoa-availability-v1.tap` (6/6, no skips). The exact four-file sparse workflow copy also passed 6/6 (`cocoa-isolated.tap`), and independent peer review passed 6/6 (`.cache/solo-followup/final-native-c41/cocoa-availability-peer.tap`). Scoped lint and formatting passed. The hosted observation remains unobserved until the separately declared workflow completes. Even successful hosted API availability would require a separate reviewed ownership design and real closure checks before it could support Cocoa browser execution.
