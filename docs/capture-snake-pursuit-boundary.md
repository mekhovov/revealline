# Capture Snake pursuit compatibility

Capture Snake now supports an opt-in Varied roster and authored pursuit through
separate native successor editions. The original finite population, clear-all
Hunt quota, growth, ordered bonuses, safe-return shedding and Team friendly-tail
policy are retained. Existing Capture Snake source and historical saves keep
their original versions until a player selects Varied or an author explicitly
applies pursuit in Studio.

| Contract           | Original Snake              | Snake with pursuit          |
| ------------------ | --------------------------- | --------------------------- |
| Capture level      | `xonix-level.v11`           | `xonix-level.v13`           |
| Capture core       | `xonix-core.v12`            | `xonix-core.v14`            |
| Capture replay     | `xonix-replay.v13`          | `xonix-replay.v15`          |
| Capture checkpoint | `fnv1a64-state-v12`         | `fnv1a64-state-v14`         |
| Team level         | `revealline-coop-level.v10` | `revealline-coop-level.v12` |
| Team core          | `revealline-coop.v12`       | `revealline-coop.v14`       |
| Team pack          | `revealline-coop-pack.v10`  | `revealline-coop-pack.v12`  |

`running-enemies.v3` pins the complete inherited Snake recipe. Capture verifies
its base identity, actor descriptors and Hunt definition. Team retains and
compares the original combat, Hunt and Snake definitions. Its actor-addition list
is empty: the remix changes accepted movement policies of existing runner
identities, never replaces required quota targets or adds an unbounded supply.
The new `pursuit-goals.v1` definition is included in replay authority together
with runtime actor phases and both native Snake definition and tail state.

The wrapper's native geometry/capture capabilities still resolve to the original
Hunt base. The actual inherited Snake version remains available separately for
installed-content and restore identity checks. Native self-collision, simultaneous
Team resolution, fatal-event priority, enclosure and once-only growth continue
through their existing engine owners. Presentation does not advance these rules.

## Studio and player workflow

Players select **Running enemies: On → Roster: Varied** before starting an
existing Capture Snake mission. Original leaves its existing behavior intact.
The shared preparation path also applies to compatible future/imported missions.
A prepared attempt pins its policies; Retry and restore reconstruct that recipe.

The main Capture/Team Studio pursuit panel accepts `MissionDesignV5` together
with `snake` and the original `hunt`. Target IDs and start positions are retained;
authors edit the existing runners' goals, routes and explicit behaviors. Inspect
uses production validators. Apply updates the chosen mission and owning source
revisions; ordinary Undo, source JSON export/import and Team native export retain
the whole recipe. Specialists require explicit authoring and are excluded from
ordinary Varied generation.

The raw Playground transport now has explicit pursuit scenario/pack v12 and
combined Snake+pursuit scenario/pack v13. Import, native validation, expansion
export, library installation and raw-level reimport retain the complete immutable
recipe. Historical formats still reject these levels. The editor explains that
routes/goals are authored in main Studio; presentation edits remain available,
and gameplay changes that break the pinned recipe are rejected. No opaque AI or
tail fields are silently stripped.

## Verification and release limits

Production compiler, native startup and presentation/checkpoint admission passed
for all 48 existing Capture Snake layouts across three difficulties: 288
Solo/Versus combinations and 144 Team combinations. Representative source JSON
round-trips resolve to the successor versions; the new Team pack validates.
Raw Playground import/export/pack preparation round-trips also passed production
validation for both ordinary pursuit and combined Snake+pursuit.
This is structural admission, not a claim of completed play routes.

Regression coverage was authored in `capture-snake-pursuit.test.mjs` for version
pinning, unchanged Original selection, rejected historical relabelling and recipe
tampering, ordered-bonus Studio round-trips, native tail collision/growth,
replay/checkpoint authority, installed-source matching, Team restore and raw
Playground preservation/rejection. These
automated tests remain **unrun** under the explicit suite waiver. Human play
qualification and completion-route evidence for the roster remixes remain open.
