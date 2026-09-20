# Opening artwork distribution boundary

P01 source candidate, not a published release or a whole-phase acceptance.

Earlier source `577ebc0e` failed hosted run `35490113818` because its ten original
pictures pushed mandatory offline content over the unchanged 64 MiB limit.
The explicit `optionalArtwork` build opt-in now reads the same authored
`HORIZON_ART_CANDIDATES` registry as gameplay. It validates ordinary source paths,
bounded revisions, inclusion, unique identities/paths, exact byte lengths,
SHA-256 and PNG dimensions. It checks final packaged bytes again before exclusion.

Original pictures remain unchanged in loose files, the distribution ZIP and the
complete manifest. Only these validated picture paths leave the core offline
inventory. Their metadata participates in the existing content-addressed build
identity. The 2000-file / 64 MiB core guard is unchanged. Absent opt-in preserves
historical build behavior. This is not an artwork download/install subsystem.

Both authored opening title copy and offline preparation/check reports explain
that the web preview requires an online connection for original pictures. Core
offline readiness does not promise their availability. Full downloaded
distributions include originals. Failed picture preparation retains the current
flight through the existing host contract; it does not silently substitute art.

## Local checks

- 44/44 bounded distribution and offline tests passed: exact originals retained,
  unchanged absent-option builds, bad opt-ins/pins/bytes/dimensions/duplicates and
  symlink rejection, final-byte revalidation, and truthful preparation/check copy.
- Read-only selected-source verification authenticated all ten originals totaling
  25,862,573 bytes. Source core inventory after declared exclusions: 695 files,
  56,607,189 bytes, leaving 10,501,675 bytes for generated core files. This is not
  the final build inventory or a successful hosted-build claim.
- Full lint, format, content validation and whitespace checks passed.
- Final actual Solo host regression: 8/8 passed (57.1 s), including visible
  online-artwork disclosure and all nine core route/checkpoint/receipt checks.

The existing full-source hosted distribution test also checks the optional
artwork manifest, all original hashes and final core budget. It has not been
rerun locally: free disk is close to the 256 MiB source reserve. Native layout,
and public deployment remain separately pending.

## Exact-source hosted result

Source `53b886351dfc5551672b81c844738d0a05895c68` passed the full hosted
qualification and frozen-snapshot workflow, run `35492774589`: preflight,
all four test shards and freeze succeeded. GitHub reports immutable artifact
`10599852802` (`qualified-release-snapshot`), 1,606,268,431 bytes, digest
`sha256:09b6f0254c10f998439f84108ca4ead4ea3920f096397ae0c16cf22f1883e134`.
Only metadata was read locally; the large artifact was not downloaded.
This result applies to that exact source, not later host/framework commits,
Pages deployment, human enjoyment or complete P01 acceptance.
