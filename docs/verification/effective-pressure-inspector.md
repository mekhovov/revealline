# Effective gameplay pressure inspection

## Scope and provenance

This standalone correction is based on accepted main
`b13089b702391c275f2505d1a76c87eebb9dcce0`. It reconciles only the effective
pressure-inspector and Studio presentation changes from PR #323,
`e8888844e398d9850bc833ca1a070f00e6cad5ea`. It does not adopt that PR's map,
campaign, default-route, asset, or version changes.

The prior inspector exposed authored compilation facts while fresh gameplay also
applies global tuning, selected difficulty, and browser admin overrides. Those
are different contexts: for example, a current authored craft speed of 10 cells/s
does not describe its normally tuned movement rate. Expert may add keepers that
the authored roster does not contain.

## Contract

- Authored preview fields remain unchanged and are explicitly labelled.
- `inspectEffectiveGameplay` resolves the same mission and calls the shared
  `resolveGameplayTuning` / `applyGameplayTuning` preparation adapter exactly once.
  It does not implement a second set of physics or density-placement rules.
- The effective report contains the exact fresh-attempt level input identity,
  recipe, clamped admin settings, lives, rules, actor speeds/domains/retention,
  authored versus actual population, encounter, pressure attack and trail-impact
  contracts. Team reads its top-level impact and support-role fields.
- The runtime identity is explicitly an immutable **fresh-attempt level input**,
  not a hash of mutable live simulation state, whose actor fields can evolve.
- Diagnostics distinguish an unmet density target, preserved boss roster,
  disabled optional actors, and non-awarding admin playtests. A projection is not
  balance qualification or a guarantee about a moving capture outcome.
- Studio reads its browser's shared tuning controller and refreshes diagnostics
  on changes. It neither changes preferences nor silently changes Studio Play's
  authored preview rules. Empty selection clears the effective report.

No gameplay, enemy, geometry, objectives, pictures, campaign ordering, retained
editions, progress, replay formats, default routes, or release versions change.

## Focused verification

Node 20.19.5, four focused files, final coherent run: **14 passed, 0 failed,
0 skipped**, approximately 8.93 seconds:

```sh
node --test game/test/effective-pressure-inspection.test.mjs \
  game/test/effective-pressure-current-rules.test.mjs \
  game/test/content-studio-empty.test.mjs \
  game/test/studio-pressure-inspection.test.mjs
```

Coverage includes:

- All twelve current `whole-spatial-v9` pursuit/interception adaptations, three
  presets, Solo and Versus: actual prepared rates/counts, warning/commit/recovery
  descriptors, retaining roles and global travelling trail-impact settings.
- Actual Solo attempt preparation for Return in Reserve and Crossed Bands, with
  Standard/Expert and normal/admin settings: exact level identity and runtime
  fields; actual craft movement after its initially stopped state. Real greybox
  source is proven gameplay-equivalent to its pictured edition; image decode is
  not part of this test.
- Current Team impact and specialist sources, all three presets: exact tuned
  input plus live Team impact, support roles and actual enemy count.
- Existing Studio authored adoption/Undo, explicit inspection, no-mission reset,
  disabled optional actors, density-placement limits, and boss roster behavior.

The first run had 12 passes and two test-observation failures: a stopped fresh
craft has speed zero, and live Team initialization changes owned actor state.
Tests were corrected to exercise movement and distinguish immutable input from
live state. No gameplay behavior or expected pressure timing was relaxed. The
final coherent run above supersedes that test-fixture result, not its record.

Scoped syntax, ESLint 10.10.0, Prettier 3.6.2 and whitespace checks passed before
push. No full suite, build, native browser, physical
controller, human balance test, or public deployment is claimed by this receipt.
The focused Versus coverage verifies preparation parity, not a native paired-board
session; Team checks are runtime input/initialization checks, not earned-clear
routes. Publication remains with the release owner.
