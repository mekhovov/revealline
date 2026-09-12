# Deterministic replays

The [replay module](../game/replay.mjs) records the real Xonix kernel's fixed-tick commands and explicit input releases. The format is `xonix-replay.v2`. Replay verification runs a separate simulation and grants no campaign rewards.

A release is part of gameplay history: the official `releaseInputs` hook clears buffered steering, speed and action latches. For example, holding Scout's action beyond its cooldown, pausing, then pressing it again produces a new scan. Omitting that pause release reproduces the same score/time summary but different ability timers. Version2 records this distinction and compares the full authoritative state.

## Shell integration

```js
import {createRun, stepRun, releaseInputs, FIXED_DT} from './core/index.mjs';
import {
  createRecorder, recordInput, recordRelease, exportReplay,
  verifyReplayAsync, MAX_REPLAY_BYTES
} from './replay.mjs';

const options = {seed, turnPolicy, classId, classRecipes};
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
  onProgress: ({ticks, total}) => showProgress(ticks, total)
});
showVerification(result.match, result.diagnostics, result.actual);
```

The recorder does not step or release the run itself. It owns copies of level/options/commands, and exported documents are independent snapshots. Default options are materialized, including a copy of the complete default class recipe array. A custom `options.classRecipes` array is preserved for reconstruction; it never becomes a campaign reward authorization.

Recording must begin with a new run. If a step did not happen, do not call `recordInput`. Calls after a terminal result are invalid. Export rejects a different run identity, a different tick count, or a partial internal time accumulator. Do not mutate recorder internals or gameplay state to make an export pass.

`recordInput` throws after 216,000 ticks, equivalent to 30 minutes at 120 Hz. The shell can check the recorder's tick count before stepping and pause with a valid export at the limit. If it instead continues normal play, it must disable/discard this recorder and show a recording limit message. It must not offer a truncated recording as a complete run. A new level/retry gets a new recorder.

## Document structure

```json
{
  "version": "xonix-replay.v2",
  "build": "0.1.0",
  "ruleset": "xonix-core.v1",
  "level": {"...": "complete validated level"},
  "options": {"seed": 17, "turnPolicy": "immediate", "classId": "scout", "classRecipes": []},
  "segments": [
    {"ticks": 721, "input": {"direction": null, "boost": false, "action": true, "pickup": false}, "releaseBefore": false},
    {"ticks": 1, "input": {"direction": null, "boost": false, "action": true, "pickup": false}, "releaseBefore": true}
  ],
  "releaseAfter": true,
  "ticks": 722,
  "summary": {"...": "getSummary snapshot"},
  "checkpoint": {
    "algorithm": "fnv1a64-state-v1",
    "hash": "16 hexadecimal characters",
    "sections": {"...": "named section checksums"}
  }
}
```

This is a shape illustration, not an importable fixture; exports contain the real level, nonempty recipes, summary and checksums.

Adjacent equal commands use run-length encoding. `releaseBefore` applies the official release hook immediately before the segment's first tick; it prevents merging across a release even when both commands are identical. Consecutive releases without a simulated tick collapse because the hook is idempotent. `releaseAfter` preserves a final pause/release with no later command. Releases consume no simulation time. No private core field is assigned by playback.

## Verification and limits

Exports from [game/replay.mjs](../game/replay.mjs):

| API | Behavior |
|---|---|
| `createRecorder(level, options={}, build='unknown')` | Validate and copy a new run's inputs/configuration. |
| `recordInput(recorder, input)` | Record exactly one fixed-tick command; normalize missing booleans to false and direction to null. |
| `recordRelease(recorder)` | Record the mirrored official release hook without adding time. |
| `exportReplay(recorder, state)` | Return an independent complete JSON document with summary and checkpoint. |
| `authoritativeCheckpoint(state)` | Return the versioned full-state checksum and section hashes. |
| `verifyReplay(data)` | Synchronous Node/tool verification. Accept a parsed object or JSON string. |
| `verifyReplayAsync(data, {chunkTicks=600, onProgress, signal})` | Browser verification that yields before work and between chunks, with cancellation. |

Both verification functions return `{state, match, diagnostics, actual:{summary,checkpoint}, recordedBuild, ticks}`. State mismatches identify sections through diagnostics such as `{code:'state-mismatch',section:'ability',message,...}`. A summary mismatch is reported separately. Malformed, unsupported or oversized documents throw `ReplayValidationError`; cancellation throws an error named `AbortError`. A valid but divergent replay returns `match:false`.

The checkpoint covers identity and configuration; every cell/count/coverage; player position, cardinal direction, queue and grace; live tiles and path segments; enemies and their status/boss timing; objectives and supplies; ability resources, timers and fields; status/time/tick/lives/score/recovery; input latches, serial counters and terminal continuation state; and the completed result. Decorative heading, body/palette data, class display wording and ephemeral last-step events are excluded. The whole checksum is computed from named section checksums, and those sections are compared independently.

Checksums use stable canonical JSON and FNV-1a64. They detect accidental divergence; they are **not signatures, authentication or an anti-cheat proof**. Someone able to edit a replay can also edit its expected hashes. A match states that the currently loaded kernel reconstructed its recorded expected state. The recorded build string is reported as provenance; it does not load old executable code. Changes to simulation semantics require versioned rules and appropriate replay compatibility decisions.

The file cap is 32 MiB, with at most 216,000 ticks/segments, bounded depth/nodes/string lengths, finite numbers and explicit input fields. Unknown replay fields, unsupported class primitives, prototype-related keys, accessors, cycles and non-JSON prototypes are rejected. Claimed totals must equal the RLE sum. Additional commands after a terminal result are rejected. This is local data validation, not a server trust boundary.

Async verification performs at most 600 ticks per default chunk, also checking an approximately 8 ms wall-time budget every 8 ticks. Wall time only schedules yields; it never changes simulated input or time. `chunkTicks` can be 1..1200. Parsing and bounded structural validation are synchronous startup work after the initial yield; this is a chunked simulator, not a Web Worker. Very large, rapidly changing input documents still incur their parsing/validation cost. A typical long held-input replay remains small through RLE. Use the asynchronous API in the playground, avoid expanding the segments into 216,000 input objects, and retain the size limit before reading a file.

Summary-only `xonix-replay.v1` files are explicitly rejected with a re-record message. Missing release history cannot be reconstructed honestly.

## Tests

Run `node --test game/test/replay.test.mjs`. The suite covers RLE/copy isolation; the held-Scout pause regression; trailing and repeated releases; every authoritative checksum section; cosmetic exclusion; completed runs; tampered commands/summaries; identity/tick/partial-time errors; malformed/prototype JSON; recording limits; asynchronous yielding/cancellation; custom recipes; and a full 216,000 tick recording. Browser UI wiring and campaign reward boundaries are tested separately by their owners.
