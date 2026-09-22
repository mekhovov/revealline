# Studio candidate library — bounded implementation

2026-09-22. Parent: `ff1142e2`. Local successor, not a released or
human-validated edition. This closes a discovery/layout gap in P02/P13.

## Change

The 31 static bundled Inspect actions now live in one initially closed native
disclosure: six Whole Journey entries, twelve chapters, eight mechanics/spatial
entries, four Team entries and one early-player entry. One mechanics entry keeps
the shared edition selector and both ornament/workshop and pursuit actions together.
There are 31 entries, not 31 missions. Whole Journey editions are newest-first;
chapter order remains authored progression. All sixteen existing review routes
are retained byte-for-byte, with distinct accessible names and new-tab labels.

Search intersects a category filter and matches tokens in visible copy, keywords,
control IDs and existing route IDs. It is case/diacritic-insensitive and handles
literal punctuation without constructing a regular expression from user input.
Reset restores original order and returns focus to search. Empty groups disappear.
Filtering toggles visibility only: no project, source, Apply, persistence, URL,
gameplay, loading or publication mutation.

Undo/Redo, checkpoint save, backup export and import remain above the library.
The map has a direct anchor. Pressure-edition conversion is a separate disclosure,
not a preview-difficulty setting. Existing source factories and handlers are intact.
The stale Foundations Preview badge now identifies a local draft Studio.

Successful compilation exposes a deliberately activated source-review shortcut;
inspection alone never applies a project. The compact sticky panel describes the
**current source inspection**, including source/import/checkpoint inspections,
not necessarily a bundled source. It does not open or close the library itself.
The shortcut closes the library and focuses the existing source textarea only
when activated. Invalidation, failed compilation and Apply/render clear feedback.
The existing validation region remains the only live inspection announcement.

## Verification

- Eight new hermetic tests parse the real HTML and exercise the production
  discovery module: inventory, exact route/name mapping, all category counts,
  query normalization, reset/focus, draft isolation and inspection lifecycle.
- Existing semantic text tests tolerate HTML whitespace only; their required
  messages and control IDs are unchanged.
- The finite DOM markup parser was extracted unchanged into `mount-html.mjs`.
  The Couch helper re-exports the same API, avoiding content/media imports in the
  new library unit tests. Finite DOM checks are not native accessibility claims.
- Wider Studio, source/difficulty, Apex/spatial and Couch regression results:
  **91/91 pass on Node20.19.5 and Node22.22.2**, zero failures, skips or cancellations.
  The twelve-file cohort includes the new library, pressure inspection, pictured
  labels, content Studio/empty Studio, difficulty view, preview readiness, slot
  history, Apex field, whole spatial, Couch input and Couch catalogue host tests.
- Formatting, lint and whitespace checks pass. Independent review found no
  remaining blocker after fixing a mislabeled Team link and the two whitespace
  expectations. Category counts and exact accessible names received extra tests.

Sparse checkout qualification retains the read-only exact-revision media/content
fallback at `daaef1facfe573cf13a7da2132ea8fd57aded898`. The first wider run could
not load an excluded historical catalogue fixture. The fallback was extended only
to `authoring/library/four-worlds-chapters/packs/original-fpv-pressure.json`;
its blob is identical in that revision and HEAD:
`569926a8bf12ea5eeb9eeb6023c4fe31ccac1cea`. No source/game state is substituted.
The subsequent standalone 18-test Couch catalogue cohort passes.

## Native scope and remaining checks

Local IAB at 1280×720: fresh navigation starts closed, the map begins at y≈477
and there is no horizontal document overflow. Search for Coolant/freeze yields
one Team entry; combining Chapters gives zero results; reset restores discovery.
Searching Neon then inspecting compiles seven missions while the applied Team
map and saved checkpoint stay unchanged. Initial Enter activation was observed.

The next discard confirmation stalled tab control. It was not dismissed or accepted
through the available browser API; no cancellation success is claimed. A separate
agent-owned tab confirmed fresh layout, but subsequent input was ineffective while
the earlier confirmation remained unresolved. Space activation, the source-review
shortcut, Apply/Undo, map-anchor focus, bottom-card sticky feedback, narrow reflow,
zoom and screen-reader navigation therefore remain native qualification tasks.
Do not convert finite-DOM coverage into those claims.

No runtime/catalogue/save identity, public mission count, release version or Pages
selector changes. Human usability, final integrated-source checks and coordinated
PR/release/Pages remain separate gates.

## Integrated-source follow-up

On September 22, exact PR #225 source `7faa84cbd293518a82b7341760fb0f39345b725b`
was served on the isolated local port 8858. These native observations narrow the
open list above without claiming full Studio acceptance:

- In the filtered Neon library, Tab reached Inspect and Space compiled seven
  missions. The applied Nearby shore and saved checkpoint 1 stayed unchanged.
- Review inspected source closed discovery and focused the source textarea.
- Explicit Apply changed the workbench to Folded corner in a separate Neon
  candidate project. A same-project temporary name edit required Inspect/Apply;
  Undo restored the exact original JSON, Redo restored the edited name, and a
  second Undo restored the original again. No gameplay geometry was edited.
- Jump to map focused `map-workbench`, with its top at 0 in the viewport.
- At 390×844, document width remained 390, the search input was 44 pixels high,
  and discovery controls stayed inside the viewport. A native screenshot showed
  readable inspection feedback and its source-review link. Activating that link
  still closed discovery and focused source at this width. The viewport override
  was reset and both temporary tabs were closed.

Cancellation remains **unverified**: the discard confirmation again blocked
browser input, and the documented dialog getter returned no accessible dialog.
Only the agent-created blocked tab was closed; this is not a successful Cancel
test. Reloading the separate local workbench still showed the original saved
Nearby shore. No user work or public storage was changed.

Remaining native scope includes actual cancellation, bottom-card sticky feedback,
zoom, screen-reader navigation, physical devices and broader conflict/crash
usability. These checks do not replace human authoring feedback or public
deployment verification. Evidence is also recorded on
[PR #225](https://github.com/mekhovov/revealline/pull/225#issuecomment-5769720556).
