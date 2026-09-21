# Stale backup export hides a newer storage warning

Independent review of the pending Restore-focus packet reproduces a separate
feedback race on Node20.19.5 and22.22.2. Inspect a valid backup, start an Export with
delayed completion, then Restore the inspected backup while persistence refuses.
Restore truthfully reports session-only progress. Completing the older Export then
replaces that warning with success, even though its snapshot predates the restored
records. In-memory progress remains present; the failure is misleading recovery
feedback, not evidence of corrupt progress or loss of an existing saved flight.

One selected probe fails on each runtime against the actual candidate UI and
Journey store; only the injected exporter and finite storage refusal are controlled.
Node20 reports26 unselected tests as skipped. No complete-file failure or native
browser/device failure is inferred. The probe and original logs remain at
`.cache/shared-device-r1/backup-export-review` in the root workspace. Retained TAP
normalizes trailing whitespace; both original and retained hashes are recorded.

The existing UX owner has the reproducer and owns the correction. The Restore-focus
packet is not sufficient alone for acceptance. Newer actions/snapshots must own
feedback independently of persistence and older export completion. Cover failure
as well as success and the inverse pending-Restore/newer-Export order. Never cancel
accepted progress writes merely to silence stale UI feedback.
