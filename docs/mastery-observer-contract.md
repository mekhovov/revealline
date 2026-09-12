# Optional equipment mastery observers

This documents the pure observation boundary in [game/mastery.mjs](../game/mastery.mjs) and [game/mastery-equipment.mjs](../game/mastery-equipment.mjs). Steady Signal v1 is preserved from frozen v0.7.0. Working source after that freeze adds Supply Line and Safe Return through explicit definition/fact/preview v2 dispatch. The modules themselves do not grant achievements, change levels, write libraries or install callbacks. The existing replay verifier, session reconstruction and host award queue provide those separate integration boundaries. See the [bounded equipment plan](round-18-equipment-mastery-plan.md).

**Steady Signal** asks the player to close one cut that sampled at least eight distinct cells inside Copper Orchard's active `broad-band` region while the active class had signal resistance, then win that same attempt without losing a life. Its definition identity is `mastery-v1-2e6aae3f42f3d3c2`. Equipment mastery is optional: an ordinary interceptor victory remains a normal victory with the same picture, score and medal.

## Public API

| Export                                                                      | Contract                                                                                                                                                                                                             |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MASTERY_DEFINITION_VERSION`                                                | `xonix-mastery-definition.v1`.                                                                                                                                                                                       |
| `EQUIPMENT_MASTERY_DEFINITION_VERSION`                                      | `xonix-mastery-definition.v2`; a separate constant, not a replacement of v1.                                                                                                                                         |
| `STEADY_SIGNAL`                                                             | Deeply frozen original definition for `homeward-skies` / `homeward-01`.                                                                                                                                              |
| `SUPPLY_LINE`, `SAFE_RETURN`                                                | Deeply frozen v2 definitions for `homeward-02` and `homeward-03`.                                                                                                                                                    |
| `MAX_MASTERY_TICKS`                                                         | 216,000 fixed ticks, matching the present 30-minute replay budget.                                                                                                                                                   |
| `resolveMasteryDefinition(value)`                                           | Return an owned canonical definition or throw `TypeError`. No JSON-string shorthand or partial defaults.                                                                                                             |
| `validateMasteryDefinition(value)`                                          | Return `{valid, errors}` without adoption.                                                                                                                                                                           |
| `masteryDefinitionIdentity(value)`                                          | `mastery-v1-` plus `dataIdentity` of the canonical definition, including its metadata.                                                                                                                               |
| `captureMasterySetup(state, {campaignId, campaignKey, runId, definition?})` | Capture a fresh validated core-v2 run at tick/time zero, with normalized-level identity and initial setup. Omitted definition or explicit v1 retains the original setup shape; a v2 definition selects the v2 shape. |
| `captureMasteryFacts(state, {runId, definition?})`                          | Project owned facts from trusted public core state with the same version selection. This helper is not an imported-file validator.                                                                                   |
| `createMasteryObserver({definition, setup, initial})`                       | Copy and validate the complete definition, setup and initial facts; return frozen `{observe, snapshot}`.                                                                                                             |
| `observer.observe(facts)`                                                   | Accept one consecutive fixed tick; return `undefined`. Invalid input throws before altering retained progress.                                                                                                       |
| `observer.snapshot()`                                                       | Return owned `xonix-mastery-preview.v1` or `.v2` data for that definition, always labeled `authority: 'preview-only'`.                                                                                               |

A host/verifier adapter uses the following shape. This example illustrates the observation boundary, not a new replay interpreter or award path:

```js
const binding = { campaignId: campaign.id, campaignKey: installedKey, runId };
const observer = createMasteryObserver({
  definition: STEADY_SIGNAL,
  setup: captureMasterySetup(freshState, binding),
  initial: captureMasteryFacts(freshState, binding),
});

// Immediately after each existing fixed simulation step:
observer.observe(captureMasteryFacts(state, binding));

// Read as needed for preview UI; no storage operation occurs here.
const preview = observer.snapshot();
```

The callback must run **after every simulated tick**, including reconstruction of the complete recorded prefix when restoring a suspended run. A frame can contain several ticks. `releaseInputs`, `recordRelease`, pauses and rendering are not simulation ticks; they do not call `observe`. Preserve every replay `releaseBefore` and `releaseAfter` operation in the existing interpreter. Do not initialize the observer directly from a tick-180 suspended state or import its partial totals.

## Exact definitions and bounds

A definition has exactly `version`, `id`, `revision`, `campaignId`, `levelId`, `name`, `description` and `all`. This first schema requires exactly one `{type: 'clean-win'}` and one `{type: 'resistant-cut-cells', zoneId, minCells}`. `all` is canonicalized into that order. There are no arbitrary expressions, event queries, executable rewards, optional defaults or other registered predicates yet.

IDs use the existing stable-ID validator. Revision and name are nonblank strings of at most 80 characters; description is at most 512. `minCells` is an integer from 1 through 1,564, the interior cell count. The observer must find the definition's campaign, map and named zone in the captured setup. A valid threshold is bounded data, not proof that a newly authored map can satisfy it.

Definitions, setup and incoming facts use the shared descriptor-based JSON boundary: at most 8 KiB, 256 nodes, depth 4 and 512-character strings. Definition arrays allow two entries; setup/fact arrays allow 16. Unknown or missing keys, sparse/custom arrays, duplicate references, nonfinite values, symbols, hidden fields, accessors, cycles and non-plain prototypes are rejected. Ordinary null-prototype JSON objects are accepted and copied. Validators do not invoke accessors or `toJSON`.

## Retained setup and facts

Setup has exactly these fields:

```text
campaignId, campaignKey, runId, levelIdentity,
ruleset, levelId, revision, seed, turnPolicy,
classId, classRevision, loadoutHash, rosterHash,
initialLives, signalZoneIds
```

`levelIdentity` is `level-v1-` plus `dataIdentity(normalizedLevel(state.level))`. `campaignKey` is a nonblank host-supplied string up to 300 characters; the module intentionally does not import the library or derive installed campaign identity. The host must supply the real installed key. `runId` is nonblank and at most 159 characters, chosen separately for each attempt. The setup fixes the initial class rather than overwriting it after a switch. The observer supports only `xonix-core.v2`, its 48×36 board, both existing policies, uint32 seeds, and the current `loadout-v1` / `roster-v1` identities.

Each fact object has exactly:

```text
runId
identity: {ruleset, levelId, revision, seed, turnPolicy,
           classId, classRevision, loadoutHash, rosterHash}
tick, time, status, lives
player: {x, y, cutting, cutStartedAt}
activeClass: {id, revision, loadoutHash, resistant}
classSequence, classChangedAt
signalZoneIds
events: [{type, tick, time}]
```

The helper reads resistance from both the current recipe and its current signal result. It copies active, unsuppressed zone IDs from `state.signal`; it does not infer immunity from the initial class's name or the background art. The active class entry comes from public `classHistory`. The observer retains its full bounded history, including successful switch ticks, while preserving the original setup. A change must advance the history sequence once, use the current tick and start from a non-cutting state. Unchanged class entries and their resistance cannot silently change between samples.

Events contain only `cut.started`, `cut.closed`, `player.failed`, `shield.absorbed`, `craft.redeployed` and `run.completed`, in original core order. Their tick must equal the sampled tick; times must lie within that step and remain ordered. Other core events are filtered out. There is at most one instance of each relevant event type per tick in this supported core-v2 observation contract; unsupported duplicate events fail explicitly instead of being guessed at.

The first sample must be a running, non-cutting run at tick zero with the declared starting lives and initial class. Subsequent samples must be consecutive, retain the run/setup identity and advance by at most one fixed interval. Cut start/closure/recovery facts must agree with the public live-cut state. Lives cannot increase, life loss must match a failure event, and terminal status must have a completion event. A won status must include a successful closure. Samples after a terminal result are rejected. Malformed or foreign facts leave the existing observer unchanged.

## What counts

At the end of a fixed tick, count `floor(y) * 48 + floor(x)` only when the run is running, the player still has a live cut, the active recipe is signal resistant, and `broad-band` is in the authoritative active signal list. Signal membership uses the core's half-open rectangle convention: `x >= left && x < right && y >= top && y < bottom`. Suppressed zones are absent from that list.

The observer keeps a set for the current cut. Waiting, moving repeatedly inside the same cell or returning to a previously sampled cell adds no additional credit. Visiting interference on safe ground adds none. A successfully closed cut commits its distinct count; the retained total is the **largest single successful cut**, not a sum across cuts. This makes two four-cell cuts insufficient.

`player.failed`, `shield.absorbed` and `craft.redeployed` discard the open cut. A closure followed by recovery during the same step commits that already finished cut before processing recovery. A later failure still defeats `clean-win`. Shield absorption and impact redeployment do not themselves lose a life, so they do not invalidate an earlier successfully closed qualifying cut. A terminal loss discards pending cells and cannot qualify. A clean final win and the completed-cut requirement must both hold in this one attempt.

These are **sampled endpoint cells**, not interpolated travel distance. A closure occurring partway through a tick commits the previous samples; the observer does not invent cells along the remaining sub-tick path or fill area. A cut beginning and ending inside one tick can contribute zero sampled cells. No core collision, capture, motion or event code was changed to improve a badge result.

Memory is bounded by one 1,728-cell set, a few counters, one latest fact and up to the existing 4,096 class-history entries. The observer retains no unbounded event log or partial-run collection. Call `snapshot` when needed, rather than copying the full history after every fixed step.

## Authority and compatibility

`qualified: true` is a **preview conclusion from the supplied facts**, even when a test separately verified its source replay. Neither `captureMasteryFacts` nor `createMasteryObserver` proves that a caller supplied authentic simulation state. Local identity hashes partition records; they are not signatures. The module has no persistence import, raw JSON award function, certificate constructor, network request or global mutable store.

The host integration reconstructs the whole replay through the existing verifier, binds the installed campaign, normalized map, roster, definition and original run ID, and requires an exact winning summary/checkpoint before issuing an owned verification capability. It must also preserve the host's live completion eligibility and library replacement generation. A practice/theater preview must never grant an earned seal. The separate metadata-record contract does not confer this authority either.

Definitions remain outside levels and packs. Existing core-v2 state, normalization, scoreboards, summaries, checkpoint projections, replay files, ordinary progress and the frozen v0.6.0 distribution remain unchanged. See the independent [compatibility baseline](mastery-compatibility-baseline.md). Changing any definition content changes its identity; historical clears do not imply equipment mastery, and separate attempts never combine incomplete conditions.

## Reproducible evidence

Run:

```sh
mise exec node@22.22.2 -- node --test game/test/mastery.test.mjs
```

The tests include strict/adversarial definitions, atomic invalid-fact rejection, owned-copy boundaries, duplicate/stationary cells, safe/suppressed regions, separate short cuts, all three recovery events, life loss, timeout, event order, active-class switching and original setup retention. Synthetic fact tests are labeled as observer boundary tests; they are not gameplay-completion claims.

Four integration tests replay unchanged legal inputs from `game/replays/homeward-routes.json` through `createRun` / `stepRun`, record them with the public recorder, and run `verifyReplay`. They compare the archived summaries and authoritative checkpoints without regeneration:

| Copper Orchard route | Turning policy | Final tick | Best successful resistant cut | Preview                               |
| -------------------- | -------------- | ---------: | ----------------------------: | ------------------------------------- |
| Fiber specialty      | Immediate      |      1,305 |                      22 cells | Qualified                             |
| Fiber specialty      | Cell-center    |      1,305 |                      22 cells | Qualified                             |
| Interceptor ordinary | Immediate      |      3,748 |                       0 cells | Not qualified; ordinary win unchanged |
| Interceptor ordinary | Cell-center    |      3,751 |                       0 cells | Not qualified; ordinary win unchanged |

All four retain three successful cuts and all three lives. A further legal Fiber test releases input at tick 180 during a live cut, finishes at the unchanged archived checkpoint, reconstructs the entire recording with its explicit release boundary, and obtains the same preview. These are deterministic route and compatibility results; they do not demonstrate a shipped badge UI, an awarded record or player enjoyment.

## Equipment definition v2

All sections above describing exact v1 field lists and bounds remain the Steady contract. V2 has the same required definition keys but supports only two finite predicate compositions:

- Supply: `supply-pickups {padIds}`, `suppressed-region-crossings {regions:[{zoneId,minCells}]}`, and `hangar-switch {hangarId,classId}`.
- Impact recovery: `clean-win` and `live-cut-impact {actorId,minTrailCells}`.

Supply predicates canonicalize to that order, with pad IDs and region references sorted by ID; duplicate references reject. Each reference list contains 1–4 entries, and cell thresholds are integers 1–1564. The impact pair canonicalizes to clean then impact. Unsupported combinations, properties and versions reject; v1 cannot accept a v2 predicate. V2 definitions retain 8 KiB/256-node/512-character-string budgets with depth 5 and arrays of at most four. Version dispatch reads an own property descriptor before validation, never invoking a supplied `version` getter.

The identity algorithm prefix stays `mastery-v1-`. It hashes the complete resolved definition, including its schema version and display metadata. Current definitions are:

| Definition                 | Identity                      |
| -------------------------- | ----------------------------- |
| Steady Signal, original v1 | `mastery-v1-2e6aae3f42f3d3c2` |
| Supply Line, v2 revision 1 | `mastery-v1-a3ffbfe068645ff0` |
| Safe Return, v2 revision 1 | `mastery-v1-197b5a9a9370f0f2` |

This does not change `xonix-mastery-record.v1`, `xonix-library.v2`, core/replay versions or a map's normalized identity. A changed definition receives a different content hash. Historical local metadata remains distinguishable from a currently recognized seal.

## Equipment setup and facts v2

Pass the same definition when capturing setup and every fixed tick:

```js
const binding = {
  campaignId: campaign.id,
  campaignKey: installedKey,
  runId,
  definition: SUPPLY_LINE,
};
const observer = createMasteryObserver({
  definition: binding.definition,
  setup: captureMasterySetup(freshState, binding),
  initial: captureMasteryFacts(freshState, binding),
});
// After each existing fixed simulation tick, including replay reconstruction:
observer.observe(captureMasteryFacts(state, binding));
```

The v2 setup retains all original identity fields, campaign/run binding, normalized-level hash and initial lives. It replaces v1's `signalZoneIds` with `version: 'xonix-mastery-setup.v2'`, `definitionIdentity` and `references`:

```text
references:
  padIds: all normalized supply IDs (at most 20)
  hangarIds: all normalized hangar IDs (at most 12)
  regions: selected {id,x,y,w,h} rectangles (at most 4)
  classes: bound {id,revision,loadoutHash,primitive,radius,duration,capacity,resistant}
  actor: selected {id,type,radius}, or null for Supply
```

Up to 40 roster entries are retained so an actual later switch must match a bound recipe. Setup's separate budget is 32 KiB/2,048 nodes/depth 5/array 40; definitions and facts do not inherit this larger budget. Every definition reference must exist in the captured normalized map/roster. Actor targets support the core's `bouncer` and `lane-boss`; border patrols cannot be stunned and are rejected. Fractional signal rectangles and the core's default enemy radius are preserved. The setup is copied again by the observer, so caller mutation cannot replace geometry or equipment after adoption.

V2 facts have exact fields:

```text
version: 'xonix-mastery-facts.v2'
runId, identity, tick, time, status, lives
player: {x,y,cutting,cutStartedAt,trailCellCount}
activeClass: {id,revision,loadoutHash,primitive,radius,duration,capacity,resistant}
classSequence, classChangedAt
regions: [{id,suppressedUntil}]
actor: {id,type,x,y,radius,stunnedUntil} | null
impactField: {id,kind,x,y,radius,until} | null
events
```

Facts are bounded to 8 KiB/512 nodes/depth 5/array 16. Geometry and recipe fields must agree with retained setup references. `trailCellCount` is the actual `state.trail.length`, not distance or pixels. V2 keeps the v1 closure/failure/completion events and additionally projects successful pickup, switch, ability and respawn events. Pickup carries `id,ammo`; switch carries `classId,hangarId`; ability carries `primitive,ammo`; redeployment carries `x,y,radius`. Other retained event payloads contain only `type,tick,time`. Rejection events are intentionally excluded from successful-action counters.

`impactField` is projected only when that tick has a successful impact use. Core appends that new field before filtering expired fields; the newly appended field's minimum lifetime exceeds one fixed tick, so the final field entry is the corresponding new pulse. The observer verifies its kind, unique last-use ID, position, radius and deadline against the same redeployment/use and active recipe. It never parses a field ID to infer time or copies every active field. Core emits `craft.redeployed` before `ability.used`; the observer requires that order.

Incoming facts remain strict, owned, consecutive and atomic. Class-history changes require a successful switch event; recovery completion requires the corresponding transition/event; a life loss requires exactly one matching failure. The previous owned sample preserves the cut and actor position erased or changed by an impact tick. The new pulse must overlap that actor under the core circle test and its actual resulting stun must cover the new field's deadline. An unrelated stun without this new-pulse overlap cannot stand in for a hit.

## Equipment qualification and preview

Supply Line needs both successful refills, the specified actual switch, and at least two distinct suppressed cells per named region in one successful cut per region, followed by a win. Different regions may use different cuts. A suppressed cell counts only at a running live-cut endpoint inside its half-open rectangle and while `suppressedUntil > time + 1e-9`, the core's signal tolerance. Do not change Steady's separate existing tolerance.

Each selected region retains a pending set and its largest successfully closed set size. Safe-ground movement, repeated dwell, expired suppression, two separate short cuts, full-pad button presses and rejected switches do not add credit. Failure, shield recovery and impact discard an open cut; earlier successful actions and closed cuts remain within that same run. Supply has **no clean-win clause**: later life loss alone does not invalidate the fulfilled route. Restarting a run clears all partial conditions.

Safe Return needs at least three live trail cells immediately before the successful impact, the named actor affected by that pulse, the associated later completed respawn, and a final win without any lost life. The impact intentionally abandons its initial cut. Safe-ground pulses, short cuts, missing the named actor, unrelated fields, incomplete recovery or a death respawn do not qualify. A timeout on the pulse tick or during recovery remains an unqualified loss. The observer does not claim that a pulse was necessary to survive. One completed qualifying recovery is sufficient; repeated pulses do not multiply the award.

The v2 preview retains `authority`, definition identity, owned setup/class history, tick/status, complete/qualified and `cleanSoFar`, with `version: 'xonix-mastery-preview.v2'`. Its typed `predicates` contain:

| Type                          | Additional preview fields                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ----------------- | ------------------------- |
| `supply-pickups`              | `padIds`, sorted `collectedPadIds`, `satisfied`.                                             |
| `suppressed-region-crossings` | `regions:[{zoneId,minCells,pendingCells,bestClosedCells,satisfied}]`, aggregate `satisfied`. |
| `hangar-switch`               | `hangarId`, `classId`, `satisfied`.                                                          |
| `clean-win`                   | `satisfied`, true only after a clean win.                                                    |
| `live-cut-impact`             | `actorId`, `minTrailCells`, `phase: 'not-started'                                            | 'awaiting-return' | 'returned'`, `satisfied`. |

It does not manufacture v1's `pendingCutCells` or `bestClosedCutCells` fields. Supply's `cleanSoFar` remains informational and is not part of its qualification. A lost terminal run cannot qualify, and an unfinished terminal recovery clears its pending phase. Snapshot data remains preview-only even when constructed from synthetic tests.

Equipment boundary and unchanged legal-route tests run with:

```sh
mise exec node@22.22.2 -- node --test game/test/mastery.test.mjs game/test/mastery-equipment.test.mjs
```

The new suite directly exercises four intended role routes, four ordinary interceptor wins and four action-omission comparisons in both turning modes, comparing existing summaries and checkpoints without regeneration. Supply banks four west cells and three south cells, picks up at ticks 1/814, switches at 813 and wins at 1210. Safe Return pulses from six trail cells at 105, returns at 182 and wins at 1120. Omitted Supply actions leave the bounded recording unfinished; omitted impact still wins with one lost life. These outcomes remain distinct in the tests. Separate replay/session integration tests verify the installed-content capability and restore path; the pure observer does not substitute for those checks.
