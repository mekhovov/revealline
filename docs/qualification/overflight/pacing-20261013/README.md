# Overflight pacing continuation — 13 October 2026

Rebased onto main `fba236ef80bd0310ae3b9c33fd7c26b1529b245c` before this work.
This is a gameplay review candidate, not release acceptance. The retained source
hashes identify the tested implementation independently of later Git metadata.
An unrelated Library task changed the shared checkout's branch during validation;
this PR is isolated on `codex/overflight-pacing-followup`, directly above that main.

## Completed in this continuation

- **Survivor relief correction.** A mass clear still earns the configured 8 seconds
  of Standard / 5 seconds of Veteran relief. It cannot immediately renew that
  spawn suppression: the next earned break becomes eligible after three relief
  durations. Authored rest windows remain, living enemies remain active, and no
  instant casualty replacement is introduced. This corrects all V2 runs; V1
  director behavior is unchanged.
- **Late Survivor fronts.** Newly generated V2 formations beginning at or after
  240 seconds use 40 arrivals/second, 36 movement speed and 120 hull. Slower,
  tougher ordinary fronts preserve crowds while leaving the earlier interceptors
  distinct. Imported encounter definitions and V1 defaults retain their data.
- **Raid vehicle approach.** The second sector's finite escort now screens its
  second light vehicle with four Standard / six Veteran shield units. The rear
  remains vulnerable and the opening exposed leader stays unchanged. Specialist
  admission limits still apply. This changes generated V2 content identity;
  existing authored packages and legacy layouts are preserved.
- **Review tools.** The ordinary-input Raid pilot can flank visible protected
  escorts. Qualification now records objective timestamps and 10 Hz visible
  contact-state categories, plus Survivor time at 600+ actors and relief exposure.
  Failed route attempts remain in the report. These observations do not establish
  a safe route, player comprehension or enjoyment.

## Evidence and limits

[Summary](summary.json), [full route matrix](route-matrix.json.gz),
[passive-play probes](passive-probes.json.gz), and [test output](tests.tap).
Raw JSON is losslessly gzip-compressed; `gzip -dc FILE.json.gz` reads it.

- **241/241 tests pass**, covering `game/test/overflight-*.test.mjs` and
  `game/test/raid-*.test.mjs`. Scoped ESLint, formatting and diff checks pass.
  The regression includes earned relief, re-entry into pressure, later relief,
  shield navigation without simulation mutation and cross-sector specialist limits.
- **42/42 route groups have a completion**, seed 17031991, three airframes:
  24 Raid groups (two difficulties × three encounters × three builds/baseline)
  and 18 Survivor groups (two difficulties × three encounters × three builds).
  There are **46 attempts: 42 wins and four losses**, with the losses retained.
  The matrix tries tight, orbit, then figure-eight until one succeeds; the final
  configuration needed only the first two. This proves bounded reachability, not
  balanced win rates or the one-airframe challenge.
- Survivor winning routes finish in **316.37–338.77 seconds**, peak at
  **371–656 visible enemies**, and retain one to three airframes. Three winning
  routes briefly exceed 600 (1.33–4.65 seconds); none exceeds 800. The intended
  broader, sustained surge experience remains a review gap. No actors are hidden
  or sampled to achieve these counts.
- Raid routes finish in **22.42–53.33 seconds**. These are automated simulation
  times, excluding player deliberation. They do **not** establish the intended
  4–7-minute ordinary first completion. Do not add mandatory waits or kill quotas
  solely to force those times: priority-target approach design and player trials
  remain the next pacing work.
- All **eight passive-play probes lose** after legitimately acquiring rank-two
  pulse: stationary, tiny circle, wall and edge loop, Standard and Veteran, front
  encounter. No invulnerability, XP or damage injection is used. This does not
  rule out every exploit, build or seed.
- [Native late Survivor view](survivor-late.png) retains the 04:51 crowd composition. Dense machinery armor brackets still need readability review in motion.
- [Native Survivor result](survivor-result.png) completed at 05:27 with 2,602 clears and all ten earned choices using the Systems review build.
- [Native Raid result](raid-result.png) shows completion through the shared shell
  using the explicit automated-review entry. It is a visual/functional smoke
  check, not a human playtest. Browser checks ran alongside Node validation, so
  no browser timing from this session is accepted as performance evidence.

All numerical balance findings above describe this source and this seed. Earlier
qualification packets retain their historical value but do not certify this tuning.
No new atlas frames or resources are added by this continuation.

## Remaining work, recommended order

| Priority | Item and concrete next output | Why it matters / cost of deferring |
| --- | --- | --- |
| P0 | **Human Raid approach and pacing review.** Five players, including two newcomers, two runs each; record contact misunderstandings, time to objective, missed approaches, and objective/pack route choices. Review shield-screen motion, then revise priority-target formations and exposure opportunities. | The code is completable, but fast automated clears and one added screen cannot demonstrate engaging hunting. Deferring risks shipping a mode that remains trivial or confusing. |
| P0 | **Survivor pressure and build review.** Capture early/middle/late play for all three builds; extend the same recorded matrix to more seeds and both airframe presets after reviewing the crowd composition. Tune sustained late pressure without eliminating earned relief. | Only three winning routes reach 600+ briefly. Treating peak counts as completion would miss the desired sustained crowd pressure and seed-dependent difficulty. |
| P0 before release | **Reference-device qualification.** Iris Xe/Windows/current Chrome: 30-second warm-up, three independent two-minute runs, actual sorties plus the 1,500-actor renderer fixture. Record versions, power, backing resolution and quality. Add M1 Air Chrome/Safari. | Headless simulation and old Mac records cannot prove 60 FPS or readable dense combat on the target laptop. Deferring risks slowdowns precisely during rewarding clears. |
| P1 | **Physical controls and audiovisual review.** Keyboard, physical gamepad/remap/reconnect, touch on a real phone; listen to classic/reaction sound choices, startup, music, commentator and warning mix. Capture reduced-effects and reduced-motion comparisons. | Shared integration already exists, but synthetic checks cannot detect uncomfortable steering, missed thumb actions, unreadable effects or an exhausting mix. |
| P1 before release | **Current-candidate lifecycle and offline regression.** Ten retries, context loss with explicit resume, fifteen-minute browser soak, installed offline Survivor/Raid/Snake and safe update behavior. | Earlier functional evidence predates this candidate. Without a fresh pass, leaks, restoration issues or missing downloaded resources can survive to release. |
| P1 | **Raid Creator handoff.** Demonstrate author → preview → native play → actual export download → fresh-profile import and replay; record shared-effect reuse. Verify package identity and old authored content. | Canonical package tests are passing, but a real export/download/fresh-profile round-trip remains broader than those tests. Deferring can strand creators despite correct data contracts. |
| P2 after A/Raid review | **Riy escorts, Time Attack, then Contract Marathon; character-specific mechanics.** Reuse accepted movement, contact, presentation and Creator interfaces. | These add variety later. Starting them before the core pacing review spreads balancing and testing across more interacting systems. |

Publication and full A/Raid acceptance remain separate. Existing shared home,
PWA, sound settings, Studios and touch controls are in main; this PR does not
present those earlier deliveries as new work.

## Reproduce

From a complete checkout with installed repository dependencies:

```sh
node --test game/test/overflight-*.test.mjs game/test/raid-*.test.mjs
node scripts/qualify-overflight-variety.mjs .cache/overflight-followup/route-matrix.json
node scripts/game-cli.mjs serve --port 8895
```

Native manual review: `/game/overflight/play.html?lang=en` and
`/game/overflight/raid.html?lang=en`. Explicit demos add `reviewBuild=systems`
for Survivor or `reviewBuild=objectives` for Raid. Start/Resume remain manual.
For the passive probes, call the exported `qualifyOverflight` with
`direction: 'systems', airframes: 3`, both `difficulty` values, and each route in
`OVERFLIGHT_AUDIT_ROUTES`; default seed/front encounter are recorded in the receipt.
Do not run CPU qualification concurrently with performance measurements.
