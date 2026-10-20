# Team direct Play input reconciliation

This test/docs correction is based on exact inventory-fixture predecessor `47e8e5dccf8fd97f44029aa7428dee34b81db5d5` (PR #1719). Production, shared helpers, timeouts, rules, saves and generated catalogs are unchanged.

## Contract attribution

The earlier Capture briefing change `5ac6d674303f9151a68f78f23436bd52fbfb4c0d` introduced a READY/fresh-Start test. Later merged [PR #1108](https://github.com/mekhovov/revealline/pull/1108), first-parent merge `e817f5ba34ddafaf7d0b78d8f7e1f7e27d162ef2`, established direct card activation. Its [committed selector guide](https://github.com/mekhovov/revealline/blob/e817f5ba34ddafaf7d0b78d8f7e1f7e27d162ef2/docs/verification/shared-mission-library/README.md#L18-L20) distinguishes deliberate card Play from non-launching browsing, focus, filtering and Back.

The retained old held-Confirm assertion failed on exact main because it still required that earlier policy. It did not demonstrate an accidental repeated Start. The production proposal in PR #1718 was closed after this attribution correction; its original source and receipts remain historical evidence, not an accepted runtime change. The old Capture briefing guide now carries an explicit historical/superseded notice while retaining its original text and scoped verification. The current Team discovery guide already specifies direct Play.

## Native input assertions

The real Team host now verifies that focus and search do not launch, and that one controller card activation owns one direct accepted start. Keeping Confirm held cannot dispatch another Start, Resume, Retry, setup, Next or replacement action. Releasing it cannot activate another transition. The accepted running clock advances; the exact original picture, mission identity, recipe and controller remain owned, and an unfinished arena awards no picture. Fresh deliberate Pause and Resume retain the accepted attempt. Pointer Play also asserts direct activation before the existing wait helper.

The complete changed input file passes **5/5**, zero skips. Two unchanged complete main-identical discovery/installed files independently pass **20/20**, covering direct bookmark/focus, cancellation, fresh/restored native checkpoints and replayable Hunt journals. Changed-file lint, formatting and whitespace checks pass. The separate library-inventory predecessor was independently **17/17**; that unchanged-file evidence is not a new aggregate candidate pass. Independent review is pending.

The sparse A broader run was stopped partway after preflight found twelve absent authored PNG test inputs; it is not an aggregate pass. A separate current library-file attempt failed during module loading with `ENOENT` for `game/content-design/assets/team-partners-r1/twin-landings.png`, before its seventeen player cases could run. No inputs were restored. Full source validation, browser/device qualification, iPhone PWA/offline, Steam Deck and public release gates remain pending. Finite DOM, gamepad, frame, image and Canvas tests do not establish hardware behavior.
