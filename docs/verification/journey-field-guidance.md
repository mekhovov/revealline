# Shared field guidance correction

Read-only presentation follow-up to Home Signal's native preview. It closes the
specific patrol-name and singular-relay defects observed there, not overall human
readability, campaign balance, accessibility or public-release acceptance.

## Player-facing changes

- Paused details reuse the existing seven enemy-catalogue/field-guide names,
  removing the separate Boundary patrol / Signal sentinel aliases. Classic field
  summaries use the same names and now include perimeter guards and sentinels
  instead of omitting them. Impact-carrier and pressure variants remain distinct
  in detailed threat guidance; this does not rename authored actor-role IDs.
- Border guard explicitly patrols the fixed outer perimeter. Contour crawler
  follows the changing field/reclaimed frontier; patrolling, rejoining and holding
  position have different explanations. An idle crawler can remain inside
  reclaimed ground away from the current frontier. Capture can change its route,
  and idle does not imply contact immunity. Frozen guidance defers that contact
  risk until freeze ends. Existing effect state, clocks and grouping remain intact.
- Sentinel details use the actual associated encounter's instruction, never an
  invented single relay. Missing or mismatched encounter facts stay unavailable.
  Multiple-shield tasks say all remaining relays; completed/failed encounters
  no longer advertise a live capture task/countdown.
- Phase countdowns name their event separately from the objective: next lane
  warning, next vertical warning, warning end, active lane end or opening close.
  This removes the misleading implication that a two-second attack countdown is
  a deadline to capture every relay. No gameplay timer is added or changed.
- Generic guide advice requires every linked shield and explains that both a
  release cut and isolation finish during CORE OPEN. Isolation additionally needs
  reclaimed ground and no unfinished line. The mission's exact count remains in
  its runtime-derived encounter instructions.

## Evidence

Seven initial regression tests failed against the old copy. The final correction
has nine focused tests and one new mounted three-relay preview test within a
203-test cohort passing on Node20.19.5 and22.22.2. Existing catalogue/guide,
Classic rendering and engine, source/bridge/host, typed warning, impact-carrier,
bonus, Sentinel transport and encounter-view tests are included. One existing
assertion intentionally changes from `1 field enemy` to catalogue name
`1 field hunter`; its separate impact-carrier assertion remains.

A real public-input Home Signal route samples shield counts, stage/phase changes,
CORE OPEN and defeat, checks that every projection leaves the authoritative state
unchanged, and ends at the existing fixture checkpoint. Presentation-only fixtures
cover all crawler modes, freeze wording, six phase labels, singular legacy relay,
unavailable/mismatched encounter and terminal states. These are not new feasibility
or human playtest claims.

The mounted real app loads the exact v9 Studio preview, opens Field details,
checks three-relay text and shared summaries, and proves frame advances/Back leave
the checkpoint paused with focus restored. Existing immediate/grid keyboard and
simulated-controller reader ownership/restore regressions remain green. No new
physical-controller or screen-reader session is claimed.

Native in-app browser, local read-only server8844, working source after reload:

1. Home Signal launch → Pause → Field details shows `Shield relays 0 / 3`,
   `Capture all remaining shield relays` and a separate `Next lane warning`
   countdown. Its summary includes the relay sentinel, contour crawler and rover.
2. Crossing Complete shows two field hunters, a border guard and a contour
   crawler. The latter two explicitly describe fixed perimeter vs changing
   frontier. Both previews remained paused during reading and were returned to
   the preserved Studio draft without awards or progress writes.

The local server's exact7d1f99dd missing-media fallback is unchanged. This native
check is text/host-flow evidence, not a new screenshot/art approval, full mission
playthrough, small-screen layout audit, touch test or human understanding result.
The final idle-state phrasing was verified by unit fixtures and code review;
native observations above saw patrolling, not idle actors.

## Compatibility and remaining work

No engine, schema, descriptor, physics, actor placement, authored revision,
completion receipt, saved replay or default Journey enrollment changes. Current
presentation may describe old immutable runs more accurately; it does not rewrite
their simulation. Studio's authored role terminology and legacy alias migration
are not all normalized by this scoped correction. Short finale routes, optional
mastery semantics and whole-Journey balance remain open.

The reviewed change must still pass the release owner's newer-host integration,
versioned test-build PR and GitHub Pages verification. No new public deployment or
accepted P00/P02/P11/P12/P15 gate is inferred from these tests.
