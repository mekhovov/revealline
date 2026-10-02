# Humanoid hunting implementation

Implemented on `codex/humanoid-hunting`, initially based on main `f236bb71a`, then merged with main `e48adf318` for the qualification follow-up, in an isolated managed worktree. The primary checkout and its unrelated changes were not edited. This is an implementation and review candidate, not a published release.

## Delivered behavior

Runners and guards are visibly humanoid in both clean and brutal presentation. Active players eliminate them on contact, including from a safe edge when no wall intervenes. Humanoid bodies do not damage the player or trail. Guards lock a visible aim warning and fire dangerous projectiles using the existing exposure rules. Protected active players can hunt; downed and respawning players cannot. Enclosure also removes targets, which never retain territory or respawn within an attempt.

Runner decisions use current geometry and player positions, a six-cell detection radius, stable tie-breaking, half-second committed turns, and a resolved speed of 70% of the slowest permitted unboosted player speed. Successor formats preserve historical scout behavior in old recordings and missions. Fatal events take priority over a simultaneous contact; capture/contact ties count as enclosure. Team eliminates an ID once even when both players arrive together.

The pre-attempt Encounter variant selector offers As designed, No optional encounters, Patrol encounters, Bonus hunt, Capture + hunt and Hunt only when structurally supported. Preparation freezes the population, rules, seed and objective. Continue and Retry retain the accepted attempt; changing a variant prepares a new attempt. The ordinary route remains the default.

Bonus hunts retain the original capture victory condition and allow zero kills. Capture + hunt requires both capture and its quota. Hunt only requires all authored targets and keeps capture available tactically. Contact awards 100 Hunt points; enclosure awards 50. Hunt counters, best score, completion time and all-target/contact-only/no-damage mastery are separate from historical territory scores. Versus uses paired populations/seeds; Team uses one shared total with contributor attribution.

## Player and author entry points

Serve this checkout with `node scripts/game-cli.mjs serve --port 8779`.

- Solo lessons: `/game/?journey=humanoid-hunt-v1`.
- Versus lessons: `/game/couch/?journey=humanoid-hunt-v1`.
- Team lessons: `/game/couch/relay-rescue.html?journey=humanoid-hunt-v1`.
- Ordinary compatible missions expose Encounter variant before Start. Versus places it in Match options.
- Content Studio: `/game/studio/`, then **Author hunting for this mission**. Inspect and explicitly apply a mode/quota; draft export/import retains the complete definition. **Play exact Solo preview** launches the actual Solo host without campaign awards.
- Studio's isolated presentation preview offers runner/guard, contact/enclosure/group defeats and clean/brutal/blood/remains/reduced choices. It writes neither game preferences nor mission source.
- Studio's **Character voice recordings** panel auditions, replaces, restores and exports/imports recordings by stable line ID and locale.
- Replay Theater: `/game/replay-theater/`. Hunt recording playback has live Hunt counters and current presentation controls; it awards no records or campaign progress.

The six lessons teach contact, interception, enclosure, guard evasion, combined encounters and a dedicated Hunt finale. Journey adoption is an explicit successor route; existing route/progress identities remain intact.

## Destruction and reactions

Brutal enemy destruction is off by default. Its explicit label discloses blood, body parts and explosions. The nested Blood and body parts control can substitute clean fragments while retaining stronger destruction. Show enemy remains separately controls settled remains. Disabling brutality/blood clears incompatible transient effects immediately; Reduced effects suppresses moving fragments and bursts. Humanoid silhouettes and gameplay remain the same for every presentation choice.

`humanoid-presentation.v1` is a separate immutable catalog containing original pixel sprite frames, materials, palettes, fragment art and contact/enclosure/group recipes. Graphic presentation includes directional spray, head/limb/torso pieces and bloody settled remains; guards mix organic and equipment debris. Decorative randomness is independent of gameplay. The page budget is 128 particles and four large envelopes across two board painters, with 24 settled clusters per board. Markers stay above effects. Pause freezes animation, restoration does not replay old bursts, and final effects do not delay Continue or result/reward timing.

Character reactions have localized EN/UK captions, poses/portraits, reaction SFX and independent dialogue volume under master mute. One audible reaction is allowed, with a 12-second incidental cooldown, at most three incidental reactions per attempt and five-minute exact-line suppression. Warnings and reward presentation take priority. Captions remain available without audio assets.

The checked-in generated voice pilot contains 16 AAC clips: one in-play capture line and one result line for each of Guide, Engineer, Rival and Sentinel in both locales (343,420 bytes total), plus eight portrait frames. Scripts, provenance and asset hashes are pinned. Generation is outside gameplay through a replaceable adapter; optional locale packs load on demand. Other lines fall back to captions until recordings are supplied. Studio replacement recordings are bounded and revisioned; originals can be restored.

## Persistence and architecture

- Solo successors: level v9, core v10, replay v11, checkpoint v10. Team successors: level v8 / rules v10; TeamMissionV7 source preserves Support, rescue and travelling-impact configuration.
- Accepted Hunt definitions, actor AI state, elimination IDs, objectives and scores participate in exact save/replay identities. Historical formats retain their earlier semantics.
- Host adapters lazily compile variant editions, preserve exact ownership and scope variant progress keys separately from ordinary progress.
- `revealline.hunt-records.v1` stores bounded records independently, merges best-score/time/mastery across concurrent tabs and preserves unsupported future data. Hunt records have their own export/import controls; existing campaign backups do not silently claim to include them.
- Normal Team hunts now have a bounded, independently exportable unfinished-attempt slot. Continue verifies the accepted source, full input/release journal, and authoritative state before activation; another tab cannot overwrite it during asynchronous preparation. Installed Team and Hunt Continue preserve both journals.
- Encounter and destruction preferences synchronize across tabs and restored pages, retain unsaved intent and expose retry when storage is unavailable.
- Replay presentations and Studio previews never write Hunt records. Cosmetic preferences do not change collisions, capture, score or simulation RNG.
- FPV simulation is outside this implementation.

## Phased implementation status

| Phase               | Implemented                                                                                       | Release acceptance still needed                                        |
| ------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 0 — Foundation      | Versioned gameplay/presentation, preferences, localization synchronization and immutable variants | Historical-save sampling on release targets                            |
| 1 — Pursuit         | Runners, guards, safe-edge contact and clean/graphic previews                                     | Human catchability and recognizability for every supported class/input |
| 2 — Solo/Versus     | Bonus variants, paired boards, records, remains, contextual reactions/SFX                         | Balance, visual readability and maximum-load device review             |
| 3 — Quotas/Hunts    | Both objectives, mastery, six lessons and EN/UK voice pilot                                       | Six-lesson play qualification and listening approval                   |
| 4 — Team            | Shared targets/score, once-only kills, Support/rescue and cooperative reactions                   | Two-player hardware and simultaneous-input play review                 |
| 5 — Coverage/Studio | Source authoring/validation/export, isolated effects preview and replaceable recordings           | Mission-by-mission human qualification before publication              |
| 6 — Journey         | Explicit successor route and distinct progress ownership                                          | Reviewed rollout of the new route                                      |

`docs/humanoid-hunt-coverage.json` reports structural admission for 91 Solo missions, 91 Versus missions and 12 Team missions, plus the six lessons in each mode. Its `humanPlay: pending` field is intentional. Reachability/clearance/actor-budget validation is not proof that pursuit is enjoyable, a route is catchable with every input method, or a Hunt cannot be cleared too easily by one enclosure. These are review candidates until the listed acceptance work is complete.

## Continuation: remaining implementation gaps closed

The follow-up implements missing Team Hunt persistence, spreads generated targets over the board, enforces dry target reachability and the accepted runner speed, corrects Team/Studio humanoid markers and Hunt-only briefing, and hardens shared destruction/audio resources. The detailed evidence is split by concern:

- [Gameplay and coverage](humanoid-hunt-qualification-followup.md): exact runner speed, reachability, population spread, capture snapshots and updated structural admission.
- [Team persistence](humanoid-hunt-persistence-followup.md): command/release journals, safe Continue/Retry/discard, concurrent ownership, portable slot and partial-quota/guard-warning observations.
- [Authoring and briefings](humanoid-hunt-authoring-followup.md): visible humanoids, actual Hunt objectives, EN/UK descriptions and the actual Solo practice host.
- [Presentation and voice](humanoid-hunt-presentation-followup.md), with [browser observations](evidence/humanoid-hunt-presentation-observation.json): explicit desktop Canvas, silent speech decode/lifecycle and isolated recording-library round-trip measurements. The adjacent workbench allows separate manual operations; it is not a regression suite.

Release gates in the phase table remain deliberate: human catchability/balance across input methods, low-end-device and two-player hardware review, voice listening approval, historical-save sampling and publication provenance are not established by compilation or these bounded observations.

## Verification evidence

The repository's `publishing/test-policy.json` is waived under the existing explicit authorization. Automated suites were **WAIVED_SKIPPED_NOT_PASSED**. Focused regression files were added but not executed. Syntax, lint, localization, content validation, build and direct runtime/browser inspections are separate checks.

Initial implementation checks (before the continuation):

- Full ESLint passed. Changed-file syntax/formatting and whitespace checks passed.
- EN/UK localization validation passed; content validation and presentation metadata checks passed.
- A local distribution build passed; final build identity is recorded below.
- Direct runtime inspection covered safe-edge contact versus projectile eligibility, once-only Team contact after another seat's fatal event, derived catchability speeds/actor budgets, Team specialist source preservation, records merge/storage recovery, and exact Hunt save/replay state.
- A 960-tick first-lesson recording reached one contact and one enclosure elimination, 150 Hunt points, and an exact replay checkpoint match (`ea06211245bddcfc`). Browser Replay playback independently reached that same final state and explicitly reported no progress awarded.
- Browser checks exercised the actual Solo host through Studio's practice iframe, paired Versus Hunt boards, Team lessons, Studio quota inspection/apply, isolated pixel destruction preview and Replay import/playback. These paths produced no browser errors during inspection.
- The standalone Solo home is behind the repository's existing access gate in the local browser. The actual Solo gameplay host was exercised through the supported Studio preview flow; no access-control change was made.

The full repository formatting check reports four unchanged baseline files: `game/editions/runtime-assets.json`, `game/test/fpv-world-content.test.mjs`, `scripts/test-fpv-content.mjs`, and `scripts/test-main-pages-profile.mjs`. Their Git diff is empty; they were not reformatted as part of this feature.

Still pending: automated suites while waived; exhaustive historical-save/restore scenarios; human play qualification across all classes, slower speeds and input methods; long-session/mass-elimination/low-end-device measurements; English/Ukrainian voice listening; and release publication/provenance checks. Compilation and spot checks do not substitute for these gates.

## Initial review build

Initial packaging passed from clean implementation commit `72470e3b0f922e1be1ecce97ef7e59649185393d`.

- Version: `humanoid-hunt-review`.
- Distribution files: 2,783.
- ZIP SHA-256: `a7ce9785d520d9510e5905330a6b5634fa4796f1aeab5a21ada5048298cd0c11`.
- Artifact inspection confirmed 16 voice clips, eight portraits, the versioned presentation catalog and the shared warning-priority module.
- This was a development build (`sourceRevision: null` in the CLI manifest), not a release publication/provenance attestation.
- The temporary package was removed after verification to recover disk space. The committed source, report and local preview server remain available.

## Continuation verification

After merging main `e48adf318`, EN/UK localization validation passed (12,103 messages and 8,921 references), full ESLint passed, and content validation passed with 2,634 inputs and valid literal references. Presentation metadata validation passed. The content validator retained the repository's deployment-only navigation warnings for app/update, diagnostics, release, privacy and credits pages.

The actual Solo practice ready screen showed the six-target Hunt-only goal. Team's preserved 25-second development checkpoint restored after exact compatibility verification; the foreground browser attempt advanced to 32 seconds and paused at 38 seconds, with 0/2 targets and no browser errors. Background Continue now explains the existing foreground requirement. [Team browser evidence](evidence/humanoid-hunt-team-continue.jpg) records the paused restored attempt. Team backup export reached the platform download/share request, but the browser download observation timed out; its full UI export/import round trip is still unqualified.

The desktop destruction observation held 128 particles/four envelopes across two boards, 64/two each; the competing preview yielded. Reduced effects drew no dynamic particles or envelopes. Pause retained burst ages; reset released every owner. All 16 pilot clips loaded after conservative container admission. Recording replacement, reopen, restore and bundle import retained the expected hashes in an isolated database, then removed that temporary database. These results are bounded presentation/resource observations, not full-game performance or human listening approval.

Automated suites remain **WAIVED_SKIPPED_NOT_PASSED**. The final distribution ZIP was not regenerated locally: available disk space was below 1 GiB, while the earlier temporary build required about 1.8 GiB. The committed-source inventory is recorded separately after the follow-up commit; it does not replace ZIP inspection or release provenance qualification.

The final [committed-source inspection receipt](evidence/humanoid-hunt-source-inspection.json) passed for implementation commit `3a807dccd168dd18006157201091db62ddd261f4` and tree `f2bcf0ff8d7176fac62e39fabcbd7db7986aa65c`. It verified 2,634 included originals, all 23,672 committed source files (no missing tracked files), and public-source asset eligibility. Normal build preparation produced a 2,798-file manifest with a 966,575,137-byte payload including its manifest. Manifest SHA-256: `8db90b6d8f9d195f71669c48b09f96ff1a5195a94246248211984ffa62e5716c`. This is one build preparation, zero reproducible ZIP builds, and no publication assessment. The following evidence-only commit does not alter product build inputs.

At the preceding evidence checkpoint, [draft PR #962](https://github.com/mekhovov/revealline/pull/962) contained the implementation. GitHub preflight, hosted acceptance and optional-package checks passed on the implementation head. The `release-ready` check is held because this product PR has no immutable release slot; its log explicitly requires keeping unallocated work draft/stacked. The PR remains draft. Candidate/default-capacity jobs were still running when this evidence was recorded; no all-checks-passed claim is made.

## Second continuation — integration, recovery and readable feedback

This continuation started from `630f744f7`, after the release work merged Neon main `ba598ca65`. It also integrates main `06d78fcb7` and its current Pages publication profile. The source remains a review candidate. PR #962 is assigned to milestone **v0.150.0 — Unified native experience**; the earlier unallocated-slot paragraph above describes an older checkpoint, not its current allocation.

- Selected encounter variants now show their actual objective and appropriate lesson/help text throughout Solo, Versus and Team. Flight Details and the Hunt-only screen-reader coverage value no longer promise an irrelevant capture percentage. Presentation projections preserve source recipes and progress identities. See [objective follow-up](humanoid-hunt-objective-followup.md).
- The Neon merge had lost the reachable-coverage validator and initial denominator and reverted the current terrain limit. These integration regressions are repaired. All 54 Neon levels and 270 derived variants were directly admitted with matching coverage denominators. This is source/initial-state inspection, not play qualification. See [merge repair](humanoid-hunt-neon-merge-followup.md).
- Team persistence separates fresh attempts from reusable picture leases. Exact replay-verified Continue can bind its Journey completion receipt. Export reports native cancellation, sharing, web download requests and failures accurately; saved bytes remain protected. The [persistence follow-up](humanoid-hunt-persistence-followup.md) records ownership and historical compatibility boundaries.
- Compact Hunt status occupies reserved space in the actual hosts. Captions honor visibility, background and size across live/result/settings surfaces; Versus identifies Player 1 and Player 2. The Audio Settings preview is visible within the panel. Actor collision footprints draw above all enlarged humanoid bodies. See [presentation follow-up](humanoid-hunt-presentation-followup.md).

The real Solo practice host displayed a 24-actor candidate (one keeper, 15 runners and eight guards) at 320×568. At 844×390, normal keyboard cuts produced nine enclosure eliminations for 450 Hunt points. Team Continue preserved its local checkpoint and the compact landscape board; the final recovery implementation restored and paused the preserved 76-second attempt without errors; paired Versus boards remained readable at 844×390 and 320×568. [Ukrainian portrait evidence](evidence/humanoid-hunt-versus-portrait-uk.jpg) shows both boards and their counters. EN/UK caption samples rendered at the selected 200%/32px; subtitle-off hid the sample and background-off made it transparent. Review settings were returned to English, 100% captions and the original solid background. Brutality stayed off during these gameplay observations.

After rebuilding the stale merged language artifacts, localization validation passed with **12,341 messages and 8,957 references**. Full ESLint passed. Content validation passed with **2,646 inputs** and valid literal references, retaining only the documented deployment navigation warnings. Presentation metadata and whitespace checks passed. Automated suites are **WAIVED_SKIPPED_NOT_PASSED**; new persistence regression cases remain unrun.

The browser again acknowledged Team Export, but its download listener exposed no downloaded file. The checkpoint was retained; no export/discard/import success is claimed. Full distributions were not rebuilt locally with less than 300 MiB free. The previous committed-source receipt describes its named older commit only. Human catchability, complete six-lesson/input coverage, two-player hardware, constrained-device performance, listening approval and exact release-artifact provenance remain pending.

### Source preparation before standalone packaging follow-up

The first frozen-source inspection rejected `8c7cad462` because the generated content registry was stale after restoring the 512-terrain limit. Rebuilding added 75 previously omitted Neon identities: 17 normalized levels, four campaign projections and 54 gentle-level projections. No existing identity was removed or changed. The localization extractor skips failed normalization, so the earlier check with the lower terrain limit did not establish that these identities were present.

The corrected [Pages inspection receipt](evidence/humanoid-hunt-source-inspection-b454509b8.json) passed for commit `b454509b8be222516a9004cbd647db57a91a4bae`, tree `d218995a0ff4a0df80a43b25ed77892318a08254`, using the `main-pages` publication profile. It verified all **23,965 committed source files**, with no missing tracked files, **2,646 included originals**, and source asset eligibility. Normal build preparation, including its localization and content validation, produced **2,730 manifest files** with a **852,904,666-byte payload including the manifest**. Manifest SHA-256: `2bfd28467ac49d007ed04f563e9723830c112d0a3bb334dcc80dcc5d3c9e8210`.

This receipt records one normal build preparation, zero ZIP builds and no publication assessment. Hosted metadata, optional packages and the complete deployed site remain outside it. On this commit, GitHub preflight, focused validation, hosted acceptance, default capacity and the scheduled release-ready gate passed. The company candidate failed because DroneAid NL Community exceeded its unchanged 64 MiB limit (853 files / 67,389,081 bytes), prompting the standalone packaging follow-up below; its sibling optional-practice job was cancelled. Automated suites remain **WAIVED_SKIPPED_NOT_PASSED**. No all-checks-passed, merged or published claim is made.

### Standalone packaging follow-up

Standalone company editions now explicitly include the eight reaction portraits and 16 EN/UK pilot recordings through their existing catalogs. The 24 media files total 350,032 bytes; their exact hashes and byte counts are registered in the shared asset ledger, and M4A files must pass media-ledger admission. Existing pilot provenance and listening-review status remain unchanged. Hunt CSS, caption/layout helpers and procedural humanoid artwork were already included.

With these assets, DroneAid NL Community exceeded its 64 MiB limit by 647,289 bytes. Its retained artwork and media are required. The compiler now removes only leading spaces and tabs from distribution copies of non-vendor JavaScript, outside all token and comment ranges. Every transformation verifies the complete syntax tree, exact token/comment bytes and all line terminators. Source-mapped and vendor modules remain untouched; source originals, JSON, media and source archives retain their bytes. Offline and build manifests are generated afterward from the final files. The limit remains unchanged.

The direct working-tree compiler observation produced **877 files / 67,030,706 bytes**, leaving **78,158 bytes** below 64 MiB, with the complete reaction media included. It saved 725,447 bytes; mandatory offline content totaled 65,903,605 bytes. All 615 final game JavaScript modules were checked for idempotence, and independent source review found no actionable issue. Scoped syntax, lint, formatting and whitespace checks passed. Three focused regression cases cover lexical preservation, source-map/vendor boundaries and immutable data/media; they remain unrun under the waiver. Final committed-source and all-edition inventory evidence is recorded separately.
