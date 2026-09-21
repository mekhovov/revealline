# Staged Team presentation ownership

`createOwnedCoopPresentation` owns the optional retained theme and decoded picture
as one selection. It preserves the existing `select`, `confirm`, `current`,
`cancel` and `dispose` interface. `confirm` returns the unchanged picture binding,
including its exact `snapshot`, for the painter. `snapshot`, `readAudio` and
`apply` expose only the accepted owner.

Supply current code-owned picture bindings/policy, the prepared page's
`getSnapshot` and picture reader, and an owned image decoder. Audio and DOM
application are optional. Omitted borrowed `apply` returns an idempotent no-op
cleanup because the page already owns its DOM style. Retained application uses the
retained lease's DOM owner. Apply only after the surrounding host accepts its
candidate; the wrapper does not change a painter, run or page automatically.

The page must already have a valid prepared snapshot. Matching current themes
borrow this snapshot and do not release the page's resources. Each reader and
confirmation continues to check the borrowed snapshot identity. A retry of the
same attempt must keep the exact pack, level, theme and authenticated artwork
owner; it returns the same decoded picture. A changed difficulty is the host's
fresh simulation choice, outside this lease.

An authenticated `.rlteam` envelope whose theme differs from the current page can
load only the explicitly shipped `fpv@38`, null-collection association. The code
pins `field-kit@38`, the exact runtime SHA-256 and its original picture bindings
and import policy. It builds catalogue coverage from the complete validated pack
and exact selected level, then stages `prepareVisualThemeLease` with a fresh host.
The host receives `retainedManifestSha256`, never an uploaded URL. Default host
transport reads the compiled `runtime.<sha256>.json` and its hash-addressed assets.
Injected factories are trusted application/test code, not imported configuration.

Even a matching fpv38 page tuple must have the exact legacy source and runtime
hash to be borrowed for a legacy receipt. Missing or mismatching retained bytes
fail visibly. An unknown receipt revision or collection cannot fall through to
the current theme. No receipt is rewritten, no old artwork is replaced, and
`createCoopPresentation` keeps all of its strict receipt, content, reserved-name,
asset and picture byte checks.

Each new request stages independent owners. The previous accepted selection
remains confirmable while preparation runs and after a failure or cancellation.
Cancellation means stop this selection's work; it does not discard the accepted
picture. A newer request invalidates pending work. Late theme loads and image
decoders release their resources exactly once. Once adopted, aborting the caller's
old preparation signal cannot close the accepted theme. `dispose` closes accepted
and pending owners, including registered DOM cleanup. Imported envelope owners
remain owned by the caller and are not disposed by this wrapper.

This module is a compatibility prerequisite. It does not integrate the live Team
host, publish retained manifests, prepare offline dependencies, adopt new default
artwork, alter saves, or grant public acceptance. The host must stage its run and
painter together with the binding, keep rollback ownership, and qualify import,
preview, Retry, Next, failure, cancellation and offline journeys.

Tests use real Team picture/envelope readers and the real theme lease/catalogue,
with modeled native image decoding and trusted mocked host transport. They prove
identity and ownership behavior, not browser decoding, physical-device behavior
or a public deployment. Read the pinned legacy runtime from current output only
while it has the exact old hash; after a default-theme update, test its retained
hash-addressed manifest instead.

Maintenance prompt: “Keep Team presentation receipts strict. Stage the exact
code-owned retained theme and authenticated original picture as one owner. Never
accept revision ranges or import-selected URLs. Preserve the previous accepted
owner through failed/cancelled/stale work; prove release counts, Retry identity,
late abort handling, reserved pack membership and unchanged envelope bytes. Apply
DOM/painter state only through the surrounding host's accepted transition.”
