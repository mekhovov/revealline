# Deterministic replays

The [replay module](../game/replay.mjs) records the real Xonix kernel's fixed-tick commands and explicit input releases. Current source accepts two exact simulation contracts. Existing `xonix-level.v1` maps retain `xonix-core.v2`, `xonix-replay.v3` and `fnv1a64-state-v2`. Staged `xonix-level.v2` encounters use `xonix-core.v3`, `xonix-replay.v4` and `fnv1a64-state-v3`. These fields cannot be mixed. Both record class-switch commands, the complete roster, active craft and retained equipment state. Replay verification reconstructs a separate simulation and grants no campaign rewards. [Replay Theater](replay-theater.md) provides visual playback with the same reward boundary.

A release is part of gameplay history: the official `releaseInputs` hook clears buffered steering, speed and action latches. For example, holding Scout's action beyond its cooldown, pausing, then pressing it again produces a new scan. Omitting that pause release reproduces the same score/time summary but different ability timers. Explicit releases, introduced in v2 and retained in v3, record this distinction; verification compares the full authoritative state.

## Shell integration

```js
import { createRun, stepRun, releaseInputs, FIXED_DT } from './core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplayAsync,
  MAX_REPLAY_BYTES,
} from './replay.mjs';

const options = { seed, turnPolicy, classId, classRecipes };
const run = createRun(level, options);
let recorder = createRecorder(level, options, buildVersion);

// Once for every actual simulation tick; never once per render frame.
stepRun(run, command, FIXED_DT);
recordInput(recorder, command);

// Mirror every shell release: pause, blur, focus loss, input-mode change,
// resume cleanup, and the final clear after a completed run.
releaseInputs(run);
recordRelease(recorder);

const document = exportReplay(recorder, run);
downloadJSON(document, 'run-replay.json');

// Browser verification: show a progress message before awaiting.
if (file.size > MAX_REPLAY_BYTES) throw new Error('Replay exceeds 32 MiB.');
const result = await verifyReplayAsync(await file.text(), {
  signal: abortController.signal,
  onProgress: ({ ticks, total }) => showProgress(ticks, total),
});
showVerification(result.match, result.diagnostics, result.actual);
```

The recorder does not step or release the run itself. It owns copies of level/options/commands, and exported documents are independent snapshots. Default options are materialized, including a copy of the complete default class recipe array. A custom `options.classRecipes` array is preserved for reconstruction; it never becomes a campaign reward authorization.

Send `switchClass` as a one-tick command when the user selects a craft. The core validates that the destination is in the roster and that the player is safely docked without a live cut. Starting class identity stays stable; active class, per-class ammunition/cooldown, roster hash and ordered history change according to the accepted switch. The history is bounded to 4,096 entries; subsequent switch requests are rejected while play can continue. Record rejected commands too if they were actually stepped: the verifier must reconstruct the same attempt, not an edited list of successful actions.

Recording must begin with a new run. If a step did not happen, do not call `recordInput`. Calls after a terminal result are invalid. Export rejects a different run identity, a different tick count, or a partial internal time accumulator. Do not mutate recorder internals or gameplay state to make an export pass.

`recordInput` throws after 216,000 ticks, equivalent to 30 minutes at 120 Hz. The shell can check the recorder's tick count before stepping and pause with a valid export at the limit. If it instead continues normal play, it must disable/discard this recorder and show a recording limit message. It must not offer a truncated recording as a complete run. A new level/retry gets a new recorder.

## Document structure

```json
{
  "version": "xonix-replay.v3",
  "build": "0.2.0",
  "ruleset": "xonix-core.v2",
  "level": { "...": "complete validated level" },
  "options": { "seed": 17, "turnPolicy": "immediate", "classId": "scout", "classRecipes": [] },
  "segments": [
    {
      "ticks": 721,
      "input": {
        "direction": null,
        "boost": false,
        "action": true,
        "pickup": false,
        "switchClass": null
      },
      "releaseBefore": false
    },
    {
      "ticks": 1,
      "input": {
        "direction": null,
        "boost": false,
        "action": true,
        "pickup": false,
        "switchClass": null
      },
      "releaseBefore": true
    }
  ],
  "releaseAfter": true,
  "ticks": 722,
  "summary": { "...": "getSummary snapshot" },
  "checkpoint": {
    "algorithm": "fnv1a64-state-v1",
    "hash": "16 hexadecimal characters",
    "sections": { "...": "named section checksums" }
  }
}
```

This is a shape illustration, not an importable fixture; exports contain the real level, nonempty recipes, summary and checksums.

Adjacent equal commands use run-length encoding. `releaseBefore` applies the official release hook immediately before the segment's first tick; it prevents merging across a release even when both commands are identical. Consecutive releases without a simulated tick collapse because the hook is idempotent. `releaseAfter` preserves a final pause/release with no later command. Releases consume no simulation time. No private core field is assigned by playback.

## Verification and limits

Exports from [game/replay.mjs](../game/replay.mjs):

| API                                                             | Behavior                                                                                                       |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `createRecorder(level, options={}, build='unknown')`            | Validate and copy a new run's inputs/configuration.                                                            |
| `recordInput(recorder, input)`                                  | Record exactly one fixed-tick command; normalize missing booleans to false and direction/class switch to null. |
| `recordRelease(recorder)`                                       | Record the mirrored official release hook without adding time.                                                 |
| `exportReplay(recorder, state)`                                 | Return an independent complete JSON document with summary and checkpoint.                                      |
| `authoritativeCheckpoint(state)`                                | Return the versioned full-state checksum and section hashes.                                                   |
| `verifyReplay(data)`                                            | Synchronous Node/tool verification. Accept a parsed object or JSON string.                                     |
| `verifyReplayAsync(data, {chunkTicks=600, onProgress, signal})` | Own and validate the input before the first yield, then reconstruct in cancellable chunks.                     |

Both verification functions return `{state, match, diagnostics, actual:{summary,checkpoint}, recordedBuild, ticks}`. State mismatches identify sections through diagnostics such as `{code:'state-mismatch',section:'ability',message,...}`. A summary mismatch is reported separately. Malformed, unsupported or oversized documents throw `ReplayValidationError`; cancellation throws an error named `AbortError`. A valid but divergent replay returns `match:false`.

The checkpoint covers identity and configuration; every cell/count/coverage; player position, cardinal direction, queue and grace; live tiles and path segments; enemies and their status/boss timing; objectives and supplies; ability resources, timers and fields; the complete retained per-class loadout bank, class history and switch cooldown; signal rectangles/effects and configured challenge budgets; status/time/tick/lives/score/recovery; input latches, serial counters and terminal continuation state; and the completed result. Decorative heading, body/palette data, class display wording and ephemeral last-step events are excluded. The whole checksum is computed from named section checksums, and those sections are compared independently.

Encounter checkpoints additionally hash the entire normalized `level.encounter` descriptor under `configuration` and the entire authoritative `run.encounter` object in a separate `encounter` section. Stage, phase, lane, timing, transition and defeat facts are reconstructed from inputs, never assigned from imported data. Old maps receive neither an empty encounter field nor an extra checksum section; the v0.10 compatibility fixture pins their existing replay and profile outputs. `REPLAY_VERSION` and `CHECKPOINT_ALGORITHM` remain legacy defaults; `createRecorder` and verification dispatch from the validated map/version pair. Encounter maps currently support ordinary completion rewards only, with no optional mastery definition.

Checksums use stable canonical JSON and FNV-1a64. They detect accidental divergence; they are **not signatures, authentication or an anti-cheat proof**. Someone able to edit a replay can also edit its expected hashes. A match states that the currently loaded kernel reconstructed its recorded expected state. The recorded build string is reported as provenance; it does not load old executable code. Changes to simulation semantics require versioned rules and appropriate replay compatibility decisions.

The file cap is 32 MiB, with at most 216,000 ticks/segments, bounded depth/nodes/string lengths, finite numbers and explicit input fields. Unknown replay fields, unsupported class primitives, prototype-related keys, accessors, cycles and non-JSON prototypes are rejected. Claimed totals must equal the RLE sum. Additional commands after a terminal result are rejected. This is local data validation, not a server trust boundary.

Async verification performs at most 600 ticks per default chunk, also checking an approximately 8 ms wall-time budget every 8 ticks. Wall time only schedules yields; it never changes simulated input or time. `chunkTicks` can be 1..1200. Parsing and bounded structural validation are synchronous startup work after the initial yield; this is a chunked simulator, not a Web Worker. Very large, rapidly changing input documents still incur their parsing/validation cost. A typical long held-input replay remains small through RLE. Use the asynchronous API in the playground, avoid expanding the segments into 216,000 input objects, and retain the size limit before reading a file.

`xonix-replay.v1` and `xonix-replay.v2` are explicitly rejected by the current verifier. Use the matching archived game for those records, or record a fresh attempt with the current kernel. Missing releases or class-switch semantics cannot be reconstructed honestly. A recorded build label never downloads or executes another version.

## Tests

Run `node --test game/test/replay.test.mjs`. The suite covers RLE/copy isolation; the held-Scout pause regression; trailing and repeated releases; every authoritative checksum section; cosmetic exclusion; completed runs; tampered commands/summaries; identity/tick/partial-time errors; malformed/prototype JSON; recording limits; asynchronous yielding/cancellation; custom recipes; class switching and retained loadouts; and a full 216,000 tick recording. Browser UI wiring and campaign reward boundaries are tested separately by their owners.

## Browser round trip

Choose **Export replay** in the game. This pauses an active attempt, downloads JSON and opens the same JSON in a read-only dialog for copying. In Playground, expand **Replay a recorded run**, select the file or paste it, and choose **Verify pasted replay**. A new verification cancels the previous one; only the latest result updates the UI. That playground control verifies the simulation without animated playback or rewards. For visual playback, open [Replay Theater](../game/replay-theater/), select a file or paste its JSON, and wait for verification before using Play, Pause, Restart or Step 1 tick. The theater includes four Fieldcraft examples and 0.5×/1×/2× transport rates; it remains silent and does not read or write player progress.

The shell records up to 30 minutes. At that bound it explicitly discards the recorder and disables export while allowing play to continue. Start a fresh attempt to record again; the limit never produces a misleading partial export.

The theater's transport pause preserves the recorded run's input latches; it must not add an unrecorded `releaseInputs` call. Only the replay's explicit releases affect authoritative state. Switching the visual theme changes no recorded inputs or gameplay values. See [the controller contract](replay-theater.md) for cancellation, frame budgets and final-checkpoint comparison.

## Save and resume an unfinished attempt

The game offers **Save & pause**, then **Library & saves → Saves & loads → Load suspended attempt** or **Export attempt**. This is a separate `xonix-session.v1` envelope, not a replay-only import. It includes the replay, campaign identity, stable run ID, theme/body IDs and a validated UTC save timestamp. The run ID remains stable across resume so the same completion is not awarded twice.

[sessions.mjs](../game/sessions.mjs) exposes these boundaries:

| API                                                                             | Behavior                                                                                                                                                              |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suspendSession({run, recorder, campaignKey, themeId, bodyId, runId, savedAt})` | Require an unfinished run, mirror an official input release, then export its complete recording                                                                       |
| `restoreSession(candidate, {campaign, campaignKey, signal, onProgress})`        | Snapshot and validate the whole envelope, asynchronously verify the recording, match installed map/roster data and return a reconstructed run and continuing recorder |
| `snapshotSession(candidate)`                                                    | Return an owned envelope after metadata and nested simulation-pair checks; this does not verify its outcome                                                           |
| `saveSession(storage, key, session)`                                            | Validate and persist a bounded slot; report failure while preserving the previous slot                                                                                |

The portable envelope allows the replay's 32 MiB plus 16 KiB of metadata. The automatic local slot has a stricter 2 MiB budget; a larger valid attempt needs its exported file. Metadata, date syntax, object shape, keys, depth and byte limits are checked before adopting any state. The entire document and installed campaign are copied before asynchronous verification, so later caller mutation cannot alter what is accepted. Missing, terminal, mismatched or corrupt attempts leave the current game unchanged.

Install the matching expansion before loading its attempt. A successful standalone replay match does not authorize replacing installed campaign rules or granting a reward. Only a subsequently completed normal campaign run can enter progression. A resumed run rebuilds its recorder from the original segments and releases, then records future fixed ticks normally; a cut can remain live across suspension without assigning private simulation state.

The session, library, pack-library and complete-backup envelope versions remain unchanged. A complete backup may include v1/v2 expansion packs and v3 encounter packs together, plus either supported replay version in its suspended slot. Each campaign contains one simulation version; mixed old/new maps require separate campaigns. Encounter packs require `engine: 'xonix-core.v3'` and explicit `masteries: []`; their practice scenarios use `xonix-playground.v3` and `masteryDefinition: null`. Invalid pairings fail before image decoding or adoption. Older frozen readers do not acquire new encounter support: use complete-backup transfer into a compatible newer build, retaining the older release and backup when needed.

Player-library exports contain progress, preferences, local scores and picture metadata; pack-library exports contain actual imported media and campaigns. Those formats can also be combined in a validated `xonix-backup.v1` archive with [coordinated import recovery](full-backup.md). See [library and packs](library-and-packs.md) for selective exports. These are editable local files, with no cloud recovery or authenticated achievement service.

Run `node --test game/test/sessions.test.mjs` for both-policy live-cut continuation, installed-content mismatch, malformed metadata, async mutation, and storage-preservation regressions. Simulation replay checks do not certify browser audio, physical controller behavior or visual quality.
