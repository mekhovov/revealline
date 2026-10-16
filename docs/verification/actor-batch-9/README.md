# Actor batch 9 — C4 native preview and recovery

Source candidate on PR761, based on `cedcd158ddb795940471453b5ef84d0b2b4ddca0`.
This evidence qualifies a bounded authoring dependency, not production adoption,
publication, complete optional-combat readiness or C2 completion.

## Practice failure boundary

An exception in a ready Solo PRACTICE frame now latches that child as failed.
Its simulation, BoardPainter frames and controller polling stop. Flight input is
cleared and disabled; queued Resume/Prepare actions cannot revive the instance.
The controller Confirm echo guard is destroyed so held Confirm cannot retain
native-input suppression after frame polling stops.
The existing scrollable overlay shows translated recovery copy, while the
registered child Return action and parent Close/relaunch remain available.

The child reports
`document.documentElement.dataset.practiceRenderState === 'failed'` separately
from the successful `bootState === 'ready'`. A restored failed page stays failed;
a deliberate fresh child starts without the latch. Ordinary Solo exceptions keep
their previous propagation path. No simulation rules or historical source
catalogues change in this dependency.

Owned implementation and regression:

- `game/app.mjs`
- `game/ui/practice-render-failure.mjs`
- `game/test/practice-render-failure-host.test.mjs`

The focused real-host tests execute app and BoardPainter code with modeled DOM,
Phaser, Canvas2D and image-decoding boundaries. They establish exception ownership,
input isolation and lifecycle behavior; they do not establish native raster
quality, small-screen layout or human readability.

## Test results and inherited failures

The initial tool-stream runs reported **4/4 focused tests passing** and **36/40
adjacent tests passing**. Those original streams were not retained as files.
The TAP files below are post-correction captures of the same commands, not
reconstructed original logs. Earlier fresh captures remain in
`/tmp/revealline-batch9-evidence-txy4rity/`; current raw paths are recorded below.

The four adjacent failures are in `practice-brief-host.test.mjs`:

| Turn policy | Case                                              | Expected focus  | Observed focus   |
| ----------- | ------------------------------------------------- | --------------- | ---------------- |
| immediate   | Native keyboard brief/read after a live-cut pause | `overlay-brief` | `shell-settings` |
| immediate   | Controller brief/read/Back and held direction     | `overlay-brief` | `shell-settings` |
| grid-center | Native keyboard brief/read after a live-cut pause | `overlay-brief` | `shell-settings` |
| grid-center | Controller brief/read/Back and held direction     | `overlay-brief` | `shell-settings` |

All four reproduce when an ESM load hook substitutes the exact **baseline
`game/app.mjs` from `cedcd158`**, keeping the current test files and other modules.
This comparison establishes that this app failure-latch change did not introduce
those failures. It is not a clean historical-checkout result and does not identify
their root cause. The failures remain open; they were not skipped or relaxed.

The baseline source and hook used for both comparisons are:

- `/tmp/revealline-practice-baseline-w1to2xl2/app.mjs`
- `/tmp/revealline-practice-baseline-w1to2xl2/loader.mjs`

Baseline app SHA-256:
`4bf1535b8e89ab353cd99dc4c4c45f9d47437e31fa68b82013eb145f2e91635d`.
The retained bytes were checked against `git show cedcd158:game/app.mjs` and
matched exactly. Current app SHA-256 at capture:
`1a975f62a7b947097e37f96807cace277e5bdfc609160654e2e72c4a33aedc8a`.
The hook changes module loading in the test process only; no checkout or Git state
was changed.

Commands use Node 22.22.2 from the repository root:

```sh
node --test game/test/practice-render-failure-host.test.mjs
node --test game/test/practice-render-failure-host.test.mjs game/test/practice-brief-host.test.mjs game/test/controller-practice-pause-host.test.mjs game/test/practice-retry.test.mjs game/test/boot.test.mjs
node --import /tmp/revealline-practice-baseline-w1to2xl2/loader.mjs --test --test-name-pattern='^(immediate|grid-center): (native keyboard|controller brief)' game/test/practice-brief-host.test.mjs
```

The post-correction captures retain the original pass/failure counts:

| Stored TAP                                                           | Pass / total | Exit | Duration |
| -------------------------------------------------------------------- | ------------ | ---- | -------- |
| [Focused failure recovery](practice-render-failure-focused.tap)      | 4 / 4        | 0    | 2.137 s  |
| [Current adjacent suite](practice-adjacent-current.tap)              | 36 / 40      | 1    | 30.143 s |
| [Baseline app, four affected cases](practice-brief-baseline-app.tap) | 0 / 4        | 1    | 12.120 s |

No capture has skipped or cancelled tests. The baseline capture runs the four
affected cases only, not the complete 40-test adjacent suite. Both captures have
the same four case names and expected/observed focus differences.

The strengthened focused test holds controller Confirm in the paused menu at the
render fault, releases it and activates native Return **before any blur or
visibility reset**, with polling stopped. It reproduced the blocker before
`controllerConfirmGuard.destroy()` was added to the failure stop: Enter was
consumed. [Before-fix TAP](practice-confirm-guard-before-fix.tap) records that
assertion and its parent-test failure (2 passing, 2 failing entries). The corrected
4/4 capture proves Return reaches the parent without that reset. Scoped ESLint
and Prettier pass for the corrected app and focused test.

Raw paths below are absolute; stored files are adjacent to this README. Stored
TAP normalization changes only CRLF to LF and trailing whitespace, with one final
newline. Diagnostics, paths, counts and timings are retained.

- `/tmp/revealline-batch9-confirm-guard-focused.raw.tap` → `practice-render-failure-focused.tap`
  (1,151 → 1,151 bytes). Raw and stored SHA-256:
  `4d6c7178f95d16ee859cb1cf229abaaa0ad455766ad3da8763df6abbdecce8e6`.

- `/tmp/revealline-batch9-confirm-guard-adjacent.raw.tap` → `practice-adjacent-current.tap`
  (13,902 → 13,870 bytes). Raw SHA-256:
  `4ed09eb47b7c9ccd0615c76a4c51a4d820f728254e1e9da49c6c8f407c6a58ed`;
  stored SHA-256:
  `5601697a2f56b40cc19aad7e86ecb84554befa9a7a9f3344d53860c4c30b41ca`.

- `/tmp/revealline-batch9-confirm-guard-baseline.raw.tap` → `practice-brief-baseline-app.tap`
  (4,777 → 4,745 bytes). Raw SHA-256:
  `94c141eab317d34102cb05cb937aad59aeb3f6b72de9ceb732d26393d7c32685`;
  stored SHA-256:
  `3cf7701fd274b152e3cb89e569d7fd6c83b36e0acd9ba89093aa58d8d3aedd7c`.

- `/tmp/revealline-batch9-confirm-guard-before-fix.tap` → `practice-confirm-guard-before-fix.tap`
  (2,387 → 2,371 bytes). Raw SHA-256:
  `fdb70a5c643adc89b9b7d6cb5b4f532c0f8d416433e557d75f369fd288843b99`;
  stored SHA-256:
  `2a9e8e2b3f6c562a50b714ea2d92c4bd6ca1d4edda7191ccd6b3a1ec0fded9e2`.

## Shared renderer and Studio integration

The actual `BoardPainter` projects validated optional actors, warnings, shots and
cosmetic scrap through a bounded cache. Projection occurs before any clock/canvas
mutation; absent/disabled combat keeps the same drawing commands. Existing
pressure actors and shots remain distinguishable. Trails, ordinary keepers and
the player retain their layer priority. Full reveal removes live hazard drawing.

The adapter test now calls the actual checked-out class. Historical patch/renderer
bytes remain unchanged; an exact retired player-locator fixture supplies the old
renderer’s missing import, without restoring it to production.

- [203/203 encounter/authoring checks](combat-focused.tap): actual renderer,
  independent pressure/sentry locks, replay/restoration, legal return cancellation,
  optional-on/off compilation, Studio controls/readiness and EN/UK failure copy.
- [184/184 renderer regressions](renderer-regressions.tap): includes rotor/contact
  and presentation behavior. These cohorts overlap and are not additive coverage.
- [28/28 lifecycle/Studio checks](preview-lifecycle.tap): source functions retire
  pending/ready children on pagehide, reject late preparation, stop monitoring,
  avoid focus theft and permit a deliberately fresh launch.
- [Compiler copy follow-up](compiler-final.tap): confirms final updated candidate
  diagnostic without reverting any assertions or changing defaults.
- [Source provenance checks](source-provenance.tap): two selected tests pass;
  four other file cases are outside this command. The effects closure now binds
  27 actual source inputs. New production review is required; old approvals and
  compiled assets were not rewritten.

All source inventories and checks preserve original content identities, scenario
rules and current ordinary Journey defaults. Only explicit Solo practice admission
is enabled here; Team and paired-race Studio preview remain unsupported.

## Native browser evidence

Using the no-store source server at `http://127.0.0.1:8808/`, imported the existing
three-mission optional-workshop candidate into an isolated local project named
`c4-native-preview-check`. Used Inspect import, Apply inspected source, selected
Sentry detour, Play exact Solo preview and Start mission through ordinary UI.
No game-state injection, artificial victory or awards were used.

At **1280×720**, actual keyboard steering incurred ordinary losses, completed a
legal cut (**0.8% /170 points**), and retained the board through Pause/Resume. The
optional sentry was rendered separately from ordinary keepers. Close blanked the
iframe and restored focus to `play`; fresh launch worked. Native browser Back
retained the saved project with the child closed; it did not prove that this
browser used BFCache, which is covered separately by modeled lifecycle tests.

- [Native sentry/capture screenshot](native-sentry-preview.png).
- [390×844 portrait](native-preview-portrait.png): entire board visible; parent
  Close and Return targets both measured44px high and document width390px.
- [844×390 before](native-preview-landscape-before.png): fixed720px iframe
  cropped board/HUD within the actual viewport.
- [844×390 after](native-preview-landscape.png): viewport-bounded iframe gives
  the child its real short-landscape size; complete arena and critical HUD fit.

This is actual browser keyboard/pointer play and visual review, not physical
touch/controller certification or a completed mission/balance playthrough. The
controlled renderer failure and held-Confirm recovery are host-test evidence; no
native browser crash was injected. Reduced-effects/combined-lock raster commands
are tested separately, not claimed from these screenshots. Full optional combat
preferences, production appearances, culture review and whole-content/device
qualification remain open.

## Build and release boundary

Repository lint, formatting, native formatting, content/presentation validation
and Motion Lab syntax pass. The temporary committed long-suite waiver is unchanged;
no full suite pass is claimed. Preserve the four inherited practice-brief failures
above. Final ordinary build byte/source verification is recorded separately in
`development-build-verification.json`. This branch retains development metadata
v0.141.7 and no frozen source SHA; the publisher must reconcile accepted newer
production history, assign the next version and perform exact-source/provenance,
immutable-asset and public-play admission. PR761 remains a source input, not a
public actor release.
