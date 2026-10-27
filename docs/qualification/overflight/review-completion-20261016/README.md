# Remaining-delivery review — 16 October 2026

Source successor `79354e383`, followed by results-layout correction `3a6631bd9`,
based on `c8f4831a5` / runtime `cf16eea20`. Only Marathon preview/result presentation
changes host source in this batch. Project,
weapon, enemy, progression and record identities are unchanged. Current plan:
[remaining delivery and research](../../../fpv-survivals-completion-plan-2026-10-16.md).

## Completed correction: truthful Marathon decisions

V4 next-contract previews no longer promise reflected routes or moved escort
offsets. The native mode intentionally keeps these inside authored terrain;
it varies layout, route order and selected reversed columns instead. Both EN/UK
previews follow the compiled rules version. V3 retains its real legacy reflection
and escort-shift descriptions. No combat parameters or authored content changed.

The first native review then exposed a real presentation defect: route prose used
an ordinary large-number tile in a four-column grid. `native-marathon-preview-before.png`
retains the cramped tall result. `3a6631bd9` gives only the next-contract description
a full-width text panel with readable wrapping and shared Large-text support.
Numeric stats keep their existing visual treatment. Native replays complete the
first two contracts before/after the layout fix with **identical full gameplay
summaries**. `native-marathon-contract2-layout-fixed.json.gz` preserves the fresh
final receipt; `native-marathon-preview-after.png` shows the actual full-width row.
`native-panel-layout.json` records desktop832px/20px and narrow280px/16px text
panels, both without horizontal text overflow. The320×720 viewport is a desktop
responsive check, not a phone test; the browser viewport was restored afterward. `result-layout-before.tap`
retains the failing semantic result-layout test; the corrected cohort is recorded
separately below. This UI correction follows the frozen soak/refit runtime and
must not relabel their measured sources.

The regression checks actual transformed actor routes and escort offsets as
well as their previews, rather than only matching new text. The focused variant /
battlefield / package cohort passed 26/26 in the implementation check; final
source integration receipts follow separately.

## Completed diagnosis: Systems default and challenge profiles

`systems-routes.json.gz` preserves four predetermined controls on the exact two
previously losing layouts/seeds. No new pilot, equipment grant, damage buff or
salvage adjustment was made. All use the original crowd rule, legal earned
choices, ordinary 10 Hz review input and 1.5-second draft delays.

| Configuration | Control | Outcome / time | Damage |
| --- | --- | --- | --- |
| Single Drone Systems · Dispatch Junction · seed26022022 · Veteran | Figure-eight / one airframe | Lost 286.83 s | 100 contact |
| Same | Original tight route / default three airframes | **Won 389.90 s** | 280 contact |
| Riy Systems · Shelterbelt Gaps · seed19910404 · Standard | Figure-eight / one airframe | Lost 271.92 s | 80 contact + 20 fan |
| Same | Original tight route / default three airframes | **Won 357.63 s** | 180 contact + 20 fan |

All four earn ten choices. Both three-airframe wins lose two airframes; their
first replacement occurs at the exact corresponding retained one-airframe loss
time, with identical earned upgrade IDs/ticks through that point. The older
one-airframe losses remain failures. These are current-default completion
examples, not proof of human difficulty, a fully crossed matrix, or deliberate
priority-target play from this generic salvage-seeking pilot.

The 33-module simulation source closure is stable throughout the 40.27-second
study. HEAD changes from `c8f4831a5` to the unrelated Marathon-preview commit
`79354e383`; start/end hashes retain that distinction. The raw decompressed
receipt SHA-256 is `e0978bc027bb04239abde9d9f534fa9a3437ce8f023a574fed6c9722001446b9`.
The copied runner retains its original absolute worktree/output paths for exact
provenance; do not overwrite its completed output when reproducing.

The diagnosis does not justify making the one-airframe challenge as forgiving
as the default preset. No additional diagnostic pilot or blanket buff is shipped.

## Native same-seed restart check

`native-retry-baseline.json.gz`, ten `native-retry-XX.json.gz` receipts and
`native-retry-dom.json` record actual shared Settings → Retry on one native
reference-fixture page with experimental local spacing. All ten visibly enter
play and export after real simulation steps; the export action deliberately
pauses the run. Nine are short ~0.25-second restart samples, not complete sorties.

`native-retry-summary.json` checks matching seed/project/appearance/crowd rule,
1,500 simulated / 700 visible, one canvas, 1,812 allocated sprites and a stable
28,467,840-byte base atlas. No graphics failure appears. Existing renderer pools
are retained by the host; this is not a browser-heap or full-disposal certificate.
The fresh sustained soak is separate from these untimed UI actions.

## Native soak and refit comparison

Fresh native soak started at `2026-10-16T03:07:58.585Z` against `79354e383` and completed without interruption.
`native-source-boundary.json` pins all Overflight source hashes. Measurements use
30 seconds warm-up plus 900 seconds with reference 1,500 / 700, local spacing,
normal effects and the existing muted master setting. No video or headless
simulation runs alongside it. Available hardware is Apple M4 Pro, macOS26.7.1/build25G241, AC power, native
in-app Chromium155 at the recorded viewport/backing. External device coverage remains skipped. `native-soak.json.gz` preserves the frozen full download. `verify-native.mjs`
independently recomputes frame gates from every measured interval and checks source
hashes, populations and retry identities. The available-Mac soak **passes**:

- 107,984 intervals over 899.9931 measured seconds; **119.9831 rendered frames/s**.
- Frame-time **p95 11.1 ms, p99 13.4 ms**, worst **54.3 ms**. The worst foreground
  interval remains included; 0.0009261% exceed 33.3 ms.
- Trial valid, no dropped catch-up time, overflow, trace or recording overhead.
- All 63 resource samples retain 1,500 simulated / 700 visible, one canvas and
  28,467,840 atlas bytes. Allocated sprites grow from 1,355 during preparation to
  a bounded high-water/final count of 1,831.
- Actual viewport1280×720/DPR2, backing960×540. This does not qualify a1080p viewport,
  Iris Xe, Safari or real-sortie pacing. No heap-leak certificate is claimed.

`native-qualification.json` records all recomputed checks. `native-soak.png` is a
post-freeze native screenshot, never recording overhead within the trial.

The fixed earned Marathon comparison ran **after** native timing was frozen.
One predeclared Standard/three-airframe/objective-route Pursuer campaign starts in
Receiver Gardens, seed17031991, with no seed search. Its first naturally earned
capped refit draft appears in contract2/Antenna Court at3.9s, with100 hull, three
airframes, two rerolls and eight invested ranks. Both branches clone that exact
state and restart the same ordinary pilot state.

| Offered alternative | Flight time across five contracts | Campaign damage | Final hull | Banked score |
| --- | --- | --- | --- | --- |
| Retain build; useful earned reroll2→3 | 100.500s | 36 | 97 | 174,849 |
| Long Pass2→1; Disrupt Guard1→2 | 105.383s | 108 | 67 | 186,762 |

Both clear five contracts, retain all three airframes and exactly eight invested
ranks. The replacement trades shorter boost duration for a wider guard-interrupt
radius; it produces higher score but takes longer and more damage in this fixed
route. The initial split gives **neither branch healing**. Subsequent capped
choices use actually offered field alternatives; later earned repairs are logged.
No unoffered equipment, hull, score or resource write is injected.

`marathon-refit.selection.json` preserves the predeclared selection before branch
outcomes; `marathon-refit.json.gz` retains every offered/accepted card, rank change,
contract summary, damage and route samples. All61 runtime module hashes stay
stable. This is one demonstrated tradeoff, not player preference, broad balance
or performance evidence. Both headless branches omit native draft wall-time; the
100/105-second totals are gameplay clocks, not ordinary human completion targets.

## Final changed-flow checks

`final-checks.tap`: **60/60 passed**, zero failed/skipped, across Marathon/armor/
refits, V3/V4 geometry and localized previews, battlefield packages, old/new pacing
and durable records, community round-trip and shared offline controls. This is a
focused integration cohort, not the full repository suite or fresh production
publication acceptance. After the native layout correction, `layout-final-checks.tap`
passes **61/61**, zero failed/skipped, including the new EN/UK full-width prose /
unchanged numeric-stat regression. Earlier 60-check evidence remains intact.

`verify-native.mjs` was run before the later result-panel source edit; its working
source-hash check intentionally requires the pinned `79354e383` source when
reproducing that exact receipt. Do not overwrite the saved qualification result
or claim the earlier soak measured later results-layout interactions.

## Existing presentation and sound review

- [All eighteen native map views and playable links](../maps-movement-20261014/art-review/native-worlds.html).
- [Native normal/reduced effects and three build clips](../maps-movement-20261014/review.html).
- [Latest exact native Echo completion and Classic/Reactions/boss audio](../late-pacing-20261016/review.html).

These media retain their tested runtime/settings. They do not become current
performance trials because this report links them. Listening quality, warning
audibility, visual appeal and enjoyment remain gameplay-review judgments.

## Deliberate remaining boundaries

Human medal calibration and ordinary-player acceptance remain unmeasured; medals
are explicitly provisional. Previously waived device/controller/phone/five-player
trials remain **skipped, not passed**. The unreproduced imported-mission observation
keeps its prior evidence; no speculative migration. Whole-game reuse remains the
accepted bounded adapters, with further redesign deferred. No new world, mode,
home tile, currency, permanent stat system or upgrade family is added here.

## Final delivery boundary

The finite local implementation and evidence items in the refreshed plan are
complete within this scope: truthful native previews and readable result panels,
matched default/challenge diagnosis, ten short native restarts, a fresh local-grid
soak, one earned retain/refit comparison, integration checks and the consolidated
review page. No numerical combat tuning was justified by these particular findings.

The new results-panel source is `3a6631bd9`; the completed timing/refit source is
`79354e383`. Native timing, headless campaign outcomes and UI review are kept
separate. Current human visual/audio/gameplay acceptance remains ready for review,
not passed. Previously waived trials and provisional medals remain explicit.

Source and evidence are published in [PR1549](https://github.com/mekhovov/revealline/pull/1549), stacked on PR1534. Publication is not merge or deployment approval. A final independent read-only review found no concrete regression in the preview/panel runtime delta.
