# Historical Studio and Team source preservation

This packet preserves 50 exact files from three historical, uncommitted worktree
proposals. It is source evidence for later selective ports, not a runtime change,
release qualification, schema migration, or authorization to replace current files.
No prototype test, build, browser run or native acceptance was performed.

Each cohort contains `candidate-files.tar.gz` (all candidate source bytes),
`tracked.diff` (full-index changes against its pinned donor HEAD),
`new-source.patch` (the untracked new files), and `manifest.json` (original
status, preimage Git blob/hash/size, candidate Git blob/SHA-256/size, and artifact
hashes). The complete archives make recovery independent of applying old patches.
The base commits are ancestors of the pinned main. Restore or inspect archives
only in a separate scratch directory; never unpack them over a current checkout.

## Comparison and verification

The root manifest pins cached main, PR780 reconciliation, and these locally
available candidate heads:

- PR795: `81df80dda259ba8e1cef5378af1cec91260eb51e`
- PR796: `c99fbbac348691bb91bd16a7e1e281f5a9e2b69b`

None of the 50 donor blobs occurs in any of those four trees or their reachable
histories. The original main/PR780 comparison scanned 51 distinct published
verification patch/patch-source blobs, including gzip, with no new donor module
path hits. Each corrected candidate head separately contains 49 distinct such
blobs; none mentions any of the 18 distinct new-source paths, and none of those
paths exists directly in either candidate tree. The PR780 historical patches
retain Workshop and narrow-HUD proposals, not these cohorts.

Correction: the first packet mistakenly combined PR numbers with abbreviated
heads and reported the resulting malformed identifiers as unavailable objects.
Both corrected full heads resolve locally and have now been inspected; that
unavailability claim is withdrawn. Comparisons cover only these pinned local
objects, with no fetch or claim about subsequent remote state.

Every donor was read again after artifact generation: all 50 file bytes, donor
HEADs and porcelain statuses remained stable. Each archive was read back and
matched against the declared file set and SHA-256 values. All 31 tracked-file
patches reconstruct their exact candidate bytes in memory. The source-only
allowlist excludes dependency links, ignored data, media, profiles and build
outputs. Bounded full-source scans found no credential signatures/assignments,
private absolute paths, conflict markers, invalid UTF-8 or NUL bytes. No syntax
or behavioral acceptance is inferred from those checks. A subsequent recursive
scan of all 12 metadata/readable-patch artifacts found no private home, temporary
or Windows-user directory paths. Correcting the comparison metadata left all
cohort archives, patches and manifests byte-identical; all 50 donor files, HEADs
and statuses were checked again and remained stable.

## Required decisions before a current-source port

- Studio: reconcile the prototype v2 reference/provenance workspace, dispatch,
  storage and compiler APIs with current Studio codec/5 MiB metadata contracts.
- Team v621: retain current host, localization, actor and explicit-Resume owners.
  The donor R12 is still unaccepted for dense native maps, combined touch layout
  and full composed behavior; old test counts in its docs are historical.
- Team cues-next: retain as a superseded alternative. Its earlier area-first
  large-caption strategy is reported by later v621 notes as failing native owner
  association. Exact-byte preservation does not recommend runtime adoption.

## New source files

### p04-reference-prototype-r1

- `game/presentation/reference-bundle.mjs`
- `game/presentation/reference-model.mjs`
- `game/presentation/reference-session.mjs`
- `game/presentation/reference-store.mjs`
- `game/presentation/studio-formats.mjs`
- `game/test/presentation-references.test.mjs`
- `game/test/presentation-studio-formats.test.mjs`

### p05-team-large-v621

- `game/couch/coop-cue-semantics.mjs`
- `game/couch/coop-cue-symbols.mjs`
- `game/couch/coop-objectives.css`
- `game/couch/coop-objectives.mjs`
- `game/test/coop-cue-semantics.test.mjs`
- `game/test/coop-cue-symbols.test.mjs`
- `game/test/coop-large-objective-identity.test.mjs`
- `game/test/coop-large-text-host.test.mjs`
- `game/test/coop-objectives-host.test.mjs`
- `game/test/coop-objectives.test.mjs`
- `game/test/coop-threat-summary-host.test.mjs`

### p05-team-large-cues-next

- `game/test/coop-large-text-host.test.mjs`
