# Pending original-art integration: Pages capacity forecast

This is a read-only forecast, not a built release or a failure of the accepted
v0.76.1 deployment. It does not allocate a version or authorize changing the
devicePR211 delivery priority.

## Evidence and conservative bound

The public v0.76.1 frozen manifest is864files /422,166,839bytes, SHA-256
`99cc9e2fba051bdd22820a9070498504152e6bfa5af652943a652bf04a01cdc3`.
The local registry at422f1587 contains77originals /194,153,784bytes.
Exactly42 match that manifest;35 pending originals add86,559,368bytes:
Fractured Grid, Phaseworks, Livewire Foundry, Relay Labyrinth and Crosswind Array.
These are source candidates, not already-published content.

The current `build-pages.mjs` copies the current playable site to both the root
and immutable release path. Root HTML is subsequently replaced with routing
pages, so simply doubling the entire manifest would overstate a strict bound.
Excluding HTML, service-worker.js, distribution.zip and its checksum leaves
421,416,844 published bytes whose duplicate copies remain under this packaging.

| Quantity | Bytes |
| --- | ---: |
| Preserved published non-HTML payload | 421,416,844 |
| Additional35 originals | 86,559,368 |
| Two-copy conservative forecast | 1,015,952,424 |
| Existing main Pages guard | 950,000,000 |
| Excess before other metadata/archive costs | 65,952,424 |

This conditional forecast assumes unchanged packaging and no accepted-baseline
asset removals. It is not an actual integrated build measurement. The code guard
is950,000,000bytes, stricter than the plan's historical950MiB shorthand.

## Required integration work

Preserve the guard and original source images. Coordinate packaging changes on
the accepted source after the device delivery; do not mutate historical editions,
delete assets or silently replace image revisions on this isolated branch.
Evaluate removing redundant mutable-root payload only with compatibility tests
for entry routing, old bookmarks, service-worker retirement, offline downloads
and current/previous playable releases. Any derived compressed asset must be a
new pinned revision with visual verification, never an overwrite of these pins.

Before promotion, measure the actual complete current/previous deployment,
run the existing guard and routing/offline/rollback tests, and verify the uploaded
inventory against its immutable manifest. Remaining Sentinel/Apex/Team originals
will add further bytes; this forecast does not include them.

## Follow-up measurement at e3897412

The registry now contains98originals /249,814,831bytes. Sentinel Crown (five),
Apex Aurora (five) and Team partners (eleven) add55,661,047bytes to the historical
forecast above. The existing Shared detour original is reused, not counted twice.
There are56 unpublished originals totaling142,220,415bytes. Applying exactly the
same preserved-baseline/two-copy assumption gives1,127,274,518bytes, exceeding
the unchanged950,000,000byte guard by177,274,518bytes before other costs.
This is still a conditional forecast, not an integrated build or current-release
failure. No originals were removed and no guard was changed.
