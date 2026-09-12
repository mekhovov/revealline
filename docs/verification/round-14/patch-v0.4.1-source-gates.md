# v0.4.1 patch source gates

All seven checks passed on **12 September 2026**, after the repeated-file selection fixes. The checks used Node **22.22.2** through mise against working source based on `378e7902efdc5f9f585efee5946fb4661d9cfec7`. No source edits or commits were made by this gate run.

| Command, prefixed with `mise exec node@22.22.2 --` | Result                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm test`                                         | **605 passed**; zero failed, skipped, cancelled or pending                                  |
| `npm run lint`                                     | Passed                                                                                      |
| `npm run format:check`                             | Passed                                                                                      |
| `npm run format:native:check`                      | Passed                                                                                      |
| `npm run validate`                                 | Passed: 88 source files, valid literal references, 12 base maps, four themes, seven classes |
| `node --test authoring/motion-lab/test-*.mjs`      | **70 passed**; zero failed, skipped, cancelled or pending                                   |
| `node --check authoring/motion-lab/app.js`         | Passed                                                                                      |

The [patch gate record](patch-v0.4.1-source-gates.json) contains the exact commands, timestamps, durations, test totals, log sizes and hashes, validation output, and preservation checks. Distinct logs and the adapted runner remain in `.cache/round-14/patch-v0.4.1/`. The Motion Lab command enumerated all five current test files rather than relying on an unexpanded shell glob.

The [214-file patch source inventory](patch-v0.4.1-source-inputs.json) had matching before/after SHA-256 `b9d973d7e99eb10368e9deee9fe7d553662e292fed7777c1edbf757270aff1d8`. Runtime, tooling, native-project, relevant authored-source inputs and package/configuration files did not change during these checks. Documentation and verification artifacts are outside that source hash.

All **14 existing round-14 evidence files** were separately hashed before the run and re-read afterward: every byte hash remained unchanged. The v0.4.0 [gate record](source-gates.json), [source inventory](source-inputs.json), screenshots and other existing evidence were preserved. These patch results are separate files and do not replace the v0.4.0 evidence.

The same four navigation warnings remain for Motion Lab, the reference atlas, the release directory and native diagnostics. Their exact paths are in the patch JSON record. The structural validation does not certify those dynamic destinations.

This run checks current automated source behavior. It does **not** certify the frozen v0.4.1 release, actual browser file-picker change events, browser layout/decoding, or native device execution. The repeat-import/Undo browser regression is recorded separately by the release owner. No new tests merely assert an input's empty value; existing validators, import paths, replay behavior, and lab motion/collection/ability tests were rerun unchanged.
