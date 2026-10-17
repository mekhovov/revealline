# Solo automatic Next preference and retained transition failures

Main Solo now reads the existing public **Auto Next** preference. Previously the
Settings checkbox persisted `false`, while Solo's separate result countdown still
advanced automatically. The default remains enabled. Solo caches the preference
once, subscribes to changes, cancels an existing countdown when disabled, and
unsubscribes only its own listener on permanent page disposal. A cached page keeps
its listener; other consumers retain the shared preference owner. There is no
per-frame preference snapshot, simulation change, or replay-format change.

## Evidence and validation

An exact-source modeled control at candidate
`a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4` changes the public Settings checkbox to
false, verifies the persisted value, earns First Return through real simulation
inputs, and still observes automatic Choose Your Share. Its expected-bug control
passes 1/1 in 42.297 seconds. All 587 loaded production modules were independently
checked against that commit's Git blobs. This establishes the disconnected
preference; it is not a browser performance measurement.

The new regression fails against the unchanged pre-fix app at the disabled
countdown assertion, then passes with only the reviewed app correction. The
pre-fix app remains byte-identical before and after the red control
(`9a690d7b3bb2e071d2658e0418818ef6842d8f8b3e1a43a0b66d97a07fd3bfc5`).
The final tracked four-file group passes **18/18**, with no skips or cancellations,
in 38.476 seconds, with stable source hashes. It includes the complete new host
test, `win-picture-host`, `continuous-play`, and `global-settings-view` files.
Scoped lint and formatting also pass.

The new test preserves default automatic advancement, disables it through the
public checkbox before a win, cancels an active countdown through the existing
storage notification, and proves that re-enabling does not resurrect the same
cancelled result. Manual Next still works. Full authoritative checkpoints stay
unchanged while waiting on each cancelled result. The test also checks cached-page
and permanent-disposal ownership. It uses controlled 100 ms callbacks, below the
existing 250 ms interruption boundary, without changing simulation ticks or the
60-second test deadline. DOM, images, and painting are modeled; native device and
ten-transition qualification remain separate.

Raw controls and command receipts remain under
`.cache/solo-followup/next-ten-cause-a6/`. The final group TAP is 4,433 bytes,
SHA-256 `991c392ff08dd0ee07a1ef25d7f299fc7400fc60eabb67a6f702642a80f1379e`.
Earlier fixture/setup failures and their bounded cleanup receipts are also
retained. The successful tracked app is SHA-256
`218cfc41b2141bd3cafda3f7a1899cc4771b0b661a7311f0620e27c060e1842f`.

## Original ten-Next cohort remains failed

Run `39015298598` declared twelve arms on the retained 8b baseline and a6
candidate. Ten arms ran; both Chromium repetition-2 arms were withheld after
external calibration failed. All ten observed final recordings reconstruct to
their retained live states in the same engine. Only candidate WebKit repetition 1
reaches the required won Second Landing. The expected final mission is correct
for eleven authored missions and ten manual Next boundaries.

| Arms                            | Retained observation and supported classification                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three WebKit baselines          | First Return won and the public result appeared. Next action 6 returned, but the 60-second running wait failed with the same First Return recording and result phase. Pointer delivery does not prove mission activation. Missing event/bounds evidence prevents assigning the cause to the older countdown layout behavior.                              |
| Two Chromium baselines          | First Return won, but the 20-second public-result wait failed in picture phase before any Next action. The won recording does not waive the presentation deadline.                                                                                                                                                                                        |
| Candidate WebKit repetition 2   | A 372 ms interruption automatically paused the first run at tick 0. No Next was attempted. This is a separate startup interruption.                                                                                                                                                                                                                       |
| Candidate Chromium repetition 3 | Two Next actions; Two Keepers remained running at tick 4,135, two lives, with an enemy-trail loss and 30% coverage below its 60% goal. The held route did not complete.                                                                                                                                                                                   |
| Candidate WebKit repetition 3   | Six Next actions; Two Bays remained running at tick 4,677, two lives, with an enemy-trail loss and 26.87% coverage below its 68% goal. The held route did not complete.                                                                                                                                                                                   |
| Candidate Chromium repetition 1 | Eight manual Next actions, nine victories, and ten playing runs. Long Way Home wins during an unconditional input route; a fresh run appears before the next declared Next. The final Behind the Patrol recording contains 2,925 neutral ticks and no movement. This is consistent with the automatic countdown advancing during the continuing workload. |
| Candidate WebKit repetition 1   | Ten Next actions and eleven won results end with won Second Landing at tick 3,352. The scoped workload completes; its original numerical performance gate still fails. Sparse snapshots do not prove every intermediate mission identity.                                                                                                                 |

For Chromium repetition 1, the retained application events show victory at
281,611.2 ms, result overlay at 285,564.4 ms, and a new run at 290,493.6 ms. There is
no declared Next after action 72 before the failed result wait at action 97. The
exact a6 code invokes Next after its four-second result countdown. This supports
the automatic-transition explanation without claiming that the report captured
that call stack. Other rows have independent causes and are not repaired by this
preference fix.

The row/source review independently rehashes all ten reports and recordings. Its
compact `review.json` is 212,190 bytes, SHA-256
`fe8e1627660f7a87c08b9c6d18188f3874167ee70594cbb27bf97a66ce786cbf`.
Original declarations, failures, deadlines, and numerical exclusions stay intact.
Because the historical 8b app also ignores this preference, a future candidate
manual-Next workload cannot be described as a matched comparison with a baseline
that honors the same disabled setting. It requires an explicit declaration and
actual new package, including observed mission identities at every boundary.

Playwright's [keyboard API](https://playwright.dev/docs/api/class-keyboard) delivers
input events, while [actionability](https://playwright.dev/docs/actionability)
checks whether an action can be delivered; neither certifies a mission
transition. The browser [storage event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event)
notifies other documents, while same-document changes already use the existing
preference owner's subscription. These API facts do not identify unobserved
historical browser faults.
