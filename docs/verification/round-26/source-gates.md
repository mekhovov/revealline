# Round 26 — source gates

**Pass: 1,521 unique tests and all six gates**, on the v0.16.0 working source at base commit `b4fafdce22269b30bfa19f59ea488297c7f59bde`. The source was not an archived release during this check. The [machine report](source-gates.json) and [331-file input inventory](source-inputs.json) are byte-identical copies of the runner outputs. Browser work is recorded separately in [source browser evidence](source-browser.md).

The run used Node.js 22.22.2, from 2026-09-12T15:08:49.511Z to 2026-09-12T15:10:35.619Z. Each command ran once in this successful attempt; npm test already discovers the motion, controller, practice and new First Flight suites. The root TAP report contains 1,521 tests including nested cases, with zero failures, cancellations, skips or todos. Focused development checks are not added again.

| Gate                                       | Result           | Duration | Evidence                                                                        |
| ------------------------------------------ | ---------------- | -------- | ------------------------------------------------------------------------------- |
| `npm test`                                 | Pass · 1521/1521 | 53.00 s  | [Raw log](../../../.cache/round-26/source-gates-restored/test.log)              |
| `npm run lint`                             | Pass             | 14.85 s  | [Raw log](../../../.cache/round-26/source-gates-restored/lint.log)              |
| `npm run format:check`                     | Pass             | 27.04 s  | [Raw log](../../../.cache/round-26/source-gates-restored/format.log)            |
| `npm run format:native:check`              | Pass             | 2.93 s   | [Raw log](../../../.cache/round-26/source-gates-restored/native-format.log)     |
| `npm run validate`                         | Pass             | 10.50 s  | [Raw log](../../../.cache/round-26/source-gates-restored/validate.log)          |
| `node --check authoring/motion-lab/app.js` | Pass             | 0.36 s   | [Raw log](../../../.cache/round-26/source-gates-restored/motion-lab-syntax.log) |

The validator reported v0.16.0, 127 runtime files, 12 base maps plus 17 expansion maps across six packs, four themes, seven classes and six effective optional goals. The three private First Flight lessons are not added to the campaign-map count. All 13 package, lockfile, build-config, app fallback and iOS marketing-version values match the validator. Ten navigation warnings remain in the [validation log](../../../.cache/round-26/source-gates-restored/validate.log): four existing authoring/release/native links and six source-relative landing links. The validator reported no invalid literal references; these warnings are not a browser or hosted-navigation pass.

## Stable source and preserved evidence

The before/after source inventory contains **331 files**, with identical aggregate SHA-256 `3343c7a0d7c7480b5046e53d9bdffafbbf0ebd8b1aedcbbd783a9e8dd392932f`. It includes the accepted deployment work at `d5c6909` and repair `b4fafdc`: the CLI, package scripts, ESLint configuration, `site/**` and Pages workflow are part of the audited tree. Untracked concept images under `docs/concepts/generated_images/` are excluded from this source-gate scope and were not changed. The six gates do not execute `build:pages`, publish a site or deploy a service.

Thirty-two existing core, content, replay-proof and fixture inputs also match the exact [v0.15 tested-source inventory](../round-25/source-inputs.json). The First Flight proof fixture is new; historical proof expectations were not regenerated.

After the incident described below, all **19 previous release trees** (2,054 files, 2,591,153,392 bytes) and **20 exact tag identities** match the [pre-incident baseline](../../../.cache/round-26/integrity/frozen-releases-before-v0160.json) before and after this run. Its SHA-256 remains `c4a89d3b4401ac7ec699f5d936e80de716d80a58bdab93173e1ec9a441be78ac`. The full preservation audit covers 3,340 files, including Round 25 reports/cache and the earlier Round 26 preflight directory; its aggregate is unchanged at `1a5ef2d360982ce18cd438e1a74a3556cb5772b90cfa26b0f111702cdb962ce7`.

## Earlier preflight interruption

The first prepared attempt stopped at the release-preservation check, **before any of the six gates launched**, reporting all 19 `source.tar` paths different from the pinned baseline. The concurrent deployment script was found to delete source archives from the repository release tree. Its owner removed that deletion in `b4fafdc` and restored the files from the tagged source.

The [preflight record](../../../.cache/round-26/source-gates/preflight-failure.json) and [independent follow-up hash check](../../../.cache/round-26/source-gates/archive-followup.json) remain separate. By that later existence check, all 19 archives were already present; every archive SHA-256 then matched the original baseline. The initial runner aborted before writing its full observed tree index, so the later record must not be described as a snapshot of missing files. This successful fresh run rechecked every release file and tag, not only the archives. It establishes exact restoration and stability during the new run, not uninterrupted preservation across the earlier deletion.

## Pins and limits

| File                                     |  Bytes | SHA-256                                                            |
| ---------------------------------------- | -----: | ------------------------------------------------------------------ |
| [source-gates.json](source-gates.json)   |  9,170 | `94b2f9f4b7a1626eb6cc1412e3055b8e214947ba42f150933533aff237dc17f9` |
| [source-inputs.json](source-inputs.json) | 56,291 | `4e84c90b037a4e647a9062301be9eb2012d4a89c21f92549d931324bb7a023d7` |

[Runner](../../../.cache/round-26/source-gates-restored/run-gates.mjs), [before-source index](../../../.cache/round-26/source-gates-restored/source-inputs-before.json), [after-preservation index](../../../.cache/round-26/source-gates-restored/prior-evidence-after.json) and [after-tag index](../../../.cache/round-26/source-gates-restored/tags-after.json) retain the raw audit trail. All outputs use new paths; earlier reports and failed-preflight records remain intact.

These checks establish automated source behavior, formatting, metadata consistency and file identity. They do not establish a new frozen archive, public hosting, physical touch/controller behavior, native runtime execution, accessibility across assistive technologies, comprehension or player enjoyment.
