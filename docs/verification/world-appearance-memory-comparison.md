# Worlds whole-file memory comparison

Status: review-only delivery prerequisite. No local or hosted diagnostic execution
has occurred. This is not a player feature, feature acceptance, or permission to
increase a memory budget.

The fixed comparison sources are compatibility head
a7c8be6ff7f4cf2ee0409edbab136e398f21c1c2 and readability head
2d15ac09834c762a543d5aa3edcb9114f6135b88. Their entire
game/test/fpv-world-appearance-ui.test.mjs file is identical:
c46411cfe70fad0a9a1e364645ef896dc5da74d4, 161945 bytes, 115 registered
cases including nested cases. The main World app, worker, two DOM/tool helpers,
and all four package/lock inputs are identical too.

Exact 2d15 failed the complete file at Node22.22.2, 1536MiB V8 heap,
2048MiB owned RSS, 180 seconds, serial tests and
--experimental-test-isolation=none. V8 aborted after 70 top-level successes,
without a whole-file TAP footer. Its 82.62-second child terminal, complete raw
streams and unchanged source/dependency proof remain historical failure evidence.

Both sources passed the whole file with Node20.19.6 and default isolation; the
a7 preview also passed its exact file within a 118-file Node22.13.1 preview.
Those launches recorded no explicit 1536MiB cap. Their default heap limits were
not measured. They are useful different-control observations, not the proposed
controlled baseline.

## Fixed diagnostic boundary

The two fresh hosted VMs run the exact whole file with identical Node22.22.2
binary identity, 1536MiB heap, 2048MiB owned RSS, 180-second child wall,
2GiB disk floor and complete bounded logs. No case filter, source change,
partition, GC option, assertion change or timeout increase is allowed.
Fail-fast is disabled so an OOM in either source does not suppress the other.

A sparse control checkout contains only these five reviewed control files.
The full target checkout is an exact immutable historical source. The adapter
fetches the already reviewed 2d15 guard and source auditor by fixed Git blob
identity, then imports only their stdlib definitions. The original 28-file
guard and workflow are not edited. Its existing process, subreaper, raw capture,
sealed child terminal, dependency scan and full source auditor are reused.
The adapter changes only the explicit diagnostic nine-owner and external-control
provenance boundary. It never pretends that a7 contains feature58 or feature60.

The fixed native command is:

    node --max-old-space-size=1536 --test --test-concurrency=1 \
      --experimental-test-isolation=none \
      game/test/fpv-world-appearance-ui.test.mjs

Before and after the whole file, all tracked source bytes/modes, Git metadata,
installed dependency content/metadata, immutable package inputs and exact Node
binary must match. Capture is retained before postflight. A failed test or OOM
does not become a pass because a source audit succeeds.

## Evidence and interpretation

Each matrix job remains failed when its native file fails, but always uploads its
bounded diagnostic receipt and raw streams. The final observer runs even when a
matrix job fails. It validates both immutable artifact names, API run/attempt/head,
archive digest, strict path/type/size/encryption rules, raw hashes, full argv,
source auditor links, control provenance and semantic dependency parity.
Unsafe archives are rejected before extraction; the observer reads ZIP members
without writing them into source.

The result states are WHOLE_FILE_SUCCESS, V8_OOM, FAILED_WHOLE_FILE or
FAILED_OR_INCOMPLETE.
The comparison's overall result is COMPARISON_RECORDED or COMPARISON_INCOMPLETE.
Neither means feature qualification. A baseline OOM excludes a feature-exclusive
failure under these exact controls, but does not establish a retention cause.
A baseline success alone does not prove a product regression.

The source has a concrete retention shape worth investigating later:
RegionalWorker.instances retains workers; each worker retains cloned messages.
Its terminate method disposes the simulation but does not clear that array or
message history. The World fixture also performs the actual app's owned async
teardown. No size or causal contribution has been measured. This proposal does
not fix or attribute that retention.

## Remaining gates

Root and independent source review, mocked evidence regressions, source statics,
strict new control publication/readback and sealed prelaunch approval are pending.
No workflow dispatch, native run, browser check, package build or device claim
comes from this source proposal. Existing red and green receipts remain bound to
their original exact source and launch controls.
