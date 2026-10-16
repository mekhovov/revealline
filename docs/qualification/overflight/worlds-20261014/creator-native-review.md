# Creator and native operation qualification

Review date: 2026-10-14. Base commit `29e3bd4a831834c55b8ecf14a204b14784252f38`, implementation working tree on `codex/fpv-survivals-worlds`. Source hashes, exact exported packages and compiled identities are recorded in `creator-package-evidence.json`. These are implementation-stage checks; final qualification must identify a fixed commit.

## Native UI round-trip

- Authored Field Crossing, Freight Depot and Relay Ruins using Raid Studio's preset controls. Each validated and previewed through the actual Contract Marathon compiler and native iframe.
- Pressed Start explicitly for each native preview. Operation context and Marathon contract HUD matched the selected variant. Worlds showed different material regions and landmarks.
- Exported all three packages using the Studio UI. Files are retained alongside this report.
- Opened `localhost:8899` as storage isolated from the authoring origin `127.0.0.1:8899`. The installed Raid list was empty before import. Imported and installed all three exported packages through file chooser controls. This demonstrates an empty mission-library round-trip; it is not a separate browser profile.
- Re-exported Relay Ruins after import. Its bytes are identical to the original exported package.
- Opened the installed Relay Ruins link in Time Attack. Correct title and operation appeared in briefing; time stayed at zero until Start. The installed mission then rendered and ran with the Time Attack HUD.
- Studio runs are marked review runs, excluded from score/mastery records, and do not overwrite the last family operation preference.

Evidence: `studio-field-marathon.jpg`, `studio-freight-marathon.jpg`, `studio-relay-marathon.jpg`, `installed-three-worlds-studio.jpg`, `installed-relay-time-attack.jpg`, and four `studio-*.raid.json` packages.

## Experimental terrain native checks

Depot Breach is explicitly named Experimental in mission selection. It is available in Single Drone, Riy and Single Raid. Selection returns to Home and waits for Start. Time Attack and Contract Marathon reject terrain projects; terrain missions are absent from their built-in lists.

Short manual native runs checked starting scenes and movement in all three supported operations. Solid obstacles and two-hit barriers were visually distinct from low decoration. A Raid fan warning stopped at the cover edge. Riy's two escorts followed the leader outside obstacle geometry. Screenshots: `experimental-raid-native.jpg`, `experimental-survival-native.jpg`, `experimental-riy-native.jpg`.

Supporting simulation tests cover connected 240-unit corridors, sliding collision without wall damage, distinct two-hit barrier passes, cover-aware area damage, unchanged committed warning extent after breakage, enemy routes around cover and Riy escort navigation. These short native checks do not establish full experimental sortie completion or long-session balance.

## Older Asset Studio workspace admission

The published r104 workspace was opened in Asset Studio. **Add FPV Survivals artwork slots** staged an unsaved r105 with 54 optional decorative material/prop and soldier/machinery slots. Existing reviewed assets remained selected. The action then disabled itself; Undo draft returned to the prior document and showed that saved history was intact. No player preferences or saved artwork revision were overwritten. Screenshot: `asset-studio-admitted-artwork.jpg`.

The action and immutable transition are tested with old and partially upgraded workspaces, existing custom images, package export/import, exact contract admission and rejection of unknown slot prefixes. Company Studio's token-only handoff accepts newly added unchanged native fallback recipes, but continues rejecting real asset modifications because that handoff cannot carry image bytes.

The long-lived 8899 browser origin retained older catalog modules even after normal reload, so this UI check used a fresh temporary localhost origin serving the same source. The fresh origin admitted slots successfully. This is a development-cache observation, not an offline-update acceptance result.

## Family Home and world selection

Fresh-origin checks at 1280×720 exposed excessive inherited top spacing. A compact-height family layout now keeps all five operation choices, Start, Select Mission, Settings and device utilities in the initial viewport. Settings ends at y=614 and every main action remains at least 44 pixels high. The two group illustrations and all operation descriptions remain visible. Evidence: `family-home-fresh.jpg`.

Mission selection shows the three distinct world thumbnails plus the explicitly Experimental terrain fixture. Choosing Freight Depot returns to Home with that mission selected and waits for Start. Evidence: `world-missions-fresh.jpg` and `family-home-depot-selected.jpg`.

## Automated source checks

- Full Overflight, shared navigation and package test selection: 483/483 passed before the final benchmark/terrain list adjustments (`/tmp/fpv-worlds-all-overflight-tests.tap`).
- Latest native host suite: 25/25 passed, including trial selection for all modes and experimental mission admission.
- Mastery suite: 7/7 passed. Tests verify actual-action goals, completed-run-only writes, stored prior-run comparisons, legacy preservation and artwork changes retaining the same gameplay/mastery identity.
- Artwork admission and curated-theme compatibility: 15/15 passed. Changed native UX/Studio/admission modules pass ESLint.
- Earlier focused native UX, Studio, mastery and variants suite: 127/127 passed.

Browser captures used the Codex in-app browser at 1280×720. Normal effects and Standard difficulty were used. Character handling was preserved from the existing profile: Scout/standard hull for Single Drone and Raid; Interceptor/80 hull for Riy. These are UI/visual checks, not performance samples. Benchmark, offline, auditory and long-duration evidence are tracked separately. Previously waived external hardware and player trials remain skipped.

## Post-reconciliation Creator checks

After parent/main reconciliation at `c375324951b4b510e8dd5a1814289da287300d2d`, shared menu/navigation/host/mastery tests passed 85/85. Source inspection confirms the compact family styles do not override main's new bottom anchoring on `.mode-play-content`. A fresh native Home screenshot is tracked by the final qualification owner; earlier menu captures above predate this merge.

Guided Experimental cover authoring was added to the existing world editor. It admits six permanent and two breakable footprints, shows exact solid/dashed outlines over the world preview and on the Raid actor map, and rolls back edits that obstruct passages, supply rewards or authored Raid markers. Adding the layout preserves the author's title, ID, settings and artwork; Raid target/route locations move only as required for clearance. Removing cover is explicit. Time Attack and Marathon retain imported terrain visibly but disable editing/addition and offer explicit removal.

The final focused Creator/host/world/variant suite passed 54/54 (`/tmp/fpv-worlds-terrain-editor-tests.tap`), including all three supported modes, transactional rejection of invalid geometry, reward clearance, Raid route clearance, fixed counts and exact overlay footprints. ESLint and whitespace validation passed. These guided-editor checks are automated DOM/source evidence; they are not an additional native screenshot or a full terrain-completion claim.

Independent integration review also fixed bounded mastery retention at 256 contexts and verified cumulative Marathon damage/airframe outcomes. The renderer/terrain/world/mastery/variant selection passed 82/82 (`/tmp/fpv-worlds-integration-review.tap`), including exact dependency closure and retained atlas disposal/recovery.

## Installed Experimental missions in Raid variants

The final diff audit against `origin/codex/overflight-rebalance` found and fixed a discovery blocker: installing a valid Experimental Single Raid mission could throw during Time Attack/Marathon chooser registration or record lookup. Discovery now preserves its stable installed row, labels it unavailable with the open-arena requirement, and skips unsupported progress queries. The secondary installed-mission controls also disable its launch while preserving export and removal. Valid current and legacy open-arena missions remain playable.

Mission discovery and variant regressions passed 26/26. A targeted host test additionally executes the native picker progress flow for both variants with mixed installed content; it passed (25 unrelated host tests intentionally not rerun). Changed source/tests pass ESLint and whitespace validation. This is source-level integration evidence; the final offline build must include this fix.

## Installed terrain compatibility — final native regression

At source revision `b47ef71979ac86228fcea54a45689e9cedcaf29c`, the native Raid Studio added Experimental cover to Field Crossing, validated it and installed it through “Install in this profile.” Both Time Attack and Contract Marathon then opened Select Mission successfully: all three built-in worlds remained playable and the custom terrain row remained visible, disabled with the reason that this variant requires open arenas. See `installed-terrain-time-attack-unavailable.jpg` and `installed-terrain-marathon-unavailable.jpg`. This verifies the final discovery/progress fix in the actual shared chooser.
