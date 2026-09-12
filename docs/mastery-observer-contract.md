# Steady Signal observer foundation

This is working source after frozen v0.6.0. It implements one optional badge definition and a pure observation module, [game/mastery.mjs](../game/mastery.mjs). It does not add a badge to the interface, grant an achievement, change a level, write a library, import a pack or install a replay callback. Those integrations remain separate work in the [mastery plan](round-15-mastery-plan.md).

**Steady Signal** asks the player to close one cut that sampled at least eight distinct cells inside Copper Orchard's active `broad-band` region while the active class had signal resistance, then win that same attempt without losing a life. Its definition identity is `mastery-v1-2e6aae3f42f3d3c2`. Equipment mastery is optional: an ordinary interceptor victory remains a normal victory with the same picture, score and medal.

## Public API

| Export | Contract |
|---|---|
| `MASTERY_DEFINITION_VERSION` | `xonix-mastery-definition.v1`. |
| `STEADY_SIGNAL` | Deeply frozen original definition for `homeward-skies` / `homeward-01`. |
| `MAX_MASTERY_TICKS` | 216,000 fixed ticks, matching the present 30-minute replay budget. |
| `resolveMasteryDefinition(value)` | Return an owned canonical definition or throw `TypeError`. No JSON-string shorthand or partial defaults. |
| `validateMasteryDefinition(value)` | Return `{valid, errors}` without adoption. |
| `masteryDefinitionIdentity(value)` | `mastery-v1-` plus `dataIdentity` of the canonical definition, including its metadata. |
| `captureMasterySetup(state, {campaignId, campaignKey, runId})` | Capture a fresh validated core-v2 run at tick/time zero, with normalized-level identity and initial setup. |
| `captureMasteryFacts(state, {runId})` | Project owned facts from trusted public core state. This helper is not an imported-file validator. |
| `createMasteryObserver({definition, setup, initial})` | Copy and validate the complete definition, setup and initial facts; return frozen `{observe, snapshot}`. |
| `observer.observe(facts)` | Accept one consecutive fixed tick; return `undefined`. Invalid input throws before altering retained progress. |
| `observer.snapshot()` | Return owned `xonix-mastery-preview.v1` data, always labeled `authority: 'preview-only'`. |

A future host/verifier adapter can use the following shape. This example illustrates the observation boundary, not a new replay interpreter or award path:

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

The next integration must reconstruct the whole replay through the existing verifier, bind the installed campaign, normalized map, roster, definition and original run ID, and require an exact winning summary/checkpoint before issuing an owned verification capability. It must also preserve the host's live completion eligibility and library replacement generation. A practice/theater preview must never grant an earned seal. The separate metadata-record contract does not confer this authority either.

Definitions remain outside levels and packs. Existing core-v2 state, normalization, scoreboards, summaries, checkpoint projections, replay files, ordinary progress and the frozen v0.6.0 distribution remain unchanged. See the independent [compatibility baseline](mastery-compatibility-baseline.md). Changing any definition content changes its identity; historical clears do not imply equipment mastery, and separate attempts never combine incomplete conditions.

## Reproducible evidence

Run:

```sh
mise exec node@22.22.2 -- node --test game/test/mastery.test.mjs
```

The tests include strict/adversarial definitions, atomic invalid-fact rejection, owned-copy boundaries, duplicate/stationary cells, safe/suppressed regions, separate short cuts, all three recovery events, life loss, timeout, event order, active-class switching and original setup retention. Synthetic fact tests are labeled as observer boundary tests; they are not gameplay-completion claims.

Four integration tests replay unchanged legal inputs from `game/replays/homeward-routes.json` through `createRun` / `stepRun`, record them with the public recorder, and run `verifyReplay`. They compare the archived summaries and authoritative checkpoints without regeneration:

| Copper Orchard route | Turning policy | Final tick | Best successful resistant cut | Preview |
|---|---|---:|---:|---|
| Fiber specialty | Immediate | 1,305 | 22 cells | Qualified |
| Fiber specialty | Cell-center | 1,305 | 22 cells | Qualified |
| Interceptor ordinary | Immediate | 3,748 | 0 cells | Not qualified; ordinary win unchanged |
| Interceptor ordinary | Cell-center | 3,751 | 0 cells | Not qualified; ordinary win unchanged |

All four retain three successful cuts and all three lives. A further legal Fiber test releases input at tick 180 during a live cut, finishes at the unchanged archived checkpoint, reconstructs the entire recording with its explicit release boundary, and obtains the same preview. These are deterministic route and compatibility results; they do not demonstrate a shipped badge UI, an awarded record or player enjoyment.
