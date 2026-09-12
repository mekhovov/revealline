# Round 17 — one optional equipment seal

Current source after frozen v0.6.0 adds **Steady Signal** to Copper Orchard, the first Homeward Skies map (`homeward-skies` / `homeward-01`). It is a reason to try another route after collecting the picture. It never gates the next mission, removes a picture, changes a medal or alters a scoreboard. This guide describes implemented source; release version, browser evidence and native/device readiness are recorded separately.

The earlier [mastery and staged-boss plan](round-15-mastery-plan.md) remains a broader proposal. This increment implements **one seal and exactly two predicate types**, not its three-seal set, pack v2 or two-stage sentinel. The 25 existing maps, their original art, seven class recipes, core-v2 physics and old campaign/board identities remain the baseline.

## The player's goal

**Close one cut through at least eight distinct interference cells while the active recipe has signal resistance, then win without losing a life.** The registered region is `broad-band`; the Fiber recipe supplies resistance. A different starting class can qualify if its actual active recipe has resistance during the relevant cut. Cosmetic bodies and theme names grant no capability.

The mission brief identifies the optional goal. During play and pause/results, text separates:

- **Open line:** pending distinct endpoint cells on the current cut. Return to safety to bank them.
- **Closed cut:** the best count from one successful closure. Several short cuts do not add together.
- **Clean attempt:** no lives lost. A lost life does not invalidate an ordinary win, but it prevents this seal for the attempt.

Stationary dwell, revisiting a counted cell and crossing interference on safe ground add no credit. Suppressed regions are absent from the authoritative active-signal list. Failure, shield absorption or impact redeployment discards an unfinished cut. A previously closed qualifying cut survives a later recovery without life loss; the final clean-win condition still applies. See [exact observation semantics](mastery-observer-contract.md) for event order and endpoint sampling.

After an eligible normal win, the app collects the ordinary result and starts optional replay verification. “Checking your equipment goal…” does not delay the next mission. A successful save says the seal was earned and saved; a storage failure identifies a session-only seal and asks the player to export the library. An unsuccessful goal leaves the collected picture and normal continuation intact. A cancelled or unavailable check is reported, not silently presented as an earned seal.

Gallery cards show collected seal names. The open picture lists each recorded class route, turning policy, seed and date. A current seal name requires matching definition ID, revision and hash, plus the registered level identity/revision, roster and ruleset. Unmatched imported metadata appears as an archived seal; a matching name or hash alone is insufficient. These are portable local collection records, not authenticated competitive achievements.

## Implementation boundaries

| Responsibility                 | Current module and contract                                                                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Definition and live preview    | [`mastery.mjs`](../game/mastery.mjs): strict `xonix-mastery-definition.v1`; exactly `clean-win` plus `resistant-cut-cells`.                                                            |
| Built-in registration and text | [`ui/mastery-view.mjs`](../game/ui/mastery-view.mjs): `masteryFor(actualCampaignKey, levelId)` returns only the definition for the pinned Homeward content identity or null.           |
| Completed attempt authority    | [`mastery-verification.mjs`](../game/mastery-verification.mjs): reconstruct the whole replay against installed content; see [verification contract](mastery-verification-contract.md). |
| Pending checks                 | [`mastery-awards.mjs`](../game/mastery-awards.mjs): at most four jobs, active run-ID deduplication, cancellation and current profile-generation checks before synchronous commit.      |
| Local collection metadata      | [`library.mjs`](../game/library.mjs): v2 `masteries`, strict v1 migration and bounded union; see [records and migration](mastery-records-contract.md).                                 |
| Unfinished flight              | [`sessions.mjs`](../game/sessions.mjs): rebuild the observer from the recorded prefix; see [restoration contract](mastery-session-contract.md).                                        |

Definitions are **sidecar data in application code**, outside the normalized map, campaign and pack documents. Adding a seal does not add a field to `xonix-level.v1`, modify `homeward-skies.json`, change the global ruleset or split an existing time leaderboard. A definition identity includes its complete canonical metadata and predicates; changing its content creates a different historical identity. Predicate order is canonicalized.

The built-in lookup is pinned to `homeward-skies/1/0d01f5687b3c38ff` and `homeward-01`. Call it with the actual `campaignKey(installedCampaign)`, not just `campaign.id`. An edited pack retaining the same campaign and map IDs does not inherit the built-in goal when its normalized content or roster changes. A custom supported definition still needs an explicit reviewed registry change for its own campaign identity; changing IDs or text in JSON does not register it.

Existing replay files stay `xonix-replay.v3`, with the same core-v2 summaries and `fnv1a64-state-v2` checkpoint projection. Optional observation is a verifier option, not a new serialized replay field. Saved flights stay `xonix-session.v1`: no pending counters or observer object is trusted from a file. Restored attempts remain paused and can continue their reconstructed live-cut progress. Completed old clears do not automatically receive a seal.

Player libraries now export `xonix-library.v2` and require `masteries`. Valid v1 libraries migrate to empty masteries without changing their original bytes on read; a v1 document with a mastery field rejects. Complete backups, source-locked earlier-release copy and Undo reuse this migration. The storage envelope, backup and journal remain v1. New exports are forward transfers; frozen older readers are not expected to accept library v2.

Practice can display the preview, including a completed route, but cannot award seals. The controller lab remains practice for its whole session. Replay Theater is a non-writing viewer; it does not issue awards or gain a new mastery dashboard through this change. A second non-writing tab may retain an eligible normal result for its session and export it; a displayed session-only result is not a successful persistent save.

## Author a supported variation

1. Read the [observer](mastery-observer-contract.md), [verification](mastery-verification-contract.md) and [record](mastery-records-contract.md) contracts. Select an existing 48 × 36 core-v2 map with an explicit signal zone and a registered resistant recipe. Confirm its actual IDs and geometry in source.
2. Create a separate definition with stable definition/campaign/map/zone IDs, a revision, readable text and the same exact two-predicate shape. `minCells` is an integer in 1…1,564. This bound is structural validity, not a guarantee of a reachable or fair threshold.
3. Validate with `resolveMasteryDefinition`, then construct an observer against a fresh real run. A valid definition alone does not prove the referenced zone exists. For the shipped seal, preserve the eight-cell requirement and existing registration unless the task explicitly calls for a new version.
4. Register an approved definition and its exact campaign/map/setup identity through an explicit application registry change. Confirm the unmodified registered campaign resolves and a same-ID altered map or roster does not. There is currently no generic pack importer, playground field, expression evaluator or upload UI for mastery definitions. Do not put an unsupported `masteries` field into a v1 pack or map; pack-based registration needs a separately implemented future format.
5. Compare successful resistant routes and ordinary non-resistant routes in both turning modes. Preserve old input proofs and expected identities. Test failed-cut discard, repeated cells, split short cuts, life loss and switched equipment. Missing the seal must leave ordinary victory unchanged.
6. Test restored open cuts, replay tampering, cancellation, profile replacement and Undo. Use a verified in-memory result to append new award metadata; never treat a preview or a JSON `qualified` flag as authority.
7. Inspect actual text, focus and controls at the requested logical viewports with muted audio and reduced effects. Separate these observations from physical iOS/controller/native tests and from any claim that players enjoy the goal.

Use [the eight Round 17 prompts](../authoring/prompts/round-17-optional-mastery.md) for concrete work. Theme variants can reinterpret an interference field as a signal weave, arcade static or a fictional budget-noise region without changing the supported predicate. New role goals require new implemented predicates and tests first.

## Evidence and remaining work

The [frozen compatibility baseline](mastery-compatibility-baseline.md) pins five campaigns, 25 maps, nine terminal traces and four live-cut continuations from v0.6.0. Existing Homeward inputs produce 22 distinct cells in the best successful Fiber cut and finish at tick 1,305 in both policies. The ordinary Interceptor routes still win at their prior checkpoints with zero resistant-cell credit. These are deterministic comparisons, not human playtest or public-release certification.

The optional seal adds no new boss, simulation version, reward currency, gameplay unlock, online leaderboard or network mode. Supply Line, Safe Return, surveillance/net/fixed-wing goals, new themes' goal types, pack v2 and the staged sentinel remain proposals requiring separate behavior, schemas, proofs and player-facing review. Public-host, actual iOS/controller/native, store and human-playtesting gates remain in [public release guidance](public-release.md).

Run focused checks from the repository root:

```sh
mise exec node@22.22.2 -- node --test game/test/mastery*.test.mjs game/test/sessions-mastery.test.mjs game/test/compatibility-v060.test.mjs game/test/gallery-focus.test.mjs
mise exec node@22.22.2 -- node --test game/test/library.test.mjs game/test/backup.test.mjs game/test/backup-storage.test.mjs game/test/profile-transfer.test.mjs
```

Use the actual current test files and report their results; do not convert the number of passing checks into a claim that every browser, device or player experience is verified.
