# Shared windows: pictured Team test and bonus-optional host routes

This P02/P14 successor turns the three already-authored timed studies into an
explicit, playable test sequence. It is not a new public release, final balance
acceptance or completion of either phase.

## Playable integration

Open `game/couch/relay-rescue.html?journey=team-timed-originals`. Window exchange,
Coolant crossing and Depot dash use the shared compiler, Team host, pressure-v2
presets, picture verifier and ordinary input pipeline. All nine resolved gameplay
levels and simulation identities remain exactly equal to the earlier greyboxes.
No enemy, wall, pickup timing, quota, control or collision rule changes here.

The three missions span challenge bands 4–6, not a replacement opening tutorial.
Next crosses the two authored campaign boundaries without a menu. Skip remains
two activations, awards no clear and remains reversible through the chooser.
The final mission has no automatic next assignment. Standard's enemy multiplier
is 1.4 and Expert's 1.75 relative to the authored actor tier; these already existed
in the greybox pressure edition and are not new tuning in this commit.

Bookmarks, skips and completion receipts use the stable, explicit profile key
`team-shared-windows-originals`. The twelve-mission Team Journey keeps its existing
default key. Scoped backups carry their edition identity; default backup naming
and format remain unchanged. Difficulty preferences intentionally remain shared.
There is **no claim of saving an unfinished Team attempt**.

Studio has a separate **Inspect Shared windows originals** action. Inspection
does not apply the source; Apply explicitly changes the local draft. Its bundled
play link opens another tab and says that draft edits are not included. Existing
Team test exports remain geometry/rules-only and disclose that artwork limitation.

## Original pictures

Three original opaque 1774×887 PNGs were generated with the built-in image tool,
visually inspected and copied unchanged into
`game/content-design/assets/team-windows-r1/`. Exact prompts, inspection scope and
pending gates are in `docs/research/team-timed-art-prompts.json`; immutable byte
counts, dimensions and SHA-256 pins are in `team-timed-art.mjs`.

- Window exchange: two coastal workrooms with instruments and flowering plants.
- Coolant crossing: terraced water basins, ferns and a central cooling coil.
- Depot dash: two repair bays with drone-frame parts, motors, tools and a controller.

The three files total 7,282,747 bytes, each below the per-picture 4 MiB limit.
They are registered as optional Journey artwork, not mandatory offline-cache
assets. This is registry evidence, not a new full Pages-size audit. The existing
64 MiB/2,000-file core-cache limits and 950 MiB Pages guard are unchanged.
Scenery never defines collision; map walls, terrain and reclaimed foundations
remain separately authored. Full-set capture contrast, small-screen inspection
and human visual review are still pending.

## Completion without taking a timed bonus

`team-timed-optional-host.json` records nine pickup-free routes at the production
seed 17, with one initial idle/release tick. Eight retain the original pickup-free
logs; Coolant/Expert adds an explicit legal-return route. Its old route is retained
as a negative control: at this seed/timing it takes freeze and suffers a knockdown.
No failed historical result is relabelled successful.

Direct-core tests run every route with both seat assignments and joint-cut settings:
36 cases, no pickups or knockdowns, at least two return closures per pilot.
Nine actual imported keyboard-host runs use the same direction-change semantics
as the earlier collection qualification. They observe no collected-item caption
or active effect, unchanged reserves and a completed mission. As before, host
HUD observations are not full engine event hashes or physical-controller evidence.

| Mission          | Gentle: frames / coverage | Standard     | Expert       |
| ---------------- | ------------------------- | ------------ | ------------ |
| Window exchange  | 3025 / 81.4%              | 2245 / 75.4% | 1369 / 76.8% |
| Coolant crossing | 5287 / 78.7%              | 5731 / 94.4% | 4672 / 80.7% |
| Depot dash       | 2899 / 82.6%              | 3625 / 81.9% | 2899 / 81.7% |

Frames are controlled fixed-step deliveries, not native wall-clock measurements.
These optimized routes establish optionality, not enjoyment or sufficient duration.
In particular, short Window paths and Coolant/Standard's excess coverage remain
reasons for pacing and route-choice review.

## Verification

The focused optionality file passes 47/47 on Node 20.19.5 and Node 22.22.2, with
zero failures, skips or cancellations. This includes the expected negative route.
The new originals tests cover exact image bytes, unchanged nine manifests,
Studio/export agreement, source immutability, sequence ownership, isolated saves
and denied-storage retry. Actual pictured keyboard hosts clear three consecutive
missions, including two Next transitions and a failed next-picture retry; they
also exercise Skip/chooser replay and cancelling a pending picture preparation.

Native in-app browser observations at 1280×720, served from the isolated worktree:

- Studio Inspect compiles three missions while Nearby shore remains the applied
  map. Apply switches the project URL and workbench to the distinct pictured
  project, three maps/missions, Team-only export and the pressure presets.
- Window starts with its picture, timed announcement and shared-pickup guidance.
- Two-action Skip starts Coolant directly; its slow/lethal surfaces, foundations,
  craft numbers and available freeze ring are visible over the original picture.
- Reload restores Coolant as the ready mission, not the unfinished attempt.
  The chooser lists Window as skipped/replayable and the others as not cleared.

No native state injection, fabricated victory, mobile emulation or human-playtest
claim is involved. Full consecutive victories belong to the finite host tests,
not these scoped native observations. Independent source review found no runtime
blocker and prompted preserving the Studio tab when opening the bundled player.

The broader 17-file cohort passes **246/246 on each runtime**, zero failures,
skips or cancellations and exit 0. Node 20.19.5 took 218,978.798 ms; Node 22.22.2
took 178,164.127 ms. These are test-run durations, not player latency.
Files under `game/test/`, each with `.test.mjs` suffix:
`team-timed-originals`, `team-timed-originals-host`, `team-timed-optional-host`,
`team-timed-host`, `team-journey-progress`, `team-entry`, `team-journey-next-host`,
`team-journey-difficulty-host`, `team-journey-discovery-host`, `team-originals-host`,
`team-capture-teaching`, `candidate-team-pictures`, `team-timed-integration`,
`border-art`, `offline`, `boot-build`, `content-studio`.

Run with each Node binary, `--import ./.cache/read-source-git.mjs --test` and those
explicit paths. The read-only sparse-worktree shim supplies only missing
historical content/media at `daaef1facfe573cf13a7da2132ea8fd57aded898`; present
source and new images always win. No gameplay source or state is substituted.
Independent review also passes the 11 originals-unit/historical-progress tests
on both runtimes. ESLint, formatting and `git diff --check` pass.

Coordinated promotion remains separate. No version bump, release asset,
publisher or accepted Legacy edition changes here.

## Still open

Broader missed-window relocation and mastery across presets; slower/human starts;
two-human cooperation and physical controllers; touch, compact screens, audio and
accessibility; whole-picture/revealed-ground threat contrast; final enrollment,
reviewed release and public byte/browser checks. P02/P14 and the whole Journey
remain incomplete. Do not turn test counts into claimed successful playthroughs
or human acceptance.
