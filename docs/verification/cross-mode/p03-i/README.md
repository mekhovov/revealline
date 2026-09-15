# P03-I Team departure record

This internal work package guards loss of an unfinished Team attempt. It is based
on `bb372a012ec2d12cf89bba1b251a4721e30b3c13` and changes only the Team host,
markup, scoped confirmation CSS, its existing host test, and related guidance.
It does not merge the separate P03-H starting-setup work, change a version,
publish a release or complete P03.

The three final production files are pinned in
[source-held-03](source/source-held-03.json). The source review by Lagrange and
root found no blocker in that exact hold; this statement reports their source
review separately from the recorded test and browser results. No co-op core,
shared input/navigation, format, replay, save, producer or generated file changed.

## Executed source checks

Four complete affected files pass on each Node version:

| File                                                                            | Node 22.22.2 | Node 20.19.5 |
| ------------------------------------------------------------------------------- | -----------: | -----------: |
| `game/test/coop-host.test.mjs`                                                  |      61 / 61 |      61 / 61 |
| `controller-navigation`, `couch-input`, `coop-input-policy` test files together |      91 / 91 |      91 / 91 |
| Unique cases per runtime                                                        |    152 / 152 |    152 / 152 |

There are no failures, skips or cancellations in those final runs. These are
four whole files, run in a host batch and a separate three-file batch; they are
not a full repository suite or a build. Syntax, ESLint, Prettier and authored
whitespace checks pass. The [host receipt](host/verification.json) identifies the
final test/source pins and [shared input pins](source/shared-tests-before.json)
bind the other whole-file runs. Exact commands and results are retained in the
individual receipts/logs. Historical runs are not added to the final count.

The host tests use real Team markup, controller navigation, input adapter, core
and painter, with modeled DOM/native default events, pads, frames and Canvas
commands. Paused-state comparisons cover displayed HUD and the real painter's
command stream, not private core-object identity or physical pixels. Retry also
matches the original fresh HUD/paint before progressed enemy state is reset.
The tests cover eight running/paused entry combinations, Stay/Back/Tab, fixed
Solo/Versus destinations, held controller confirmation, lifecycle cancellation,
changed hidden setup controls, failed navigation and injected rendering faults.

## Retained correction history

- The initial 57/59 run exposed a real Retry bug: live enemy fields had made
  `run.level` invalid as a fresh authored recipe.
- The fault-handler successor passed 58/61. It cleared an invisible pending
  decision after a pause-time rendering error; the same recipe defect still
  prevented Retry and the second rendering-fault path.
- Capturing the original authored starting level fixed Retry. The 60/61 run's
  remaining failure was a test clock expectation: 75 frames at 120Hz is 0.625s,
  so a whole-second display correctly remained 0:00. The check now waits 150
  controlled frames and retains the same advancement assertion.
- A 61/61 pair preceded a lint-only test correction from bare `location` to
  `globalThis.location`. Both complete host runs passed again on the exact final
  test pin. The initial lint report was tool output; it is not invented as a
  retained raw file.

Raw logs and source diffs are stored as deterministic gzip files. Their
uncompressed bytes remain exact, with both original and retained hashes in
[copied-evidence.json](copied-evidence.json). JSON and native images are exact
copies. Historical absolute/relative cache paths inside original receipts retain
their original meaning; the mapping identifies their portable retained copies.

## Scoped native desktop observations

Root used a fresh hash-bound preview on port 61341 with only the three final
Team files over exact `bb372a`; the [binding](native/native-preview-binding.json)
and [server](native/serve-native-root.py) are retained. The
[native receipt](native/native-root-verification.json) binds 21 observations and
two original JPEGs at a 1393 × 1348 desktop viewport. Snapshot and DOM reads were
sequential and are not claimed to be atomic.

The observed Relay Yard attempt paused at 0:08. Stay/Escape retained its clock,
coverage and reserves; Tab wrapped between the two decisions and measured
confirmation actions were 50 CSS px. Explicit Discard and retry reset to 0:00
without an arena error. Confirmed Change setup returned to a focused lobby Start
without auto-starting; native selection changed to First Connection. Header
pointer requests with keyboard confirmation reached actual Solo and Versus
pages without automatically starting them.

Paused header links are still outside the active keyboard navigation root.
An intended Solo-header Enter redirected focus to Resume, and the next Return
explicitly resumed. The two original intent labels in
[native events](native/events.json) carry corrections; they are not counted as
successful keyboard-header or Stay journeys. Future mode destinations need
in-panel keyboard/controller actions rather than exposing unrelated page roots.

This record does not establish native fault handling, held controllers, imported
packs, nonzero-territory preservation, portrait/short-landscape geometry, zoom,
physical touch/controllers, browser chrome navigation, reload durability or
public/offline acceptance. No synthetic fault or state fixture was used in the
native preview. The source-test fault cases and actual native journeys remain
separate evidence.
