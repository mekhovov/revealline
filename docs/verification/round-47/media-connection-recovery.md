# Managed media connection recovery

Recorded 2026-09-14. Commit `adf48522aaae5a9dc630aec2ff1934c0810f95c5`
closes the cached-connection defect in source. v0.37 still needs a new complete
exact-source qualification; it is neither frozen nor deployed.

## Observed failure and bounded fix

After a long idle in the unpatched numeric `0.37.0` preview at runtime
`a7d1e48bd78af21ddd69d82c049311d34830346d`, the inland exchange yard stayed
paused with “The database connection is closing.” An explicit Retry picture
repeated the error. Source review confirmed that the managed store could retain
a closed connection: neither an unexpected close nor a synchronous
`InvalidStateError` at transaction creation invalidated that cached handle.

The [manager](../../../game/managed-media-store.mjs) now discards only the closing
handle it still owns. Both transaction-creation paths use the same wrapper and
preserve the original error; the next deliberate operation can reconnect. A late
close or versionchange from an older handle cannot clear a newer connection.
Explicit manager close remains terminal. No mutation is automatically replayed;
abort, quota and already-started transaction outcomes retain their existing
behavior. Database versions, originals, saved/earned pins and storage caps stay
unchanged. MDN distinguishes [unexpected close events](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/close_event)
from normal close and documents [the transaction exception](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction#exceptions).

The [13 focused cases](../../../game/test/managed-media-connection.test.mjs)
pass on Node 20; all 128 affected cases pass on Node 22, with scoped lint and
format checks. Against the exact old manager, the same focused suite passes five
cases and fails eight closing/reopening cases. These are meaningful modeled
regressions, not an injected browser reproduction. Root interrupted the earlier
`2ede389b0d37` source run after 1,219 partial passes and no reported test failures;
it has no final totals, and the other five gates never started. It is not a pass.

## Separate missing-original recovery

Normal reload retained saved-flight and Collection metadata but showed zero
installed packs. The reason for the observed absence of chapter data remains
unproven; reopening a connection does not reconstruct missing pack rows or
original bytes.

Still on the unpatched preview, root explicitly reinstalled the matching Spend
Network pair shown as 7.1 MiB. Continue recovered the paused flight at
24.9% / 6,200 / three lives / 2:54. Subsequent native play earned Gold in the yard
at 50.4% / 12,040 / three lives and in the final hall at 100% / 23,620 / three lives.
These results establish bounded recovery and gameplay before the patch, not a
patched long-idle browser check or a resolved storage-loss cause. In that browser
journey no database failure was injected. No cold/offline, physical-device or
public acceptance is claimed here.

Later explicit Ukraine Atlas and 1994 Forever reinstalls made all five existing
Collection entries available, with three chapter-progress choices. Root inspected
the settled old earned pictures without earning them again: Ukraine retained
14,900 points / 9.86 s and Retro 10,850 points / 23.34 s. Snapshots 18 and 19 show
the rendered pictures; snapshot 17 remains an earlier loading capture. Together
with the previous opening checks, five of nine themed missions have actual native
wins. This supplement uses the same unpatched runtime and does not extend the
patch's browser qualification.

Evidence is retained in the original checkout under
`.cache/round47/media-connection-recovery`: scoped verification
`708b86b57693690862c4d8790a39927b81161d92b85032798868f688660b80dc`
and independent peer
`730ba035d8589e82835d910ef5a557663e7887d2e343459bbd3c309ba4521575`.
The interrupted-run receipt is
`.cache/round47/v037-source-qualification-preparation/bound-2ede389b0d37/root-interrupted-receipt.json`
(`9bf50a36b0f0e977bcf6384c746bebf9219a69e35078cdeee6ef9e75351ccb5c`).
Native snapshots and screenshots are bound by the 28-file receipt
`.cache/round47/v037-extended-native/receipt.json`
(`7f65322ef1fc403c4a6006c56735ed36c44256c7f3d930ece24201b56d0bb3c5`).
