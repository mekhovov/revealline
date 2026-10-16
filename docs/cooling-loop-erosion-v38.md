# Cooling loop earned-return pressure — `whole-spatial-v38`

Status: source candidate; production testing deferred and balance review pending.
This is not a default-edition promotion or a new gameplay-policy revision.

## Why this successor exists

Current-speed legal-input inspection of v37 exposed an inactive signature threat
on two useful openings. Its eroder started at `(14.5, 9.5)` heading horizontally;
after the northern five-cut opening and 2,400 observation ticks, it had neither
warned nor eroded territory by tick 4,050. The northwest wall keeps that ordinary
path away from the newly earned lower returns. Capture-induced domain repair can
relocate an embedded enemy, so this is not a claim that erosion is impossible
under every route.

The earlier design description also called the connected route permanent. Only
its authored foundations are permanent: the earned links can erode. This
successor corrects that distinction without changing the map or increasing speed.

## Bounded authored change

- Move the existing `eroder` to `(14.5, 24.5)`, heading `[1, 1]`.
- Preserve its identity, role, tier, speed, warning and recovery rules. Ordinary
  travel remains straight between physical impacts; no mid-flight retargeting.
- Describe the choice between protected northern/side landings and a bank-first
  approach honestly. Erosion threatens earned returns, not the foundations.
- Preserve every wall, foundation, terrain cell, objective, quota, bonus,
  picture, soundtrack, mission identity and other authored actor.
- Preserve every v37 and earlier project. The new route has its own source,
  runtime, profile and suspended-session identities.

The Polissia separated-band-inspired geometry from v37 stays unchanged; this
is an encounter/counterplay correction, not new ornament research or artwork.
The new design text uses the existing English fallback where no translation has
been authored. It does not claim a newly translated Ukrainian content catalogue.

### Effective preparation, not authored counts alone

Runtime uses `resolveMission` followed by the normal `applyGameplayTuning` path
exactly once, at default admin settings (`gameplay-pressure.v4`). Standard speeds
remain craft 8.84, keeper 11.05, eroder 5.376 and trail impacts 38.4 cells/second.
Gentle/Standard retain three actual actors; Expert retains four.

Existing Expert maximum-clearance placement also moves its generated extra
keeper from `(44.5, 2.5)` to `(41.5, 2.5)` because the occupied authored positions
changed. Its count, role and speed do not change. This is tested explicitly;
neither the preparation algorithm nor an authored second actor was edited.

## Source verification

The committed tests prepare fresh real runtime states and use legal commands,
without editing cells, actor positions, health or terminal status during a run.

| Evidence                                            | What it establishes                                                                                                    | Limit                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Copy-on-write checks, pictured and greybox projects | Only Cooling loop's authored eroder/design and owning revision metadata change                                         | Does not prove fun                                   |
| Effective preparation on all three presets          | Same speeds, rules, geometry, counts and Solo/Versus levels; explicit Expert placement consequence                     | Default admin settings only                          |
| 24 first-return cases                               | Up/left returns on three presets, both steering modes, seeds 1/917; zero loss, stopped craft and protected foundations | First returns, not complete routes                   |
| Two longer Standard routes                          | Northern-landings/both-banks and western-bank-first approaches remain lossless; real warning → earned-return erosion   | Immediate steering, seed 1                           |
| Northern full Standard clear                        | 13 cuts, 81.410867% at tick 5,503, all three lives retained; both banks neutralized and all foundations linked         | One preset/control/seed, not whole-mission balance   |
| Bank-first full Standard clear                      | 15 cuts, 81.649190% at tick 8,189, all three lives retained; western bank neutralized and all foundations linked       | Eastern bank remains unclaimed; not optional mastery |
| Deterministic replay and actual paired boards       | Recorded inputs reproduce the checked outcomes; independent Versus boards receive equal conditions                     | Not physical multiplayer testing                     |

The longer partial routes observe three removals at ticks 1,615, 2,653 and 3,723
at `(17, 26)`, `(17, 27)` and `(18, 27)`. Each has a 60-tick warning. These are
ordinary earned-ground cells, **not restored lethal-bank cells**. The identical
v37 commands produce no erosion in the bounded observation window.

The complete northern continuation clears in about **45.85 simulated seconds**
with six warnings and six removed cells. Its checkpoint is
`21a461387f53c722`; source simulation identity `12cb94779989a3b1`, once-tuned
runtime identity `c3f6fa4df98379f9`. Claimable area remains 2,098 every tick;
permanent foundations remain intact and no bonus is collected. This demonstrates
a complete feasible route within the intended ordinary duration, not a guarantee
that human attempts have that duration or that every approach is safe.

The second, bank-first continuation clears in about **68.24 simulated seconds**
with eight warnings and eight removed cells, checkpoint `b8aab03a29e67318`.
It finishes with 1,713/2,098 cells and all foundations linked, but leaves the
40 eastern-bank lethal cells unclaimed. This is a valid ordinary win, **not**
both-bank optional mastery. The two approaches make different bank/landing choices;
they are not two mirrored versions of the same input.

The recipes are retained in `game/test/cooling-loop-erosion-routes.test.mjs`.
Neither repair necessity, optimality, mastery recognition, quota-tail quality nor
enjoyment is established by these two scripted routes.

### Focused execution receipt — 29 September 2026

- Initial candidate/route files: **33/33 passed**, zero skipped (4.38 seconds).
- Final supplemented cohort: **36/36 passed**, zero skipped (5.27 seconds),
  including the second Cooling loop clear plus Pressure ladder and Switchback
  exchange full-route regressions. The latter two missions are unchanged.
- Selected route-loader/history/Studio cases: **11 passed, 96 name-filter skips**,
  zero failures (6.68 seconds). This is not a full historical-suite rerun.
- Changed JavaScript ESLint, changed-file Prettier and `git diff --check` pass.
- `node scripts/game-cli.mjs validate` passes, retaining five existing
  cross-site navigation warnings; presentation metadata validation passes.
- Independent source review's missing final-foundation-connectivity assertion
  was added; its selected rerun and the subsequent 33-test cohort pass.
- No full local build/archive copy with 2.6 GiB free. Hosted integration retains
  build/provenance and release-integrity checks; no build success is invented.

Reproduce the main focused cohorts:

```sh
node --test game/test/cooling-loop-erosion-candidates.test.mjs game/test/cooling-loop-erosion-routes.test.mjs
node --test game/test/cooling-loop-erosion-candidates.test.mjs game/test/cooling-loop-erosion-routes.test.mjs game/test/pressure-corridor-complete-routes.test.mjs
node --test --test-name-pattern='v3[78]|Cooling loop|all literal|recent registered|review links' game/test/content-route-loader.test.mjs game/test/spatial-candidate-edition-history.test.mjs game/test/studio-spatial-editions.test.mjs
```

### Failed proposals are not erased

Eleven placement/heading proposals were inspected: nine valid eight-way starts
and two rejected non-eight-way headings. Several valid alternatives caused a
life loss on one proposed opening or left the eroder inactive. The selected
placement preserves both bounded openings. A naive upper departure in the clear
search hit an emitter impact; the successful route uses a different departure.
Six historical clear recipes also failed before a closure under current tuning.
None of these attempts is relabelled as a pass or evidence of universal fairness.

## Access and preservation

After this source is incorporated into a build:

- Solo: `game/?journey=whole-spatial-v38`.
- Versus: `game/couch/?journey=whole-spatial-v38`.
- Search **Cooling loop** in that edition's mission selector.
- Studio's combined Journey edition selector exposes v38 and its exact review
  links without automatically applying it to a user's working project.
- v38 **Archive** adds the exact v37 Cooling loop to the previous 81 cards. Its
  manual launch stays on v37; Archive never becomes the automatic Next order.

The ordinary Solo/Versus default remains v25 and does not automatically advertise
this candidate. Team keeps `team-cultural-specialist-originals-2`; no Team rules,
custom projects, installed packs or player media are modified. Older route
snapshots stay pinned. The new content snapshot is 293,372 bytes, SHA-256
`2ed49a419214ffe991a26e99a5c6e730b0f8d117c16900aecc99943a7329d17e`.

## Delivery and remaining work

This is one scoped source input for the existing consolidated release queue, not
a competing version/tag/Pages publication. Long suites are waived, not passed.
Keep focused correctness, lint/format, source review and required build/provenance,
immutable hashes, archive preservation and basic availability checks. The user's
production-testing deferral is not an approval record.

Remaining: broader seeds/presets/control-style clears;
useful repair/escape choices and post-bank pressure review; actual host input,
device/accessibility/performance and human fairness/enjoyment qualification.
Production and human qualification remain explicitly deferred. This source slice
does not complete the rest of the v37 triptych, default promotion, Team balance or
the original P13–P15 acceptance work.
