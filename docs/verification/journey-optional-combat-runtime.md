# Optional combat D2a — engine evidence, not player-facing release

Date: 2026-09-21. Approved [runtime specification](../superpowers/specs/2026-09-21-optional-combat-design.md).
This is the first of four optional-combat increments. It does **not** complete
the enemy-variety request or authorize public enrollment without D2b–D2d gates.

## Implemented

- Strict opt-in `combat-patrols.v1` on foundation-aware Solo levels v5–v8.
  Disabled descriptors are validated and retain distinct identity but create no
  live actors, timers, random draws or decals. Absent historical descriptors add
  no state. Unknown versions/fields, invalid geometry, overlaps and excess actors
  fail closed.
- Separate non-retaining scout/sentry population, never added to field keepers.
  Stable-ID private random streams, normalized eight-way movement and swept
  classic domain reflection. No teleport recovery, enemy body damage, extra
  score, life reward or respawn.
- Sentry opening/scan/locked-warning/shot/recovery/rest deadlines use the frozen-
  aware actor clock. Aim locks once, shots do not home, warning/rest origins are
  explicit. Runtime consumes resolved speed/rest values without double scaling.
- Bounded eight-shot population and stable-ID capacity allocation. Shots damage
  exposed craft only, not trails. Existing wall/reclaimed boundaries absorb them;
  new capture cannot retroactively save a same-time fatal contact.
- Contact and accepted capture remove patrols once. Shared radius envelopes
  match classic domain motion, including corners. Remote chamber and isolated
  release fill use the same removal hook. Capture takes a same-time nonfatal ram
  cause; already-fired fatal contact beats a same-time owner ram.
- Freeze/slow, life loss, impact redeployment, terminal cleanup, independent
  paired runs, replay and suspended restoration. Up to24 inert elimination
  records are authoritative for later cosmetic scrap rendering; no visual assets
  or graphic effects are included here.

## Verification

Independent specification review approved revision2 after correcting ambiguous
deadline origins and difficulty authority. Independent runtime review found no
concrete correctness blockers; its additional12,800 simulation steps across eight
seeds found no foundation-domain motion failures.

The complete regression invocation passed **744 tests on Node20.19.5 and22.22.2**.
One additional owner-projectile/ram tie test was then added; the final seven-case
collision file passed on both versions, and the full final combat suite passed
45/45 on Node22. Thus the verified union is **745 distinct tests** per version,
not a claim that the original744-test invocation included the later case.

New tests:

- `game/test/combat-definition.test.mjs`:9 strict-schema/geometry/identity cases.
- `game/test/combat-patrols.test.mjs`:12 deterministic timing/motion/state cases.
- `game/test/combat-collisions.test.mjs`:7 synthetic sub-tick ordering cases.
- `game/test/combat-transport.test.mjs`:17 public-input/transport cases, including
  twelve no-loss clear/replay/equal-board cases (three interactions ×two steering
  policies ×two seeds), exact warning/fire/expiry timing, save during warning and
  live projectile, tampering, actual shot failure/recovery and ordinary keeper
  collision preservation.

The two route seeds deliberately have identical early trajectories: their long
turn interval avoids random turns during these compact fixtures. Separate random-
stream tests exercise different seeds and reordered actors. These fixtures prove
interactions and transport, **not** full mission pacing or diverse balance.

Historical regression cohorts cover classic core/transport/capture-stop/domain
recovery; enemy pressure and timed bonuses; real Horizon Versus host; foundations,
four-connected capture, both line-impact contracts, relay/directional/Sentinel
transport; the complete498-case pressure inventory and its opening, middle,
Livewire, Relay/Fracture and Crosswind/Apex route packets. Existing route checkpoint
assertions remain unchanged. Scoped ESLint, Prettier and diff checks pass.

Tests use the existing sparse-checkout source adapter:

```sh
node --import ./.cache/read-source-git.mjs --test game/test/combat-definition.test.mjs game/test/combat-patrols.test.mjs game/test/combat-collisions.test.mjs game/test/combat-transport.test.mjs
```

## Remaining / release boundary

1. **D2b:** successor catalogue, shared compiler/Studio CRUD and effective pressure
   inspection, explicit copy-on-write on/off projection, diagnostics and original
   greybox encounters. Unsupported Team combat must remain rejected.
2. **D2c:** pixel actor/locked aim/projectile/impact/scrap presentation, captions and
   sound, cosmetic/reduced-effects options, persistent restart-or-next combat
   preference, player-facing host integration and native/device qualification.
3. **D2d:** versioned Team simultaneous-contact/ownership semantics, useful joint
   encounters and two-player/controller tests with the Team owner.
4. Human readability/failure-understanding/enjoyment evidence; reviewed integration,
   version allocation, immutable release and exact-source Pages verification.

No shared project is auto-enrolled, no released mission is silently rewritten,
and no player-facing combat setting is claimed complete. Current release and
frozen device work remain owned by the release task. AI soundtrack work stays
paused. Non-graphic robot/fictional-trooper cosmetics remain the intended direction.
