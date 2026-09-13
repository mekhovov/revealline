# Sentinel Circuit: external originals candidate

This source-only compiler pairs the three separate
[Sentinel Circuit missions](../sentinel-circuit/README.md) with their three exact
[original panoramas](../sentinel-circuit-art/README.md). It creates one additive
`sentinel-circuit-fpv` edition using the existing external-chapter descriptor and
native `.rlmedia` transfer format. No current registry, optional catalog, default
build, installed pack or user assignment changes here.

| Mission          | Exact original         | Gameplay                                                                               |
| ---------------- | ---------------------- | -------------------------------------------------------------------------------------- |
| Listening Court  | `listening-court.png`  | Scout information and two courtyard routes                                             |
| Switchyard Gates | `switchyard-gates.png` | Light carrier temporary control or an outer route                                      |
| Open the Circuit | `open-the-circuit.png` | Fiber signal resistance with a vulnerable live cable; shielded and exposed boss stages |

The three geometries were newly authored in the separate Sentinel source slice.
This binding edition preserves them exactly. All seven classes, full mechanic
briefings, stock theme/music, walls, spawns, enemies, rules and boss timings remain
unchanged. The final boss still has two schedules; three missions are not three
internal boss phases. The fictional artwork is scenery, not collision geometry
or equipment instructions.

## Exact outputs

The [descriptor](descriptor.json) binds normalized compact `pack.json` and
`media.rlmedia` by raw bytes and SHA-256, authored campaign key, and three immutable
poster records. Each presentation uses `contain` and `nearest`, exact level/
revision/theme identity and literal null story. The companion contains the three
original PNG bodies (8,584,068 bytes total); the pack contains no inline images.

- Pack: 9,238 bytes, SHA-256
  `ae2c1489c27afd2f492472d00605a57a65fd1d2c154e63b1b2c17b48bca323cb`.
- Media: 8,596,058 bytes, SHA-256
  `ca68ec6d1c7b1ade630227f810416136bd862f956b9e26dc0a0233e7d28c2e3c`.
- Authored campaign: `sentinel-circuit-fpv/1/398c82081d2d49df`.

The [builder](build.mjs) checks the exact procedural source-pack serialization,
source builder/proof and art provenance before preparing the new edition through
the real pack, still-media, native bundle and external-descriptor validators.
Every original is bounded, decoded with the unchanged PNG decoder and checked
against its provenance hash. Source-original bytes and historical content remain
unchanged.

From the repository root, explicitly produce one new ordinary cache directory:

```sh
mkdir -p .cache
node authoring/library/sentinel-circuit-external/build.mjs .cache/sentinel-external-pair
node authoring/library/sentinel-circuit-external/verify.mjs
```

The producer writes `descriptor.json`, `pack.json`, `media.rlmedia` and `inputs.json`.
Existing output directories, foreign destinations and symlink ancestors refuse.
No runtime or release artifact is generated implicitly. `verify.mjs --record` is
a one-time source-proof recorder; it refuses existing proof/descriptor files and
any explicit caller candidate. Normal verification is read-only.

## Actual source qualification

The [proof](routes.json) executes the same cardinal/equipment commands through the
real core, under Standard and Gentle and both turn policies:

- 56 distinct contexts and 101,713 ticks;
- 32 wins, 16 controls ending after one actual life loss, and 8 unfinished
  early/short-closure controls;
- 56 actual unfinished cut prefixes, serialized v4 restores, full replays and
  exact suffixes, with the corresponding original still and null story pinned.

Every physical summary, checkpoint section, event, metric and saved-prefix state
matches the preserved procedural source proof. Edition identity and terminal
identity fields are derived under the new campaign and recorded exactly. The
first recording attempt retained a comparison diagnostic for `run.completed`'s
new level ID; only that identity comparison was qualified, without changing a
level, route or gameplay result. No failed attempt was rewritten.

The focused tests also check exact reproducibility, original-body equality,
ownership/hash tampering, malformed candidate refusal, output protection and
exclusion from ordinary catalogs/builds.

## Later adoption

The fifth known descriptor/catalog/build entry requires a separate coordinated
integration after the existing four-entry publication slice. Native install must
preserve current flight/profile and keep Choose explicit. Browser rewards,
Collection, backup/recovery, cache/offline, public delivery and hardware checks
remain later work. This slice does not migrate existing embedded packs, enable
external removal, replace assignments silently or claim three stories.
