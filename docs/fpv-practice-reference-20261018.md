# Verified practice split references — acceptance

Runtime source: **d4565cf6ebedf312d4ce24e100725844f8531afe**.
Tree: **f8367258ba5e91485ccf4fb542a64d003f3f0310**.
Status: independently reviewed and locally accepted; not yet deployed.

## Behavior

Academy and World course practice can explicitly use a completed, verified archive
as an unscored split reference. The archive must pass the existing full physical
and course reconstruction. Parsed or imported proof flags do not grant eligibility.
The prepared session's actual comparison class and admitted terrain identity must
both match. Personal rotation rates and cosmetic camera settings can differ; aircraft, controller,
throttle, backend, mission adapter, course or terrain differences reject selection.
Regional/free flight remains without course splits.

Use/Clear is explicit. Selection copies at most 64 contiguous safe-clock rows.
The panel compares completed observed objectives at the existing 50 Hz mission
frequency; unobserved or pre-recovery durations receive no delta. Reference data
never enters physics, recovery, recording or scoring identities. Ordinary pause
and resume retain the reference. Selection, new verification, replacement,
recovery and disposal clear it. Restored sessions use their actually accepted
historical backend and adapter; failed or cancelled recovery retains the old identity.
No restart, arm, score, personal best or award is triggered.

Implementation commits: `08d5660146` (prepared identities and worker-wrapper
cleanup), `3c029d110e` (shared validator deduplication), `d4565cf6e` (UI/hosts/splits).
The shell generator now imports the already shipped stateless JSON validator
instead of embedding its duplicate. This saves 5,033 source bytes. AST and boundary
checks preserve all other generated behavior; no package cap or vendor changes.

## Automated evidence

| Scope                                      | Result               | Boundary                                                                                                                                                                                                         |
| ------------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session, archive and actual worker handler | 38/38 pass, no skips | All 15 aircraft × Academy/World × both modes prepared identities; compatible/incompatible settings; recovery, cancellation and unchanged physical output. Structured-clone worker harness, not physical devices. |
| Shared reconstruction / CLI                | 42/42 pass, no skips | Stable evaluator-source pins; all 15 × both modes on one original lesson; full tail verification. An earlier run correctly rejected a source edited during execution; the frozen rerun passed.                   |
| Archive, recovery controls and split panel | 69/69 pass, no skips | Owned proof, explicit selection, copying, malformed/bounded timing, missing history, lifecycle, EN/UK and nonfatal presentation failure.                                                                         |
| Shared validator and projected shell       | 20/20 pass, no skips | Stateless validator reuse, projected settings and preference boundary. Generator idempotence and AST/boundary preservation were separate audits.                                                                 |
| Final packages                             | 19/19 pass, no skips | Exact clean committed source; optional 10, native 7, World 2. Native packaging is not native runtime qualification.                                                                                              |

[Exact package receipt](fpv-practice-reference-package-qualification-20261018.json)
and [dedup preservation receipt](fpv-shell-validator-dedup-preservation-20261018.json).

| Boundary                | Bytes / limit          | Remaining  |
| ----------------------- | ---------------------- | ---------- |
| Academy original inputs | 13,299,549 /13,303,808 | 4,259      |
| Academy emitted bundle  | 13,074,621 /13,107,200 | 32,579     |
| World original inputs   | 19,785,276 /20,971,520 | 1,186,244  |
| Simulator-only native   | 19,019,082 /33,554,432 | 14,535,350 |

Academy source 151/151; World 211/211. Actual Academy output 138 files.
No capacity waiver, physical constants or recording schema changes.

## Rendered World acceptance

18 October 2026, approximately 23:05–23:10 CEST, isolated local origin
`127.0.0.1:8873`, normal UI and keyboard, current committed runtime bytes.
The existing public tab and its archives were untouched.

- Reopened the saved Meteor75 and original **Meet your drone** Self-level lesson.
  Selected the earlier test archive `World ·2026-10-18T20:44:29.447Z`.
  Course completion verified again at 14.48 s. The UI offered a compatible reference.
- Explicit selection showed 0.80/5.16/8.52 s reference objectives. The current paused
  attempt remained 6.00 s; objective 1 compared 0.80 against 0.80 with zero delta.
- Resumed keyboard flight and paused at 58.22 s. The reference survived ordinary
  pause/resume. Objective 2 took 25.52 s against 5.16 s, displaying +20.36 s. Objective 3
  remained unobserved. This flight included a climb near the ceiling and is not
  a completed course or controlled-hover qualification.
- Restored the 55.00 s durable checkpoint. Proof/reference cleared; earlier objective
  times became unavailable. Flight remained paused. Reverification and explicit
  reselection worked with the restored prepared identity. Unknown historical
  objectives displayed reference durations but no invented current values/deltas.
- EN→UK→EN translated the reference, controls, result and archive status without
  rerunning verification. Explicit Clear removed the comparison while retaining
  the verified result. English was restored. No archive was deleted, and no
  aircraft setup was saved. Browser diagnostics captured no errors/warnings.
- The source-preview server has no generated World offline worker, so this is not
  offline-network acceptance. Existing test-origin retention does not close the
  separate public missing-archive incident.

## Actual emitted Academy acceptance

The actual 138-file output from the exact package receipt was served at
`127.0.0.1:8874`, approximately 23:11–23:13 CEST. The fifteen-aircraft picker loaded,
Meteor75 **Use in draft → Test draft** prepared normally and remained disarmed at
0.00 s. The prior 3.88 s test archive was still listed. Course verification correctly
returned **physics verified / course not completed** and did not offer a reference.
No new flight, setup save or archive deletion was needed. Captured diagnostics
had no errors/warnings. Both temporary test tabs and servers were closed.

This confirms the emitted shell/worker imports and incomplete-proof UI, not a
positive completed Academy reference, offline-network or native-device acceptance.

## Remaining boundaries

Hosted integration/publication and deployed acceptance remain. At this original
R11D boundary the slice covered timing comparison only; the subsequent
[geometry-correct visual reference](fpv-practice-ghost-20261018.md) is now locally accepted.
No physical radio/pilot/flight-log qualification is implied.

The previously observed nonblocking observer/control-label lifecycle edge is corrected in `f81dd8a004d911049efc1ff366b2166168e72506` (integrated as `3d528a190`). Controls query their own session's live split reference; proof clearing always removes that owned reference, including when the presence query throws. The visual reference remains independent. Independent review and 92 focused checks pass, including EN/UK, owner/disposal and failed-query cleanup. The final integrated package and actual Meteor75 proof/recovery acceptance also pass. [Final integrated scope](fpv-flight-integrated-acceptance-20261019.md). Publication remains a separate gate.
