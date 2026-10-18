# Final-source recovery and overhead declarations

Three separate temporary workflows bind the independently verified [a6 production package](solo-artifact-a6eacee2.md). They release only on the next same-repository PR #1544 synchronization whose previous head is `a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4`. They do not repeat automatically, cancel other runs, deploy, merge, or declare performance success.

| Lane                      | Declared observations                                           | Preserved scope                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recovery                  | Six candidate observations: Chromium/WebKit × three repetitions | Existing injected recovery events, actual viewport resizing, explicit Resume and strict replay. Native background suspension remains separate.                    |
| Application diagnostics   | Two engines × ten counterbalanced pairs, 40 fresh arms          | Existing 30-second route, seed 1544, CPU 1 and 5% uncertainty-aware overhead gate.                                                                                |
| Synchronous journal hooks | Two engines × ten counterbalanced pairs, 40 fresh arms          | Matched hooks on/off with the exact cold recipe. Browser delivery, journal construction, GPU work and full instrumentation overhead are outside this measurement. |

The historical first-eight pass prerequisite remains false and all three lanes remain excluded from gameplay performance qualification. Recovery reuses normal-main8b package authority without running a baseline recovery arm. Overhead lanes compare the same candidate with instrumentation off/on; their baseline source field is descriptive and does not cause baseline artifact acquisition or a baseline observation.

Tool checkouts contain the explicitly audited static/dynamic source and test/data dependencies. Game-source checkouts remain complete. Recovery retains 107 minutes for the outer job, including the two explicitly added source-checkout minutes; its 60-minute helper, 420-second row and all cleanup/upload limits remain unchanged. Each overhead job retains 130 minutes, with 128 minutes of declared maximum steps and two minutes of additional reserve. Native observation bounds and evidence caps are unchanged. No baseline dependency installation is needed for these candidate-only lanes.

## Verification before publication

Actual manifests independently match source/tree/runtime, successful producer `39008793814`, artifact `12092903788`, both archive identities and the baseline authority where used. Every frozen helper, adapter and recipe was rehashed. All three declaration CLIs and all ten resulting job bindings passed from their isolated declaration copies. Twelve source/tree/runtime/prerequisite mutation controls reject altered plans; workflow controls retain exact one-shot guards, full source checkouts, ownership cleanup, partial evidence and fixed observation limits.

The complete isolated tooling groups passed recovery **103 + 4 platform skips**, application diagnostics **78 + 4**, and journal hooks **134 + 4**. Skips are the declared Linux process controls on the local macOS host; those complete test files run on the Linux jobs. No browser is launched by these local controls. Formatting checks cover all six actual plan/workflow files.

Receipts are retained under `.cache/solo-followup/final-wave-a6e/`: `root-release-checks.json`, `root-workflow-checks.json`, `root-isolated-declaration-checks.json` and `workflow-templates/closure-final-readback.json`, with the later journal refresh at `16708351b` and its exact raw output. Earlier cache declarations and metadata-reader failure remain retained. Browser results, including setup failures and partial observations, must be collected and evaluated separately after publication.
