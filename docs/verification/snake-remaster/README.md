# Tactical Snake remaster — delivery and evidence

This delivery remasters the existing 240-mission catalogue in place. Eight accepted gameplay recipes change; 232 retain their established gameplay. All 240 receive explicit construction-family and focal-assembly descriptors. Recipe review, automated solvability, browser inspection and player enjoyment are separate forms of evidence.

## Implemented

- Three playable presentation directions across the same six encounters (18 presentations), sharing one simulation, seeds, controls, sound adapter and production board renderer. Open `game/test/manual/snake-operation-lab.html?review=remaster`. Appearance changes preserve the current attempt. The comparison lab deliberately does not save progress.
- Six worlds, 18 modular structure families and six landmark assemblies. Coordinated edges, corners and fixed-scale details replace stretched repeated motifs. Landmarks occupy existing solid cells; 37 open/thin missions explicitly omit solid landmarks. Open Loop remains obstacle-free.
- Lively FPV, Toybox, Atmospheric Ruins and Night Arcade material treatments, alongside Game Theme and Retro Field. Creator-owned wall artwork remains authoritative, including images arriving while paused under interference.
- Stable enemy silhouettes, compact mobile actors, accepted-heading cues, warning/action/recovery presentation, parcel attachments, matching dock fittings, mechanical switches and load/delivery/erosion reactions. Per-step observations preserve reactions during multi-step frames.
- Successor v6 tactical commitments for runner/refuge/switchback/pair/sprinter/shield/jammer/guard. Authored routes use adjacent cells and bounded current-position decisions. Mobile jammers and guards move only during recovery. The existing shared hazard scheduler remains authoritative; warnings last at least 800 ms.
- Eight revised operation missions connect interception to cargo, cable-held gates, wrapping, source interception and flanking. See `catalogue-review.md` for each concrete change and `catalogue-review.json` for all 240 briefs.
- Jamming conceals actors and incidental position cues. Movement projection, catches, warnings and relay-opening audio do not reveal hidden enemy direction; required warnings remain audible. Pulse and recovery restore ordinary presentation.
- A fresh official campaign namespace isolates remastered records and unfinished attempts without deleting old bytes, creator content or other modes. Retired official recipes do not silently restore as current attempts. v6 Continue/replay reproduces committed state and hazard seeds.
- Compact delivery/source acknowledgements use existing HUD space. Shared entry, pause, selector, touch controls, results, final-eight replay/retry, 5.2-second victory celebration and cancellable five-second auto-next remain owned by the existing host.

## Verification

- Eight changed missions: 48 winning journals across Solo/Team and three paces, plus 12 additional jammer journals for hazard seeds 73 and 2026.
- The full Snake batch initially passed 325 of 326 tests. Its one creator-art arrival regression was fixed; the complete affected renderer/audio follow-up passed 39 tests.
- Local traces cover all 60 remaster journals: maximum two catches per cell; longest interval without an encounter/objective/state change 21 moves (5,880 ms). Thresholds are review heuristics, not scores for fun.
- Existing catalogue proof suites remain in place. Current record-capacity test covers 576 operation records, using 2,270,011 bytes against the 24 MiB logical budget.
- Fresh-session/retired-import host regression suite: 89 passing tests. Tactical engine tests cover committed routes, ignored queued inputs, replay tampering, concurrent outcomes and hazard coordination.
- Renderer/cache tests cover exact occupied cells, eroded geometry, creator artwork, concealed actors, surface bounds and compact identities. Additional retained render surfaces total approximately 15.11 MiB against the 16 MiB budget.
- English/Ukrainian localization, canonical shared-source byte checks, presentation metadata, source lint/formatting and offline dependency closure checked. Generated JSON evidence retains its canonical generator formatting.
- Development build succeeded: 3,270 files. Final source changes are revalidated separately; build output is disposable and excluded from Git.
- Browser inspection: all six comparison encounters; desktop, 320px portrait, short landscape, Team/Versus presentations, shared D-pad input, Ukrainian copy, grayscale, collision overlays, paused state and active-jammer fixture. Screenshots are stored alongside this report.
- `renderer-comparison.json` records same-browser baseline and remaster redraw measurements. The two-board animation comparison measured 120 frames after warm-up: baseline frame-interval p95 9.90 ms and remaster 9.00 ms; draw-cost p95 10.30 ms and 5.20 ms respectively. These are bounded browser measurements on frozen simulation states, not a claim about all phones, active-match FPS or statistically established speedups.

## Remaining limits and follow-up priorities

1. **P1: physical-device qualification.** Responsive desktop emulation cannot establish touchscreen ergonomics, physical controller behavior, thermal throttling or low-end phone frame times. Run the existing lab/gallery on representative phones and controllers before claiming those devices qualified. The code does not require another approval screen.
2. **P1: full production-host browser pass once unlocked.** The local production game presented its password gate. It was not bypassed. Host behavior is covered by the 89 automated Snake UI tests; live comparison pages exercised the shared renderer/controls independently.
3. **P2: optional player comparison and pacing feedback.** The previously waived study remains optional. Titles-hidden screenshots and winning proofs do not prove world recognition or fun. In particular, retained missions can still warrant shorter quotas or redesigned routes after observed play; the static 240-entry review is not represented as 240 player-tested encounters.
4. **P2: compatible higher-star calibration.** Changed recipes retain completion and personal-record behavior. No unverified silver/gold budgets are invented for new tactical or variable-schedule setups.
5. **Separate existing main-game test investigation.** The broad `classic-*.test.mjs` selection also includes Capture-mode `classic-host.test.mjs`: 2/5 passed, with three failures involving picture readiness, restored player state and an obsolete saved-replay shape. Those files are not changed by this Snake delivery. This report does not claim the full repository test suite is green or that a baseline execution proved these failures pre-existing.

## Original artwork and safety

New structure, pose and material artwork is editable original drawing code in the existing presentation system; no third-party game sprites were copied. Existing shared artwork/audio provenance remains authoritative. Cosmetic state does not consume gameplay randomness or enter gameplay recipe identity.

Disk preflight initially blocked work. Connectivity verification passed before cleaning abandoned, inactive Git temporary packs (about 6.1 GB). Normal packs, refs, commits, working files and creator assets were preserved. An external repository relocation subsequently rewrote the checkout link; final Git operations explicitly target the verified tactical-remaster metadata to avoid including unrelated changes.
