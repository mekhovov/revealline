# Single Drone saved flights

Single Drone has one manual saved flight per browser profile on a device. From
Home or a paused flight, open **Saved flight**. Saving requires a complete,
verifiable game release, available IndexedDB storage and a held writer lease.
Development pages without the emitted release identity explain that saving is
unavailable. Saving neither ends nor resumes the current flight.

Replacing an existing save and restoring it require separate confirmation.
Restore retains the exact encounter, seed, difficulty, airframes, handling,
assistance, authored/official selection ownership, build, upgrade offers,
random generators, simulation tick, enemy/pickup/effect pools, terrain state and
runtime links. The flight returns paused with input released. Continue is an
explicit later action, including when an upgrade choice was pending.

This does not introduce autosaving, transferable save files, cross-version
migration or support for Riy, Raid, Marathon, Time Attack, review fixtures or
Studio previews. Progress after the last manual save is not retained. Existing
backup formats are unchanged; they do not promise to include this new saved-flight
slot or its completion journal. Keep the same complete release package and
appearance settings to restore the flight. A package or appearance mismatch
leaves the existing save and current run intact.

## Checkpoint boundary

`game/overflight/checkpoint.mjs` implements the production decoder. Its versioned
wire format uses an explicit typed schema, bounded JSON and an 8 MiB encoded
limit. It does not import the F04a assessment graph decoder. The compiler
reconstructs immutable project/flight references; the importer accepts only
explicitly declared references and typed mutable state. It rejects unknown fields,
cycles, unowned objects, invalid pool/index links, altered build/offer data and
inconsistent clock/settings/project identity. It preserves negative zero and
allowed infinite terrain distances. Saving itself validates the encoded state
before any storage mutation.

Package admission hashes the actual release manifest and fetched state/result
runtime closure, checks each member against its manifest, verifies the actual
host entry bytes, and matches the emitted play-page build marker to the visible
page. Neither a test core digest nor a source revision alone is a package
identity. Verification is performed when the player opens saved-flight management,
not during a gameplay frame. The first admitted package is held for this page
lifetime. A changed release requires reopening the original release or an explicit
future migration; there is no best-effort decoder fallback.

The appearance in a save is an admission request, never permission to load an
arbitrary URL. The host resolves its current assets independently and compares the
complete prepared appearance before retiring its current renderer. Rendering
failure can still require the existing graphics recovery route; it never adopts
the incoming run or replaces its saved checkpoint.

## Durable ownership

`overflight-suspend.v1` is a versioned sidecar in the existing Journey IndexedDB
`profiles` store. Its monotonically increasing revision provides compare-and-set
protection. A page-lifetime Web Lock owns writes; a denied or released lease does
not silently promote itself. Page hide releases the lease, and a restored page
must reload before it can write again.

A saved attempt has a stable UUID. On completion, the coordinator first commits a
terminal checkpoint as a **finishing** journal. Records and world mastery then
commit separately. Each store writes its unchanged v1 profile value and a bounded
receipt in one IndexedDB transaction. The receipt captures the attempt ID, exact
result input and original comparison result. Duplicate requests return that
receipt; the same ID with different input is rejected. Ordinary unsaved results
retain their existing API and schema.

The coordinator retires the recovery checkpoint only after both stores acknowledge
durable ownership. Interruption before either store, after one store, or after both
stores leaves a recoverable journal. **Recover completed result** retries those
receipts without playing or awarding the flight again. Once retired, that attempt
cannot be restored. Storage failure keeps the prior slot, and a finishing journal
cannot be replaced by a different flight.

## Qualification boundaries

Automated coverage includes production checkpoint round-trips and continuation
across the six V4 worlds and legacy/V2/V3 fixtures; retained upgrade/reroll state;
legal terminal gameplay; malformed state and package rejection; atomic abort and
writer-loss cases; separate store instances; and fresh-process recovery at each
result boundary. The fresh-process harness transports only committed fake-IndexedDB
values. It proves process-independent ownership and production decoding, not a
browser's disk durability under physical power loss.

Native host-source tests execute the actual preparation/result/mount functions.
DOM component tests cover confirmation, focus return, EN/UK copy, disabled unsafe
actions and unavailable-package recovery. These are not a browser layout or device
claim. Packaged-browser save → close/reopen → paused restore → continuation,
real IndexedDB interruption, controller/touch focus, offline cold launch and
physical Steam Deck/mobile suspend remain separately scoped qualification gates.
