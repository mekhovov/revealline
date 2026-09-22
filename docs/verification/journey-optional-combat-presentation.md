# Optional combat D2c/C1 — pixel presentation component evidence

Date:2026-09-21. Implements C1 of the independently approved
[presentation contract](../superpowers/specs/2026-09-21-combat-presentation-design.md).
This is a local reviewed component and static review sheet. The shared gameplay
host is **not integrated**; enabled combat previews remain blocked. No public
release, human recognition or whole-D2c acceptance is claimed.

## Implemented

- Owned frozen `combatView` validates supported level/ruleset pairs, bounded
  actor/projectile/elimination populations, ID ownership, phase/deadline and
  geometry consistency. It rejects accessors without executing them. Absent or
  disabled combat is null; malformed active combat has an explicit error instead
  of masquerading as a successfully empty view. Private random state is omitted.
- Locked aim uses current authoritative actor ticks. The displayed ray extends
  beyond the fixed aim point to maximum projectile travel or current obstruction,
  clipped by the same radius-aware boundary primitive as combat motion. It is
  current geometry, not a guarantee against future capture or slow effects.
- Original native16px scout/sentry pixel masks, open removable-role brackets,
  separate sentry emitter, alternating feet and stationary warning/recovery.
  Nearest-neighbour cached sprites follow existing16px phone/24px desktop minimum
  and32px body cap, independently of collision radius.
- Dashed two-ink warning ray, fixed cross and a remaining-time bar outside the
  painted body. Monochrome preserves the dark unfilled portion. Live shots have
  a six-CSS-pixel diamond core, short direction tail and visible frozen markers.
- At most24 inert scrap marks, optional cosmetic hiding, short local contact/
  capture sparks, reduced-effects suppression and no terminal-clock sparkle
  freeze. Marks reconstruct from elimination records; nothing is burned into
  the picture asset, score, coverage, collision state or replay.
- Separate underlay, warning, body and projectile functions allow correct host
  layering later. No BoardPainter, app, Team, preferences, audio or preview-guard
  changes in this increment.
- Seven static review specimens: scout, locked sentry, recovering sentry, shot,
  freeze, removal and existing keeper outline. Explicit unpublished/non-gameplay
  labels; no autoplay, storage, Apply, script-driven victory or preferences.

## Verification

**315 tests pass on Node20.19.5 and22.22.2**, full final invocation on each.
31 are new C1 cases:13 projection,17 drawing and one review-sheet test. The other
284 cover prior D2a/D2b, compiler/Studio/preview/capture/Team, actor/classic/lane/
pressure presentation and existing presentation UI. Scoped ESLint, Prettier and
diff checks pass. Independent review approved after the two presentation fixes.

The committed `scripts/verify-combat-presentation-routes.mjs` independently feeds
the21 pinned greybox routes through public inputs and projects **all95,718
simulation frames** on both Node versions, with identical summary results:
2,847 warning-containing frames and438 live-projectile frames. Every view is
valid and every final simulation checkpoint is unchanged. Initial frames are
checked separately and not included in95,718. This is state compatibility, not
hardware frame-rate evidence, comprehensive seed balance or human play.

Additional tests cover warning/shot/elimination suspend restoration, malformed
data and getters, ray clipping at walls/reclaimed corners, repeated paused
projection, freeze/slow, bounded canvas operations, role/pose differences without
colour, nearest-neighbour drawing, exact contact footprint, retained critical
cues, actual-run state neutrality, all36 review control combinations and empty/
invalid/terminal drawing behavior.

Three corrections emerged from inspection/review:

1. A public-input winning closure at tick846 can skip end-tick AI exactly at a
   sentry recovery deadline. The projection now accepts that legal terminal state;
   the same reached deadline still fails when labelled running. No engine change.
2. The first keeper-reference call omitted coordinates/radius. A full review-sheet
   execution test now requires finite geometry and visible operations in all seven
   specimens, rather than merely checking accessible labels.
3. Fixed countdown offsets could overlap32px feet. Placement now follows the
   actual painted diameter, tested across three viewport widths and three scales.

## Scoped native browser observation

Loopback8823 used pinned base `7594859b` plus four SHA-256-verified new UI files:

| File                                   | SHA-256                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `game/ui/combat-presentation.mjs`      | `7dc9d78eb66c7752bd7380131cc39ae9b2dd8dac11db5e2e6f723dd569e08865` |
| `game/presentation/combat-review.html` | `db3b22a42969689581462128e1acd017efccefe05a7c73b5e7ec69fff4955bd8` |
| `game/presentation/combat-review.css`  | `a105218efbe238afe68ad6b1c913d40fbb6081978871a426735c3f962a1b1b7f` |
| `game/presentation/combat-review.mjs`  | `1a739a0018c90cf9495f0b52d36c5644f8b476506c742b6ccaf4cae08dc11db3` |

Observed actual rendered24px workshop bodies on ink,16px monochrome/reduced
specimens on paper, and32px monochrome on grey with the countdown clear of feet.
Keeper outline, shot, frozen marks and inert scrap are visible. No warning/error
console entries were reported. A360×780 responsive override had no horizontal
overflow (`scrollWidth === clientWidth ===360`) and retained256×128 canvases;
the16px sentry warning was viewed at this breakpoint. The viewport was reset.
This is a desktop browser responsive check, **not physical-phone/controller or
human readability acceptance**. The sheet is not a live gameplay preview.

## Remaining D2c/C2 and programme work

1. Coordinate the accepted host and integrate drawing around territory/trail/
   craft layers, including explicit invalid-view handling. Remove the Studio
   guard only once that required presentation actually exists in the host.
2. Persistent player choice applied only on deliberate restart/next; exact new
   attempt identities, completion receipts, import/replay/suspend handling,
   save failure and cancellation. No live authoritative toggle.
3. Captions and supplementary sound respecting mute; physical input, small-board
   busy-scene contrast/performance, full native play and meaningful human tests.
4. Refine greybox short routes/bypasses, final per-level art and optional mastery;
   D2d Team ownership/simultaneous-action semantics and two-player qualification.
5. Release-owner-reviewed integration, versioned immutable release and exact
   GitHub Pages deployment checks. None happened in this component increment.

Original soundtrack generation remains paused. This component adds no music.
