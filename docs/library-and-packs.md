# Player library and expansion packs

The playable runtime separates a portable player library from an installed expansion library. Both are versioned, local data. Importing a file does not fetch remote media, execute scripts, grant authenticated online scores, or alter archived game releases.

## Player library

`game/library.mjs` exports the pure-data API. The shell supplies storage and owns file pickers, dialogs and recovery messaging. No browser storage is read by this module until the caller explicitly invokes `loadLibrary`.

```js
import {
  emptyLibrary, progressFor, recordLibraryCompletion,
  importLibrary, exportLibrary, loadLibrary, saveLibrary,
  updatePreferences, setCampaignProgress,
} from './library.mjs';

const loaded = loadLibrary(storage, 'revealline.library.v1', { campaigns: [campaign] });
let library = loaded.library;
const progress = progressFor(library, campaign);

// A matching terminal core result, never an arbitrary visible score label.
library = recordLibraryCompletion(library, {
  campaign, result: coreSummary, runId,
  themeId: theme.id, bodyId: selectedBody,
  sourcePackId: currentPack?.id ?? null,
});
const write = saveLibrary(storage, 'revealline.library.v1', library, loaded.recovery);
// If !write.ok: retain the session and expose exportLibrary(library) as a file.

const before = library;
const imported = importLibrary(fileText, { campaigns: availableCampaigns });
// Adopt only after the whole file validates. Keep before until storage succeeds.
library = imported;
```

The file has format `xonix-library.v1` and five sections. Earlier v1 files lacking the additive `masterVolume` preference migrate to 0.8 without losing progress:

| Field | Purpose |
| --- | --- |
| `preferences` | Theme/body/class selection, steering policy, terrain style/grid, reduced effects, music enabled/genre, master, music and SFX volumes. |
| `campaigns` | Saved progression keyed by campaign identity and a content digest. |
| `gallery` | One earned image entry for each campaign/map/theme combination, with its best complete attempt and original pack identity. |
| `scores` | Actual completed attempts, preserving score/time/medal/class route together. |
| `format` | Explicit portable-file version; unsupported versions fail closed. |

`campaignKey(campaign)` includes the current ruleset, normalized level content and complete class recipe roster. Editing mechanics, levels or that roster produces a different progression partition. This conservative digest also changes for campaign level presentation metadata or recipe display text; it does not silently migrate renamed or retuned content. Registered theme art outside levels is independent. `progressFor` returns a clone, so a caller cannot accidentally mutate the stored record.

A scoreboard identity additionally includes level content, the starting recipe, steering policy, seed and ordered class route. Starting in Scout and switching to Bomber is a different board from a Scout-only completion. Switching times are not partition keys. Leaderboards sort by score descending, then time ascending, then stable completion time/run identity. Ten attempts per board and 1,000 attempts in total are retained. These are **local scoreboards**, editable by the device owner; there is no server, signature, global ranking or anti-cheat promise.

Only matching wins enter the gallery and scoreboard. Practice and couch sessions remain separate unless a later mode defines its own explicitly named competitive rules. `awardCompletion` checks roster identity, class transitions, configured medal thresholds, lives and goal coverage. New progress variants include both roster and class-route hashes. Legacy five-part variants remain readable for an explicit old-save migration, and subsequent new variants remain separate.

For a known old campaign save, validate it with `validateProgress` then call `setCampaignProgress`. Migration retains old achievements but does not manufacture a gallery picture, individual historical run or replay from aggregated best scores. Unknown campaign records survive portable roundtrips while a pack is temporarily removed. They are validated against their known campaign again when that content returns.

The profile budget is 4 MiB, 512 campaign identities, 4,096 gallery entries and 1,000 local scores. The game preserves old pictures and reports capacity rather than silently dropping them. The gallery searches 12 pictures per page; local scores search ten setup groups per page. Gallery entries contain metadata, not an unlimited copy of every original image. Keep and export the originating pack to preserve its artwork. Importing a library alone does not install missing packs. Corrupt stored bytes are returned as `recovery`; `saveLibrary` preserves them under a unique recovery key before replacement. If preserving the original or writing the new profile fails, the previous primary record is not replaced by that failed operation. The caller retains the in-memory session and offers a portable backup.

In-progress sessions belong to the replay/session workflow. Do not serialize mutable kernel objects into this profile or interpret an imported completion record as permission to resume a run. Recovery must reconstruct a run from validated inputs and compare its checkpoint before adopting state.

## Expansion contract

`game/packs.mjs` accepts `xonix-pack.v1`. A complete pack contains:

```js
{
  format: 'xonix-pack.v1',
  id: 'my-expansion',
  version: '1.0.0',
  name: 'My Expansion',
  description: 'An original themed challenge collection.',
  engine: 'xonix-core.v2',
  dependencies: [],
  metadata: {
    author: 'Your name',
    license: 'Your distribution license',
    rightsStatus: 'Original artwork',
  },
  themes: [/* validated complete theme recipes */],
  classRecipes: [/* validated registered behavior recipes */],
  campaigns: [{
    version: 'xonix-campaign.v1',
    id: 'my-campaign', revision: '1', title: 'My Campaign',
    themeId: 'my-theme', musicId: 'my-music',
    // Optional classIds restricts this campaign to a subset of pack recipes.
    levels: [/* full xonix-level.v1 maps */],
  }],
  visualOverrides: {},
  levelVisuals: [],
  music: [{
    id: 'my-music', name: 'Original Night Drive',
    genre: 'synthwave', tempo: 112, root: 45, scale: 'minor',
  }],
}
```

The three complete editable examples are [Night Shift](../game/content/packs/night-shift.json), [Living Threads](../game/content/packs/living-threads.json) and [Fieldcraft](../game/content/packs/fieldcraft.json). Their ten maps use different authored geometry, time/cut/trail constraints and specialty class interactions. They contain original procedural scene/music recipes; no downloaded Telegram artwork or commercial song is bundled.

Themes, class recipes and map IDs are local to the pack. IDs must be stable, bounded and unique in their declared scope. Map IDs are unique across the entire pack. Reserved JavaScript property names are excluded by this interchange boundary. Optional `level.themeId` and `level.musicId` override campaign choices. `campaign.classIds` selects registered recipes from that pack. `sourcePackId` is returned separately for UI selection and gallery provenance.

`visualOverrides` supports `background`, `player`, `enemy`, `patrol`, `boss`, `objective`, `supply` and `wall`. A descriptor uses `dataUrl`, optional `name`, `fit` and provenance `metadata`. A per-map override has shape `{levelId, visualOverrides}` and merges over shared roles. Replacing the player image retains the body rig's existing attachment/propeller anchors; it does not create an aligned animated rig automatically. New rigs use the separate animation pipeline. Only background fitting changes between contain/cover; actor images keep their registered footprint.

The music descriptor accepts `synthwave`, `chiptune`, `rock`, `metal` or `ambient`; tempo 60–180, integer MIDI root 36–84, and `minor`, `major` or `dorian`. It directs the original synthesizer. No raw audio, remote URL, MIDI code or arbitrary pattern script is accepted in this version. New sample/stream formats would need their own decoding, memory, playback and provenance contract.

Use **Library & saves → Saves & loads → Export complete backup** for one portable file containing the player library, installed packs and the current unfinished campaign flight or saved fallback. Load a file/pasted JSON and use **Undo complete backup import** to restore the previous collection in this page. See [full backup and recovery](full-backup.md) for the single-writer policy and exact protocol. It reuses these validators and performs coordinated storage writes only after complete preparation. The separate exports below remain supported.

## Prepare, install and switch content

```js
import {
  emptyPackLibrary, preparePack, installPack, removePack,
  exportPackLibrary, importPackLibrary, resolvePackCampaign,
  scenarioFromPack,
} from './packs.mjs';

let expansions = emptyPackLibrary();
const prepared = await preparePack(fileText); // Browser performs complete image decode.
const next = installPack(expansions, prepared.pack);
// Store/export next successfully before replacing the persisted library.
expansions = next;

const content = resolvePackCampaign(prepared.pack, prepared.pack.campaigns[0].id);
// content.campaign includes the resolved classRecipes for progress/replay identity.
const scenario = scenarioFromPack(
  prepared.pack, content.campaign.id, content.campaign.levels[0].id,
  { turnPolicy: 'grid-center', seed: 1 },
);
```

`validatePack` is a synchronous structural/header check for authoring and CI. It does **not** certify full image decoding. `preparePack` performs all shape, budget and image-header validation before allocating a decode surface, snapshots the candidate, decodes sequentially and requires actual dimensions to match each header. Caller edits during decoding cannot change that snapshot. Only successful prepared objects can install; accepted packs and library containers are frozen. Do not mutate or `structuredClone` them and then attempt to install the clone: re-prepare the edited JSON instead.

`importPackLibrary` validates the entire multi-pack file and its dependencies before starting any image decode. It adopts nothing until every pack succeeds. `exportPackLibrary` returns a portable JSON string containing all installed original asset bytes. A `decodeImage` injection exists for tests and non-browser tools, returning `{naturalWidth,naturalHeight}`; a header-only stub is not evidence that real images decoded.

Each dependency is an exact `{id,version}` pin. There are no version ranges, remote registries, code loading or implicit transitive fetches. Missing versions, repeated IDs, cycles, an incompatible dependency upgrade and removal of a required pack reject atomically. Dependencies are compatibility requirements; each current pack remains self-contained and does not inherit classes or assets from another pack. Install/update replaces the prior pack with the same ID only after the resulting library validates. Existing progress stays in its content partition, and old portable files can be retained independently.

Budgets: at most 12 installed packs, 24 MiB per pack, 48 MiB for the expansion library, 128 maps, eight campaigns, 16 themes and 40 class recipes per pack. Artwork also obeys the original 4 MiB/image, 6 MiB encoded/image, 20 MiB combined encoded, 8,192-pixel side, 16-megapixel/image and 32-megapixel/pack limits. All scopes count toward combined budgets, including repeated bindings. These are upper guards, not a promise that every low-memory phone should use the full allowance.

For source selection, runtime expansion imports, signal/hangar painting, interaction presets and exact music previews, see [the current playground guide](playground-runtime.md).

## Authoring and verification

The kernel supports only its implemented behavior primitives and rule fields. JSON can tune and combine them; a new weapon, actor behavior or networking model needs implemented code, replay identity and meaningful tests. Keep military inspiration at the level of fictional game classes, silhouettes, signal regions and clear visual telegraphs.

Run relevant tests before packaging:

```sh
node --test game/test/library.test.mjs game/test/packs.test.mjs game/test/progress.test.mjs game/test/expansion-playthrough.test.mjs
node scripts/verify-packs.mjs
```

When intentionally revising supplied maps or class recipes, `node scripts/verify-packs.mjs --discover` performs a bounded legal-input route search and writes new fixtures. Review the content diff before recording a new pack version. The standard proof covers all ten supplied maps under both turning policies: 20 wins without state edits, enemy removal or changing the rules. `node scripts/verify-specialty.mjs` adds 70 Fieldcraft attempts: eight specialty clears, 56 ordinary clears covering every class and both policies, and six comparisons with selected actions omitted. It measures signal resistance, supplied emitter suppression, a hangar switch, Impact recovery and net slowing. This establishes the recorded routes and their actual interactions; it does not establish balance, enjoyable difficulty, finger controls, audio quality or player retention. Test those in the actual shell and on target devices.

### Useful AI authoring prompts

1. “Create a three-map Ukrainian embroidery expansion from Living Threads. Keep the current engine contract, use original patterns, vary walls and objective routing, and prove all maps under both steering policies.”
2. “Make a Night Shift variant with an original rock soundtrack recipe. Keep exact map mechanics unchanged so the comparison measures music and readability.”
3. “Create an FPV signal maze that gives the fiber class a distinct choice. Use registered signal zones and visible trail risks, show an escape route, and document fictional units.”
4. “Add a two-stage hangar challenge using registered class switching. Require a meaningful equipment choice without trapping players on a map that their starting class cannot finish.”
5. “Replace only the boss image and preserve its footprint. Keep provenance, inspect sprite/telegraph contrast, and verify the boss phases are unchanged.”
6. “Prepare separate background pictures for every level in this pack. Use levelVisuals, preserve original bytes and document rights; do not infer a license from a public preview.”
7. “Review this third-party pack as data. Report unsupported fields, missing dependencies, oversized images and unavailable behaviors. Preserve the installed library if any stage fails.”
8. “Retune this pack for a relaxed family session with more lives and slower enemies. Give it a new version and test both movement policies; do not mix those scores with the harder rules.”
9. “Export my local player library and expansion library separately. Validate both roundtrips and explain how missing packs affect saved gallery images.”
10. “Investigate a corrupt save using a copy. Preserve the original bytes, distinguish old valid variants from unsupported versions, and recover only records whose schema and known content identity validate.”

## Design references

Browser storage belongs to an origin. Web Storage operations are synchronous; large asset libraries should use asynchronous storage and avoid per-frame writes. The pure APIs here keep that backend replaceable. [MDN Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) and [Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB).

Quota failures and browser eviction mean local persistence should be paired with a user-owned export. The game must communicate failed persistence rather than silently reporting success. [MDN storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

Steam Workshop still requires the game to implement content loading and integration. This data-only pack boundary and local authoring environment provide that game-side structure; they do not constitute a Steam integration, upload, dependency service or Workshop entitlement system. [Steamworks Workshop documentation](https://partner.steamgames.com/doc/features/workshop).
