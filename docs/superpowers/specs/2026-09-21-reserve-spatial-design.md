# Return in Reserve: pressure-aware teaching and spatial successor

Status: proposed implementation specification; independent skill-required review
pending. The user requested automatic continuation; routine confirmation pauses
are replaced by documented decisions and independent review. No human balance,
native acceptance or publication is implied.

## Evidence and decision

The unchanged pressure edition now has all six ordinary clear routes. Three new
Standard/Expert paths clear in10.55–12.35seconds without seeding any trail impact;
Standard Grid needs one closure. The old immediate Down opening fails at tick130
on Standard and102 on Expert. Separate Left-then-Down alternatives reach its
landing without damage and clear an active impact. This is a teaching and spatial
pacing issue, not proof of unavoidable damage or a broken impact engine.

The intended decision remains: use a nearby landing for a short return, or expose
a larger cut while watching the carrier. Preserve the carrier/ordinary-keeper
distinction: only the carrier propagates trail impacts; a keeper damages the
trail immediately. Impacts touching the live endpoint remain immediate danger.

Research rechecked2026-09-21: [AirXonix developer rules](https://www.axysoft.com/airxonix/)
distinguish field threats and reclaimed-ground mines; [Xposed Switched's publisher
listing](https://www.nintendo.com/us/store/products/xposed-switched-switch/) describes
several enemy/terrain types and randomly available bonuses. These support a small
clear vocabulary, not specific Reloaded collision timings. [Mike Stout's design
article](https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing) supports
readable attacks. Geometry-based teaching below is our inference and hypothesis.

## Alternatives

1. **Selected:** an off-center horizontal reclaimed deck separates a shallow
   carrier practice bay from a deeper two-keeper bay. One landing per bay offers
   a small-return alternative; two open lower baffles alter approach choice.
   Retaining actors in both bays prevent unexplained remote fill. Players choose
   which bay to tackle first; neither bay alone reaches78% earned coverage.
2. Raise the quota, require a visit or require an impact count: rejected. This
   risks cleanup, forces damage-adjacent play and turns optional mastery into a
   mandatory mechanic gate. A clever risk-managed enclosure remains valid.
3. Faster actors, shorter impact grace or mandatory countdown: rejected. Pressure
   already varies through the shared catalogue. Do not introduce per-map physics
   or reduce the warning/response contract to invalidate old routes.

## Authoring and isolation

Create `createPhaseSpatialCandidates()` as an additive greybox project
`phase-spatial-review`, revision `reserve-spatial-1`, based on the existing Phase
factory projected to difficulty-v2. Change only Return in Reserve's geometry,
spawn, actor placement and design copy; preserve all other six resolved levels,
original factories/assets, historical identities and replays. Project, mission,
map, campaign and pack references receive explicit successor revisions as needed.
No default enrollment, host edition replacement, Team conversion or release pin.

Initial hypothesis on the existing72×36 board, integer-cell rectangles:

- Reclaimed deck `(1,14,70,3)`, connected to the outer return surface.
- Northern landing `(31,5,9,3)` and southern landing `(37,26,7,3)`.
- Lower walls `(12,23,18,2)` and `(48,18,2,10)`; neither joins the deck, an island
  or outer wall to create another sealed chamber. Walls never close cuts.
- Interior spawn `(35.5,15.5)` on the deck, away from the outer patrol.
- Carrier initially in the north bay; two familiar measured keepers in the south;
  one existing perimeter patrol. Four actors, three known role families. No new
  actor schema, new mandatory rule, terrain, timer, objective or bonus.
- Preserve78% quota, pressure multipliers, player handling, impact speed24,
  per-actor impact allowlist, collision envelope, recovery and capture semantics.
  Keep optional mastery: win without loss after closing with an active impact.

Fixed positions/headings and the above geometry may be tuned from actual-input
evidence before freezing this new revision; document final values. No per-preset
geometry, seed-adaptive layouts, hidden invulnerability or forced waiting. Initial
topology must have exactly two retained field components, no empty auto-fill and
three reclaimed components (deck/perimeter plus two islands). Both islands need
at least four usable departure cells. Each bay must be below78% of the earned
denominator, so one-bay capture alone cannot finish. The first safe return need
not provoke an impact in every preset: introduce a safe route, then separately
prove the impact-closure technique without turning mastery into a required gate.

Studio adds an explicit inspect button alongside the existing picture candidate.
Inspection changes only source text/diagnostics; Apply uses existing cross-project
saved-slot behavior, not cross-project Undo. Within-project edits retain Undo/Redo.
No custom runtime or editor field required; the same compiler drives preview,
CLI, Solo and equal paired-board Versus. Label this greybox study, not final art.

## Implementation sequence and gates

1. Implement the isolated factory and topology/identity tests. Preserve all six
   other maps and shared policy values. Check Solo/Versus parity, no Team claim,
   safe spawn and each bay's earned area; inspect all topology diagnostics.
2. Replay the three recorded fast paths as old controls, matching their old
   checkpoints; show they do not produce a no-loss clear on the successor. This
   comparison is insufficient by itself: also search for equally trivial new
   shortcuts and record duration, closures, retained regions and landing visits.
3. Prove a no-wait first return and10second idle survival for all six preset/control
   cases, preferably the same path. Record full ordinary clear/public replay/equal
   races for all six with no pickups. Preserve actual movement inputs, do not
   inject cells, objectives, actor state or completion.
4. Separately prove existing impact-closure mastery in all six configurations;
   one path may serve both ordinary and mastery if its evidence proves both.
   Record impact seed/cleared-front events, not just a carrier touching a trail.
   Add six seed2 and six seed1/180tick-delayed ordinary clear samples. Unresolved
   samples remain explicit gates; do not silently drop them from the inventory.
5. Verify old Phase route/mastery/timing, pressure, capture and Studio regressions
   on Node20/22. Native Studio inspect/Apply, saved-slot isolation and actual first
   return precede an integration-ready handoff. No native/human claim from tests.
6. Publish measured comparison and outstanding pacing/art/device/human/host/Pages
   gates to the release owner. Ordinary human target remains45–150seconds; short
   optimized paths trigger review, not artificial wait padding or proof of fun.
   If decisions remain shallow, hold or revise the study rather than enroll it.

No installed writing-plans or subagent-driven-development helper is available;
this explicit sequence and existing isolated worktree are the fallback. Spec
review precedes code. Original soundtrack production remains paused.
