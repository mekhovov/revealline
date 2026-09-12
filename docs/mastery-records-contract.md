# Optional mastery record contract

`game/mastery-records.mjs` defines bounded local metadata and deterministic merging for optional earned seals. Current source after frozen v0.6.0 integrates those records into player library v2. The records module does **not** implement earning, verify replay qualification, write storage or add a player-facing badge. Existing progress, score and campaign identities remain unchanged; completed replay authority is a separate integration.

## Record shape

Every field below is required. Unknown properties reject. The values shown illustrate metadata structure; a matching hash spelling does not prove those values correspond to installed content or a completed run.

```json
{
  "format": "xonix-mastery-record.v1",
  "campaignKey": "homeward-skies/1/0000000000000000",
  "levelId": "copper-orchard",
  "levelRevision": "1",
  "levelIdentity": "level-v1-0000000000000000",
  "definitionId": "steady-signal",
  "definitionRevision": "1",
  "definitionHash": "mastery-v1-0000000000000000",
  "setup": {
    "ruleset": "xonix-core.v2",
    "seed": 1,
    "turnPolicy": "immediate",
    "classId": "fiber",
    "classRevision": "1",
    "loadoutHash": "loadout-v1-00000000",
    "rosterHash": "roster-v1-00000000",
    "classHistory": [
      {
        "classId": "fiber",
        "classRevision": "1",
        "loadoutHash": "loadout-v1-00000000",
        "tick": 0
      }
    ]
  },
  "runId": "qualifying-run",
  "earnedAt": "2026-09-12T12:00:00.000Z"
}
```

`levelId` is the map ID. `campaignKey` retains the existing campaign-key shape: stable campaign ID, canonical URI-encoded revision and 16 lowercase hexadecimal content digits. `levelIdentity` uses `level-v1-` plus the shared `dataIdentity(normalizedLevel)` result. `definitionHash` is the definition module's `masteryDefinitionIdentity` result: `mastery-v1-` followed by the hash of its complete canonical definition, including metadata. The records module checks these spellings; it has no installed definition or level with which to authenticate them.

The setup retains current core identity names and accepts exactly `xonix-core.v2`, an unsigned 32-bit seed and `immediate` or `grid-center`. Initial and historical recipe revisions are nonempty strings up to 80 characters; level/definition revisions have the same bound. Run IDs are nonempty strings up to 159 characters. These strings reject control characters. Stable IDs use the shared data boundary's rules. Loadout and roster hashes use their existing eight-digit lowercase hexadecimal forms.

History is a complete ordered list, beginning at tick zero with the exact initial class ID, revision and loadout. Later ticks must be strictly increasing nonnegative safe integers, and adjacent entries must change class. Returning to an earlier class must use its same revision/loadout within that roster. The tick bound establishes integer representation only, not a valid simulated switching time or replay duration. The verifier must still compare the installed roster and reconstructed run.

`earnedAt` is a roundtrippable UTC ISO timestamp with milliseconds. Impossible dates, alternate offsets and informal dates reject; no current-clock or recency assumption is made. No counters, partial predicates, cosmetic IDs, arbitrary rewards, `qualified` flags or executable fields belong in a record.

## Pure API

```js
import {
  resolveMasteryRecord,
  validateMasteryRecord,
  masteryRecordKey,
  resolveMasteryRecords,
  validateMasteryRecords,
  mergeMasteryRecords,
  MASTERY_RECORD_VERSION,
  MASTERY_RECORD_LIMITS,
  MasteryCapacityError,
} from '../game/mastery-records.mjs';

const record = resolveMasteryRecord(importedRecord);
const result = validateMasteryRecord(importedRecord); // { valid, errors }
const records = resolveMasteryRecords(importedRecords); // Array, or JSON array text.
const merged = mergeMasteryRecords(records, anotherValidCollection);
const displayKey = masteryRecordKey(record);
```

Resolve functions return owned copies in canonical field/order form or throw. Validation returns `{valid, errors}` without adopting data. Record and collection boundaries accept plain data or JSON text, reject getters without invocation, and reject hidden/symbol/prototype keys, custom prototypes, cycles, sparse arrays, nonfinite numbers and structural/byte excesses. Ordinary and null-prototype data are accepted; output uses ordinary objects and normalizes numeric negative zero.

A collection is an array; `[]` is valid. Each input collection must already contain at most one record for each definition/setup identity. Duplicate identities within an imported collection reject rather than silently repairing it. `mergeMasteryRecords(left, right)` first validates both complete collections, then unions duplicates across them. Invalid input never returns a partial result or changes caller data. A caller should adopt the returned value only after the operation succeeds.

## Identity and deterministic winners

A record's grouping identity includes campaign key, map ID/revision/content identity, definition ID/revision/hash, ruleset, seed, turning policy, initial class ID/revision/loadout, roster hash and the complete ordered class route. The route projects every history entry to `{classId, classRevision, loadoutHash}`, matching the existing `completionVariantKey` policy. It omits tick timing. Run ID and earned timestamp are also omitted from grouping.

Changing only switch timing does not produce another equipment setup. The winning record still retains the qualifying attempt's full history including ticks. Changed recipe, roster, route, turning policy, seed, level or definition identities remain distinct. Old definition hashes are retained as historical records; this module does not interpret them as satisfying a current definition.

For matching identities, the earliest `earnedAt` wins. Equal timestamps use lexicographically smaller `runId`, then the entire canonical record as a final deterministic tie-break. Comparisons use code-unit order rather than locale. The merge is commutative, associative and idempotent when its result fits the budgets; it never combines progress from different attempts. Results sort by the full canonical grouping identity.

`masteryRecordKey` returns `mastery-record-v1-` followed by 16 hexadecimal digits for local display/reference. It is not a signature. Internal union uses the **complete canonical identity string**, not the short hash, so a short-hash collision cannot merge unrelated records.

## Capacity and later integration

| Limit             | Contract                                         |
| ----------------- | ------------------------------------------------ |
| Records           | At most 4,096 per input/output collection        |
| Complete history  | At most 128 entries per record                   |
| Individual record | At most 64 KiB through the bounded JSON boundary |
| Whole collection  | At most 4 MiB through the bounded JSON boundary  |

All limits apply together. Large metadata/histories can exhaust the byte budget before 4,096 records. The conservative structural byte accounting can reject data before its compact JSON reaches the nominal limit. Recognized byte, record-count and history overflows throw `MasteryCapacityError`, with code `mastery-capacity` and `resource`, `used`, `limit` fields; `used` is null when exact usage was not measured. Other malformed/structurally excessive data can throw `TypeError`. Validation helpers report either kind as an invalid result.

No record is silently evicted or history truncated. The current core permits longer class-switch histories than this optional metadata contract; a qualifying attempt with more than 128 entries needs explicit capacity handling, not a shortened false history. A later award integration should preserve ordinary clears, scores and pictures even when it cannot append an optional seal. Its encompassing library budget still applies independently.

The observer's setup includes fields for live predicate checks, such as `initialLives` and `signalZoneIds`. Do not copy that object wholesale into a record. A future trusted verifier should first establish a matching installed campaign/definition and a genuinely qualifying completed replay, then select this record's exact public fields (`levelRevision` comes from the observer setup's `revision`). A preview snapshot, imported record, short hash or successful structural validation is never an award capability.

Completed-replay authority, generation-safe asynchronous award adoption and result/gallery UI are separate from this metadata boundary. Use the existing coordinator rather than inventing another storage writer. See [the mastery implementation plan](round-15-mastery-plan.md), [library contracts](library-and-packs.md) and [full backup recovery](full-backup.md).

## Player library v2 migration and storage

Current `game/library.mjs` exports `LIBRARY_VERSION = 'xonix-library.v2'`. A new library includes `masteries: []`; every v2 library must provide that field with a valid complete record collection. A valid v1 library migrates to an owned v2 document with empty masteries. The exact old shape is validated first: v1 documents with `masteries`, `mastery` or another unknown field reject. Missing mastery data is never inferred to be valid v2. Existing omitted-only preference migrations still apply, and progress, gallery, scores and preferences retain their existing semantics.

Read/import validation performs no storage writes and never changes its argument. `loadLibrary` accepts raw old profiles or the existing `xonix-library-storage.v1` envelope and retains its generation. A corrupt source remains available as recovery bytes. Portable exports now contain v2, including exports made from valid v1 input. Frozen older readers do not understand v2: collection transfer is forward into current source, not a promise that new exports can be imported into old releases. The existing release channel names and storage-envelope format are unchanged.

```js
import { withMasteryRecords, mergeLibraries, libraryCapacity } from '../game/library.mjs';

const next = withMasteryRecords(library, importedRecords);
const merged = mergeLibraries(local, remote, { baseline });
const { masteries, maxMasteries } = libraryCapacity(next);
```

`withMasteryRecords` validates the library and both complete record sets, then returns their pure bounded union. It does not award an ordinary clear, score or picture, and it accepts structurally valid historical metadata without requiring an installed campaign. It is **not** an award capability. The caller must establish qualification separately before using it to append an earned record. Its successful return is owned data; an invalid record or capacity error leaves the original library unchanged.

Ordinary concurrent library saves union records and preserve the existing whole-preference baseline merge. Explicit replacement/import/Undo replaces the collection under a new storage generation, so a stale writer cannot resurrect deliberately removed records. `saveLibrary` reports typed mastery capacity failures through its existing `capacityError` result. The whole 4 MiB library budget applies in addition to the individual mastery budgets: even separately valid picture and mastery collections may not fit together. Nothing in this integration evicts pictures or optional seals to make room. An award caller should commit the ordinary completion independently if appending an optional seal fails.

Complete-backup preparation, export, coordinated import, Undo and source-locked previous-release transfer reuse `importLibrary`, so old v1 members migrate and valid v2 records survive without changing pack or unfinished-flight formats. The backup wrapper, recovery journal and storage envelope retain their v1 formats. Journal rollback preserves exact prior raw bytes, including a prior v1 profile; successful Undo adopts its validated v2 equivalent under a fresh generation. These are the existing journaled storage semantics, not a cross-storage transaction.

## Verification

```sh
mise exec node@22.22.2 -- node --test game/test/mastery-records.test.mjs game/test/mastery-library.test.mjs
```

Tests cover current core identities, owned roundtrips, strict malformed/accessor rejection, canonical grouping against the ordinary class-route projection, unchanged full timing, changed-definition history, algebraic merge properties and deterministic ties. Boundary cases exercise 128 history entries, all 4,096 compact records and aggregate byte overflow without eviction. These establish a data contract, not live qualification, persistent awards or player enjoyment.

Library integration tests cover strict v1 migration, mandatory v2 fields, unchanged ordinary identities and controller preferences, concurrent union, generation conflicts, complete backup/Undo, exact-byte rollback, read-only source transfer and a whole-library capacity conflict between individually valid 4,096-picture and 4,096-record collections. Live-cut backup checkpoints are reconstructed by the session verifier. These tests establish persistence compatibility and metadata behavior; they do not certify an earned seal or replace physical/browser playtesting.
