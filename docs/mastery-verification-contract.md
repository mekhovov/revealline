# Completed mastery verification and award lifetime

Current source after frozen v0.6.0 separates a preview, a verified completed attempt and portable record metadata. [`mastery-verification.mjs`](../game/mastery-verification.mjs) reconstructs a replay and produces an in-memory result. [`mastery-awards.mjs`](../game/mastery-awards.mjs) applies host eligibility and profile-lifetime rules around that asynchronous work. Neither module changes core-v2 physics or the replay-v3 file format.

## Verify one complete recording

```js
import {
  verifyMasteryRun,
  isVerifiedMasteryResult,
  verifiedMasteryRecord,
} from '../game/mastery-verification.mjs';

const checked = await verifyMasteryRun(
  {
    replay: completedReplay,
    campaign: installedCampaign,
    definition: registeredDefinition,
    runId: originalRunId,
    earnedAt: '2026-09-12T12:00:00.000Z',
  },
  { signal: abortController.signal, onProgress, chunkTicks: 600 },
);

isVerifiedMasteryResult(checked); // true for this original in-memory result
const record = verifiedMasteryRecord(checked); // owned record, or null for an unqualified win
```

`chunkTicks` defaults to 600 and must be an integer in 1…1,200. `onProgress` receives the existing replay progress shape `{ticks, total, fraction}`. The interpreter also yields on its existing elapsed-work budget. Cancellation is checked before work, between chunks and after final verification. A rejected or cancelled operation returns no award result.

Before its first asynchronous yield, the wrapper snapshots the replay through `snapshotReplay`, the trusted installed campaign through the bounded data boundary and the definition through `resolveMasteryDefinition`. It validates record metadata even when a valid winning attempt will ultimately be unqualified. The caller cannot change adoption by mutating those data objects after submission.

The wrapper requires:

1. The definition names the supplied installed campaign and recorded map.
2. The recorded normalized map equals a run created from that installed map, and its complete class roster equals the installed roster.
3. Replaying all normalized inputs and release boundaries reproduces the recorded winning summary and full authoritative checkpoint.
4. The observer reconstructed from tick zero reaches the same complete winning attempt with both supported predicates evaluated.
5. A qualifying result fits the strict [mastery record schema](mastery-records-contract.md), including original setup and full class history.

A valid ordinary win missing either predicate resolves successfully with `qualified: false` and a null record. Incomplete/lost recordings, mismatched installed content, forged summaries/checkpoints, unsupported definitions and invalid run/timestamp metadata reject. The live host still chooses the trusted campaign/definition and the original run ID: the wrapper does not discover an installed pack, authorize practice, derive an unrecorded run ID or grant a historical clear merely because it has a medal.

The app obtains its built-in definition through `masteryFor(campaignKey(installedCampaign), levelId)`. The lookup is pinned to `homeward-skies/1/0d01f5687b3c38ff` and `homeward-01`, so another pack with the same textual IDs but changed normalized content or roster gets no automatic registration. The verifier remains a general reconstruction wrapper for the supported predicate pair; it does not perform that application registry lookup for its caller. A new supported custom goal requires an explicit reviewed registry change, not merely changed definition IDs. Pack-based definitions are future work.

The frozen result contains `format: 'xonix-mastery-verification.v1'`, `qualified`, `runId`, `campaignKey`, `levelId`, `definitionId`, `definitionName` and the reconstructed `preview`. A private WeakMap associates that exact object with its owned record or null. A clone, JSON export, hand-made result or observer preview does not pass `isVerifiedMasteryResult` and cannot be passed to `verifiedMasteryRecord`. The extraction helper may be called again on the original result; each extraction returns an owned copy. This is an in-process authority boundary, not a cryptographic signature, server verification or anti-cheat guarantee.

`withMasteryRecords` intentionally accepts structurally valid portable metadata, including imported historical seals. It does not itself prove qualification. Use the verifier result when issuing a **new live award**, and the existing importer when loading a player's local records. Those are different responsibilities.

Gallery presentation has its own current-versus-archived check. The picture must belong to the registered campaign/map, and the supplied definition identity must equal the actual registered Steady Signal identity. A record must then match the registered definition ID/revision/hash and the registered level identity/revision, roster and ruleset to use the current seal name. The current content pins are `level-v1-5983ec4eaf745012`, level revision `1`, `roster-v1-e159e435` and `xonix-core.v2`. Other matching-picture records remain visible as archived metadata; records for another campaign/map are excluded. This stricter label prevents an imported record with only a copied definition hash from masquerading as the current setup; it still does not turn imported local data into a verification certificate.

## Replay observation and restored flights

`verifyReplayAsync(replay, {mastery})` accepts the optional strict request:

```js
{
  definition: registeredDefinition,
  campaignId: installedCampaign.id,
  campaignKey: installedCampaignKey,
  runId: originalRunId,
}
```

The asynchronous replay interpreter builds a fresh observer and feeds it public facts after each fixed step. With that option, its result adds `masteryPreview`. With the option omitted, its old result keys and behavior remain unchanged. `verifyReplay` remains the ordinary synchronous path. No mastery fields are added to recording segments, summary, checkpoint or session JSON.

An exact matching optional replay result also holds a one-use observer accessible through `takeReplayMasteryObserver`. `restoreSession` takes it only after validating the saved identity, nonterminal state and installed map/roster; the continued observer remains preview-only. See [saved-flight reconstruction](mastery-session-contract.md). Do not restore a live cut by copying `pendingCutCells`, observing the same tick twice or creating a fresh tick-zero observer on an advanced run.

## Queue and current-generation boundary

```js
import { createMasteryAwards } from '../game/mastery-awards.mjs';

const awards = createMasteryAwards({
  getGeneration: () => currentLibraryGeneration,
  commit(record) {
    // Synchronous: merge into the current library, then use its guarded writer.
    library = withMasteryRecords(library, [record]);
    return persistProfile().ok;
  },
  onStatus(status) {
    if (status.runId === currentRunId) showCurrentGoalStatus(status);
  },
});

void awards.submit(attempt, { eligible: isNormalLiveCompletion });
// Before replacement/Undo snapshot, pack changes or page exit:
awards.cancelAll();
```

The host supplies `eligible: true` only for the normal live completed attempt it is authorized to award. The default is false. Practice, Controller Lab and Replay Theater must not submit eligible awards. Ordinary clear/gallery/score persistence precedes this optional work, so a failed check does not discard the primary reward.

There are at most four pending jobs. Re-submitting a run ID already being checked returns pending without starting a duplicate. A fifth distinct pending request reports unavailable and recommends retaining its replay. Submission captures the profile generation and cancellation epoch. Immediately before synchronous commit, both must still match and the job must not be aborted. The queue does not keep the old library object for later replacement; the host merges into its **current** library.

`cancelAll()` increments the epoch, aborts the jobs and publishes cancelled statuses. Call it before taking a replacement's Undo snapshot, not only when applying the incoming profile; otherwise a delayed seal could arrive after the snapshot and disappear on Undo. The app also cancels for profile replacement, pack changes and page exit. Starting the next ordinary mission does not itself cancel an eligible earlier check; its result may update the same-generation library while run-ID filtering prevents stale result text from replacing the new mission's status.

The queue expects `commit` to return a synchronous saved/not-saved boolean. Do not return a Promise: a truthy pending Promise is not evidence of persistence. The host must use the existing writer, backup lock and generation protocol. If metadata is retained locally but storage fails, the status is `session`, not `earned`. A capacity or other thrown error reports unavailable; the existing ordinary award remains independent. Profile-generation conflict still requires the host's normal recovery/export handling.

Statuses include `ineligible`, duplicate `pending`, `checking`, `unqualified`, `earned`, `session`, `unavailable` and `cancelled`. Only current-run messages belong in the current HUD. Pending jobs are not persisted or resumed after a reload. A full backup exports existing records and its saved flight; it does not export a pending verification job.

## Required regression boundaries

Use [the observer tests](../game/test/mastery.test.mjs), [completed verifier tests](../game/test/mastery-replay.test.mjs), [session tests](../game/test/sessions-mastery.test.mjs), [library integration tests](../game/test/mastery-library.test.mjs) and [frozen compatibility baseline](mastery-compatibility-baseline.md). Cover both turning modes, resisted positive/control traces, caller mutation after yielding, counterfeit results, final-callback cancellation, old session restoration, ordinary awards after optional failure and import/Undo cancellation before snapshot. Queue-specific tests must exercise active deduplication, the four-job bound, same-generation next-mission completion, replacement/epoch invalidation and saved versus session-only outcomes.

These checks establish deterministic reconstruction and adoption rules. The one registered definition remains a finite two-predicate contract. More predicate types, pack-based definitions and staged-boss replay versions are separate planned work. Browser interface, physical controller/iOS/native, distribution and human enjoyment evidence require their own checks; see [the current increment](round-17-mastery-increment.md).
