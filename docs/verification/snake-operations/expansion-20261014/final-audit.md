# Final parallel audit — 14 October 2026

The user waived final player review and requested continued parallel work independently of the PR queue. Three independent code reviews inspected gameplay, visuals and persistence against the approved requirements. This report supersedes prior completion assumptions where it identifies a fixed gap.

## Closed gaps

- **Full proof profile:** `classic-records.mjs` now separates accepted-proof verification from durable saving. True 2,048-row overflow, exact 24 MiB external input boundary/overflow, unavailable IndexedDB and an earlier failed write are covered. Existing disk data and earlier queued writes remain intact; no proofs are evicted. The host shows localized session-only status, stars and immediately usable Retry. Invalid proofs still reject before fallback.
- **Terminal effects:** an independent cosmetic clock expires final catch/delivery particles while completed drone animation stays frozen. Pause/background and compact replay keep their own timing boundaries. No simulation step or steering delay was added.
- **Total render cache:** a 4 MiB terrain LRU evicts before replacement; 24 decoded 256×192 backgrounds account for 4.5 MiB; 192 material tiles account for 0.75 MiB; three receiver slots with five 320×320 RGBA buffers account for 5.86 MiB. Total conservative retained pixel budget: **15.11 MiB**. Receiver eviction releases its surface/scratch state and an evicted paused board resamples. Existing live output canvases are excluded, as specified by the plan.
- **Authored lighting:** morning/late edge light and night focal illumination now consume the literal composition brief. Static opacity stays below 6%, beneath walls/actors and equal across effects modes.
- **Performance evidence:** the final committed renderer was compared with previous main using the same fixture and device, rather than only cached versus uncached variants of new code. Raw samples and scope limits are in `renderer-baseline.json`.

## Scope verified

The static inventory independently confirms 240 official missions, all twelve eight-mission v5 chapters, and exact membership of 576 Solo/Team/pace proofs. New missions include 57 cargo, 21 plate, 15 switchyard and 16 wrapping missions, with one to three continuous stages. The original 144 entries each retain an audit decision, and 48 revised recipes retain exact previous authority plus 288 revised proofs.

Code and boundary tests cover fatal-collision-before-award ordering, cargo growth debt and tail vacancy, same-step Team extraction, junction-only prey redirection, once-per-step Team switch groups, 800 ms plate warnings and occupied-gate yielding. Operation missions require Mission Race rather than silently losing objectives in Score mode. Cargo/switches do not enter enemy-defeat totals.

The shared renderer retains exact occupied footprints, creator-owned artwork, hidden-enemy concealment, readable danger/objective markers, reduced-effects equivalence and common live/preview/replay rendering. Appearance remains outside gameplay and grading identities.

## Final evidence

- All **306** Snake tests pass, including all 576 new proof combinations and 180 additional variable-jammer runs.
- All **42** optional installation/offline/distribution tests pass (17 package/installation plus 25 lifecycle).
- Persistence subset **10/10**, host subset **88/88**, localization (13,029 messages / 9,026 references), targeted lint/format and canonical byte checks pass.
- Exact-source full distribution: **3,262 files**, commit and checksum recorded in `audited-build.json`.
- Final 320px collision-overlay inspection retains readable paths and structures. Earlier EN/UK, desktop, short-landscape, Team/Mission Race and shared-control browser evidence remains in the release reports.

## Delivery boundary

All runtime/content fixes are pushed in #1168, stacked on #1167 and #1164. The ten-minute full-validator CI termination was an infrastructure limit after 1,350 tests passed. #1172 extends only that fallback validator to 30 minutes; ordinary timeouts and validation remain unchanged. It has passed its gate and merged, and #1164 has been refreshed for fresh checks.

GitHub validation/merging remains delivery work. Human playtesting was explicitly skipped. Physical phone/controller measurements are unavailable; no subjective enjoyment, unaided-recognition or hardware-performance result is claimed.
