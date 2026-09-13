# v0.30 — Pressure Lines and readable flight

Status: implemented candidate; full committed-source, frozen artifact and public delivery gates still pending. v0.29.2 remains the verified public baseline until the new delivery receipt passes.

## Changed player behavior

- Two original three-map Arcade chapters: Pressure Lines (Orchard Crossing, Courtyard Exits, Night Crossfire) and Frontier Lines (Copper Switchyard, River Frontiers, Last Beacon). Six different existing owned pictures; no claim of six newly produced illustrations.
- Optional bounded pursuit and interception: local sensing, visible locked aim, finite collision-safe commitment and cooldown. This is our original extension, not a measured XPOSED AI behavior.
- Capture stopping, direction-only Arcade and automatic contact bonuses remain. Instantaneous/manual equipment commands cannot bypass that policy.
- Larger occupied enemy silhouettes, locomotion in compact treatments, actual facing and separate collision markers. Bright functional trail/head ink stays readable when theme ink/paper are reversed. Capture decoration is behind actors and hazards. Reduced effects preserve functional cues.
- Replay Theater uses keyboard/controller navigation and predictable Confirm/Back. Page/lifecycle suspension pauses playback; no playback input changes the recorded simulation or player progress. It remains a separate silent tool.

## Evidence collected before freeze

The new route set records 24 actual completions: two packs × three maps × Standard/Gentle × Immediate/Grid + buffer, totalling 53,266 simulation ticks. All observe pressure warnings and committed pursuit. Separate inward-cut probes use identical inputs for pressure-enabled and pressure-disabled controls. These probes do not establish universally harder play: Standard Orchard's ordinary Down cut gives 51.45% in both cases, while the same immediate starting route in Gentle loses a life in both cases because slower enemies meet it at a different time. Difficulty still needs human assessment.

Search found a real multi-cut exception: Left 288 → Down 264 → Right 564 → release, then a captured field actor overlapped two forbidden cells. One supplied a collision normal while the actor was already embedded in another. The bounded deferred domain recovery now handles that mixed-normal case, preserving initial collision ordering and excluding lawful grazing. The new both-policy regression reconstructs the legal input trace, saved continuation and 120 subsequent stationary ticks. Initial failure files remain under `.cache/round40/r5-routes/`; no old proof oracle or released pack changed.

Pre-freeze browser observations on source HTTP:

- Keyboard title → Pressure Lines → Start → brief Down press/release: 51.5%, 12,060 points, three lives, stopped craft and continued stationary simulation without reported browser errors. Pause retains the run.
- Narrow 320×640 viewport: full 294-pixel arena, cardinal pad outside the image with the explicit Always setting, pointer Down/Pause/Resume and a later 1.5% completed cut. No horizontal overflow. This was a desktop viewport/pointer check, not a real phone touch certification. A separately retained writer warning means this phone-layout session is not evidence of saved persistence.
- Actual Replay Theater keyboard selection and Confirm plays Copper Crossing to its exact final checkpoint `861a6de2ffd7e119`, 1,305 ticks. Back focuses the return action; no console warnings/errors observed. No controller hardware or audio listening claim.
- CPU raster inspection covers 252 enemy body variants: seven roles × four themes × three styles × three arena sizes. At a 294-pixel arena, occupied major spans are 14–16 CSS pixels versus 9–12 in frozen v0.29.2; contact geometry remains unchanged. These measurements exclude decoration and are not browser/device certification.

Six existing reward images stay byte-identical, as do all ten older indexed pack files and historical proof inputs. Each new chapter fits its own image budgets. All eight active packs fit the existing 48 MiB installed-library cap; installing another archived image-heavy edition can require deliberate removal. Failed installation preserves the current library. Frontier is an optional offline download; the generated complete offline budget is a separate release gate.

## Retained failed candidate

Source `40bfeedf841f78b7bfd8a9e3fde6ae652a212348` was not frozen or published. Its immutable source gate run passed lint, native formatting, content validation and motion syntax, but failed three of 2,447 tests and formatting of the two new JSON packs. Two failures were stale map-count assertions. The featured-edition test accumulated image-heavy installations through nested hosts sharing the asset database connection; separate top-level test lifecycles now verify each old/new edition pair within the unchanged cap. The two new JSON files were formatted without changing parsed data, and the development fallback badge was updated. All 26 focused correction tests pass. The failed source-gate record remains in `.cache/releases/verification-40bfeedf841f/`; the corrected candidate must pass its own complete gates.

## Delivery gates

Record the exact source SHA, six source gates, immutable artifact reproduction, original tag/ZIP preservation, actual frozen online/offline capture, PR review/CI/merge, full Pages inventory and actual public entry/play here or in the attached final release receipt. Source, modeled input, browser, listening, human enjoyment and physical-device evidence remain distinct.

[Active full plan](../../production-plan.md) · [Pressure contract](../../enemy-pressure.md) · [Fresh reference research](../../research/round-40-pressure-and-presentation.md)
