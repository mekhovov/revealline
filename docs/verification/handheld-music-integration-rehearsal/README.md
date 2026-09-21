# Handheld layout and music integration rehearsal

**Held source review; not release or device acceptance.** The landscape candidate
`61af3634` and PR209 music candidate `8ee3bbe5` merge cleanly against accepted game
source `432110b5`. `composed.css` is a reproducible preview artifact, not an installed
runtime stylesheet. The working branches, release versions and publication remain
unchanged.

The reviewed composition retains the height-fitted Team grid through 600px, removes
full-height touch-pad gutters, preserves the music-aware header and pad sizing, and
keeps the portrait Menu/Pause hit-testing correction. The four shared input and
fullscreen modules are unchanged between the accepted base and music candidate;
the held interruption/reconnect fixes still require final-source integration tests.

## What remains visible to players

The music candidate reserves an additional 44px when a track credit is visible.
That means the requested one-row gameplay HUD is **not complete**. After PR209,
review a compact now-playing affordance in the existing HUD, with complete track
information and attribution available from Pause/Music. Check each track's retained
attribution requirements before changing credit presentation. Do not silently remove
credits, hide mandatory objectives, or crop the arena to claim a larger field.

## Browser observation

An isolated HTTP preview served exact music-candidate files with only the composed
stylesheet substituted. All 239 unique served bindings (2,993,908 bytes) were
independently compared with Git or the composed artifact. This is a unique-file
inventory, not a request count or traffic total.

At 568×320 the Team title loaded, and Start together was enabled, focused, not inert
and inside the viewport. Enter and a direct locator click did not advance. No console
warnings/errors were captured. Similar activation failures were independently
reported by the other testing tasks, but their cause remains unresolved. No simulated
DOM click or injected gameplay state was used to substitute for a real start.

Therefore this run establishes **no gameplay geometry or input acceptance**. The
temporary viewport was reset and the test tab closed. Earlier landscape browser
measurements apply only to their pinned source, not this composition.

## Required final-source checks

1. Reconcile against PR209's actual accepted source, which may differ from this head.
2. Re-run shared Solo/Versus/Team gesture ownership, resize, controller start,
   disconnect, reconnect and explicit Resume tests on that composed source.
3. Play Team First Connection and Relay Yard at 568×320, 600×400, 844×390,
   960×540 and 1024×600; check both sides of the 500/501px breakpoint.
4. Repeat music off/on and full credits, both control sizes, Large/Plain text,
   both visible pads and one-seat controller handoff. Verify the complete arena,
   required warnings, Pause and targets at least 44px with no horizontal overflow.
5. Check Solo and Versus at 390×844 and 844×390, including all start/pause/results
   transitions. Keep the same shared touch preferences and direction semantics.
6. Test physical iPhone Safari and Home Screen mode with toolbar changes, safe-area
   insets, rotation and simultaneous fingers. Fullscreen permission must not be
   required to play. Test physical Steam Deck A-start and every menu/Back/Resume path.
7. Run the agreed release gates, publish an immutable successor, then verify public
   bytes and affected journeys before marking these items complete.

[WebKit's Safari guidance](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
supports treating browser-fit layout and Home Screen presentation independently.
[Steam's compatibility requirements](https://partner.steamgames.com/doc/steamhardware/compat)
require the complete controller journey; modeled A-button tests do not establish
physical Steam Deck readiness.
