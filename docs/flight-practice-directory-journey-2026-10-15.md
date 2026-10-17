# Flight practice: full-source-shell directory journeys

Hosting remains deferred. This continues the
[localized player-flow work](flight-practice-player-flow-2026-10-15.md), adding
the native main-game entry rather than another isolated directory component.

## Result

Six local EN/UK journeys pass in Chrome `155.0.8059.80`: one for each of Gym,
Academy and Worlds in each language. The original
[successful receipt](flight-practice-directory-journey-20261015/completed.json)
and [complete output archive](flight-practice-directory-journey-20261015/completed-artifacts.tgz)
retain the actual plan, authority snapshots, per-case data and 18 screenshots.
`completed` is true; `qualified` remains false.

The source shell is commit `613c290204e7067305e0ed7e099fef9a1df8fe94`, tree
`2f90ff81f815d0782a69df0f5e8dfc11031317f4`. Practice uses the original admitted
candidate at `8cf5fe46d239387e4686ad44443e78ad7cc0dd62`, tree
`c670ed46fa7b8db775b74112532ce20e9f928957`, envelope SHA-256
`78c09eea14faffe9a18457b13c8ad1db268fe25815812e11b038d341d5031bb6`.
The two sources are recorded separately. No simulator mechanics, application
bytes, size policy, publisher, review decisions or public selector changed.

## How to use the feature

1. In the main game's title menu, open **Settings → Help & Extras → Flight practice**.
   In Ukrainian: **Налаштування → Довідка й додаткове → Практика польотів**.
2. Read the app's purpose, inputs and requirements. Choose **Play / Грати**.
   It opens a separate tab; the original game stays open. A site password, if
   required, is a separate access step. In these fresh-context observations it
   was entered through the normal form once per context, before browsing.
3. Gym opens ready, Academy disarmed and Worlds ready. Directory Play does not
   arm or start a flight; use the app's deliberate Start/arm action and its
   current first-flight guidance.
4. Close the practice tab to return to the original game. For instructions,
   choose **Details & guide / Подробиці й посібник** on the card, then **Player guide**
   in the launcher. The guide's Directory link returns to the standalone
   directory, whose Main game link returns to the game. The selected language
   survives each route.

This walkthrough describes observed local behavior, not a claim that packages
have been published on the public host. The public catalogue remains governed
by the reviewed selector. `.rlpack` files remain content for World Studio,
not executable apps registered in this directory.

## What the six checks verify

- Actual unmodified `game/index.html` and the full main-game shell run, not a
  minimal page mounting only the practice panel.
- All three cards match the admitted bilingual descriptors: name, description,
  learning purpose, inputs, requirements, version and generated download size.
  Each gameplay preview loads successfully.
- Browsing the directory requests no optional practice executable modules.
- One ordinary Play click opens exactly one additional tab and reaches the
  expected immutable app entry, with the correct language and unarmed phase.
- Details, guide, standalone directory and main-game return work for all six
  cases. Screenshot, authority and source hashes are retained.
- Browser/server cleanup succeeds; no page errors occur. Each case uses a fresh
  browser context, without injected progress, imported proofs or access bypasses.

## Source-shell boundary, not production-build qualification

The normal build-file collection still fails because this checkout lacks
`docs/verification` inputs declared by `game/build-config.json`. No replacement
documentation, successful producer receipt or review approval was invented.
The local server instead serves only explicit committed public regular files,
checking each source against its Git blob before serving it. Both runs recorded
823 source-file pins and 394 overlay pins; the package overlay is admitted
unchanged. Generated catalogue and `current.json` files are explicit unpublished
fixtures using real package metadata and the production directory renderer.

This does not qualify a complete production distribution, final hosted capacity
or deployed selection. The successful run records twelve source-only
`game/build-info.json` 404s (initial and return loads) and two favicon 404s. Those
requests are not hidden or described as a failure-free production deployment.
They did not prevent the observed native journeys. The title correctly shows a
development build rather than invented release metadata.

All appearance query parameters were absent in this default-context run. Their
absence was preserved; this is **not** a positive custom-appearance handoff test.
Guide section headings and document language were observed. Default guide
screenshots include an English gameplay preview with the selected UK language;
the UK heading is further down the page. This is not a full translated visual,
screen-reader, 200% zoom, keyboard or physical-input qualification.

## Initial failure and correction

The [first original receipt](flight-practice-directory-journey-20261015/initial-failed.json)
and [complete archive](flight-practice-directory-journey-20261015/initial-failed-artifacts.tgz)
retain six failures. The observer tried the hidden `shell-home-practice` control
without opening Settings and Help & Extras. Native menus intentionally reparent
that control into the Extras panel; screenshots show a functioning main menu,
not a broken practice app. The correction follows the visible Settings route
and has a regression that keeps Practice unavailable until Extras opens.
No hidden control is forced or invoked programmatically.

Independent review also found a potential unhandled popup-wait rejection. The
observer now joins the click and popup wait immediately, tests late failures,
and rejects extra/missing browser tabs. Failed output is never overwritten.

The [observer suite](flight-practice-directory-journey-20261015/observer-tests.log)
passes **68 tests**, and the [full practice suite](flight-practice-directory-journey-20261015/practice-tests.log)
passes **352 tests, zero failures or skips**. Scoped lint, formatting and
whitespace checks pass. The [independent audit](flight-practice-directory-journey-20261015/independent-audit.json)
rechecks the source/overlay identities, authority, screenshots and native claims.

## Remaining C2 work

The full production-build journey and a positive selected-appearance handoff
remain open. Representative FPV beginner-exercise completion is next: use the
native `flight-01` Lift and land exercise in Academy and Worlds, both FPV modes
and EN/UK. Observe genuine progression, soft landing and terminal completion;
then export the app's actual newly verified practice proof through its normal UI
and independently replay against the exact admitted model/course. A completion
panel or “Recording verified” message alone is insufficient; Worlds can verify
recordings of failed attempts too. Existing hook-driven performance observers
and imported demonstrations must not substitute for this player journey.

Physical/human, migration, remaining pointer/recovery/performance and publishing
gates remain on the [acceptance checklist](flight-practice-release-checklist-2026-10-15.md).
