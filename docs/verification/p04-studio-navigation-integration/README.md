# Studio navigation integration

Held source integration on `9076ada1`; no public release or full P04 acceptance.

Workspace mutations retain owned keyboard focus, choosing a usable Undo/Redo successor or selected visible inventory row/Search when the opener disappears. Obsolete, detached or background operations cannot reclaim focus. The current browser history entry preserves bounded inventory filters and selected slot. Cold Back restores the view; BFCache preserves the live workspace. Skip inventory focuses the inspector without adding a fragment history entry. Originals, workspace saving, player data and operation ownership remain separate.

All 41 unique scoped ordinary-source cases passed on both Node 20.19.5 and 22.22.2 across the retained initial 40/41 runs and affected 1/1 reruns. The original failure was an omitted tracked raster in the sparse checkout; restoring exact compiled assets resolved it without code/test changes. Do not describe this as one clean 41-case run. Lint, formatting and whitespace checks passed.

The actual in-app browser verified a reversible theme edit, final Undo/Redo focus, the shipped Skip link, next Tab, Return to game and cold Back with query/selection/count restored. No console warnings/errors. Native request logs have an incorrect override boolean; receipts explicitly identify the four working runtime modules and their hashes. Remaining responses used exact base Git objects. These checks do not certify physical touch/controllers, assistive technology, responsiveness, full integration gates or public delivery.
