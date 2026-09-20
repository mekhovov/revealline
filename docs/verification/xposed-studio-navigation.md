# Content Studio navigation follow-up

Source code: `f932ecb61d25113ccfa30e84f7fd68273357089b`. This is a small
follow-up above the sealed nine-tool navigation prerequisite, not a new navigation
registry. The local prerequisite commit `cfb4900b` applies the reviewed packet
`p16-workshop-return-8a9f-r2` (patch SHA-256
`de21a3c19d98b1ef87e1a08cb1eaa14bc9d5dcbdd1e09c9e2de15b4386e6703d`)
with context-only integration. The release owner integrates that prerequisite
separately; cherry-pick the follow-up only after its accepted composition.

## Scope

Content Studio remains a descendant of Playground. Its fixed Game and Playground
returns retain the bounded shared Journey context and exact release directory.
Playground's Content Studio link uses the same helper. Unknown/duplicate Journey
hints, caller-supplied return destinations, project and practice identifiers never
become game-route authority. The nine-tool Workshop registry is unchanged.

The shared preview boundary has one additional finite owner descriptor: the exact
named Studio frame on a same-origin Studio page. Existing current-frame, focus,
visibility and retirement guards apply unchanged. Native Tab traversal can leave
either edge; focus re-entry never activates Resume. The new bottom Return to draft
button uses the existing Close handler, preserving abort, readiness cancellation,
frame retirement and Play-button focus. Dirty-source guards remain intact.

## Automated evidence

- Node 20.19.5: combined navigation/Studio/controller/readiness cohort 197/197,
  exit 0; no changed assertions in the nine-tool prerequisite.
- Node 22.22.2: navigation/Studio/controller cohort 190/190; separate existing
  readiness file 7/7. Zero failures, cancellations or skips.
- New descendant-link tests cover local, release and archive prefixes, optional
  index files, valid/invalid/duplicate Journey values, fixed parent mapping,
  early inert-link enable order, unchanged outbound registry, frame naming and
  shared Close wiring. Boundary tests cover actual paused-host re-entry plus
  wrong name/id/path/origin, stale ownership, hidden frames and retired callbacks.
- Changed source passes ESLint, Prettier and `git diff --check`.

## Native browser evidence

Read-only Git servers serve exact source without overlays. Baseline `aaa4d50c`
at localhost:8788 reproduced the bug: a Studio preview wrapped forward from
Main menu to Game menu and backward from Game menu to Main menu. Clicking the
Studio wordmark returned to bare `/game/`, discarding `journey=opening`.

Candidate `f932ecb6` at localhost:8789, browser tab 31:

1. Opened Studio with `journey=opening&project=my-journey`; initial local draft
   saved as checkpoint 1. Play launched Nearby shore as an exact practice draft.
2. At the ready briefing, Tab from the child's last Main menu control focused
   parent Return to draft. Shift+Tab returned to Main menu. Shift+Tab from the
   child's first Game menu control focused parent Close preview; Tab re-entered
   at Game menu without starting the mission.
3. Explicitly started practice and paused at 0:07, 0.0% revealed, three lives and
   score 00000. Tab out and Shift+Tab back preserved that paused display; re-entry
   did not start time or move the craft.
4. Return to draft retired the frame and focused Play exact Solo preview. Draft
   remained at checkpoint 1. Back to Playground retained `journey=opening`; its
   Content Studio link returned with that context and restored checkpoint 1.
5. Studio wordmark navigated to `/game/?journey=opening`, not the baseline's bare
   game route. Browser Back restored the saved draft.
6. Started another preview and selected Close during preparation. The panel hid
   and focus returned to Play without awaiting engine readiness.

No imported draft was published, checkpoint was deleted, full mission was cleared
or official award granted. Browser evidence is scoped to desktop keyboard/local
source; it is not physical-controller, touch-device, human enjoyment, complete
campaign, final release or GitHub Pages acceptance.
