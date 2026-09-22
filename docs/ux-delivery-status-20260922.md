# Remaining UX and production work — 22 September 2026

This dated checkpoint distinguishes implemented candidates from published features. Consult the live PRs and Actions for later state; it is not an automated dashboard.

## Published and qualifying

[v0.82.0 is public](https://mekhovov.github.io/revealline/releases/v0.82.0/site/game/), frozen source `9b26f2a02fb621a6f023422768e34605ae103739`. Its source qualification passed11,688 checks. Publication correction [PR254](https://github.com/mekhovov/revealline/pull/254) at `75e3c0279ff4f7b5f110a6240c0df258c4b085c1` corrected root Play/Download links; [actual Pages deployment](https://github.com/mekhovov/revealline/actions/runs/35724104771) succeeded. Scoped native and offline observations do not close whole-game acceptance.

[v0.82.1 / PR250](https://github.com/mekhovov/revealline/pull/250), source `565c4f3bd6a06a593d22786730435f59ee6b1aa1`, is qualifying. At this checkpoint [run35722144548](https://github.com/mekhovov/revealline/actions/runs/35722144548) has passed preflight/build/test groups2/4, while1/3 are running. It has not been declared publicly accepted. The sole publisher owns merge, freeze, selector and public verification; independent candidates do not mutate that source.

## Queue and next steps

1. Finish v0.82.1 exact-source qualification and its complete publication cycle.
2. Integrate [PR252](https://github.com/mekhovov/revealline/pull/252) backup preflight against the accepted parent. Its scoped native checks cover Keep/Replace/Undo, unavailable Undo, controlled write refusal/retry/reload, and repeated Escape. The final version/source still needs complete qualification.
3. Recover closed PR233 retained-presentation work once, preserving PR252 and session-only originals. This candidate's [130-check-per-runtime focused integration evidence](verification/presentation-recovery-20260922/README.md) is separate from full-source and public acceptance.
4. Rebase Team descendants234→236→238→240→243→244→245→247 onto that recovery; PR241 is the related full-picture preview branch, and239 is already included in later Team work. Keep parent branches until dependent PRs move.
5. Independently integrate retry-copy230, Replay preferences231, CI supersession235, responsive Studio237 and closed Studio validation242. Review each final diff and qualification after integration, even where earlier checks passed.
6. Release Solo save-warning253 and Couch recovery255 as bounded follow-ups. PR255 evidence-only head13af2c37 preserves product bytes from a37a651b. Independent review and scoped native refusal/retry/reload checks pass; final source/public acceptance remains. Newly discovered Journey backup success-focus recovery is a separate correction.
7. Continue the remaining programme below, releasing coherent verified increments. Do not accumulate completed features solely in local patches or mistake draft PRs for releases.

Every feature follows implementation, review, testing and fixes, explicit related staging, synchronized version, commit, exact-source qualification, immutable freeze, Pages deployment and public play verification. Never mutate an already published tag or asset. Full source gates remain `npm test`, `npm run lint`, `npm run format:check`, `npm run format:native:check`, `npm run validate`, and `node --check authoring/motion-lab/app.js`, plus applicable production/build/artifact/browser checks.

## All remaining areas

| Phase | Remaining work and acceptance |
| --- | --- |
| Baseline reconciliation | Finish the serial release queue, reconcile accepted main, and qualify each final version/source. Preserve frozen publications; complete remaining public/offline checks and keep source/publisher/evidence identities explicit. |
| P03/P05 — Global Settings and sound | Complete each host’s categories, cached-page preference reconciliation, failed-storage recovery and safe return. Quick Sound follows shared master authority; Settings must preserve attempts and require explicit Resume. Listening and physical-device checks remain separate. |
| P03/P05 — Shared navigation/readability | Complete keyboard, touch and controller journeys across Home, modes/lobbies, Help, Pause, results, Collection and Workshop. Verify opener focus, mode-switch cancellation, neutral/reconnect handling, responsive order, EN/UA glyphs, Theme/Plain, Standard/Large, contrast, zoom and reduced motion. |
| P07-A/P16-A — Continuation and data safeguards | Qualify Retry picture/theme retention and staged Next success/failure/cancellation without duplicate awards or lost results. Finish difficulty-change intent, missing-picture/cross-tab recovery, truthful backup/media scope, replacement preflight and with/without-Undo journeys; integrate the qualified snapshot-memory correction. |
| P08-A — Existing map completeness | All 15 built-in Versus maps now have scoped compiled-art parity tests; finish native partial/full reveal and retained-art acceptance, installed/imported coverage, both Team arenas and coverage/multi-stronghold imports. Review all 42 Team roles, anchors/cores/shields/Support/rescue/recovery, full board/control visibility, invalid-art recovery and offline dependencies. |
| P06/P07-B — Catalogue and campaign journey | Adopt reviewed Journey content through the normal player entry with a clear Legacy distinction. Complete discovery/download/play, teaser and optional preview, retained selection, repair/capacity/cancellation, named successors and direct result endings. Campaign offline readiness must include required art, presentation and advertised audio. |
| P04/P05 — Studio and complete visual themes | Finish complete compatible collections and real Solo/two-board Versus/Team previews; upload/edit/history/atomic replacement and exact export/import recovery. Keep campaign style default. Qualify distinct FPV and Ukrainian ornamental collections across required hosts, retained revisions, explicit fallback, backup and offline use. Slot inventory alone is not visual approval. |
| P08-B/P02-B — Feedback and audio | Review moving and reduced-effect countdown/cut/capture/defeat/recovery/Support/objective/result feedback at actual size, without timing changes. Complete published soundtrack listening, cross-mode master, interruption, imports and cold offline/recovery acceptance. Follow the audio owner’s current recording instructions; do not infer or invent recording completion. |
| P09 — Encounter and difficulty benchmark | Qualify deterministic encounters, warnings/counterplay, contact/capture defeat, optional remains, checkpoints/replays and Gentle/Standard/Hard behavior. Preserve named edition presets; separate scripted success from human fairness and pacing. |
| P10 — Team encounters | Complete the separate 36-configuration matrix, complementary cooperation, readable two-player roles, Support/rescue/strongholds and two-person/controller checks. New Team studies do not replace existing-arena acceptance. |
| P11 — FPV production | Map the original FPV edition goals to accepted Journey design cards, original art, skills/counterplay, difficulty, rewards and coherent public releases. Earlier four-by-twelve quotas are historical; reject filler and trivial bypasses. |
| P12 — DroneAid production | Complete community branding/provenance, animated logo plus reduced-motion poster, actors/HUD/art/audio and Support/Combat semantics across compatible modes. Map community content to the newer Journey allocation; the old four-by-twelve quota is historical. Research and candidate assets are not brand approval. |
| P13 — Living Atlas | Complete cultural/history review, original edition assets, meaningful mission variety and applicable mode/difficulty/public acceptance. |
| P14 — After School Arcade | Complete distinct Retro visuals/audio/encounters, meaningful progression and cross-mode release checks. |
| P15 — Spend in Motion | Complete coherent Coupa/noncombat semantics, edition assets, progression and cross-mode release checks. |
| P16 — Remaining workflows | Finish Collection Pictures/Records/Mastery and distinctions between viewing, recorded replay and fresh play; learning/practice/controller lab; data/media recovery; workshops/support pages and explicit Legacy categories. Close shipped links and return-focus paths. |
| P17 — Community guide | Reproduce a small branded pack in an independent fresh workspace: prompts/assets, prepare/validate, ordinary install/play, export/restore/recover and release. Document compatibility; ordinary players must not require file pickers. |
| P18 — Full qualification | Complete fresh/loss/Retry/win/Next/ending, saved/mode-switch/Settings, download/failure/offline, Collection/theme/backup/update and Couch rotation/disconnect/recovery matrices. Cover desktop/tablet/1280×800/portrait/short-landscape, ≥44px targets, meaningful 200% zoom, EN/UA, announcements, reduced effects, actual devices/controllers, sustained performance, image memory, storage budgets and public rollback. |


## Production totals and exclusions

The original **132-mission / 792-Solo-configuration / eleven-campaign** allocation is historical. The later user-approved **Xposed-Led Campaign and Gameplay Redesign** explicitly replaces it with an authoring backlog of **242 Solo candidates, twelve finale Remixes and twelve purpose-built Team missions**, with **no minimum shipped count or filler quota**. Six preset/control cases per mission describe qualification, not additional content. Current authored routes contain a smaller curated subset plus optional studies; neither candidate totals nor test passes establish release acceptance.

The original FPV, DroneAid, Ukrainian, Retro and Coupa presentation/community requirements remain tracked separately from the newer Journey campaign structure. Map those requirements explicitly to supported editions; do not double-count the superseded mission quotas. Team preset, encounter and input matrices must retain their actual scopes rather than sharing an unexplained aggregate count.

Online multiplayer, Deathmatch, complete Ukrainian translation, hosted administration and persistent co-op saves remain deferred.

Physical touch/controllers, audio listening and full offline checks remain separate from modeled tests and desktop browser evidence. The release coordinator retains per-candidate receipts; public acceptance must name the actual committed source, publication and tested journey.
