# Discovery candidate reconciliation with accepted main

Accepted main `321408a3cfd75ae230d760f39fb692503652601a` contains production101,
including the mission-selector continuation. Discovery candidate
`db4b2c8e89f3c9a3c0b67d6e7e5f64f08ea3c6ef` contains a separate101–103 lineage.
Both preserve complete production100 and all 132 original payloads, but their
`fpv@101` and eight `audio.*.field-kit@53` records differ. These records cannot
be combined under a single numeric identity.

The active ledger starts with accepted main101 and uses the normal producer to
append one successor102: eight reviewed audio54 records and 24 reviewed UI23
records. The audio review authenticates the merged 50-input source closure; the
existing WebP UI review still authenticates its unchanged seven inputs. No
history is renumbered, rewritten, padded or silently treated as another lineage.
The scope is software continuation; it does not establish human listening,
artwork, learning, physical-device or release approval.

`discovery-production103.rltheme.gz` retains the candidate's complete original
bundle, including its source-stage101 and reviewed102/103 history. Decompression
is bounded and tests authenticate both compressed and original bytes. It is an
inert historical source archive, outside the default playable include roots.
It is not an implicit import or runtime fallback. The original source commits
also remain in merge ancestry.

Runtime restoration uses the existing exact-manifest mechanism. Four explicit
source pins in `retained-inputs.json` and the code-owned
`scripts/field-kit-retained-runtime.mjs` registry preserve main101 and
candidate101/102/103 byte-for-byte, alongside the existing54/58/60/62 retained
runtimes. Their complete lazy dependencies are verified against unchanged
content-addressed originals. The compiler emits each retained runtime once.
Continue, Retry and historical requests retain their exact runtime hash; a
numeric theme revision by itself cannot select an alternate lineage. Team
picture eligibility has its own finite policy and does not follow from mere
presence of a retained manifest.

The full-bundle oracles are independently read from their original Git commits,
validated and re-exported byte-identically before production:

- `game/test/fixtures/production-v01424-main321-fpv101.json` authenticates main101.
- `game/test/fixtures/production-discovery-db4-fpv103.json` authenticates candidate103.

The pre-existing discovery100/101/102 oracles and reviews stay immutable. Their
historical tests now reconstruct from the authenticated candidate archive;
main101 reconstructs from the active canonical ledger. Tests also prove that
the two different101 records remain distinct and that all 132 payloads match.

The four added raw runtime manifests total 4,900,684 bytes. After smaller current
runtime/Studio metadata and the ownership manifest update, compiled output grows
4,877,674 bytes from candidate db4. Source copies and the inert archive are not
in the default playable include roots. This still exceeds the earlier default
archive headroom; current whole-build admission must resolve that capacity gate
without dropping promised history or raising caps. Source archive eligibility,
full default/hosting admission, publication and rollback remain separate.

## Working-source validation

The production history, raw retained-runtime and recipe-source cohort passes
**52/52**, with no skips or cancellations. It authenticates both full ledgers,
each original runtime and lazy dependency, exact source fingerprints, corrupted
input rejection and deterministic regeneration. Its local log SHA-256 is
`9f723e8e183ee82d19130e00bd93819e862fd59faa99001e18c3f90cbeba812e`.
Normal `produce-field-kit-theme.mjs --check`, scoped ESLint, Prettier and diff
whitespace checks pass. Canonical102 has144 compiled files,2646 asset records,
103 theme records and132 unchanged original payloads. Its bundle is8,472,841 bytes
with SHA-256 `a6343c77e63b3ff2ad1d401f8193795f484d5eb046797049452191051051d14b`.
Its current runtime SHA-256 is
`92f09d9eb867989438991f116ee8a192cee6ac8c2e3f286297aa184257c96f78`.

The first local cohort passed40/50: nine checks lacked an explicitly required
README in this sparse checkout and one still expected the old four-input
retention registry. The second run followed explicit input restoration and the
new eight-input assertion. The earlier failure remains recorded; it is not
relabeled as passing. An initial production attempt also encountered a missing
prepared title image before the original prepared inputs were restored.

These are working-source checks, not a frozen artifact, merged release,
performance qualification or public-byte observation. Exact final integration
and the default capacity gate remain open.
