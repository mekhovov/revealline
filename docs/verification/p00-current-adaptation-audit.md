# P00 current-edition adaptation audit

Issue: [259](https://github.com/mekhovov/revealline/issues/259).
Baseline: `64ec9fd2e5688f4248fe005ac6a47c0c1394ea9e`.

The prior audit's newest selector, `actor-originals`, predates the current
`whole-spatial-v5` route. All 48 numbered references still have explicit links,
but those links resolved older executable revisions. The diagnostic found 62
linked mission identities with changed Standard Solo enemy payloads; seven map
references changed. Identity differences alone were not called geometry changes.

## Correction

Run `node scripts/audit-journey-adaptations.mjs --edition whole-spatial-v5`.
The shared route and compiler now resolve the selected project's 91 missions,
66 explicit adaptation links, 48 covered references and six Solo/Versus preset
identities per link. The 29 missions without a reference link are listed once;
original optional missions are not silently assigned a source-game reference.

Each selected-edition link retains its declaration project, mission revision and
map, and explicitly requires selected-edition design review. Historical pin
validation is not bypassed when selecting new geometry. Missing declared or
selected missions fail instead of falling back to old content. Final dispositions
remain zero. No rules, maps, art, saved progress or gameplay runtime changed.

The ledger's recommended command selects v5 explicitly. Its default historical
CLI behavior and all five older edition options remain available. Selecting this
edition does not mean selecting any future edition automatically.

## Evidence

- Red regression: the new selector failed with `Unknown adaptation content edition`.
- Node20.19.5: all five adaptation coverage tests passed, no skips/failures,
  including 396 selected manifest comparisons, complete CLI/API output parity,
  source immutability, historical pin rejection and missing-mission rejection.
- Expanded adaptation/campaign-presentation/actor-edition cohort: 18/18 passed
  on Node20.19.5, no failures, skips or cancellations (22,839 ms).
- Direct in-memory comparison against the baseline script produced identical
  serialized reports for all five historical options. SHA256 values:

| Edition            | SHA256                                                           |
| ------------------ | ---------------------------------------------------------------- |
| greybox            | aaf75afc9653ad1b209b43f17825b3fa9aad0d0bcd36723124f0e1834719ab67 |
| originals          | ef32d126cf418726149814686220416703d8256aeea5dc084e9cb254ce8bd89a |
| teaching-originals | 279cf05601b2e07d29a17797472294faf1c044df6b17ec0adc5e7f9774fe86b3 |
| campaign-originals | b9df5cb0c719c39457591bd4e63d0d432ef0a66fb9dd95b6b2eff76689a1a658 |
| actor-originals    | 10e6a1080451610159a1207f6204c443b7f2a8327dcc84a54e0307c3df87876a |

Compilation and crosswalk coverage are not renewed route, art, human balance or
final-disposition evidence. Exact-source CI, independent review, coordinated
release and public deployment remain required. This increment is not part of the
already-running v0.82.1 source qualification.
