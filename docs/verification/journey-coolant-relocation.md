# Coolant crossing: missed-window recovery at every preset

Successor to the [pictured Shared windows test](journey-team-timed-originals.md).
This closes the three Coolant preset relocation-route gaps at the production
seed 17. It does not change geometry, enemy speeds, quotas, bonus schedules,
artwork or old simulation editions. Human balance and publication remain open.

## Actual recovery, not a delayed first appearance

Every new route starts with one explicit idle/release tick, then only directional
commands. The team earns territory while the first freeze pickup remains
available; both pilots contribute over the recovery route. The pickup visibly
expires; the next opportunity appears at the other anchor.
The full public-input transcript then collects that second pickup, returns with
freeze active and clears without damage. Both seat assignments and joint cuts
on/off pass for each preset: twelve direct-core cases.

| Event                  | Engine event tick | Anchor       |
| ---------------------- | ----------------- | ------------ |
| First announcement     | 359               | (54.5, 29.5) |
| First appearance       | 479               | (54.5, 29.5) |
| Uncollected expiry     | 1679              | (54.5, 29.5) |
| Relocated announcement | 2639              | (17.5, 6.5)  |
| Relocated appearance   | 2759              | (17.5, 6.5)  |

That preserves the authored 1200-tick availability, 960-tick cooldown and
120-tick announcement. These are our explicit timings, not inferred Xposed rules.
The second anchor is unclaimed before and after both its announcement and
materialization. Cancelled warnings and delayed first appearances are not counted
as this recovery sequence.

| Preset   | Contact tick | Clear tick / coverage | Total joint-idle ticks | Longest joint-idle streak |
| -------- | ------------ | --------------------- | ---------------------- | ------------------------- |
| Gentle   | 3515         | 5113 / 79.5%          | 29                     | 6                         |
| Standard | 3245         | 6067 / 88.5%          | 24                     | 6                         |
| Expert   | 3302         | 5909 / 87.4%          | 13                     | 6                         |

All routes gain more than 25 percentage points during the first visible window,
then more than nine additional points between expiry and the second appearance.
Genuine return closures occur in both intervals. On Standard, the recovery cut
banks during the second announcement rather than during its preceding cooldown;
that distinction is retained. There is no all-neutral waiting segment beyond
the one initial tick. Low idle time alone is not used as proof of useful play.

These are 120 Hz controlled-step measurements, not native performance numbers.
The optimized clears take approximately 42.6, 50.6 and 49.2 seconds. They do not
prove a monotonic human difficulty curve or the right target duration.

## Capture and collection remain different

Gentle and Standard touch the second pickup while its anchor is still field.
Expert first reclaims the ground under the **already visible** pickup and later
touches it. Enclosure does not grant freeze. This is valid contact collection,
not a claim that Expert made the same exposed detour as the other two presets.

The partner is not cutting at contact in these recordings. The collector's later
freeze-active return proves a usable effect window, not concurrent cooperation
mastery. The existing independent pickup-free clears remain valid; no mission
requires taking or waiting for a bonus. Earlier failed seed/timing and Depot
relocation probes are unchanged and remain negative controls.

## Authoring correction

Studio previously promised that missed Team pickups relocate. In fact a future
appearance requires another eligible unclaimed anchor and remaining appearance
capacity. Both Solo and Team authoring now say that a missed pickup **may**
reappear at a different eligible field anchor, within the appearance limit.
The in-game Team wording was already conditional. No runtime rule was weakened
to make a later item appear after its destination was reclaimed.

## Verification boundary

`game/test/fixtures/team-coolant-relocation.json` pins the three complete input
logs, unchanged simulation IDs and all twelve exact state/event hashes. Optional
observer fields record anchor cells and coverage around real bonus events;
the longest-idle observer records actual unchanged craft positions. Tests compare
observation on/off hashes to prove those measurements do not modify the run.
One diagnostic Expert search segment initially spent 92 frames stopped at a wall;
those search frames were removed before fresh qualification. No historical
recording or failed result was edited.

Three actual imported keyboard-host runs also clear. They use production input,
command batching, simulation and UI with a finite DOM/Canvas/frame clock. Tests
pin both visible appearance/expiry sequences, the named collector, effect onset
and expiry, unchanged reserves, final coverage and clear. HUD effect onsets are
3516, 3246 and 3303; those are not contact event ticks. No engine-state injection,
bonus grants, artificial braking or host seed override is used.

The initial two-file focused run passes 24/24 on Node 20.19.5. The final 11-file
regression cohort passes **391/391 on each of Node 20.19.5 and Node 22.22.2**,
zero failures, skips or cancellations, exit 0. Test-run durations are 74,136.388 ms
and 57,452.629 ms, not game performance measurements. The cohort contains
`team-coolant-relocation`, `content-timed-bonuses`, `team-timed-candidates`,
`team-timed-qualification`, `team-relocation-routes`, `team-reserve-routes`,
`team-timed-host`, `team-timed-optional-host`, `coop-timed-bonuses`,
`team-bonus-opportunity`, `team-timed-integration`, each under `game/test/` with
the `.test.mjs` suffix. Use each Node binary with
`--import ./.cache/read-source-git.mjs --test` and those paths. The existing
read-only sparse adapter supplies missing historical media/content at exact
revision `daaef1facfe573cf13a7da2132ea8fd57aded898`; it never replaces present
source or injects state.

Independent review repeats all 13 new direct-core/inventory checks on each
runtime and 28 Studio/historical-relocation/reserve checks on each runtime. It also
corrected the first-window cooperation wording above: one pilot banks during
that window; the other contributes later. Lint, formatting and diff checks pass.
The committed engine and keyboard proofs do not claim a native full clear,
controller/touch qualification, a two-human playtest or public deployment.

## Research and remaining work

Primary-source recheck on 2026-09-21: [AirXonix's developer rules](https://www.axysoft.com/airxonix/)
describe bonus collection and different enemy domains; [Xposed Reloaded's
publisher listing](https://store.playstation.com/en-us/concept/10002881/) emphasizes
picture revelation, compact controls and demanding levels. Neither specifies
these respawn timings or proves that waiting for bonuses improves enjoyment.
Our design application is optional recovery during useful territory play, not
mandatory waiting or unverified claims about engagement.

Still open: Window relocation, Depot Gentle/Standard and reserve relocation,
broader starts, genuine complementary two-person play, spatial/short-route
balance, physical devices, full picture contrast and human acceptance. The
coordinated reviewed PR/version/immutable release/Pages gates remain with the
release owner. This is a P02/P14 evidence/copy increment, not completion of either
phase or a new mission count.
