# Demo variety, audio and privacy follow-up — 30 September 2026

## Scope

Runtime source `25578aca39a5050ff75adcd58d6af05b604c9379` continues from merged PR #847 on current main `1a0be74b06e0d7bd700ee45d141456e3244907c1`. It keeps the qualified planner limited to Orchard Crossing and Courtyard Exits while extending real-core viewing coverage through reviewed recordings and a replay-verified improvised adapter. The intervening main changes concern independently reviewed soundtrack delivery, actor follow-up, optional-practice radio recovery, FPV offline navigation, native evidence and restored landing-menu workflows. The rebase was conflict-free. The integration follow-up preserves the shared Confirm-release owner now that **Watch demo** lives under Settings, so a held controller/touch confirmation cannot immediately reopen Demo after Back. This record does not claim physical-device, audible-output or human-viewer acceptance.

The implementation now:

- routes demonstrated events through the same ordinary `Soundscape.feedback` and `Soundscape.events` path, including the real body, theme and campaign feedback context;
- shows the exact verified earned original in demo, completion and takeover practice, while the opt-in privacy setting conceals every demo/practice picture without changing Collection or ordinary play;
- supplies sixteen authored recordings across all twelve base maps, including six readable mistake scenes and two complete losses;
- gives every other compatible installed Standard level a lazy, seeded improvised source recorded and strictly replay-verified through the ordinary core;
- retains exact installed campaign, mission, class roster, theme and picture ownership, including isolated Coupa and DroneAid editions;
- changes the performance seed on each improvised preparation so a repeated level does not replay one fixed route.

## Authored mistake pacing

The first expansion generated several 2.9–8 second failures. Those technically demonstrated death but could look like an artificial immediate loss. The current recordings first reposition visibly on safe ground, then make an ordinary cable reversal or hazard mistake. Nonterminal scenes show the respawn and continued border play. Internal IDs use `authored-mistake-*`; provenance remains `authored` and never claims a captured human session.

| Scene                        | Duration | Result                           |
| ---------------------------- | -------: | -------------------------------- |
| `authored-mistake-signal-03` | 17.325 s | Three failures, complete loss    |
| `authored-mistake-signal-06` | 12.508 s | One failure, continued recovery  |
| `authored-mistake-signal-08` | 14.583 s | One failure, continued recovery  |
| `authored-mistake-signal-10` | 14.542 s | Two failures, continued recovery |
| `authored-mistake-signal-11` | 24.558 s | Three failures, complete loss    |
| `authored-mistake-signal-12` | 12.567 s | One failure, continued recovery  |

All sixteen authored recordings reproduce their complete authoritative checkpoint on the tested runtime. The mistake duration guard is 12–30 seconds; reviewed wins retain the existing 20–60 second check. No scene uses boost or writes simulation state directly.

## Automated evidence

The focused runtime cohort passes **47 tests** across audio feedback, earned-picture host behavior, settings, practice/captions, improvised playback, authored recordings, source isolation and theme selection. On the rebased integration source, the final recording/source/improv subset passes **27/27** and the mounted Confirm/Back, experience and host cohort passes **35/35**. `node scripts/build-demo-recordings.mjs` verifies **16 authored recordings across 12 unchanged campaign levels**.

The source cohort exercises the real current Journey composition and all public `coupa-all`, `droneaid-nl-community` and `droneaid-community` edition bootstraps. Every installed Standard level receives exactly its own compatible source; public editions expose only improvised sources owned by that edition. Gentle entries do not duplicate scenes. Same map IDs in distinct installed owners remain distinct campaign and level keys.

Scoped ESLint, Prettier, localization and whitespace checks pass. The ordinary build-inventory assertion confirms every dynamic demo asset and Worker module is collected. After the latest-main rebase and Settings integration fix, the production build passes with 2,661 files and manifest SHA-256 `992a80f5673d6bf77dd81e251de1881cd20f0accfff3a4f03aebe388cc35cef6`; [the retained output](build.txt) records its version and path. An earlier attempt exhausted local disk while writing; removing only that task-owned ignored `dist` output and repeating the unchanged build succeeded. These tests use modeled DOM/input and local assets; they do not substitute for Safari/iPhone hardware, physical controllers/touch, actual speakers, battery/thermal measurements or unfamiliar viewers.

## Updated plan and remaining priorities

The [phase-by-phase plan status](../../demo-plan-status-2026-09-30.md) is the current execution plan. The highest priorities are to diagnose the completed observation's 158-second visible-return stall, obtain a clean exact-build two-hour observation, make the unchanged capacity assertions complete within a reliable CI job budget, and finish physical iPhone/browser/native input plus audible-output acceptance. Three unfamiliar viewers remain the final comprehension and attraction gate. More attributable player recordings and additional bot maps are optional post-acceptance expansion.
