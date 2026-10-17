# Flight practice: stable result actions and native FPV completion

16 October 2026. Hosting remains deferred. Real-hardware checks are also deferred
at the owner's request on this date; neither decision grants a publishing approval.

## Outcome

All **eight** scripted native FPV beginner journeys now pass: Academy and World
Studio, English and Ukrainian, Self-level and Acro. Each deliberately starts
`flight-01`, observes ordered lift/landing/completion through the maintained visible
Detailed HUD, releases owned keys, uses the first ordinary pointer click on Home,
exports through normal UI, and independently replays the actual exported bytes
against that package's admitted dependencies. Browser, server and temporary-site
cleanup pass; no page errors were recorded. The aggregate remains `qualified:false`:
this is bounded functional evidence, not human learning, physical-input acceptance
or permission to publish.

The [original passing receipt](flight-practice-result-qualification-20261016/matrix-passed.json)
and its complete archive retain all eight case files, exports, screenshots, observer
authority and plan. Exercise elapsed times are 13.448–14.827 seconds; 128–136 visible
samples per case. These are task observations, **not performance benchmarks**.
Independent replay binds `flight-01`, the selected mode and terminal step 2/2 on
the ground. A vertical exercise in Acro does not establish rotational proficiency.

## Root cause and repair

The shared result-row owner cancelled auto-next on `pointerdown`. Its synchronous
render removed the countdown's flex item, moving Home before `pointerup`; the
first press could miss. This explains the prior failed native export, and a fresh
component experiment directly reproduces the geometry change: all six keyboard
cases pass, while all twelve pointer/geometry cases fail across EN/UK and widths
1440, 600 and 375. Its original receipt/screenshots remain retained.

The canonical `game/ui/continuous-play.mjs` now cancels the timer immediately but
keeps the exact occupied slot invisible and inert until the result retires. A new
result restores it. Stay here moves focus to an available result action before
its own controls become inert. No navigation action is moved to pointer-down;
release outside still aborts activation. The existing projection tool regenerated
the optional shared shell; no flight mechanics, lessons or rendering were changed.

After repair, **18/18 component browser cases** pass with unchanged target
geometry, correct release-outside behavior and clean shutdown. This fixture uses
a modeled result, not a completed flight; only the separate packaged journeys
above establish the native result/export path. Its final observer records source,
observer and fixture hashes and owns late-acquired resources and independent
cleanup. Earlier diagnostic observer versions remain identifiable in their receipts.

The plan applies [W3C's native click/up-event guidance](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html)
and adds geometry checks beyond [pre-click actionability](https://playwright.dev/docs/actionability).
This is an engineering recommendation, not a WCAG conformance claim.

## Candidate identity

Three-app bundle:
`/Volumes/alex/CodexMigrationStaging/flight-practice-result-pointer-20261016-candidate`.

- Source `90d8443b299fc46d42db9ccec1ff2bdfbfa23b4a`;
  tree `6232c034706a40d5d8cdfed25d3d7b9c61078cda`.
- Envelope SHA-256 `78354d4bfac0346877863c443de4abb1fa8292e4fea71e6b5473e766bd0830b8`.
- Two identical builds, committed inputs and complete original ZIP admission for
  all three apps; `publicEligible:false`. `v0.151.1` remains a development identity,
  not a newly allocated release.

| App | Package revision | Runtime files |
| --- | --- | --- |
| Gym | `3d55ed30217f4cc5bbe27453545e3b4b93167592657bbd8030fdc886866a540f` | 94 |
| Academy | `283a28199a5ca539f7f989c802c7f97e7a0948d26371a2475afda9527031e4d7` | 101 |
| Worlds | `db84d10a7fd3520eb24631d91c8d0b83f0ab66274b972b3ded9d143f26b959bc` | 162 |

Source inventories and original archives remain in the frozen bundle. The copied
envelope and verification receipt are in the evidence directory. Historical
candidate identities are not relabelled as this candidate.

Compared with guide candidate `80a32d6a9`, the 87/94/155 source-input paths are
unchanged; only `optional-practice/civilian-fpv/flight-fullscreen.mjs` differs in
each package. The newer observer-only Worlds correction changes no package input.

## Regression and independent checks

- Full practice suite: **354 passed, zero failures/skips**.
- Observer suite: **102 passed, zero failures/skips** (includes the 13 feedback
  helper checks). These counts overlap other named runs and must not be added.
- Shared/Academy/Worlds/Gym/Team host suites: **118 passed, zero failures/skips**.
  The initial host attempt failed old remove-from-layout assertions and could
  not resolve the local Worlds test dependency. The retry uses the installed
  dependency path and asserts invisible/inert cancellation instead; the independent
  no-restart/state/proof checks remain intact. Its success does not erase that
  initial attempt from the tool history.
- Generated shell byte-equivalence, changed-file lint and whitespace checks pass.
- An independent read-only agent re-admitted the candidate, checked 27 unique
  authority/screenshot/export pins, reran all eight exact-package replays, checked
  all 70 files across the passed/failed matrix archives against originals and
  reviewed the runtime/observer changes without findings. This is automated
  development review, not one of the 24 human publishing decisions.

## Failed attempts and observer corrections

1. The preceding one-case **keyboard** probe passes on guide candidate `80a32d6a9`,
   with native Notebook backup, independent replay and clean shutdown. It did not
   prove pointer behavior. Its full original output is retained separately.
2. The first eight-case pointer matrix on the new candidate passes all four
   Academy journeys but fails all four Worlds journeys **before the first
   controller sample**. Cleanup passes; the aggregate is failed, not eight passes.
3. Worlds' percentage output is touch-only: production CSS hides it for every
   non-touch source, regardless of compact/expanded size. The corrected observer
   reads the visible left knob's rendered vertical transform, divided by its
   production travel radius (`clientWidth × 0.34`; Academy uses `× 0.30`). Localized
   yaw/throttle axis metadata checks the mapping but supplies no numeric
   measurement. Hidden percentage/legacy height nodes are never read. A regression
   fails before and passes after this observer-only correction; all 13 helper tests
   pass. No app or frozen-package bytes changed between the two matrix attempts.
4. The second eight-case attempt uses the identical plan and candidate, with the
   corrected hash-pinned observer, and passes all eight cases. Raw helper metadata
   stays conservative/provisional; the outer case's export hash and independent
   replay result establish the recorded success, not an invented approval flag.

Original [failed matrix](flight-practice-result-qualification-20261016/matrix-failed.json),
[keyboard probe](flight-practice-result-qualification-20261016/keyboard-probe.json),
[component failure](flight-practice-result-qualification-20261016/component-before.json)
and [component success](flight-practice-result-qualification-20261016/component-after.json)
are preserved alongside complete archives. Older failures in the HUD report also
remain failures, including its browser-close timeout.

## Remaining priorities

| Priority | Next item | Benefit / risk if omitted |
| --- | --- | --- |
| P0 | Populated Worlds data through offline browser-process restart; then deliberate offline flight/pause in all three apps | Prevents confusing cached shells with usable saved content. Existing empty/profile observations are narrower. |
| P0 | Real distinct-version update, active-flight protection and rollback for every app | Detects migration/data-loss risks that same-payload path fixtures cannot expose. Keep version allocation under the existing release process. |
| P0 | Current cancellation, 30-second inactivity and five-minute overall-limit journeys, preservation and explicit retry | Proves slow/failing preparation does not strand an older working copy. Controlled quota denial is not physical eviction. |
| P0 | Remaining full-shell appearance/build integration and broader first-pointer actions | These eight stable-launcher exercises do not qualify the complete production build or every modal/input path. |
| P1 | Moving packaged performance, browser accessibility and real guide/content reviews | Functional replay does not establish responsive graphics, spoken announcements or understandable teaching. |
| Deferred | Real hardware, hosting/capacity/public selection | Owner-deferred, not passed. Required publisher decisions remain pending. |

Full-source-shell discovery and the temporary fourth-app recipe retain their
earlier bounded passes. The general EN/UK guide already describes reachable
Detailed guidance. Complete Phase 1/public release, all 24 review decisions,
human/assistive acceptance and physical-device coverage are **not** claimed here.
