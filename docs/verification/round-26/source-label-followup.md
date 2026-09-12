# Round 26 — display-label follow-up

**Pass: the existing 23 CLI tests, lint, formatting and validation.** This narrow check covers the landing page's duplicated version-prefix fix at commits `131361e` and `1044627`, using the v0.16.0 working source at `1044627808f296068bd2e49483bc007e50add1ed`. No source files changed during the check.

The earlier [six-gate report](source-gates.md), its [1,521-test machine record](source-gates.json) and [original input inventory](source-inputs.json) remain unchanged. Those full-suite results apply to the earlier inventory. This follow-up runs the affected existing CLI tests again; it does **not** add 23 new tests to the 1,521 total or claim a second full-suite run. Native formatting and motion-lab syntax are preserved prior results because those inputs did not change. Browser label inspection and candidate artifacts are separate evidence.

| Check                                   | Result       | Evidence                                                         |
| --------------------------------------- | ------------ | ---------------------------------------------------------------- |
| `node --test scripts/test-game-cli.mjs` | Pass · 23/23 | [Raw log](../../../.cache/round-26/label-followup/cli-tests.log) |
| `npm run lint`                          | Pass         | [Raw log](../../../.cache/round-26/label-followup/lint.log)      |
| `npm run format:check`                  | Pass         | [Raw log](../../../.cache/round-26/label-followup/format.log)    |
| `npm run validate`                      | Pass         | [Raw log](../../../.cache/round-26/label-followup/validate.log)  |

Node.js was 22.22.2. All 13 metadata values and the validator report v0.16.0. Validation still reports 127 runtime files, 12 base plus 17 expansion maps, six packs, four themes, seven classes and six effective goals, with the same ten navigation warnings recorded in the [log](../../../.cache/round-26/label-followup/validate.log). No Pages build or deployment was executed. No dedicated existing landing test file was present; the selected test command is the actual CLI suite.

## Exact accepted delta

The final inventory still contains **331 files**. Relative to the full-gate inventory, precisely these three files changed; every other audited input is byte-identical. Their changes normalize the version label to one leading `v` in both generated HTML and the landing page's script. Core, course, maps, preferences, persistence, replay and historical proof bytes did not change.

| Changed input          | Final SHA-256                                                      |
| ---------------------- | ------------------------------------------------------------------ |
| `scripts/game-cli.mjs` | `7dd99f7663891b54cef30da75c6ed6fd48475f0cafdce200fa801db065321671` |
| `site/index.html`      | `e9ad003331b67baba55de0eb3610e366f490cc00bc39046e8aa70ee31eab1b99` |
| `site/landing.mjs`     | `3e714ed8b5fe12822f8d676808191affdea50f5edafa5ae1ae4302e8dd9c83f7` |

The before/after final-source aggregate is `a3532d1582596ffee7d1ab3413699bee752b9ee33dc8e6ecb893dd93c753e1f6`. The [final source inventory](source-inputs-final.json) is the appropriate input list for a later frozen-source comparison. The [follow-up machine record](source-label-followup.json) pins both this final inventory and the unchanged earlier full-gate evidence.

## Preservation and output pins

All **19 previous release trees** (2,054 files, 2,591,153,392 bytes), **20 exact tag identities**, and the original six-gate outputs match their recorded hashes before and after the follow-up. The preserved evidence set contains 3,360 files, with aggregate `81e30ef22727da4a208210d89efd2d5bbb0f4c97fcfc342a44a57eba9ccc8c40`. The [earlier archive-deletion/restoration incident](source-gates.md#earlier-preflight-interruption) remains recorded; these checks establish stability of the restored bytes during this follow-up.

| Published file                                           |  Bytes | SHA-256                                                            |
| -------------------------------------------------------- | -----: | ------------------------------------------------------------------ |
| [source-label-followup.json](source-label-followup.json) |  8,775 | `eda708f1c11ebe2fbc00843c4e645aa514c61b5fd1eb56c3c655b1bd7290ff58` |
| [source-inputs-final.json](source-inputs-final.json)     | 56,291 | `5b376c936837fa429dc7810773e5f03f896d45321b3b5556fd390901234b3635` |

[Runner](../../../.cache/round-26/label-followup/run-followup.mjs), [before-input index](../../../.cache/round-26/label-followup/source-inputs-before.json), [after-evidence index](../../../.cache/round-26/label-followup/prior-evidence-after.json) and [after-tag index](../../../.cache/round-26/label-followup/tags-after.json) retain the raw audit. The JSON files above are byte-identical cache copies. The report copy is formatted for documentation; its data is identical to the preserved raw runner report. This report does not certify an archive, hosted deployment, native runtime, physical input device or player comprehension.
