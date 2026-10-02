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

[Draft PR #962](https://github.com/mekhovov/revealline/pull/962) contains the implementation. GitHub preflight, hosted acceptance and optional-package checks passed on the implementation head. The `release-ready` check is held because this product PR has no immutable release slot; its log explicitly requires keeping unallocated work draft/stacked. The PR remains draft. Candidate/default-capacity jobs were still running when this evidence was recorded; no all-checks-passed claim is made.
