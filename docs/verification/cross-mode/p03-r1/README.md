# P03-R1: guarded Workshop Restart

Restart from Workshop previously reset the live attempt immediately and left Workshop covering the ready field. Both Workshop and the visible paused overlay now use the existing native Restart decision. Stay paused, Escape and controller Back preserve the attempt and return to the actual opener. Explicit Restart closes retained menu parents and requests a fresh attempt through the existing picture preparation/start path. Terminal Retry remains direct.

This is an internal work package within approved P03, based on `3253189`, not a new version or overall phase acceptance. It changes only the two Restart adapters and their decision ownership, plus focused tests and guidance. It does not change core simulation, saved formats, P01 operations, artwork, producer inputs or mode-entry design.

## Source and automated checks

The held runtime is `game/app.mjs` SHA-256 `47009b41f82b759b7af4aa69f2c4a53477c083929d25a844bf73b53262d135de` and `game/index.html` SHA-256 `ce6f600d6209f6cd7b4e2e98e6af1f5fa0c39ff2e773371750da18aead06e33d`. [Source holds](source/source-held-02.json), [root’s source review](source/source-peer-root.json) and [test qualification](source/verification.json) retain their separate identities.

Seven complete files passed **145/145 on Node 22.22.2 and 145/145 on Node 20.19.5**, with zero failures, skips or cancellations in the final pair. These are the same tests on two runtimes, not 290 distinct cases. ESLint, Prettier and Git whitespace checks passed. The 16 new Restart host cases exercise both actual openers, button/Escape/controller cancellation, exact focus, queued turn/checkpoint/saved-byte preservation, explicit confirmation, stale and competing requests, failed dialog opening, foreground/pagehide invalidation and queued close ordering. Three additional picture host cases cover delayed success, decode failure and background cancellation after confirmation. Existing mission/setup/return/modal/terminal and missing-original cases remain in the complete-file runs.

Earlier failures remain under [the input mapping](copied-evidence.json): unsupported test DOM selector syntax; incorrect picture error/abort expectations; and an existing missing-original test that still used the old hidden, unconfirmed Restart shortcut. The last was updated to use visible overlay Restart and explicit Confirm while preserving its original media/save oracle. No failure was removed by increasing deadlines or changing runtime behavior. The initial seven-file result was 144/145; it is separate from the final pair.

## Native observations

Root recorded [14 desktop keyboard events](native/events.json), [confirmation](native/restart-confirmation.jpeg) and [restarted pause](native/restarted-pause.jpeg), with [HTTP source checks and scope](source/native-root-verification.json). Both openers showed the decision, Stay/Escape returned to the correct opener with the paused HUD unchanged, and explicit Restart closed menus and entered a fresh running field at 0:00. The starting 0:11 First Signal save was earned earlier in the owned browser origin; no game/storage state was injected for these observations.

The preview used exact held app/HTML over `3253189` plus the separately reviewed P05 compact-dialog CSS. That stylesheet is not part of this change. Snapshot and DOM reads were sequential: event 13 captured preparation before its subsequent DOM read established running. The [five-event predecessor reproduction](predecessor-native/verification.json) and [earlier screenshot](predecessor-native/workshop-reset.jpg) remain unchanged. The reproduction establishes a live reset and retained modal, not saved-slot byte loss.

Native keyboard observations do not establish native controller/touch, queued-cut preservation, failed decode, storage faults, phone/short-landscape/zoom or public acceptance. The deterministic host checks cover some of those boundaries separately; no physical-device or overall P03 completion is claimed. Outgoing mode navigation, Library launch adapters, course selection and the approved mode-entry composition remain distinct work.

The mapping verifies 24 exact or losslessly compressed inputs, totaling 347,994 retained bytes. Each copied file was reread; compressed logs/diff decompress to their original bytes. The packager hashed and copied root’s screenshots without reinterpreting them.
