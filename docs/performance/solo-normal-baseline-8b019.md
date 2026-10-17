# Exact latest-main normal baseline producer

This prospective lane produces the normal distribution from main revision
`8b01991942dc764b8aa4726851699ce1985e53ae`, tree
`9373b6a74aea8fa1ef47aa17ace140b4cf714609`, for a future comparison with the
merged performance candidate. Those identities are fixed for this cohort even
if upstream main advances again. The historical `b117` packages, raw reports,
V1 ready/reuse records and completed workflows retain their original meanings.
No new package or comparison result exists until the remote producer completes.

The independent workflow `solo-remote-baseline-temporary.yml` has one PR 1544
synchronization edge from `1ccf8368a3dcd099e1608c8a9433e6f0c0518e8f`, with no
automatic retry. It checks out exact tooling and baseline separately, installs
locked dependencies under Node 22.13.1 on Ubuntu 24.04, and executes no browser,
candidate row or candidate artifact download. It can run alongside candidate
Appearance production. This is a source/package prerequisite, not performance
or physical-device qualification.

## Stages and boundaries

1. Verify both clean checkouts, the exact baseline tree, Linux/x64/Node runtime,
   frozen helper bytes, at least 12 GiB memory and 8 GiB free disk.
2. Use the existing process owner to run the baseline's own build command:
   `node baseline/scripts/game-cli.mjs build --out <fresh-build> --revision 8b01991942dc764b8aa4726851699ce1985e53ae`.
   The 1,200-second timeout, 6 GiB owned-process RSS and 4 MiB complete output
   limit remain. Alternate publication/build flags are rejected by proof validation.
3. Independently read every inner ZIP member with `solo-remote-archive.py inner`
   within 600 seconds. Preserve the existing 2 GiB ZIP/payload, 6,000-member,
   duplicate/path/symlink/encryption rejection and hash checks.
4. Run `verify-solo-build.mjs` against that payload and fresh exact baseline
   checkout, including normal manifest, source, static worker/dependency closure
   and content-security-policy checks, within 480 seconds.
5. Recheck both source identities and publish V2 positive readiness only after
   all three owned commands close successfully, with no forced cleanup,
   ambiguity, survivors or violations. Read back all package/proof bytes before
   the upload step independently repeats source-bound admission.

The producer helper is limited to 50 minutes; the outer termination wrapper is
52 minutes, its step 53 minutes and the whole job 100 minutes. The job bound
includes separately bounded checkout/install, proof-admission and both upload
paths; command deadlines are unchanged. Evidence is capped at 32 MiB with a
4 MiB final-metadata reserve. Setup logs are separately capped at 12 MiB; their
small retention receipt is uploaded alongside them. The ongoing disk floor is 1 GiB plus 4 MiB. A
resource stop yields a failed summary in the reserved space rather than
reasserting the failed reserve check before writing the failure. Existing logs
and command receipts remain intact. Every output is fresh and owned; no earlier
work directory or package is reused.

## New authority, preserved historical authority

`SoloHostedNormalBaselineReadyV2` and `SoloHostedNormalBaselineReuseV2` admit only
the exact `8b019` revision/tree and the new baseline producer workflow. V2 bundle
readback requires an explicitly supplied expected source/tree; it cannot trust
its own ready file as source authority. V1 remains restricted to `b117` and its
historical correctness/offline producer workflows. Tests reject cross-version,
cross-source, wrong-tree, wrong-producer and alternate-profile substitutions.

The successful package artifact is named
`solo-normal-baseline-8b019919-<run>-<attempt>` and contains exactly
`distribution.zip`, `manifest.json` and the six files beneath
`normal-baseline-proof/`: source proof, archive proof, complete command receipts,
environment/tooling identity, final positive ready marker and checksums. The
independent evidence artifact retains the whole bounded build log, all stage
logs/owner receipts, partial proofs, setup results and final failure or success,
using an unconditional upload step. Readiness does not imply a later consumer
or scenario passes.

After the producer finishes, retain and inspect the small evidence first. Bind
actual API run/artifact/attempt, outer byte count and SHA-256, inner byte count
and SHA-256, manifest SHA-256 and positive-ready bytes/SHA-256 into a new V2
consumer declaration. Each consumer must still download and read back the full
outer/inner package, recheck producer/run metadata and verify the source/CSP
against its own exact checkout. Failed/interrupted production without positive
proof cannot be substituted. A Main Pages package is not equivalent: that
workflow explicitly uses `--publication-profile main-pages` and deletes the
normal `distribution.zip` before publishing.

The new baseline package alone does not update existing fixed-source timing or
preflight adapters. A separately reviewed source-pair release must bind this
new baseline and the actual merged candidate package, with fresh equivalent
measurements and unchanged gates. Old `3ad`/`b117` diagnostics remain historical;
no old result is relabeled as latest-main evidence. Synthetic tests of this lane
use tiny local files; no local large archive, build or native browser is run.
