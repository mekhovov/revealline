# Round 30 — v0.21 source gates

**All six source gates passed**, including **1,831 / 1,831 tests**, against committed source `1250a8afdcf9594d87ed6a79ba29639d1225fa69`. The run and preservation audit span **2026-09-12 19:53:54–19:54:47 UTC**, using **Node.js 22.22.2**. All **371 checked inputs** matched that commit and remained unchanged, as did HEAD and the runner.

The [machine report](v021-source-gates.json) and [source inventory](v021-source-inputs.json) are byte-exact copies of the original [cache report](../../../.cache/round-30/v021-source-gates/source-gates.json) and [cache inventory](../../../.cache/round-30/v021-source-gates/source-inputs.json). This note was staged outside source after the run; no gate was repeated.

| Gate                     | Command after `mise exec node@22.22.2 --`  | Result               | Raw log                                                                       |
| ------------------------ | ------------------------------------------ | -------------------- | ----------------------------------------------------------------------------- |
| Tests                    | `npm test`                                 | 1,831 passed; exit 0 | [Tests](../../../.cache/round-30/v021-source-gates/test.log)                  |
| Lint                     | `npm run lint`                             | Exit 0               | [Lint](../../../.cache/round-30/v021-source-gates/lint.log)                   |
| Source formatting        | `npm run format:check`                     | Exit 0               | [Format](../../../.cache/round-30/v021-source-gates/format.log)               |
| Native source formatting | `npm run format:native:check`              | Exit 0               | [Native format](../../../.cache/round-30/v021-source-gates/native-format.log) |
| Validation               | `npm run validate`                         | Exit 0               | [Validation](../../../.cache/round-30/v021-source-gates/validate.log)         |
| Motion Lab syntax        | `node --check authoring/motion-lab/app.js` | Exit 0               | [Syntax](../../../.cache/round-30/v021-source-gates/motion-lab-syntax.log)    |

Each command ran once. Final TAP reports **zero failures, cancellations, skips or todos**, meeting the 1,831 minimum. The **148 new cases** are included in that total alongside the prior 1,683; the scoped component batches are not added again. Separate source evidence covers [library/backup/gallery](gentle-library-gallery.md), [host/browser observations](gentle-host-browser.md), and [58 legal routes](gentle-routes.md).

Validation reports `0.21.0`, **137 collected build inputs**, valid literal imports/resources, **12 base maps plus 17 expansion maps across six packs**, four themes, seven classes and six pack goals. It also retains **22 nonfatal navigation warnings** for anchor links, including source-only authoring/docs/release navigation and source landing-page relative links. The validator reports these separately from missing literal resources; the command passed. This does not establish that every navigation destination works in a packaged browser.

## Exact source and version scope

The reviewed merged Gentle implementation is `68487e05b76c30b7939b83758357ceeb08007e56`. Its only checked-input differences from the tested commit are **13 owned release-version fields across nine files**, all `0.20.0` → `0.21.0`. No additional game README delta occurred. Comparison uses exact JSON version tokens, the app fallback assignment and two iOS marketing-version assignments with explicit occurrence counts. All **200 `engines` objects** in the six package/lock documents were independently compared between these commits and remain unchanged, including Node requirements such as `^20.19.0`.

The [reference](../../../.cache/round-30/v021-source-gates/reviewed-implementation-inputs.json), [committed](../../../.cache/round-30/v021-source-gates/committed-source-inputs.json), [before](../../../.cache/round-30/v021-source-gates/source-inputs-before.json) and final inventories retain the comparison. Before, after and committed inventories have identical bytes. Their input aggregate is **`b550f49f3b8bce415b2f9228acd29f90b3980f007550860ef79b6a329e9a85b3`**.

The executed [runner](../../../.cache/round-30/v021-source-gates/run-gates.mjs) is **24,681 bytes**, SHA-256 **`d9b6535742b63dc7686284f4e1e7f964736a7e532b4dd28fc87c4d288f0ad03a`**. It checks explicit implementation/source ancestry, committed input equality, all required Gentle modules/proofs/tests, actual final TAP counters, version values and before/after preservation. Discovery covers game, scripts, site, workflows, native sources/metadata, Motion Lab, authoring-library inputs and tooling configuration, including consumed ignored files. Dependencies, generated native staging and unrelated external untracked concept images are excluded.

## Preserved evidence and limits

All **25 earlier release trees / 2,928 files / 3,818,769,268 bytes** and **26 exact tag identities** match the [prepared baseline](../../../.cache/round-30/v021-preservation/before.json), SHA-256 **`8dfbbf2feb8f9e5fb7896362554f2bd51ae298b3931a7c0667095abbbed392f2`**. Its **603 protected records**, including **416 verification artifacts** and eleven original proof/fixture files, also match. The wider **4,830-file** preservation audit stayed unchanged at aggregate **`614b84ec1b8c94622154e10c121c4cb006e1a96ecbb31c9b1b8f31b5fbac148e`**. The [before](../../../.cache/round-30/v021-source-gates/prior-evidence-before.json), [after](../../../.cache/round-30/v021-source-gates/prior-evidence-after.json) and [tag](../../../.cache/round-30/v021-source-gates/tags-after.json) records remain intact.

Report preparation independently rehashed all **16 referenced runner/log/index/baseline files**, checked **six inventory aggregates**, read final TAP counters and verified the nine-file metadata comparison. Only new cache-staged documentation and exact machine-record copies were written. No tests, runtime edits, old-evidence changes, release writes or commits were performed for this note.

Candidate building is separate. The ordinary CLI consumes working files, so a build claiming this revision needs another exact source comparison before and after it. Packaged browser/offline acceptance and an independent frozen archive rebuild require their own evidence. These source gates do not establish a public release, physical-controller accessibility or a native-runtime pass.

Machine report: **13,996 bytes**, SHA-256 **`e963d0c543f2b52c86920cbcafce78b6a2a4ff49693db70b6222d23cb39e2031`**. Source inventory: **63,220 bytes**, SHA-256 **`166d07aac7f3a0123ca4cc735c48fa747faaeaacce0ed7085d6e200f40c35762`**.
