# Soundtrack v3 framework — scoped development evidence

This records development checks associated with source commits
`8f082ee9957bb44cf891ba131f7aabbd7aff4df8` (scores and production evidence) and
`0c673a590d8cb938402ba7bbd0f8434ea6001b5d` (runtime framework). The working source
continued to change during verification. These results are **not** a passing
final full suite, frozen-artifact qualification, physical-device check, offline
qualification, music approval, or publication/release claim.

## Music status

- **Zero approved originals, creator recordings, or UA-FPV recordings.** The
  original `ready.json` and both publication approval lists are empty. A direct
  publication compile returned zero catalogue recordings, public audio files,
  hosted archives and bonus albums; generated catalogue metadata matched.
- Seven distinct candidate compositions have eight full rendered attempts:
  Idle Frequency has its original and Arcade Revision. **Both Idle versions were
  rejected by the user.** The other six compositions remain unapproved.
- Two additional direction sketches last 38.736 and 42.384 seconds. They remain
  unreviewed and contribute **zero** completed compositions toward the planned 36.
- Thirty licensed creator candidates have provenance records; the private UA
  inventory contains 80 files / 77 unique recordings with permission unresolved.
  Their presence in authoring inventories does not admit them to public delivery.

The production agent reported verification of ten receipt sets and twenty local
audio files against source, score and audio SHA-256 pins. Native 48 kHz / 24-bit
FLAC masters have exact PCM round-trip receipts. Decoded MP3 loudness is around
−16 LUFS; the 4× oversampled peak estimate is below −1 dBTP. This is technical
measurement, **not certified true-peak metering or listening approval**. Full
listening, repeated-session fatigue, gameplay mix, Ukrainian cultural review and
publication review remain separate and pending. Candidate audio stays outside
the framework commits; scores, source and receipt JSON are retained.

See the [candidate inventory](../../../authoring/library/revealline-original-soundtrack/local-production/candidates.json),
[direction sketches](../../../authoring/library/revealline-original-soundtrack/local-production/direction-sketches.json)
and [production notes](../../../authoring/library/revealline-original-soundtrack/local-production/README.md).

## Completed technical checks

The following are observed final TAP summaries from retained development logs in
`/tmp`. Runs overlap and their counts must not be added. They do not establish
that every test ran against either exact commit. Log hashes, timestamps and
eight-line tails are retained in [retained-log-summaries.json](retained-log-summaries.json);
large logs have not been copied. These logs do not contain original shell argv
or exit codes, so neither is reconstructed.

| Retained log                            | Passed | Failed | Skipped |
| --------------------------------------- | -----: | -----: | ------: |
| `revealline-distribution-tests.log`     |      5 |      0 |       0 |
| `revealline-archive-gates.log`          |     34 |      0 |       0 |
| `revealline-collection-gates.log`       |    145 |      0 |       0 |
| `revealline-db5-host-rechecks.log`      |     77 |      0 |       0 |
| `revealline-final-panel.log`            |     87 |      0 |       0 |
| `revealline-playback-review.log`        |     48 |      0 |       0 |
| `revealline-ui-final.log`               |    129 |      0 |       0 |
| `revealline-host-followup.log`          |      3 |      0 |      13 |
| `revealline-fixture-recheck.log`        |      1 |      0 |       0 |
| `revealline-border-fixture-recheck.log` |      2 |      0 |       0 |

Separately, the production agent reported 11/11 Python checks from
`audio-analysis/bin/python -m unittest discover -s authoring/library/revealline-original-soundtrack/local-production -p 'test_*.py'`
and 10/10 Node checks from
`node --test game/test/original-soundtrack-production.test.mjs game/test/soundtrack-original-flac-production.test.mjs`.
These are retained agent-reported results; no fresh render or re-run was performed
to write this note.

Earlier failing attempts remain visible: integrated audio 292 pass / 38 fail;
host 30 pass / 3 fail; player 54 pass / 3 fail; UI 46 pass / 1 fail. The initial
`revealline-full-tests.log` still had **no final TAP summary** at inspection, and
source was constantly changing during that run. Its observed failures include
missing sparse-checkout files (`docs/verification`, Border crosswalk and pack
catalogues), DB4 observers encountering DB5 state, and earlier transport/fixture
assumptions. Focused rechecks above are separate evidence; they do not erase
those failures or convert the initial run into a completed passing suite.
Empty lint logs and formatter output alone are not recorded as global gate passes.

## Native source preview reported by the root agent

These checks used the local evolving source preview, not a frozen release build:

- Solo menu → gameplay → pause; imported Glass Highway and Steel Kolomyika MP3s
  were saved and retained after reload.
- Versus manual Play → menu → Start → Pause retained Steel's title, artist and
  original filename. At 390 × 844, credits wrapped to two lines without overflow.
- Team manual Play → menu → Start retained the same metadata. At 390 × 844,
  title and filename remained visible below the footer without overflow.

A fresh saved-unmuted Couch Settings gesture remained paused until manual Play:
this is a recorded gap, with a first-trusted-gesture fix still under verification.
Solo compact landscape credit placement was corrected after static review;
its native retest is pending. These interactions do not constitute full-track
listening, hardware audio certification, or approval of either imported candidate.

## Still pending

- Latest Team/Versus first-gesture fix and broader lifecycle/reload source checks;
  Solo compact landscape native retest and the remaining compact source matrix.
- A complete clean full suite, CI, latest-main reconciliation, final version
  selection, and verification of the final exact source/artifact.
- Frozen-build offline/recovery qualification, physical-device checks and any
  public archive admission, publication or release.
- Listening and rights approvals before any recording enters the shipped catalogue.

Later results should be appended with their actual source identity and scope;
this record should not be relabelled as a release sign-off.

## Follow-up near source 9afb9b8c

This append records subsequent work associated with
`52a92efcb27d84eaf0fa33b914b9c5b6746a5bdc` and
`9afb9b8cd0ca5141a9a52db85325cb0ea5ec956f`. It leaves the earlier observations and
failures above intact; the preview still used evolving source.

The follow-up adds an explicit Solo music grid area and actual space reservation
in fixed landscape layouts; first-trusted-gesture Couch menu activation with
listener cleanup; Versus source-link keyboard/controller navigation; and large-text
credits with 44 px link targets. The root agent observed Solo at 844 × 390 with
the title above the complete board and clear of the HUD. A fresh Versus Settings
gesture automatically started synthesized music. These address those particular
earlier gaps without qualifying every layout, lifecycle or device.

Completed retained TAP summaries: the four affected DB5 host suites remain
77/77; the Couch menu/host/session cohort passed 46/46
(`revealline-couch-menu-host-checks.log`), and the final gesture/disposal tests
passed 5/5 (`revealline-couch-menu-gesture.log`). Horizon fixture rechecks passed
3/3 (`revealline-horizon-fixture-recheck.log`). The latter three logs are summarized
in the companion evidence JSON. The architecture agent reported scoped lint and
formatting success; broad validation/lint were deferred to preserve disk reserve.

The initial full run was **stopped at root's disk-reserve request with exit 143**.
It reached top-level test 5062: 5041 `ok`, 21 non-passing entries, with no final TAP
summary. The retained non-passes comprise four sparse-fixture misses, three DB4
observer-caused parent failures, and fourteen external-host cancellations after
the failed DB4 open. Studio 1/1, Border 2/2, Horizon 3/3 and DB5 host 77/77 focused
rechecks passed separately. This interrupted, mixed-source run remains failed /
incomplete evidence; it is **not** a full-suite pass.

**Native persistence remains open.** A runtime backend timeout/reset and closing
an old tab coincided with generation-zero libraries being observed in both Solo
and Couch. The cause is unresolved; no erase or save action was taken as part of
that observation. The root agent is reimporting a 1.3 MB direction sketch to
isolate save/reload persistence. The earlier successful import/reload observation
does not resolve this later event. No data-loss cause or durable-persistence pass
is asserted until that retest finishes.

Zero approved/public recordings is unchanged. Clean full-suite/CI qualification,
latest-main and version reconciliation, remaining native checks, frozen/offline
verification, and publication/release remain pending.

### Subsequent storage and layout retest

On the same source, a new 1.3 MiB Tracker Breaks sketch was imported through the
native file chooser. Save reported generation 1; Save & use playlist reported
generation 2. Navigating to a fresh Team page retained the saved track and
selection, and the first Settings gesture started that MP3 without pressing
Play. Its title, artist, original filename and source link were visible during
Team gameplay at 844 × 390 with Large text. The complete canvas, clock and Pause
remained visible. This successful bounded cross-mode retest does not explain the
earlier generation-zero observation or establish durable browser retention.

A separate read-only source audit found the same DB5 database and library key
in Solo and Couch, no startup/reset writes, and generation-zero synthesis only
when the saved library key is absent. Three existing storage regressions passed
(28 unrelated tests skipped; `/tmp/revealline-shared-storage-read-audit.log`).
Browser partitioning or eviction remains an unproven explanation for the earlier
event. The native test did not clear storage or replace a saved library.
