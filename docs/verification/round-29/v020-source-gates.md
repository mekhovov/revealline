# Round 29 — v0.20 source gates

**All six source gates passed**, including **1,683 / 1,683 tests**, against committed source `a9578e0aecacf8d78fbc097406f5f603f5de41cc`. The run and final audit span **2026-09-12 18:54:25–18:55:15 UTC**, using **Node.js 22.22.2**. All **354 checked inputs** matched that commit and remained unchanged, as did HEAD and the runner.

The [machine report](v020-source-gates.json) and [source inventory](v020-source-inputs.json) are byte-exact copies of the original [cache report](../../../.cache/round-29/v020-source-gates/source-gates.json) and [cache inventory](../../../.cache/round-29/v020-source-gates/source-inputs.json). This publication adds documentation after the completed run; no gate was repeated.

| Gate                     | Command after `mise exec node@22.22.2 --`  | Result               | Raw log                                                                       |
| ------------------------ | ------------------------------------------ | -------------------- | ----------------------------------------------------------------------------- |
| Tests                    | `npm test`                                 | 1,683 passed; exit 0 | [Tests](../../../.cache/round-29/v020-source-gates/test.log)                  |
| Lint                     | `npm run lint`                             | Exit 0               | [Lint](../../../.cache/round-29/v020-source-gates/lint.log)                   |
| Source formatting        | `npm run format:check`                     | Exit 0               | [Format](../../../.cache/round-29/v020-source-gates/format.log)               |
| Native source formatting | `npm run format:native:check`              | Exit 0               | [Native format](../../../.cache/round-29/v020-source-gates/native-format.log) |
| Validation               | `npm run validate`                         | Exit 0               | [Validation](../../../.cache/round-29/v020-source-gates/validate.log)         |
| Motion Lab syntax        | `node --check authoring/motion-lab/app.js` | Exit 0               | [Syntax](../../../.cache/round-29/v020-source-gates/motion-lab-syntax.log)    |

Each command ran once. The completed TAP output reports **zero failures, cancellations, skipped cases or todo cases** and meets the 1,683 minimum. The [16 new couch-navigation tests](couch-source.md) are included in this total, not added again. The [native source-browser observations](couch-browser.md) have a separate scope.

Validation reports `0.20.0`, 131 collected build inputs, valid literal references, **12 base maps plus 17 expansion maps across six packs**, four themes, seven classes and six pack goals. Its 22 nonfatal navigation warnings remain in the raw report; this is not a claim that all built-page links were exercised in a browser.

## Source identity and preparation correction

Relative to reviewed couch implementation `4eb71551dee4ff72f08100ade4613ec29c31115c`, the checked runtime delta is **13 owned release-version fields across nine files**, all `0.19.0` → `0.20.0`; the only additional checked change is `game/README.md` prose. The [reference inventory](../../../.cache/round-29/v020-source-gates/reviewed-implementation-inputs.json) and [committed inventory](../../../.cache/round-29/v020-source-gates/committed-source-inputs.json) retain that comparison.

Before any gate ran or the release-metadata commit was made, review caught an overly broad substring replacement that could also change a dependency's Node requirement such as `^20.19.0`. Preparation was corrected to match only exact JSON version tokens, the app fallback assignment and the two iOS marketing-version assignments, with explicit occurrence counts. The [original unexecuted runner](../../../.cache/round-29/v020-runner-preflight-original.mjs) is preserved at SHA-256 `aa76df67cbf8bf77bce66556a1d50dbc1f07880ce59a6c5372f320d19bde928b`. This was a preparation correction, not a failed or discarded six-gate run. All **200 `engines` objects** in the six package/lock documents were independently compared between the implementation and tested commits and are unchanged.

The executed [final runner](../../../.cache/round-29/v020-source-gates/run-gates.mjs) is **22,023 bytes**, SHA-256 `acdbe62a5ccfd5ce88ffd2f797b692c3d82d2f2c95989016c2140ea4753ca43a`. Its before/after input aggregate is **`f5d5bab1b777a2e55ec6b47b184b8e1ea849e451c0ba249708b2358aa57a875e`**. The before, after and committed inventory files have identical bytes. Checked scope includes game, scripts, site, workflows, native sources/metadata, Motion Lab, authoring-library inputs and tooling configuration; discovery includes actual consumed directories alongside Git's file list. Dependencies and generated native staging are excluded.

## Preservation and publication boundary

All **24 earlier release trees / 2,780 files / 3,605,305,379 bytes** and **25 exact tag identities** match the [prepared baseline](../../../.cache/round-29/preservation/before.json), SHA-256 `87617d0cc5a59a660d5c9069cfd5becdc8953dba7417910dc6d72ffa776ce08b`. Its 490 protected evidence files, including 407 verification artifacts, also match. The wider **4,567-file** before/after preservation audit stayed unchanged at aggregate **`aa1d94a76ca2ff42f1e2271f215430f21cd1a4dbcfc808c0047aa94e231f76e6`**. The [before](../../../.cache/round-29/v020-source-gates/prior-evidence-before.json), [after](../../../.cache/round-29/v020-source-gates/prior-evidence-after.json) and [tag](../../../.cache/round-29/v020-source-gates/tags-after.json) records remain intact.

Publication independently rehashed all 16 referenced runner, log, index and baseline files, checked five inventory aggregates and read the final TAP counters. No tests, source edits, old-report rewrites, release writes or commits were performed for this publication.

The candidate build is a separate operation under a new output path. The ordinary CLI reads working files, so its inputs must still match this tested inventory before and after building when claiming the same committed revision. Packaged browser/offline acceptance and any later frozen archive rebuild require separate evidence; these gates do not establish a public release or hardware/native-runtime pass.

Published report JSON: **12,934 bytes**, SHA-256 **`a57c0352abef6c0315e4c85556eb3c48d512adbf89dd598b7ef7c4b652023f1d`**. Published input JSON: **60,337 bytes**, SHA-256 **`e8ba0170eb8e8e4bd461f056799f109b18abdd61bb91ef70a523192a8decdea7`**.
