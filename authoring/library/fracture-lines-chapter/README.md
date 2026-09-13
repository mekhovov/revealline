# Fracture Lines · FPV chapter source

This compiler binds the three [Fracture Lines layouts](../fracture-lines/README.md)
to the three unchanged [FPV originals](../fracture-lines-art/README.md). It produces
one optional Arcade chapter, `fracture-lines-fpv`, with the authored owner
`fracture-lines-fpv/1/8f79476cc9cf6221`. It does not register or install that chapter.

| Map             | Original                             | Authored level revision |
| --------------- | ------------------------------------ | ----------------------- |
| Split Ring      | `fracture-lines-split-ring-fpv`      | `1`                     |
| Fault Fan       | `fracture-lines-fault-fan-fpv`       | `1`                     |
| Frayed Causeway | `fracture-lines-frayed-causeway-fpv` | `1`                     |

All three full level definitions, class recipes and controls remain exact. This
slice illustrates the existing three Fracture geometries; it adds no geometry or
gameplay rule. Standard and Gentle, each with Immediate and Grid Buffer steering,
are the only proof contexts. Expert is not advertised or qualified. Direction-only
Arcade input, contact pickups and capture stops are inherited from the source.

`buildFractureChapter()` in [build.mjs](build.mjs) returns
`{descriptor, payloads: {pack, media}, prepared, sourcePack, inputPins, imageProofs}`.
[edition.json](edition.json) assigns exactly one pinned source PNG to each level.
Metadata and source files must match their pinned hashes; every PNG is fully decoded
and its dimensions, original bytes and SHA-256 are checked before the existing still,
media-bundle and external-chapter validators prepare the pair. All original assets
remain under 4 MiB. No cap or existing transfer format changes.

The compact gameplay body is 9,708 bytes. The `.rlmedia` body is 8,669,310 bytes,
including all 8,656,868 original PNG bytes. The pair totals 8,679,018 bytes. Each
presentation uses `contain` and `nearest`, with an explicit `story: null`. Artwork is
fictional reward scenery, not collision geometry, a real operational location,
documentary evidence or an animation. Source metadata retains the complete image
prompts and generation provenance; these files make no new rights claim.

From the repository root, explicitly emit a new pair into an existing cache parent:

```sh
mkdir -p .cache
node authoring/library/fracture-lines-chapter/build.mjs .cache/fracture-pair
node authoring/library/fracture-lines-chapter/verify.mjs
node --test game/test/fracture-lines-chapter.test.mjs
```

The output directory must be new, inside this worktree's `.cache`, with ordinary
existing parents. Writes refuse an existing output or symlink parent. The output is
`descriptor.json`, `pack.json`, `media.rlmedia` and `inputs.json`; serve/startup does
not generate them. The source descriptor is [descriptor.json](descriptor.json).

[verify.mjs](verify.mjs) reuses the exact retained base controls and pinned
[base route evidence](../fracture-lines/routes.json). The compact
[routes.json](routes.json) references each full base trace by ID and hash, without
duplicating input arrays. Its finite matrix contains 48 route contexts: 24 alternative
ordinary wins, 12 deliberate first-life-loss controls and 12 recovery wins. Six
separate three-life game-over controls are additional evidence. These traces cover
121,942 core ticks and 204 saved boundaries: 192 nonempty suffix resumptions plus
12 exact respawning endpoint restores. The verifier executes both the authenticated
base trace and the illustrated trace; those execution passes do not double the
number of authored routes or gameplay observations.

Gentle derives its execution revision from the campaign owner. Accordingly, this
new owner has a distinct Gentle revision and replay/checkpoint identity even though
its physical recipe is identical. The verifier authenticates the old trace, compares
every physical checkpoint section, and permits only that explicit revision remap
in identity, completion summaries and completion events. New receipts retain the
actual new revisions and hashes. Every saved boundary carries its exact new still
pin and null story through current session restoration, original resolution and
the complete remaining ordinary-input replay. Old source saves and first-earned
records remain owned by the old campaign and cannot silently acquire these pictures.

The focused tests also cover foreign owners, corrupt originals, changed metadata,
missing picture availability, first-earned isolation, caller mutation during an
async proof request and exclusive output. Producing or preparing a pair awards
nothing. The checks are core/model/source evidence, not native browser play,
controller/touch qualification, balance or fun approval. Runtime catalog/download
adoption, budget/backup host qualification, native three-map play and later frozen,
offline and public delivery remain separate work. No music or video is produced.
