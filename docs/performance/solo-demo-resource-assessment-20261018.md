# Demo resource assessment and held repeat-cycle proposal

The manual Solo export already reports `resources.demo`, but the existing offline
resource assessor did not inspect it. The Demo recovery probe also retains only
quality/calibration from a paused export. Consequently neither an old resource
assessment nor an unchanged recovery run establishes the new Demo owner counts.
This change closes the pure assessment gap only. No application, probe, workflow
or native observation changes here.

Call the existing `assessSoloOwnedResources` with an explicit option:

```js
{
  group: 'demo-closed',
  last: 10,
  demo: {
    format: 'DemoOwnedResourcesV1',
    sourceRevision: verifiedReportSourceRevision,
  },
}
```

The caller must first verify the report/chunks, package and exact source through
the existing admission/readback. The option is an assertion of the reviewed
source/schema contract, not an authentication mechanism or a new source
allowlist. A missing or different report source and an unsupported schema reject
the call. The result records the requested contract. With no option, the previous
output and historical behavior are unchanged. Opting in to a report without Demo
fields records unknown values; it does not manufacture a never-created owner.

The assessment checks the persistent display, live painter category sums and
retained pixel buffers, transition canvas, reward poster and media owner, observed
Worker handles, and outstanding source/scene/reward preparations. All observations
are checked, including failed boundaries before the final comparable window.
Worker creation and termination-request counters are cumulative; a successful
`terminate()` call does not prove native thread exit. An explicit absent reward
presentation establishes only absence of that JavaScript owner. Native decoded
bytes remain unknown.

Painter indexes are not stable identities. Their individually checked canvas
counts/estimates are aggregated into Demo-only trend fields; the assessor does not
compare index zero across different scenes. Per-painter legacy/enemy pool reports
are replicas of page pools and must match their existing page observations. They
are never summed. Demo image categories overlap; the observed union must be at
least each category and no larger than their sum, but is not added to Solo or
other image pools. Dimensions remain RGBA8 estimates, not measured native memory.

A closed Demo may retain its display canvas and canceled work that has not
settled. Positive reservations stay positive in the pending series. An active
Demo export must be paused/suspended and have settled its scene preparation, as
required by the existing application boundary. No memory tolerance, native limit,
plateau pass or leak verdict is introduced. The existing 512-snapshot input cap
remains. At most 64 painter records per snapshot are inspected; exceeding this
additional evidence-processing cap rejects the evidence, not the application.

## Source controls

The complete assessor and snapshot-store files pass **72/72** on Node 20.19.5.
The assessor now has 26 controls. The first six new controls fail against the old
assessor (18 pass/6 fail), with that output retained. Tests execute the actual
Demo manual snapshot function against explicit modeled owners, including ten
close/reopen cycles, persistent display, shared image identity, canceled work,
worker accounting, reward command ownership, malformed/missing counters,
source/schema mismatch, earlier breaches and arithmetic overflow. These are
source/model checks, not native observations.

Raw controls are retained in
`.cache/solo-followup/demo-resource-assessment-56e/`: `before.tap`,
`after-v1.tap`, and `after-v2-complete.tap` with its compact receipt.

## Held native coverage proposal

This is a proposal for the existing remote Demo entrypoint. It is **not executable
or released**: final package/source/tooling references, exact public action fixture,
independent owner readback, and release admission still need review. No additional
workflow is proposed.

1. Retain `resources.demo` from the existing public paused export in the Demo
   probe/report. Passive active-state observations continue to omit diagnostics;
   never call export during advancing spectator or practice play. Preserve the
   raw export and source-bound readback before passing a derived resource report
   to this assessor.
2. Declare separate spectator and practice repeat-cycle arms. In each, use the
   visible public controls to open, reach actual play, explicitly Pause, export,
   close, and export. Repeat ten times. Preserve the ordinary run/checkpoint and
   storage state, and retain strict replay for the observed Demo/practice run.
   Group paused and closed boundaries separately; do not combine different
   viewport, quality, source, or mode cohorts into a plateau.
3. Keep the existing 360-second observation, 120-second replay and 660-second row
   limits and 64-snapshot report cap. Ten paused/closed pairs plus initial/final
   snapshots fit that cap. If an acquisition remains pending on close, retain
   that positive state and observe settlement only within the original deadline.
   A deadline or failure remains a failure; no extra dwell or renewed timeout.
4. Reuse the existing four declared display/owned-layer context-loss recovery
   arms separately. Their unchanged actions prove recovery behavior, not ten
   comparable close/reopen cycles. A failing arm cannot be erased by the repeat
   cohort, and the repeat cohort does not supply active timing or device memory.

The observed closed Worker handles/scenes/painters and eventual pending counts
should be reviewed against their source ownership. The persistent display is
expected to remain. Rising cumulative Worker creations alone are not retained
workers; flat owner values alone do not qualify native memory. This work does not
replace the final-source 20-Retry, 10-Next or 30-minute lifecycle obligations.
