# Bounded independent G4/G2 loading review

Source-only review of the current P01 working changes, performed by the G5 owner after its implementation handoff. No changes to G4/G2 files, no full suite, no browser or physical-device qualification. This does not accept P01 or change any phase status.

## Concrete finding

G2 `authoring/asset-studio/index.html` directly loads `studio.mjs` with a module script. The new static busy notice has no independent failed-module handler: if that module or a static dependency fails to fetch/evaluate, the operation owner never initializes, the notice remains “Loading the Studio workspace and presentation registry…” indefinitely, and Cancel stays hidden. Back remains available. Requested terminal failure and explicit retry recovery from root and G2 owner. This is separate from the tested IndexedDB/read error paths. Review refers to source as inspected before the owner's follow-up correction.

## Boundaries reviewed without a concrete regression found

- G4 library operations: immediate labels; precommit cancellation and current-owner checks before adoption; detached durable commits retain locks until reconciliation; stale finally cannot unlock newer work. Backup-set export and profile transfer preserve atomic mutation boundaries and restore focus only from the relevant operation controls.
- G4 recovery: dialog/module/read ownership and closing fences; original export phases; late reads cannot redraw a closed/replaced view; explicit cancellation and close cleanup retain their original boundaries.
- G4 Collection: staged picture decode and earned-original acquisition, current view generation checks, progressive card loading labels, shared status ownership, and celebration preparation errors. Original artwork binding remains separate from status changes.
- G2 Studio operation owner: cancellation invalidates adoption, new work cannot be unlocked by an old finally, Stop waiting retains the save lock, and success/failure reconciles the durable result. Upload, image decode, encoding, imports, and saves check ownership before visible workspace adoption.
- G2 previews: each surface owns status and cleanup; superseded decoded bitmaps are closed; Stop waiting invalidates the current surface before retry; audio metadata, font decode, and scene preparation retain explicit cleanup and current-owner checks. Preview errors no longer overwrite the whole Studio operation notice.

These are bounded source review results, not proof of every navigation route or layout. Root and the implementation owners retain focused test execution, browser delay/failure interactions, viewport checks, and acceptance.
