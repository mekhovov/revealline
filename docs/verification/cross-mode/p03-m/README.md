# P03-M — Title mode entry

Title now shows Solo as the current mode and real Versus/Team links. Both use the existing Solo departure owner and retain the actual Title opener. Their fixed Back route opens Title; they do not create a Missions hint, start a mode or resume a saved flight. Missions v1/v2 returns and the First Signal default remain unchanged. See [the navigation contract](../../../title-mode-entry.md).

This internal P03 work package is based on `5aceb1b34764822e12303489494bd6b91e23516e`, with the exact shared presenter from P03-L commit `8078796de87ba64ae49076a81e7a444915f5e720`. The six production/dependency pins in [held source 03](source-held-03.json) bind four owned files (app, HTML, shell and modal helper) and two borrowed presenter files. The borrowed files are dependencies, not part of M's source commit. Source review by root and Lagrange closed without a blocker; tests and native observations have distinct scope below.

## Source validation

[Verification](verification.json) records eleven complete affected files passing **366/366 on Node 22.22.2 and 366/366 on Node 20.19.5**, with zero failures, skips or cancellations. The two runtime counts are not summed. Materialized game inputs remained byte-identical across both runs. Scoped ESLint, Prettier and Git whitespace checks passed.

The actual host tests cover fixed Title destinations and receiving Title without automatic continuation, Immediate/Grid cuts, saved retention, Stay/Escape/controller Back, changed writers and readback failures, lifecycle retirement, close/reopen and deliberate newer focus, delayed Start and saved Continue. A pending saved Continue may refuse departure until the existing restore cleanup releases its busy state; a fresh action then works without late adoption or changed stored bytes. These tests execute actual modules and markup through a finite DOM/input model; they are not browser or physical-controller evidence.

The shared modal helper removes closed stack entries while inactive. It admits opener restoration only from a foreground close and checks foreground again when the queued callback runs. Existing top-layer, reopened-dialog and newer-focus guards remain. These two checks do not observe every complete blur/return between them; the Title request separately owns persistent lifecycle cancellation.

## Root's desktop browser observations

[Native retention](native-verification.json) hashes root's original [19-event record](native/events.json) and six PNGs, and independently rechecks actual HTTP bytes after the observations. The source preview was `http://127.0.0.1:54230/game/`, with exact Git `5aceb1b` plus the six pinned overlays. The source [binding](preview/binding.json) explicitly retains Git `5aceb1b` Couch lobbies: successor Couch L/R5 composition was not part of this native run.

- Title → ready Versus → keyboard Return to Solo, and Title → ready Team → Escape to Solo Title, did not start a flight automatically.
- During a paused attempt at 0:06, Team displayed the checked-save decision. Escape restored the actual `shell-title-team` link; repeat confirmation departed to Team, then Back offered named Continue without automatic resume.
- Root visually reviewed [second-cut-running.png](native/second-cut-running.png) as the actual exposed line. Explicit Continue without another direction completed First Signal at **52.2%, 8,160 points, 0:09**.

The records preserve imperfect attempts. Event 10's intended Pause missed the shortcut and observed a win; its correction remains in the original JSON. The earlier `unfinished-cut-running.png` still shows the border and does not prove an exposed line. [saved-continue.png](native/saved-continue.png) already shows the completed result, not the exact resumed position. Exact checkpoint, queued direction, save-fault and background-currentness assertions remain host-test evidence; browser observations are not relabelled to match those stronger oracles.

## Retained diagnostics and remaining gates

[Copy map](copied-evidence.json) covers 42 originals / 883,105 retained bytes, using byte-identical metadata/PNGs and lossless deterministic gzip for logs, diffs and earlier test snapshots. Every copied input was rehashed and every compressed output was reread and decoded against the original bytes.

Initial incomplete runs and the command timeout are retained. Comparing full cyclic DOM objects made focus failures impractical to report; subsequent assertions use compact element identities. The precise 20/25 diagnostic exposed three shared foreground-restoration failures and two invalid tiny-picture fixture IDs. The corrected fixture matches its actual library mapping. The later 60/61 two-file run exposed an old paused Workshop challenge expectation: R3 now requires explicit checked replacement. The test now waits for that decision and confirms it before retaining its original ready, focus and no-advance assertions. No executed baseline reproduction is claimed for that expectation. The final eleven-file pair supersedes these diagnostic scopes without erasing their records.

P03 remains implementing. This is not a version, public release, full-source CI certificate or phase acceptance. Combined P01/P02/P03/P05/P08 gates, successor Couch integration, responsive/browser matrix, public/offline checks and physical-device qualification remain required. No native controller, touch/phone/Safari, audible media or public acceptance is claimed. No core, saved format, artwork or producer changes are included.
