# Round 27 — initial source gates

**The initial attempt did not pass all gates.** All **1,550 unique tests passed**, as did lint, native formatting, content validation and motion-lab syntax. The sole failure was project formatting for the generated [Equipment Workshop pack](../../../game/content/packs/equipment-workshop.json). No source was changed during this run.

The [machine report](source-gates-initial.json) and [343-file inventory](source-inputs-initial.json) are exact copies of the initial cache output. This v0.17.0 working-source run used Node.js 22.22.2 at base commit `dab6941e37de911fb43ae857e1b66ab501c171f0`, from 2026-09-12T16:02:48.730Z to 2026-09-12T16:03:25.692Z. Each of the six commands ran once; the previously focused tests are included in the full count and are not added again. All test failure, cancellation, skip and todo counts were zero.

| Gate                                       | Result           | Duration | Evidence                                                               |
| ------------------------------------------ | ---------------- | -------- | ---------------------------------------------------------------------- |
| `npm test`                                 | Pass · 1550/1550 | 27.57 s  | [Raw log](../../../.cache/round-27/source-gates/test.log)              |
| `npm run lint`                             | Pass             | 4.58 s   | [Raw log](../../../.cache/round-27/source-gates/lint.log)              |
| `npm run format:check`                     | **Fail**         | 7.21 s   | [Raw log](../../../.cache/round-27/source-gates/format.log)            |
| `npm run format:native:check`              | Pass             | 1.08 s   | [Raw log](../../../.cache/round-27/source-gates/native-format.log)     |
| `npm run validate`                         | Pass             | 5.45 s   | [Raw log](../../../.cache/round-27/source-gates/validate.log)          |
| `node --check authoring/motion-lab/app.js` | Pass             | 0.03 s   | [Raw log](../../../.cache/round-27/source-gates/motion-lab-syntax.log) |

The formatter named only `game/content/packs/equipment-workshop.json`. Its builder writes standard indented JSON and already accepts equivalent JSON formatting in its read-only check. A [calculated formatting proposal](../../../.cache/round-27/source-gates/workshop-format-proposal.json) preserves the exact parsed data and all three embedded image strings, while reducing 11,127,186 bytes to 11,127,024 bytes. This initial report records the failure; it does not claim that the proposed repair has been applied or verified.

## Source and preservation

The before/after source aggregate is identical: `4a14c2439fe04b253374c43016e71d6ac83253403499fa7d4396b8c683c8da7f` across **343 inputs**. Coverage includes game, scripts, native scaffolds, source authoring/library material and the accepted deployment landing/workflow files. The gates do not run `build:pages` or publish anything. External concept images under `docs/concepts/generated_images/` are excluded.

All **13 version values** match the validator's v0.17.0. Validation reported 127 runtime files, 12 base maps plus 17 expansion maps across six packs, seven classes, four themes and six effective optional goals; the three optional First Flight lessons remain separate. Its 21 navigation-warning entries are retained in the raw log; literal references passed. This is not a hosted-navigation result.

All **20 earlier release trees** (2,198 files, 2,753,850,005 bytes) and **21 exact tag identities** matched the original Round27 baseline before and after. The baseline SHA-256 remains `70c383948cee601f25f7966f8bf6ac55583512c987ff932cde3078e5a3234715`. The complete preservation inventory covered **3,742 files**, with unchanged aggregate `49ba5077a374e0a5750a180592d460c48828918e15a86d35cd76168e02db56a1`, including Round26 reports/cache and Round27 focused-development evidence. The 32 protected legacy core/content/proof/fixture inputs and 19 separately pinned original art/proof/baseline entries remained exact. The Workshop pack's nonvisual data matches the retained procedural edition.

## Pins and scope

| File                                                     | Bytes | SHA-256                                                            |
| -------------------------------------------------------- | ----: | ------------------------------------------------------------------ |
| [source-gates-initial.json](source-gates-initial.json)   |  9800 | `c97259f4ee018ce9bef8494743a633a97b4f86b8b0fefc668fec4ef870a8a5cb` |
| [source-inputs-initial.json](source-inputs-initial.json) | 58536 | `04a680c43bf96180f9f1a58cd45c190059bafdab77def2e4eed64cc284487796` |

The [runner](../../../.cache/round-27/source-gates/run-gates.mjs), [before-source index](../../../.cache/round-27/source-gates/source-inputs-before.json), [after-preservation index](../../../.cache/round-27/source-gates/prior-evidence-after.json) and [after-tag index](../../../.cache/round-27/source-gates/tags-after.json) preserve the raw audit trail. Later corrections must use separate evidence and retain this initial attempt. These automated checks do not establish a frozen archive, browser rendering, physical controller/touch behavior, native execution or public hosting.
