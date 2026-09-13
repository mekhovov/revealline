# Explicit authored story selection

This isolated continuation of [story transfer](story-bundle.md) at `92f310371be98915f17168012f07276ffec464e7` connects an exact retained picture to a deliberately selected optional story. It supplies a model for later fresh attempts. It does not change game/session/library/UI hosts, award a story, add playback, adopt a default database, or enter v0.34. The next integration must adopt authoring, attempts, first-earned receipts and Collection together.

## Logical v2 inside explicit database v4

The existing opt-in database remains version **4**. A deliberate binding operation creates `revealline-story-storage.v2`:

```js
{
  format: 'revealline-story-storage.v2',
  stories: [/* unchanged immutable victory-story.v1 descriptors */],
  originals: [/* explicit available original hashes */],
  bindings: [
    {
      picturePin: /* exact existing managed still snapshot */,
      story: null // or {id, revision, descriptorSha256}
    }
  ]
}
```

There is at most one binding for the **complete** picture pin: authored owner/map/theme identity, presentation ID/revision, poster asset ID and SHA-256. Matching only a map, a name or today's picture is insufficient. A non-null reference must identify a retained descriptor for that exact picture; its SHA-256 covers the canonical complete validated descriptor, including source facts, segment, description and picture pin. IDs/revisions stay immutable even when bindings change.

Logical v1 remains strict `{format,stories,originals}` and is not rewritten on read. It has no story selection. An absent binding and an explicit null both resolve to no selected story. They never search the descriptor history. A v1 import cannot erase a destination's v2 choices, and a v2 document cannot be downgraded to v1. Explicit-null rows persist until another deliberate binding for the same full picture replaces them.

An older v4 story adapter that supports only logical v1 may reject a v2 row even though the database version is still 4. Older v3 database clients can still receive `VersionError` after an explicit v4 upgrade. Recover through a compatible current manager and original exports; do not delete/downgrade the database or promise old clients will read new records. Default v2 and rich-still v3 hosts remain unchanged in this slice.

## Selection and immutable attempt model

`game/story-bindings.mjs` supplies three separate operations:

| API                                                                 | Contract                                                                                                                                                                                        |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `snapshotStoryPin(pin)`                                             | Strict bounded structural copy of a `revealline-story-pin.v1` object, or literal null. No codec, execution or award authority.                                                                  |
| `createAuthoredStoryPin({document,still,picturePin},{signal})`      | Validates retained owners/picture/history and rehashes declared binding references, then freezes only that exact current selection. V1, missing, explicit-null and legacy pictures return null. |
| `resolveAuthoredStoryPin(pin,{document,still,picturePin},{signal})` | Resolves the previously frozen ID/revision/full descriptor hash against retained history. It never substitutes today's binding. Literal null returns null without inspecting current history.   |

A non-null pin contains `{format,picturePin,id,revision,descriptorSha256,sourceSha256}` within **8 KiB**. A resolved selection returns `{kind:'available'|'unavailable',pin,descriptor}`. Availability is the declared original inventory, **not** proof of actual stored bytes or playable codec; the existing store's exact-poster/video `acquire` remains necessary. Removing an original leaves the saved selection pinned but unavailable. It cannot select another original automatically.

These pins are **authored source choices**. They do not carry an execution key, distinguish Standard/Gentle by themselves, prove a win or create first-earned authority. No existing flight-picture, session or first-earned schema accepts these new fields. A later host must validate execution-to-authored ownership, freeze the choice once at the correct attempt boundary, retain a saved null after future authoring changes, and record an explicitly versioned first-earned selection exactly once. Better later scores must not replace that first-earned story/poster.

## Deliberate persistent binding

`changeStoredStoryBinding(document,{picturePin,story:null|{id,revision}},still,{signal})` is a pure asynchronous document transformation. It owns input JSON before hashing, computes the selected canonical descriptor digest, validates the full resulting history and returns logical v2. It writes nothing and cannot make an unavailable original playable.

`store.stageBinding(request,{expectedGeneration,signal,...inspectionOptions})` uses that transformation on the current v4 store. A non-null selection requires an explicitly available original and verifies the actual historical poster. It reserves proposed metadata with **zero new original bytes**, prepares the unchanged complete available video inventory through the existing native inspection path, and returns the same store-specific staged review. Only `store.commit(review)` changes the binding and generation in one transaction; cancel, stale generation, lease expiry or write abort cannot publish a partial selection. The old source/history, audio/still bytes and other reservations remain preserved.

The unchanged full-inventory preparation means unrelated available videos with missing bytes or unsupported native codecs can also prevent a binding update, including a null selection. Recover or explicitly detach those unavailable originals first; this slice adds no metadata-only trust bypass. A null selection itself requires neither a new video nor an actual poster acquisition, but its exact retained poster metadata must remain valid.

Synchronous record validation checks strict structure and exact descriptor/picture relationships for the final IndexedDB transaction. Asynchronous `verifyStoredStoryBindings` recomputes descriptor hashes before prepared writes, adapter metadata/export publication and binary inspection. A structural row check alone is not a cryptographic or playable capability. Every asynchronous operation owns its input and honors cancellation before publishing a result.

## Explicit transfer dispatch

The `.rlstory` layout and all old v1 bytes remain unchanged. New logical v2 documents use a distinct combination:

| File signature | Manifest format              | Storage document              |
| -------------- | ---------------------------- | ----------------------------- |
| `RLSRB1\r\n`   | `revealline-story-bundle.v1` | `revealline-story-storage.v1` |
| `RLSRB2\r\n`   | `revealline-story-bundle.v2` | `revealline-story-storage.v2` |

Crossed signatures/manifest/document versions reject. Both retain the exact sorted original-video inventory, retained still context and native-codec import requirements. Existing JSON, `.rlmedia`, `.rlsound`, still `story:null` and first-earned formats are unchanged. Original source-license/provenance handling stays with its existing authoring records; a descriptor hash is not a rights claim.

`prepareStoryBundleRestore(imported,{store,restoreBindings:false,...})` defaults to **keep current bindings**. Explicit `restoreBindings:true` applies incoming bindings, including null, only to the full picture keys present in the incoming v2 document. Destination bindings absent from that document remain. V1 imports never clear bindings under either policy. Review reports `bindingPolicy:'keep-current'|'restore-incoming'` before the same complete-inventory CAS commit; invalid policy values reject. History/available originals still merge additively and immutable conflicts still reject the entire transaction.

## Unchanged limits and next acceptance

All shared limits remain: **256 MiB committed plus staging**, **64 MiB per original**, **2 MiB combined still/story metadata**, **512 physical rows per original store**, **four reservations**, **15-minute leases**, and the existing 120-second/1920×1080 descriptor limits. V2's null-only binding table counts toward the shared metadata allowance even when there are no story descriptors. There are at most 512 binding rows, further limited by the existing 256 retained presentations and metadata budget; source file counts do not create runtime capacity. Near-capacity repeated imports may still refuse conservative staging despite final deduplication fitting.

The next useful work is one coordinated playable slice: native story binding/segment authoring, shared current manager in ordinary/practice/course audio and workshops, new attempt and first-earned receipt dispatch, then a real win → optional Play/Skip → exact poster → Collection Replay with no duplicate award. Pair game JSON, exact `.rlmedia`, `.rlstory` and `.rlsound` recovery, explicit missing-original handling, music gain restoration, focus pause and cold offline acceptance. No further standalone preview is needed.

Focused model/store tests retain original bytes and use the project's modeled IndexedDB and native metadata boundaries. They cover v1 exact export, canonical descriptor pins, saved A after current B, literal null, original detachment, stale/CAS/cancel/expiry/rollback, explicit restore policies and actual persisted null-only metadata overflow. This is source evidence, not native browser durability, download, codec/device, offline, host or public-release qualification. See the [agent examples](../authoring/prompts/authored-story-bindings.md) for the current interface and scope.
