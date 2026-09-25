# Default Journey pressure: rollout audit and real-input regression

Source audited: `b13089b702391c275f2505d1a76c87eebb9dcce0` (accepted main).
Scope: test/evidence-only successor. **No gameplay, maps, artwork, objectives,
mission order, historical editions, defaults or version files change.** This is
not a new release or a claim that every pressure mission is balance-qualified.

## Already implemented in the accepted source

The normal Solo and Versus entry is `whole-spatial-v9`. Its source composes the
existing v7 core and v8 optional pressure arcs; v9 adds erosion teaching records.
There is no missing two-mission batch in these approved pressure arcs to invent.

| Arc                              | Existing missions                                         | Existing role                                       |
| -------------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| Phaseworks introduction/practice | A return in reserve → Two ways home → Dogleg transfer     | One trail pursuer replaces an ordinary keeper       |
| Phaseworks introduction/practice | Crossed bands → Pressure ladder → Signal channels         | One heading interceptor replaces an ordinary keeper |
| Optional Ornament crossings      | Cross-stitch crossings → Pysanka sections → Rushnyk bands | One trail pursuer replaces an ordinary keeper       |
| Optional Workshop routing        | Four motor landings → Circuit lanes → Twin lens chambers  | One heading interceptor replaces an ordinary keeper |

The original 91 mission identities, original pictures and authored order remain.
The six-mission core arc and six optional adaptations use `journey-actors-v9`:
90 actor ticks of warning, 144 ticks of finite commitment, then 441/300/229 ticks
of Gentle/Standard/Expert recovery. Global gp4 tuning applies through the shared
runtime boundary; it is not a second authored catalog or an unmarked speed edit.
Ordinary keepers still use their straight-between-impact movement contract.

Earlier `whole-spatial-v6` has no pursuit/interception replacements and keeps its
own exact source and profile. The older six separately named encounter studies
are not the default missions and cannot serve as evidence for current gameplay.

The open PR inventory was checked before this work: spatial successor pairs
PR421/429 and Team specialist pairs PR420/428 already have owners. This work does
not duplicate or pre-empt them; later successor work must recheck their state.

## Verification gap closed here

The pre-existing default pressure test proves catalogs, counts and locked targets,
but its lock demonstration directly supplies a trail and advances actor clocks.
The older public-input encounter fixtures target different missions and timing.
Neither alone demonstrates the current tuned introduction missions through
actual legal movement.

`game/test/default-pressure-lifecycle.test.mjs` and its small input fixture add:

- The actual v9 default and distinct v6 historical ownership, not a hand-built map.
- Both introductory missions at all three presets, both steering policies and
  seeds 1/2: five-second stationary protected openings in Solo and both actual
  untimed race boards, exact state parity and independent pressure state.
- Effective gp4 rosters: Return has 4/4/6 enemies and Crossed Bands has 3/3/4.
  Each still has exactly one pressure actor; Expert extras are ordinary keepers.
- Four Standard, seed-1 real-input traces: warning → unchanged target → committed
  route → earned closure cancellation → capture-stop → finite recovery.
  Three traces turn after the warning without retargeting the attacker.
- Exact public replay verification for those traces and two real, no-loss clears.
- After each real clear, the shared authored sequence resolves its actual next
  mission, preserving the exact local gameplay receipt without inventing a clear
  for the next mission. This is shared navigation/receipt code, **not a native
  Next-button, IndexedDB persistence or complete host integration check**.

Reclaimed ground is deliberately not asserted invulnerable. In the Crossed Bands
immediate-steering trace, waiting motionless after closure lets the existing
frontier patrol reach the craft at tick 708. The test records that direct body
failure while the interceptor is recovering; it is not a changed lock or an
unexplained trail hit. The other three recovery observations lose no life.

| Standard immediate trace |                Earned clear | Captures | Authored Next   |
| ------------------------ | --------------------------: | -------: | --------------- |
| A return in reserve      |  1,716 ticks / 14.3 seconds |        2 | Two ways home   |
| Crossed bands            | 4,135 ticks / 34.46 seconds |        7 | Pressure ladder |

These optimized, omniscient feasibility times are **pacing warnings**, not human
first-play timings or enjoyment measurements. They do not certify the desired
45–150-second ordinary mission range. No quota, speed or geometry was changed to
make the recordings succeed. The bounded search is not run by the tests: only
the recorded commands are replayed.

## Evidence and limits

- New focused file: **13/13 passing, zero skipped**, Node 20.19.5, 4.74 seconds.
  After formatting, the coherent new file plus the existing core/optional arc
  checks pass **23/23, zero skipped**, in 5.69 seconds:
  `node --test game/test/default-pressure-lifecycle.test.mjs game/test/whole-pressure-candidates.test.mjs game/test/whole-cultural-pressure-candidates.test.mjs`.
  No full repository suite or build is claimed.
- The initial cohort was 9 passing / 4 failing. The four failures retained an old
  pressure-object reference while the engine advanced. The test now looks up the
  current owned actor on every tick. No runtime deadline or assertion was relaxed.
- Initial broad 15-second-per-map route searches stopped at one capture; a bounded
  lower-candidate search found the two clears above. Budget exhaustion was not
  described as impossibility. Earlier unsuccessful exploratory departures remain
  failures, not silently reclassified wins.
- Scoped syntax, ESLint 10.10.0 with the repository rules and Globals 17.12.0,
  Prettier 3.6.2 and whitespace checks pass. Existing cached tools were used;
  no dependency installation or large asset copying was needed.

## Still remaining

1. Current-default warning/commit/counterplay and full-clear coverage for the other
   ten approved pressure adaptations, beyond their existing structural checks.
2. Broader preset, seed and alternate-route qualification. The new safe-opening
   matrix is not an all-preset clear or warning/commit matrix.
3. Actual current-host clear → Next → reload/Continue, public frozen-build checks,
   physical controllers/touch, muted audio and reduced-effect readability.
4. Human timing, failure comprehension and balance review, especially whether the
   short optimized clears conceal a trivial dominant strategy.
5. Normal reviewed PR/publication handling for later gameplay changes. This test
   PR neither owns publication nor changes an immutable playable release.
