# Resuming optional mastery from a saved flight

Working source after frozen v0.6.0 adds an optional `masteryDefinition` argument to [restoreSession](../game/sessions.mjs). The saved file remains `xonix-session.v1`; no mastery counters, definitions or observer objects are serialized. Restoration reconstructs preview progress from the original recorded inputs.

```js
const restored = await restoreSession(savedFlight, {
  campaign: installedCampaign,
  campaignKey: installedCampaignKey,
  signal: abortController.signal,
  onProgress: showVerificationProgress,
  masteryDefinition: STEADY_SIGNAL, // optional; omit on other maps
});

// Always present, with their existing meanings:
restored.session;
restored.run;
restored.recorder;

// Present only when masteryDefinition was explicitly supplied:
restored.masteryObserver;
```

An omitted or `undefined` definition preserves the exact old return keys: `session`, `run`, `recorder`. Explicit `null`, malformed definitions and definitions for another campaign, map or missing signal region reject the optional restoration; they are not silently replaced by defaults. The host chooses the registered definition for the **imported replay's map**, which can differ from the currently selected mission.

## Reconstruction and adoption

`restoreSession` takes owned snapshots of the bounded session envelope, installed campaign and optional definition before its first await. The caller cannot change a queued load by editing the input object, definition or installed roster afterward.

The session method derives the observer request's `campaignId` from the owned installed campaign and its `campaignKey`/`runId` from the validated saved envelope. It does not accept an additional caller-supplied mastery run identity. The existing `verifyReplayAsync` interpreter creates the fresh observer at tick zero and feeds it facts after every fixed step, preserving all recorded input releases.

Before returning any continuation, restoration requires:

1. The expected campaign key matches the saved envelope.
2. The replay reproduces its summary and complete authoritative checkpoint.
3. The reconstructed attempt is still running or respawning.
4. Its normalized map and full class roster match the installed campaign.
5. Cancellation has not been requested, including by the final progress callback.

Only after those checks does restoration take the verifier's one-use in-memory observer. The returned observer has the same tick, original setup identity and pending live-cut cells as the reconstructed run. It is a **preview continuation**, not an earned-seal certificate. A forged preview field in a save cannot substitute for reconstruction; the strict session envelope rejects extra mastery fields.

Restoration releases held inputs and marks that release in the returned recorder, as it did before. Release is not a simulation tick and changes none of the observer's sampled facts. After the host adopts the returned run, the first resumed fixed step advances the observer from tick `n` to `n + 1`:

```js
stepRun(run, input, FIXED_DT);
recordInput(recorder, input);
masteryObserver?.observe(captureMasteryFacts(run, { runId }));
```

Do not call `observe` for pause, input release, a render-only frame or the unchanged restored tick. Do not create a fresh observer from an already running tick-180 state. A loaded attempt requires the reconstructed prefix, not a reset checklist or imported partial totals.

## Host responsibilities

The app retains its cancellation and adoption boundary. After the await, recheck the restore signal before changing the selected campaign or run. If selecting the entry calls `prepare`, install the returned `masteryObserver` **after** that preparation and after adopting the returned run and original run ID. Otherwise a temporary tick-zero observer could overwrite the reconstructed live-cut observer.

Cancel a pending restore when a newer selection, import/replacement, page exit or explicit cancellation supersedes it. A page returning from the browser history cache must not adopt an older pending restore merely because that promise finally resumed. Keep loaded gameplay paused until the player's explicit Resume action.

An unfinished loaded attempt earns nothing during reconstruction. After a qualifying normal win, the host submits the full completed recording to the separate [mastery verifier](../game/mastery-verification.mjs), which binds installed content and verifies the final result. The host still owns practice eligibility, original completion identity, pending-job cancellation and the profile generation. Normal picture collection, score persistence and celebration remain independent of this optional check.

Before a full profile replacement takes its Undo snapshot, cancel pending optional award writes. Cancelling only when the new profile is finally applied leaves an asynchronous window in which a seal can be saved after the old snapshot and then disappear on Undo. The Library panel's `beforeProfileReplacement` boundary now runs before `backupContents` and asynchronous preparation of that previous snapshot. Cancelled checks publish a terminal status, so returning from browser history cannot leave a permanent “Checking…” label.

## Compatibility and limits

- `SESSION_FORMAT`, storage/import byte budgets, recorder segments, summaries, ruleset and checkpoint projection are unchanged.
- The observer is never written into the session, even when a restored flight is saved again.
- Existing sessions without a mastery definition follow the existing path; full-backup validation can continue to omit the optional argument.
- Old clears and completed replays are not reinterpreted as unfinished sessions. A completed replay cannot be loaded through this API to obtain an award.
- A changed or missing pack, altered roster, mismatched checkpoint, invalid definition or cancelled verification exposes no restored run or observer.
- Definition and record migrations belong to their own contracts. Session restoration does not migrate a library or merge earned records.

The observer's finite facts, ownership rules and endpoint-count semantics are specified in [mastery-observer-contract.md](mastery-observer-contract.md). Existing release identity evidence is pinned separately in [mastery-compatibility-baseline.md](mastery-compatibility-baseline.md).

## Verification

```sh
mise exec node@22.22.2 -- node --test \
  game/test/sessions.test.mjs \
  game/test/sessions-mastery.test.mjs \
  game/test/mastery.test.mjs \
  game/test/compatibility-v060.test.mjs

mise exec node@22.22.2 -- node --test game/test/gallery-focus.test.mjs
```

The nine new session tests use actual Homeward inputs. In both immediate and cell-center steering, they suspend Fiber at tick 180 during an open qualifying cut, reconstruct that prefix, continue through the unchanged remaining inputs and finish at the archived tick-1,305 winning checkpoint with a 22-cell best cut. They also cover absent-option shape, exact re-saving, caller mutation after yielding, malformed or inapplicable definitions, injected progress fields, altered installed rules/rosters, terminal recordings and cancellation before work or at final progress.

The combined session/observer/archived-compatibility run passed 71 tests at handoff. The Library DOM test drives the real import and Undo handlers through a bounded browser adapter, checks cancellation-before-snapshot-before-application ordering, and verifies that Undo returns the full previous profile. A rejected replacement boundary also leaves the current profile untouched. These are automated API, state and DOM-order results; physical-device behavior and final browser release checks are separate evidence.
