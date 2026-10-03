# Snake visual refresh — 3 October 2026

The visual refresh combines the earlier readable humanoid chips with the shared FPV / LINE presentation. It changes rendering and localized guidance only; accepted recipes, simulation, scoring, saved journals and replay identity remain unchanged.

## Artwork and motion

- Original tall pixel humanoids show an uncovered face, jacket, arms and separate trouser legs against a warm cream backing. Caps/reflective jackets, headbands/shoes and delivery satchels distinguish patrols, sprinters and couriers. Frozen and warning cues stay outside the face.
- The drone reuses `game/ui/fpv-body-recipes.mjs`'s carbon X-frame, FPV lens, antenna and tri-blade motors. Additional battery rails, straps, blue/yellow flight marking and rear tether socket fit the existing occupied cell.
- Cable is joined tubing with visible bends, clamps and a terminating connector. Signal retains its lighter animated trace. Both preserve the full marked collision cells and terminate wrap seams at the correct boundary.
- One bounded cosmetic clock per board uses the shared alias-aware rotor sampler. Ready, Pause, hidden pages, terminal boards and Reduced effects stop motion. Retry and restore reset presentation clocks. No gameplay randomness is read.
- The board uses subdued theme-token checker/grid contrast. Bounded higher-resolution canvas drawing uses the cached responsive footprint, with exact half-step resolution to avoid aspect-ratio feedback.
- Updated EN/UK role guidance describes the actual accessories.

## Observations

Manual browser observations covered Solo, Team, paired Versus, Cable, Signal, English and Ukrainian. A replay-derived Solo preview restored six catches and a ten-cell cable through the normal file import UI. No browser errors were observed. A measured 320×640 CSS-pixel Versus viewport showed two approximately 260×195 boards and visible Pause/Retry and 56px turn controls without horizontal overflow. Desktop and larger phone layouts also rendered. Browser zoom meant requested device dimensions were not always the final CSS viewport, so measurements above use the page's actual dimensions.

The selected shared appearance preference takes precedence over a launch-link default. The attempted Pocket LCD link retained that existing preference; this observation does not claim a separate light-theme acceptance pass. This refresh keeps the existing theme owner and preference behavior.

Production Company closure validation retained `classic-flight-art.mjs`, `classic-target-art.mjs`, `fpv-body-recipes.mjs` and `authoring/motion-lab/animation.mjs` in both Company and offline outputs. At artwork source 34c9cd0a1 the Company runtime payload was 46,118,061 bytes and offline core had 731 files. New artwork is procedural original code using the existing main-game renderer; no external image or new bitmap rights declaration was added.

## Verification

Automated test suites remain **WAIVED_SKIPPED_NOT_PASSED**, per `publishing/test-policy.json`. Regression sources were authored for pause/reduced-effects clocks, failed-board independence, retry/backgrounding, bounded resolution, read-only rendering and wrap/occupancy semantics; they were not run.

The remote PR branch independently received main's FPV pack recovery changes and two edition-fixture updates. These were merged without overwriting them. The preliminary build inspection of 34c9cd0a1 was intentionally stopped without a pass claim; final committed-source inspection targets integrated source a1c36916f5d7b6b40d60ed255589f81e1679f9d9.

Repository lint and validation passed on the combined revision. Validation reported the existing generated-site navigation warnings only. Changed-file Prettier and whitespace checks passed. The earlier repository-wide formatting baseline remains separately disclosed in `format-baseline.json`; this refresh does not claim a clean global formatting run.

The [committed-source build inspection](default-build-visual-a1c36916f.json) passed for a1c36916f5d7b6b40d60ed255589f81e1679f9d9 (tree 5cef70ec8d0571a1b1a8a90433ca8557110c1030). Included inputs and available committed sources were verified. Payload including manifest: **856,136,457 bytes**, within the 950 MB Pages budget and separate 25 MB headroom guard. Report SHA-256: `7b8948033ab181634d856927e77d9e1a96ac71aec77a2c614b4308f5ea94402e`. This is candidate-source preparation, not deployment or public qualification; publicEligible/promotable/completeHostedOutput are false. The evidence-only follow-up does not alter runtime inputs.

Full physical-device, sustained performance and human play qualification from the parent implementation remain outstanding.
