# Depot Dash — inner-lane retention and useful relocation

2026-09-22. Explicit `depot-spatial-1` candidate, not final human balance or public
deployment acceptance. Supersedes Depot only in the new three-mission Shared
windows edition; the earlier timed and Window editions remain immutable.

## Why another placement revision was necessary

A legal paired circuit at live seed 17 and one startup tick earned only 18.7856%
on Gentle/Standard, but **won Expert at tick 967 (8.06 seconds), 85.6262%**, without
collecting a pickup or activating either reclaimed-ground rover. The faster
diagonal keepers entered two small opposite corner pockets. Closing the second
pocket left the main region unoccupied, correctly filling 1,722 cells under the
shared capture contract. This was a content/difficulty inversion, not a reason
to special-case the capture rule or impose a minimum mission time.

The successor changes only the two keeper headings to vertical, preserving their
positions, counts, authored speed tier, difficulty multipliers, all walls and
foundations, coverage denominator/quota, rover behavior and bonus schedules.
Existing shelves bound the north lane at x28.5 and the south lane at x43.5.
They contest the inner platform approaches without isolating enemies in
unreachable pens. Both outer return choices remain available.

The identical circuit now earns 18.7856% at all three presets, including the
bounded seed/start-delay matrix (seeds 1/17/41, delays 0/1/30). Both keepers remain
in the 1,712-cell connected main region. This closes the demonstrated inversion;
it does not prove every possible route is well balanced or slower on Expert.

## Useful timed speed, not a last-moment collection

The earlier Expert relocation proof collected speed at tick 2836 and won at2857.
That remains historical feasibility evidence, not evidence of a useful speed
window. New public-input routes instead demonstrate:

| Event                                       | Completed simulation timing          |
| ------------------------------------------- | ------------------------------------ |
| First right-hand speed appears / expires    | Event ticks359 /1559                 |
| Next left-hand speed appears                | Event tick2639                       |
| Actual contact on unclaimed field           | Event tick2747; effect2748–3348      |
| Boosted bank on upper foundation            | Tick2877,52.1822%                    |
| Fresh cut and boosted lower-foundation bank | New cut after2877; bank3109,53.2732% |

Useful captures occur during both the first window and cooldown; no explicit
parked waiting segment or artificial neutral brake is added. Tests identify
foundation landings using the engine's accepted cell, not floor(y) at the exact
upper edge. Speed belongs only to the collector. Ordinary no-pickup routes
remain available. The other partner is **not** cutting at collection, and only
the east rover activates on these relocation routes: neither observation is
presented as optional cooperation/rover mastery.

Short optimized clears and the long reclaimed-ground pickup approach still need
human pacing review. Do not lengthen them by forced idling or a mandatory timer.
Reserve relocation, concurrent pickup mastery, genuine active-rover escape
decisions and broader start timing remain open.

| Preset   | Ordinary clear (no pickup) | Relocated-speed clear |
| -------- | -------------------------- | --------------------- |
| Gentle   | 2527ticks /81.8786%        | 4035ticks /89.7059%   |
| Standard | 3217ticks /78.7002%        | 3560ticks /91.2239%   |
| Expert   | 3985ticks /83.2068%        | 3496ticks /89.9431%   |

These are different feasible routes, not a leaderboard or proof of monotonic
human difficulty. Ordinary routes activate both roamers but do not establish
that both actually threaten a useful player return. Relocation deliberately
does not require either activation as a completion condition.

The first direct simulation logs omitted the host's individual post-capture
release tick at the upper/lower banks. Actual keyboard Standard finished with
different coverage; Expert did not finish the same log. Extending a later
one-tick alignment gesture did not repair the cause. Final logs instead hold
the stopped incoming direction one additional tick at both platform banks;
Expert also completes its last fraction of a return after speed expires. The
read-only host diagnostic then found no per-tick player-position, direction or
cutting divergence on Standard/Expert. No input handling, engine state, bonus
effect or runtime timer was changed to make the evidence pass.

## Integration and verification scope

- Shared compiler factory: `team-depot-spatial-candidates.mjs`, inheriting the
  qualified Window placement revision and unchanged Coolant mission.
- Explicit player entry: `game/couch/relay-rescue.html?journey=team-depot-spatial-1`.
  Uses a separate `team-depot-spatial-1` profile and the existing Next/Skip/chooser
  flow, not a new menu hierarchy or automatic replacement of saved editions.
- Studio adds one edition option and an explicitly labelled bundled-player link
  within the existing Shared windows card. Inspect and Apply remain distinct.
- Reuses the three original, immutable picture revisions; no copied reference
  artwork, new image generation or asset-size increase.
- Fixture inventories ordinary and relocated-speed routes across all presets,
  both seats and joint cuts on/off. Historical fast circuit remains a regression
  control. Automated keyboard-host qualification is a separate gate.

Native browser checks on isolated localhost8846: inspect kept `my-journey`
applied; explicit Apply created the separate candidate; Depot preview reported
the exact78% quota,10cells/s handling, pressure-v2 presets and two field anchors.
Flat chooser launched Depot directly. Both outward returns banked0.8% without
losing either reserve; pause exposed pickup expiry details; reload restored
Depot. Temporary agent tabs were closed; the user's8778 tab was not altered.
This is not a native full-route replay, physical controller or two-human test.

## Research interpretation and next gates

### Follow-up: relocated reserve and complementary work

The same unchanged `depot-spatial-1` runtime now has a bounded reserve recovery
route on each preset. The first reserve appears at tick959 and expires at2159
while players continue capturing. Its second window appears at3239 at the other
authored anchor,52.5,7.5. Pilot0 collects it in unclaimed field at3396 while
pilot1 is actively cutting. One shared reserve is granted; enclosing the area
does not grant a second pickup. Pilot0 returns at3458 and pilot1 at3525, with
only59.5351% earned, leaving substantial play after collection.

| Preset   | Final clear         | Shared reserve | Maximum joint idle |
| -------- | ------------------- | -------------- | ------------------ |
| Gentle   | 4740ticks /87.9507% | 4→5            | 6ticks             |
| Standard | 3852ticks /78.8899% | 2→3            | 6ticks             |
| Expert   | 4668ticks /88.6622% | 1→2            | 6ticks             |

All twelve seat/joint-cut combinations clear without knockdowns; three actual
keyboard-host routes match their exact clear tick, percentage and grant timing.
Each pilot contributes at least five returns. This demonstrates complementary
work at contact, not mandatory cooperation, Support or joint-closure mastery.
Only the east rover activates. Both-rover pressure and human desirability remain
open. No artificial neutral braking, injected positions, grants or runtime
physics changes are used.

The Standard finishing route hits the south keeper's trail collision on Gentle
at3835 and Expert at3767. These remain explicit negative controls, not a claim
that one script must work at every speed. Separate successful endings are
recorded in `team-depot-reserve-relocation.json`. Oversized idle-ended detours
were rejected before qualification; committed routes have no both-neutral
command segments.
This closes the bounded reserve-relocation feasibility gap, not universal
timing tolerance, human balance, native/controller testing or public promotion.

Follow-up cohort: **80/80 on Node20.19.5 and22.22.2**, covering
`team-depot-reserve-relocation`, `team-depot-spatial`, `team-reserve-routes`
and `coop-timed-bonuses`. The17 new checks include12 public-input variants,
three keyboard-host clears, inventory and retained negative controls. Changed
JavaScript passes ESLint; fixture/docs pass formatting and diff checks. This is
an evidence-only follow-up; no runtime/assets or build graph were changed.
Independent review found no substantive blocker; wording corrections distinguish
parked-pilot commands and the prior regression cohort from this new evidence.

Prior implementation's twelve-file regression cohort: **369/369 passed on both Node20.19.5 and
22.22.2**. Includes the six Depot keyboard-host clears, all24 direct route
configurations, earlier Window/timed/bonus/Studio regressions, original-picture
pins, Next/Skip and original/Window profile preservation. All13 snapshot/boot
build guards pass on Node20. Changed JavaScript passes ESLint; changed source,
fixtures and docs pass formatting and `git diff --check`. Independent review
found no blocker. Sparse historical assets use the existing read-only fallback
at `daaef1facfe573cf13a7da2132ea8fd57aded898`; present worktree files always win.

The final cohort is `team-depot-spatial`, `team-window-spatial`,
`team-timed-originals-host`, `studio-candidate-library`, `team-timed-originals`,
`team-timed-candidates`, `team-timed-integration`, `team-timed-qualification`,
`coop-timed-bonuses`, `content-timed-bonuses`, `team-relocation-routes`, and
`team-reserve-routes` under `game/test/*.test.mjs`. Build guards are
`scripts/test-whole-spatial-snapshot.mjs` and `game/test/boot-build.test.mjs`.
Run with `node --import ./.cache/read-source-git.mjs --test` in this sparse
worktree; a complete accepted source checkout does not require that asset shim.

Public marker rechecked September22 still names v0.80.1, source
`b810521a53af7be145acb8dedce0a01a747339cf`; it does not include this candidate.
The single existing release owner must integrate this source through reviewed
PR/version/immutable-release/Pages gates. No competing publication or version
bump is made from the design worktree.

[AirXonix's rules](https://www.axysoft.com/airxonix/) explicitly separate balls in
unclaimed field from mines on filled ground; the important design lesson is
changing threat domains, not arbitrary speed escalation.
[Xposed Switched's publisher listing](https://www.nintendo.com/us/store/products/xposed-switched-switch/)
documents four randomly available powerups and eight enemy types. That supports
optional route opportunities; it does not establish Reloaded's exact timings
or prove a specific retention/addictiveness effect.

Apply the observed lesson to remaining map reviews: replay small legal openings
at every preset, inspect where retaining enemies end up, and verify the bonus
supports subsequent play. Do not mistake actor activation or a final-tick pickup
for meaningful counterplay. Human enjoyment/readability, accessibility/device
qualification and coordinated reviewed release/Pages promotion remain required.
