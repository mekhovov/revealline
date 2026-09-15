# Controller Apply focus correction (CF1)

The P01 Controller Settings change checked focus ownership after disabling the active Apply button and hiding its editor. Native disabling can move focus to the document body, causing the new guard to suppress the existing return to **Edit controller settings**.

The original public v0.57.1 interface sample recorded only `activeElement.id === ""`. Controller action buttons have no IDs, including Edit, so this did **not** prove the browser focused the body. Cancel already explicitly focuses Edit. The concrete Apply condition was identified in the source and reproduced with a more faithful fixture; the public sample remains an unknown focus target.

[Controller Settings](../../../../game/ui/controller-settings.mjs) now captures ownership before disabling controls. Temporary observers relinquish restoration after later focus, pointer or keyboard intent, page visibility changes, or window blur. Successful Apply restores the same enabled Edit node only while its transaction is current, its container is connected, the document is visible and focused, and focus remains owned or empty. Observers are removed on abort and settlement.

Canonical validation, single-flight Apply, guarded host adoption, persistence warnings, Cancel, source-change invalidation, refresh and disposal semantics are preserved. The correction neither commits a draft early nor reclaims focus from another modal or a later user choice.

The [test fixture](../../../../game/test/controller-settings.test.mjs) now focuses actions and models blur when an active control is disabled or hidden. With the public runtime unchanged, the existing canonical Apply focus assertion failed: **16/17 passed**. The original failure is retained in the [controlled-before receipt](loading-placement/controller-focus/native-blur-before.json) and [log](loading-placement/controller-focus/native-blur-before.log).

After the correction, this focused command passed **85/85**, with zero failures, cancellations, skips or todos:

```text
node --test game/test/controller-settings.test.mjs game/test/controller-navigation.test.mjs
```

The tests cover successful restoration, deliberate focus followed by blur, body pointer input, keyboard navigation, hidden/returned pages, window blur, missing initial ownership, refresh, changed source and disposal. Targeted ESLint and Prettier checks passed. The [correction receipt](loading-placement/controller-focus/receipt.json), [focused result](loading-placement/controller-focus/focused.json) and [log](loading-placement/controller-focus/focused.log) preserve exact commands, source hashes and evidence boundaries.

The [native correction review](loading-placement/craft-final/run/review.md) confirms the corrected behavior at 844×390 with Large/Plain/Reduced preferences. After keyboard Apply, the active element is the enabled Edit button, its action is `edit`, `:focus` matches, and the 47-pixel target is clear. The next native Tab reaches the visible Boost-mode selector. Reopening retains the applied Xbox setting; changing the draft to PlayStation and cancelling restores Edit focus, and reopening still shows Xbox. The original unsuccessful pointer activation is retained separately from the subsequent successful keyboard action.

This is candidate-source browser evidence. The original public sample's unknown focus target remains unknown; these results do not establish exact-source release qualification, corrected public behavior or P01 acceptance.
