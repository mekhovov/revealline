# A2 compact Team cue correction — 29 September 2026

Source parent: `1a406a2c0a33b1ba75cc61318ee91f8bcf3504a0` (PR757).
This is source/browser evidence for a bounded Team correction, not a production
approval or deployed-release receipt. Source hashes in `manifest.json` bind the
actual candidate. The 72×36 board, simulations, authored levels and originals
are unchanged.

## Finding and correction

The previous native 568×320 / Ukrainian / Large / both-control screenshot showed
two overlapping Hunter captions. The first actual-painter regression reproduced
patrol, recovery and slowed overlap. A sparse greedy placement missed usable
space. Compact canvases below 320 CSS pixels now retain clear placements or use
bounded group packing with true player/enemy contacts and locked targets excluded.
No text shrinks. Placement is atomic; partial packing retains the previous visible
fallback and reports explicit `unplaced` diagnostics. The single-entry renderer
cache keys exact measured envelopes, geometry and protected positions; it never
changes the core state. Repeated static paints reuse it; moving actors normally
invalidate it.

A stronger two-slowed fixture exposed a real capacity limit: at 212×106 CSS pixels,
full Ukrainian Hunter/Slowed pairs cannot all fit at 16 CSS pixels between actual
contacts. Recovery/Slowed is even larger. Increasing search budgets cannot solve
this. The explicit compact presentation contract is now:

- Idle slowed Hunter: full translated Slowed replaces redundant idle Hunter text.
- Slowed warning/charge/recovery: complete danger caption plus `↓`; its existing
  dashed slowdown ring remains. Help visibly explains `↓ — Slowed` in the locale.
- Expiry removes only slowing information; paused/reduced states retain live cues.
- Canvases at least 320 CSS pixels retain both old complete captions.

This consolidates information, rather than dropping an active warning. Other
roles remain unchanged. Optional celebration banners occupy only remaining space;
an oversized banner cannot invalidate required packing. A null initial placement
can now be recovered by the complete planner and still paint. Tethers remain
behind final player contacts. Accepted victory pictures/presentation replacement
clear stale layout diagnostics. Prepared bodies and contact geometry do not change.

## Automated evidence

Node 22.22.2, final complete 13-file renderer/host cohort: **157/157 pass**, zero
failures/skips/cancellations (`focused-final.tap`). It includes the 29-case actual
painter file and four pure planner tests; those counts are subsets, not additional
independent checks. The command is retained in `commands.txt`.

The recorder uses deterministic 0.64em text widths; it is not native font metrics.
Cases assert exact required text multiplicities, full backing/identity envelopes,
pairwise separation, minimum type size, player/enemy contact and locked-target
clearance. They exercise both text faces, running/paused, reduced/normal, patrol,
warning, charge, recovery, one/both slowed, expiry, active joint/recovery banners,
cache reuse and invalidation, won-picture and presentation resets. Wider-board
command hashes retain the original Standard baseline. Simulation objects remain
byte-equivalent to pre-paint snapshots. Pure planner tests retain exact clear
positions and expose impossible/malformed input rather than accepting missing text.

Initial failed runs are retained as failed evidence. The two-slowed expectations
changed only for the explicitly described information consolidation; all geometry,
font, contact, multiplicity and active-state assertions remain strict.

Scoped syntax, ESLint, Prettier and `git diff --check` pass. Independent source
review found no blocker in this bounded correction; it explicitly left the limits
below open. No full build or long-suite result is claimed.

## Actual browser interaction

Local final-source Team route, real compiled assets, Ukrainian, Plain/Large,
Reduced enabled, Expert Relay Yard, both pads shown. No private game-state injection.
At 568×320, Start then keyboard D caused an ordinary exposed-line loss, exhausted
the one reserve, and a second D caused the downed state. The complete board remains
212×106 CSS pixels. Direction targets are 44×44; Boost/Support are 76×47.59375,
all outside playable cells and within the viewport. Patrol and downed screenshots
show separated Hunter, shield and player captions with actual native glyphs.

Escape opened Pause, Help exposed the translated slowdown legend, then rotation
to 390×844 stayed paused until explicit Resume. The same downed cause/rescue text
remained. Portrait board is 370×185; directions 52×52 and action targets 76×47.59375.
The JSON files retain measured rectangles and HUD text; PNGs are native originals.
The inspected pictures establish these observed frames, not continuous all-state
collision freedom. Browser pointer/keyboard input is not physical touch/controller
qualification. Combined slowdown states are automated fixtures, not a claimed
native-input playthrough. No 200% zoom or comprehensive frame-time study ran here.

## Remaining acceptance

- Reconcile this source with the current cumulative release batch, review the exact
  Team/equipment presentation successor and run required build/source/provenance gates.
  Existing approval hashes and production collections were not rewritten.
- Provide an external readable cue rail or equivalent policy for maximum-density
  imported maps. Explicit overflow diagnostics are not that player-facing fallback;
  original visible overlaps/null placements can remain when packing is impossible.
- Qualify moving-frame costs and broader native font/locale/state coverage, physical
  devices, controller/touch and 200% zoom separately. A 24k probe bound is not an FPS claim.
- Final immutable publication, Pages bytes and public play remain publisher-owned.

Priority remains A current characters/reliable play, B optional encounters, C one
complete Ukrainian/FPV cohort; supporting tools travel with each. Formal C2 human
sessions remain last. Do not call A2, the core roster, or whole-game qualification
complete on the strength of this bounded regression correction.
