# Frozen FPV runtime observation

`scripts/observe-fpv-runtime.mjs` records one bounded software observation of an
already frozen civilian FPV package. It admits the original runtime and source
artifacts, mounts unchanged runtime modules in a separately recorded observation
document, and checks scene/reset lifecycle, viewport bounds and context loss. It
also records one eight-second demonstrated-flight pacing sample.

Create a plan beside an already downloaded optional bundle:

```json
{
  "format": "revealline-fpv-runtime-plan.v1",
  "caseId": "candidate-runtime-observation",
  "protocol": "civilian-fpv-runtime.v1",
  "deviceLabel": "Record the actual computer and operating system",
  "quietWindow": "Record known concurrent work; do not claim complete machine isolation",
  "bundle": "./optional-flight",
  "envelopeSha256": "EXACT_SHA256_OF_OPTIONAL_PACKAGES_JSON",
  "sourceRevision": "EXACT_40_CHARACTER_SOURCE_COMMIT",
  "sourceTree": "EXACT_40_CHARACTER_SOURCE_TREE",
  "packageRevision": "EXACT_CIVILIAN_FPV_REVISION_FROM_ENVELOPE"
}
```

Replace the placeholders with independently selected exact identities. The bundle
path is relative to the plan; mutable source trees, URL downloads, unbound standalone
ZIPs and guessed release identities are not accepted inputs. When using a GitHub CI
artifact, separately verify its outer archive digest and record its run/source
binding before using the extracted bundle. This observer verifies the inner frozen
artifact envelope, not the authenticity of an external release or tag.

```sh
node scripts/observe-fpv-runtime.mjs runtime-plan.json /absolute/path/to/playwright/index.mjs /absolute/path/to/new-evidence-directory
```

The output directory must not exist. Playwright and Chrome are externally supplied
validation tools; this command does not install them or add them to the game.

The shared loader reuses `validateOptionalPackageAdmission`: every envelope member,
distribution/source archive, source inventory, vendor pin and generated dependency
must pass existing checks and unchanged budgets. Only the selected FPV runtime is
extracted. Every original member, including `optional-package.json`, is fetched from
the temporary server and checked for exact byte length and SHA-256 before measuring.
The original HTML is preserved; a separate document/wrapper mounts those modules
and exposes the app's resource, snapshot and disposal APIs. Plan data cannot supply
an arbitrary driver script. Instrumentation is hashed separately from runtime.

The procedure runs twenty course/reset cycles, returns to the initial course and
compares registered resource counts. It records the canvas and page bounds at
1440 × 900, 390 × 844, 844 × 390 and 768 × 1024. It then observes the final-circuit
demonstration at 1440 × 900, retaining interval summaries and long-task entries.
Finally, it resets, arms ordinary practice and loses the actual WebGL context,
checking that the active model becomes paused and its tick count stays unchanged.
It disposes the app and records registered resources and actual context loss.

`observation.json` preserves the exact plan, frozen envelope/source/package/member
bindings, admission result, served-member pins, observer and admission-authority
copies, separate host/wrapper pins, Playwright entry-module hash, browser version and
server headers. Headers are the existing packaged-preview policy, including its
permitted soundtrack origins. The host is not a deployed origin or installed PWA.

The runtime procedure has a three-minute overall deadline, in addition to bounded
page actions, frame sampling and mount waits. A stalled evaluation therefore fails
the procedure and proceeds to cleanup. Failures retain an error and cleanup outcomes. Each owned cleanup is attempted;
cleanup waits have ten-second deadlines and the preview server closes its active
connections. A browser-close timeout records failed cleanup rather than claiming
process termination. `completed` and `passed` require the full procedure, no page
errors and successful cleanup. Existing evidence is never overwritten.

Every report keeps `qualification: false` and `qualified: false`. A successful
procedure does not establish a five-percent regression target, input-to-photon
latency, full heap retention, exclusive reward costs, physical radio compatibility
or learning transfer. Those need their own evidence. Pacing comparisons require
matched source bindings, device/browser, procedure and instrumentation conditions;
one baseline sample is not a comparison. Retained heaps use the
[separate forced-GC procedure](fpv-retention-observer.md).

The older positional command that compiled development source is intentionally
replaced by the explicit plan and new output directory. Earlier reports keep their
historical development-package scope. New report format `FlightRuntimeObservation.v2`
identifies the frozen-source contract. Authored checks are in
`scripts/test-fpv-observation-artifact.mjs`; execution follows the existing explicit
automated-suite policy.
