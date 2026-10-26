# Touch settings save feedback

This slice upgrades the shared touch preference owner and its existing settings view in Classic Snake (Solo, Versus and Team), Survival and Raid. Capture, Creator and couch Duel/Team have separate settings views; their recovery UI remains outside this slice.

## Player behavior

A changed steering mode, hand, control size or opacity applies to the current visit. The shared view says **Saved on this device** only after the record is read back successfully. A failed or unconfirmed write instead shows a localized **Session only** explanation and **Retry saving**. Full storage, blocked access, unavailable storage, unreadable records and observed concurrent changes have distinct explanations.

Retry saves the pending touch choice and returns keyboard focus to the changed control after success. It does not restart a game or clear gameplay input again when the accepted touch settings are unchanged. Language changes update the existing controls and notice in place.

## Persistence boundary

- The storage key remains `revealline.touch.v1`; snapshots retain exactly `mode`, `side`, `size` and `opacity`. No metadata enters authored settings, import/export or game records.
- Startup, `storage` events and a restored `pageshow` are read-only. Restoring a page keeps failed local choices and merges observed unrelated stored fields. Observed record removal retires stale Saved feedback.
- Each synchronous save rereads storage, merges pending fields, checks the read again and verifies the written bytes. Newer reentrant local edits cannot inherit an older save result. An observed intervening write or failed readback remains unconfirmed and retryable.
- This is **not an atomic cross-tab transaction**. Browser localStorage has no compare-and-swap primitive; the owner does not claim serializable edits between arbitrary competing tabs. A later external write can supersede a previously verified record.
- Invalid, future and oversized records are preserved rather than overwritten. The selected settings remain usable for the visit. Legacy fallback and explicit `persist: false` isolation remain supported; isolated choices do not acquire writes through Retry or restore.
- Disposal removes preference, storage, restored-page and locale listeners and prevents further writes from the disposed owner.

## Evidence

The regression first reproduced a silent `setItem` no-op: changing to Swipe showed no warning, and restored-page handling reverted the selected mode to the older record. The revised owner keeps that intent and verifies explicit Retry.

Automated checks use the actual preference/view modules, modeled storage outcomes and native game models. Paused host tests cover all three Snake modes and the Survival/Raid input gate. They assert unchanged paused replay/state and the held-action boundary, without asserting physical touchscreen or browser storage behavior. Browser, device and assistive-technology checks must be recorded separately; they are not inferred from these tests.
