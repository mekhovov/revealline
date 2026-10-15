# Team and Duel offline update recovery — 15 October 2026

The scoped recovery checks pass, and a cancellation race in edition activation is fixed. This work supplements the native offline play recorded in the [qualification report](team-duel-qualification-2026-10-15.md). It does not certify a published old-to-new browser installation, native disk-quota exhaustion, or full game play through the storage fixtures.

The checks ran against source base `859d5cfc927daff2a350318b2325486a58959648` plus this change. Shipped inputs changed here are `game/installed-app.mjs`, `game/downloads.mjs`, and `game/ui/install-offline-panel.mjs`. A package built before these changes does not contain the cancellation fix.

## Defect and resulting behavior

The downloader checked cancellation around edition activation, but activation itself did not accept the cancellation signal. A cancelled request could finish waiting for its switch lock, profile inspection, or core preparation and then select the new edition. All three regression cases failed before the fix because activation completed instead of rejecting with `AbortError`.

Activation now checks cancellation before starting, when the switch lock is granted, while acquiring profile ownership, and before and after core preparation. The standalone download screen forwards its signal. An embedded download screen sends cancellation or timeout through that request's existing private message port. Its host also cancels pending selection when the panel closes, the page becomes hidden, the page is left, or the panel is disposed. Back and native Escape cancel synchronously, before the browser dispatches the deferred dialog close event. Returning to the page does not retry or activate an edition automatically.

The queued switch lock accepts the signal. Nonblocking profile-lock requests retain `ifAvailable` and check cancellation inside their callback: combining `signal` with `ifAvailable` is invalid under the [Web Locks specification](https://www.w3.org/TR/web-locks/). The regressions enforce that API constraint. Cancellation prevents a pending selection from committing; it does not undo a selection that already committed before cancellation arrived, forcibly interrupt an underlying storage read, or promise a transactional rollback of a same-URL worker replacement.

## Recovery evidence

| Scenario                       | Exercised behavior and result                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interrupted Team/Duel download | The production downloader receives the actual authored Team and Duel Harbor source bytes and shared download module bytes under two distinct immutable release scopes. A connection failure after the first changed chapter leaves the earlier edition selected, its verified bytes readable, and the candidate incomplete. Reopening the downloader fetches only missing bytes.                   |
| Explicit download cancellation | Aborting after the first changed chapter preserves the same earlier content and progress. Retrying reuses verified candidate bytes and shared content already available from the earlier edition.                                                                                                                                                                                                  |
| Storage write failure          | A controlled `QuotaExceededError` from `Cache.put` leaves the previous bytes and selection intact. A separate failure writing activation metadata also preserves the old active selection and both profile copies. Explicit retry succeeds after the fault is removed.                                                                                                                             |
| Insufficient estimated space   | A zero available-space estimate rejects the candidate before its changed files are downloaded. Previously verified shared bytes remain reusable when space becomes available.                                                                                                                                                                                                                      |
| Progress and user assets       | Each scenario persists distinct Team and Duel records through the production Journey backend/profile store, reopens those stores, and compares the durable state exactly after failure, retry, activation and rollback. An independent user-import cache entry and the old migration-profile fixture remain unchanged. Completion records are synthetic storage fixtures, not earned mission wins. |
| Reviewed transfer and rollback | Existing edition progress defers activation before core preparation until the transfer has been reviewed and recorded. Successful activation retains the earlier edition. Selecting that previous immutable edition restores the earlier selection without deleting either release's verified content or either profile copy.                                                                      |
| Cancellation during activation | Three production-activation regressions abort while the switch lock, profile inspection or core preparation is pending. The complete stored state remains unchanged, including the earlier active and staged candidate editions. A fresh explicit activation subsequently succeeds.                                                                                                                |
| Embedded panel lifecycle       | Seven production panel-listener regressions cover close, hidden document, page departure, disposal, private-port cancellation and the deferred native close timing for Back/Escape while selection is waiting. The request fails without changing installed state, and its cancellation handler is released.                                                                                       |

The new integrated tests use two synthetic release identities, `1.0.0` and `2.0.0`, and increment the authored source revision to require different bytes. They are bounded content fixtures, not full published packages. SHA-256 descriptors, the official-download store, selection/migration gates, panel listener and Journey storage code are production implementations. CacheStorage, IndexedDB, Web Locks, network failures, lifecycle events and quota limits use finite test adapters. This establishes preservation of the earlier verified content and selected edition; it does not independently prove that a full earlier package launches in a native browser after an update.

The same run includes existing worker tests that execute the emitted service-worker implementation in a VM. They cover preservation of prior caches on failed preparation, incomplete activation refusal, integrity/stream errors, quota failures and cancellation. Existing cross-release Journey tests load hash-pinned historical reader code from source commit `406637f36c039f991e83d241cb49d4568a871109` (v0.69.3), rather than treating the current reader as an older version. Those tests check older/current reads, writes and backup round trips. These are useful independent boundaries, not an end-to-end native browser update claim.

## Reproduction and results

The initial bounded run passed **142 test nodes, zero failures, zero cancellations and zero skips** before the two review regressions for deferred native close timing. The final installed-app/panel review cohort passes **35/35**, including both new Back/Escape regressions, which failed before synchronous cancellation was added. This includes the four new Team/Duel update scenarios, three activation-cancellation regressions and the original five embedded-lifecycle regressions. Counts across other reports overlap and must not be added into a whole-repository pass.

```sh
node --test \
  game/test/multiplayer-offline-upgrade.test.mjs \
  game/test/installed-app.test.mjs \
  game/test/install-offline-panel.test.mjs \
  game/test/official-downloads.test.mjs \
  game/test/offline.test.mjs \
  game/test/journey-cross-release.test.mjs \
  game/test/edition-context.test.mjs \
  game/test/edition-profile-compatibility.test.mjs \
  game/test/offline-download-session.test.mjs
```

The local run log is `.cache/multiplayer-desktop/offline-upgrade-tests.log`. Formatting, lint and whitespace checks pass for the three changed shipped modules and their three test files. The integrated regression is `game/test/multiplayer-offline-upgrade.test.mjs`; focused existing coverage is extended in `game/test/installed-app.test.mjs` and `game/test/install-offline-panel.test.mjs`.

## Remaining acceptance boundaries

Native qualification still needs a published immutable earlier/candidate pair installed in an actual browser, update interruption and restart with the server unavailable, and a genuine storage-constrained or eviction scenario. The source tests neither manufacture that evidence nor imply that browser storage is permanent. Existing native offline Team/Duel play remains separately bound to the package identified in its receipt. Same-URL rolling replacement is not an immutable rollback target and is not claimed to be transactional. Physical controllers, touch devices and paired human playtesting are outside this recovery work; the user's human-playtesting waiver remains in effect.
