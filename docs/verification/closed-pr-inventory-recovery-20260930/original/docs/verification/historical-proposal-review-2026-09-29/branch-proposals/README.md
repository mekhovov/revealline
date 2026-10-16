# Historical branch source proposals — 2026-09-29

This packet preserves historical proposals for a source-only release input.
It does not register runtime code, adopt a storage format, enable a workflow,
change package versions, or establish current game/device acceptance.

## Retained source

- Chapter residency: commit `06c7f15db4afe4334d6ae5685be009612c128438`,
  base `57bee98f23a6bf5882f19065f1d70473ece7a12e`, version 0.40.0.
  Both exact added files are retained. The proposed still-storage v2 metadata
  requires a current manager/authority/migration design before any adoption.
- Classic race tour: commit `74e2c9baec91462e68cee130c952550d82d611d0`,
  base `1f3b9995af43879d54fb7b0053846f0723e2e069`, version 0.58.0.
  The progression module and two exact tests are retained, with a readable
  patch of all original `game/` integration changes. This preserves authored
  order, accepted terminal results, first-to-two/rematch credit and host intent.
  These are old hosts; do not apply the integration patch wholesale to main.
- Optional inspection-job regression: commit
  `3c3811a4e54b3f2892c90dd25f700ccc3cebe166`, base
  `80911bf5ec0f6df711d7e70b36a11005d2be4c3a`, version 0.132.4.
  Only its eight-line test addition is retained as a readable patch. Current
  implementation already distinguishes inspection-job authority; this is an
  optional extra assertion, not a missing runtime fix.

The donor versions above identify provenance, not the proposed release version.
The five files under `source/` are exact Git blobs. Their repository paths,
Git modes/blob IDs, lengths and SHA-256 values are in `manifest.json`. Readable
patches are bound to exact parent/donor commits and use relative repository paths.

## Scope and exclusions

This is a source subset, not a complete executable checkout. Test helpers,
historical compiled data and inherited base dependencies are not bundled.
The Classic race-tour source-only integration patch contains its original game
module, host, HTML and test changes; non-game documentation, skills, evidence
JSON and the historical evidence ZIP are excluded and enumerated in the manifest.
No original artwork/media, release binary, distribution ZIP, author credential,
local path or private runtime setting is intentionally included.

An existing old draft-discovery donor is not included: current candidate
`0c8346c312d63f3a68d5f70a63ea104f8c6bb707` already supplies the stronger
`resolveRelease` implementation and matching draft/ambiguity coverage.

## Review and verification

The source owners and declaration comments were inspected; imports and test
outlines were checked. Automated text checks cover retained source/patches for
common credential signatures, private-key blocks and local absolute home/temp
paths. Those checks do not claim a comprehensive secret-detection guarantee.
No historical tests, builds, hardware or browser flows were rerun for this intake.
No historical pass count is claimed as current qualification.

Archive validation compares each regular member byte-for-byte with this packet,
rejects absolute/traversal/link members, checks all source Git blob IDs, and
reconstructs each readable patch in memory against its exact local parent blobs.
`validation.json` records the archive hash and those checks. It is outside the
archive to avoid circular hash dependencies.

Preserve this packet as review material. Runtime adoption requires a separate
current-base change, ownership decision and focused regression evidence. The
single release coordinator retains final release and publication authority.
