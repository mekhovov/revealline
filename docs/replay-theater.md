# Replay Theater

Open [the theater](../game/replay-theater/) from a running source server or static release. It uses the game's `BoardPainter`, four presentation themes and animated character rigs. The page is silent. It loads Copper Crossing paused and includes four genuine Fieldcraft recordings: fiber interference resistance, carrier supplies and a hangar change, impact recovery, and a net-assisted cut. Two use immediate steering and two use grid-center steering. A theme selection changes presentation; it does not replace the recorded map, rules, class recipes or inputs.

Choose **Play**, **Pause**, **Restart** or **Step 1 tick**, and choose **0.5×**, **1×** or **2×**. The canvas also accepts Space to play/pause and Right Arrow to step. A progress bar reports position; arbitrary seeking and input overrides are deliberately absent. The latest 12 recorded events identify equipment use and class changes. Completed winning recordings receive the same visual reveal as the game. The visible final checkpoint must match the previously verified source.

The working Theater has keyboard and standard-controller menu navigation. Arrow keys move focus among visible controls; Enter uses the control's native action, while Tab and native text/select editing remain available. Repeating Enter, Space or Escape cannot activate a second action. Canvas Space/Right keep their transport shortcuts. A controller must first be neutral, then join with a fresh face-button press; joining does not start playback. D-pad moves focus, South confirms, East goes back, and Menu pauses and focuses transport. Controller select changes remain a draft until Confirm; Back cancels the draft without also pausing or leaving. File pickers and pasted text retain keyboard/touch access and explicit guidance rather than a simulated trusted picker activation.

Outside an active edit, Back/Escape cancels a pending load first. Otherwise it pauses playback and focuses **Back to the game**; leaving requires a separate activation of that link. The page does not implicitly resume a game or navigate on Back. Controller scope changes, native input and loss of focus require neutral controls again. These are standalone default mappings; the silent Theater does not read saved controller preferences or take ownership of session music from another page.

No player progress, saves, gallery records, achievements or scoreboards are read or written. The page imports no player-library module and uses no browser storage. Its only fetches are its own built-in examples and presentation assets. Imported JSON is processed locally. The recorded point count is a readout, not a submitted score.

## Import boundary

Open **Import your own replay** and select a normal `xonix-replay.v3`, `.v4`, `.v5` or `.v6` file, or paste JSON and choose **Verify and load JSON**. Version 3 preserves existing core-v2 maps; version 4 carries core-v3 staged encounters, version 5 the wide core-v4 branch, and version 6 Classic core-v5. The level, ruleset, replay version and checkpoint algorithm must form one supported pair. Limits remain 32 MiB and 216,000 ticks (30 recorded minutes at 120 Hz), plus the replay format's structural limits. File size is checked before reading; the player checks text and object budgets before use. Invalid or outdated recordings display an error and leave the previous recording paused and intact. A newer import supersedes an earlier load, and **Cancel load** prevents any pending recording from being adopted. File reading itself may finish after cancellation, but its result is discarded.

The main controls remain inert until startup assets and handlers are ready. Imports verify in cancellable chunks before a new player and painter are adopted together. Imported strings are written with `textContent`, never interpreted as HTML. Hidden pages, blur, native inactivity, selected-controller loss and a frame gap over 250 ms pause playback; resuming never chases a backlog of unobserved ticks. Focus/lifecycle return never starts playback. Page hide cancels an unfinished import; final disposal removes navigation/device listeners and the animation loop and rejects later load results. A native lifecycle subscription arriving after disposal is immediately removed.

## Pure controller contract

[`game/replay-player.mjs`](../game/replay-player.mjs) exports `prepareReplayPlayer(source, { signal, onProgress, chunkTicks })`. It synchronously owns a bounded copy of the source before the verifier's first yield, calls `verifyReplayAsync`, and returns a controller only if the source checkpoint matches. `onProgress` receives `{ ticks, total, fraction }`. Cancellation rejects with `AbortError`; a checkpoint mismatch rejects with `ReplayVerificationError`.

The controller exposes immutable `info`, and getters for `state`, `phase`, `rate`, `finalCheckpoint` and `error`. Its methods are `play()`, `pause()`, `reset()`, `setRate(0.5 | 1 | 2)`, `step(count = 1)` and `advance(frameSeconds)`. Reports contain `{ phase, tick, totalTicks, rate, ticks, events, reason, finalCheckpoint }`. A step request accepts 1–240 ticks and pauses transport. The page exposes only the single-tick control. Playback phases are `paused`, `playing`, `complete` and `error`.

`state` is the core's mutable read model for the existing renderer: consumers must not modify it. The controller owns RLE segment cursors and executes only the source's recorded inputs. Transport pauses preserve input latches and queued grid turns; only recorded `releaseBefore` / `releaseAfter` markers call `releaseInputs`. Restart creates a fresh run from the verified recording. Finishing compares the actual tick, checkpoint algorithm, hash and each checkpoint section, catching future-affecting accidental read-model edits. It never awards a completion.

## Refresh and verify examples

The files in [`game/replay-theater/data/`](../game/replay-theater/data/) are normal exported replays, not special theater commands. Their tests compare each file to its corresponding reviewed [Fieldcraft proof](../game/replays/fieldcraft-routes.json), then play the recording and require its actual role events and final checkpoint. After a reviewed content or core update, first regenerate and validate the specialty proof as described in [the Fieldcraft guide](fieldcraft-challenges.md). Export replacements to new filenames because the export command intentionally refuses overwrite:

```sh
node scripts/verify-specialty.mjs --export fieldcraft-01 immediate --out /private/tmp/fieldcraft-01-new.replay.json
node scripts/verify-specialty.mjs --export fieldcraft-02 grid-center --out /private/tmp/fieldcraft-02-new.replay.json
node scripts/verify-specialty.mjs --export fieldcraft-03 immediate --out /private/tmp/fieldcraft-03-new.replay.json
node scripts/verify-specialty.mjs --export fieldcraft-04 grid-center --out /private/tmp/fieldcraft-04-new.replay.json
```

Review and replace the corresponding built-in files, then run:

```sh
npm exec -- prettier --write game/replay-player.mjs game/replay-theater game/test/replay-player.test.mjs
node --test game/test/replay-player.test.mjs
npm run lint
npm run validate
```

The static build includes this directory and its sibling authoring assets automatically; nested release paths remain relative. There is no new server or package dependency. [Navigation host tests](../game/test/replay-theater-navigation.test.mjs) exercise the actual entry, router/navigation and real replay/core through modeled DOM, drawing and device boundaries: keyboard transport under both policies, neutral controller joining, select commit/cancel, deferred import cancellation, focus/loss/disposal and Classic checkpoint completion. They do not prove physical-controller behavior, browser layout, trusted picker activation or parent-page music continuity. The Theater remains silent and storage-free.

Browser review should cover all four examples, keyboard/controller pause/resume/restart, native editing, the hangar body change, theme changes at the same tick, malformed import rollback, import cancellation and narrow portrait layout. No private controller or run is exposed through globals.

## Artwork warning announcements

Renderer artwork warnings use a persistent polite, atomic status region. Keep its empty state in the accessibility tree; remove only its margins, never hide it with `display: none`, `hidden` or `aria-hidden`. Artwork failure and recovery update this region without moving focus, starting playback or changing the verified recording. Loading progress remains a separate status.

Maintainer prompt: “Verify Replay Theater with a delayed or failed craft image and then a successfully loaded theme. Confirm the complete artwork warning is exposed as a polite status, the empty region stays mounted, and the current focus, playback state and recorded checkpoint stay unchanged. Record browser semantics separately from an actual screen-reader listening check.”

## Load focus and completed playback

When Cancel load still owns foreground focus, cancellation or load settlement returns focus to an enabled Play, Restart for a completed recording, or Load example when no recording exists. The handoff does not start playback. A newer editing/reading action, backgrounding or replacement load retires that focus ownership. Escape/Back keeps its existing cancellation and return behavior.

Completed playback keeps its Restart guidance after blur, hidden-page return, a persisted page return or controller loss. Play and Step remain disabled, and the final recorded checkpoint stays unchanged until the player deliberately restarts.

Maintainer prompt: exercise the actual Theater entry with a delayed file read or artwork load. Focus Cancel, then cancel, succeed or fail; assert a visible enabled successor without advancing the recording. Repeat after newer editor focus, a pointer action on nonfocusable text, backgrounding and a replacement load, without taking their focus. Complete a real replay, leave and return through lifecycle/controller boundaries, and verify Restart guidance, disabled Play/Step and the exact final checkpoint. Keep modeled host coverage separate from native layout, picker and physical-device acceptance.
