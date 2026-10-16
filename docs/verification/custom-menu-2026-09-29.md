# Installed custom-player menus — 29 September 2026

This batch adapts the separate `/game/creator/player.html?edition=<stable-id>` Solo player. It keeps the existing verified runtime, profile lease, save format, controller owner and action nodes. Custom Versus and Team use the main multiplayer hosts.

## Implemented

- Home has the game/campaign identity, one state-derived primary action, Select Mission, Settings, supported Solo/Versus choices, fullscreen and version. There is no placeholder Sound or song control: this player does not currently own an audio runtime.
- Settings exposes actual Gameplay, Display & Language, Progress & Collection and Help & Extras capabilities. Difficulty, steering, export/import and recovery retain their original handlers. Narrow layouts separate the category list and active panel.
- Mission selection uses the installed campaign's actual mission order. Replacing an unfinished attempt or leaving its player requires a checked confirmation; cancellation restores its opener and retains the attempt.
- Continue verifies the saved attempt and resumes it in one explicit action. Async restoration/start cannot launch after blur, a hidden tab or a newer menu action retires its activation. The verified attempt remains paused instead. Save failures remain visible.
- Arrow navigation follows the action stack in both directions, including after loading changes its primary action. Settings tabs keep their shared directional behavior. EN/UK labels, Departure Mono, Plain/Large text, reduced effects, background animation and fullscreen share existing preference/owner APIs.
- Successful creator installation focuses Play only if the initiating action still owns foreground focus. No second controller poller is introduced.

## Automated/source evidence

The six-file Custom/menu/story/fullscreen/display cohort passed **83/83**:

```sh
node --test game/test/creator-player-menu.test.mjs game/test/creator-player-navigation.test.mjs game/test/creator-player-victory-story.test.mjs game/test/creator-victory-story-host.test.mjs game/test/fullscreen.test.mjs game/test/display-preferences.test.mjs
```

This includes actual-player saved-checkpoint restoration, normal start/pause/win, malformed import, replacement cancellation, delayed-load ownership, category navigation, reduced-effects rendering and creator install focus. Its invocations overlap earlier cohorts and must not be summed with them. Changed-source ESLint, Prettier and whitespace checks passed. Full `node scripts/localization.mjs check` passed with **10,895 messages / 8,567 references** across EN/UK, including generated catalog/content-registry comparison. A separate read-only package review found all seven player presentation/runtime resources with zero missing literal dependencies and excluded manual fixtures.

## Fresh browser evidence

Observed against the managed source server on port 8983 in the Codex in-app browser. The campaign is the freshly generated, exported, validated and installed fixture recorded in [the preceding report](native-menu-followup-2026-09-29/README.md).

- English and Ukrainian standard text: portrait **390×844**, short landscape **844×390**; essential controls fit, with no horizontal overflow or split action words.
- Keyboard-only Settings → Gameplay → Back → categories → Back restores Settings focus. Directional category selection displays the associated panel; the native language selector can be changed from the keyboard.
- Select Mission → the installed mission opens the unfinished-attempt confirmation. Escape returns to that mission, then to Select Mission; the saved attempt remains available.
- After a fresh final-source reload, Down reaches Continue → Select Mission → Settings; Up returns to Select Mission → Continue. Enter on Continue restores and starts the saved attempt directly; Escape pauses it and focuses Continue on the compact landing.
- Plain/Large Ukrainian: portrait **390×844**, `scrollWidth=390`, `scrollHeight=844`; all actions remain visible. At **844×390**, the large layout has `scrollWidth=844`, `scrollHeight=404`, allowing a small vertical scroll. These checks do not replace a separate 200% browser-zoom check. Test preferences were restored to English, Theme font and Standard.

## Controller Practice handoff

The checked child bridge now has a real menu Return action. It uses the same session/origin/frame checks as the existing Tab boundary, suspends interaction before transfer and disposes with the host. Ordinary Solo does not get the action. Five actual-host and fourteen boundary tests passed, including virtual Confirm release, stale/loading rejection and unchanged paused checkpoint/storage.

In the browser, keyboard activation of Focus game entered the ready child; Down engaged Start, four more Down presses reached Return, and Enter returned parent focus to the mission selector. The child stayed in briefing. This is keyboard evidence; the virtual-pad host test is separate from physical-controller qualification. The simulator's existing input-source policy remains unchanged.

## Versus library launch ownership

The relocated Settings → Content → Mission Library action exposed a real host mismatch: a valid installed mission was selected, but `startRace` only accepted the main screen's scope. Commit `0832938b0` retains the actual Settings owner throughout explicit selection/preparation and leaves Settings only after the prepared match is accepted. Back or foreground loss during that preparation leaves both previous boards/readiness intact. Ordinary Start, Retry and continuous Next keep their existing semantics.

The installed Creator Versus suite passed **7/7**. After narrowing the new admission to explicit chooser launches, the final chooser/cancellation/Start/Retry boundary subset passed **6/6**. Independent interruption/Next/Retry/focus review passed **8/8 selected cases**; its other 31 enumerated cases were intentionally skipped and are not counted as passes. Scoped lint/format/diff checks passed. These are actual-host automated checks, not a physical-controller claim.

## Mode selection is not Play

Review caught a second routing distinction: the Custom Solo mode link originally reused the existing explicit-Play mission handoff. It now carries the finite `library-intent=select` value. Versus resolves and reveals the exact installed row without preparing or launching it; malformed or duplicated intent is rejected. Existing explicit-Play links without this new parameter keep their behavior.

Commit `2612dc7d4` passed the final handoff/menu/installed-host cohort **34/34**, including the formerly failing select-only route. Existing incoming Base/Journey Play and metadata-ownership checks passed **4/4 selected cases** (15 filtered skips). Independent handoff tests passed **9/9**, with no actionable review findings. These cohorts overlap; they are not a combined total.

Fresh browser keyboard acceptance used the same installed fixture: choose Versus, confirm leaving the saved Solo campaign, then arrive at the exact `dawn-signal` library card. The lobby remained ready. Down to Back and Enter returned focus to Select Mission without starting. Reopening the selector retained the exact card; a new Enter on its Play action started the two boards. Escape then paused both and focused Resume. This establishes the mode/Play distinction in the browser; automated state assertions separately check unchanged pre-launch boards.

## Remaining qualification

Complete keyboard-only and controller-only editing journeys for every creator, physical pads/reconnects, 200% zoom, final standalone/native packages and the published aggregate remain open. This report covers the installed fixture and source under review; it does not certify every imported campaign or hardware device.

The candidate was reconciled with main `6a67d6dbfe01d5e1f3842b5a79dd5d5ddeefcfd8` in merge `78542943e`. That incoming delta contains six Pages v0.142.3 metadata/evidence files; it changed no player runtime source. Existing publication records are retained, not regenerated. #782 remains a v0.150.0 aggregate input, and these source batches do not publish a release.
