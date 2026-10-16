# P1-integrated ground package admission

Qualification source `328f4c5373a89342aca2063134c0bc2823ecbb07`, tree
`53162a0ca416c53534042233dfa99e0568c9b846`, is based on data-only main
`00770c96eb8eab8d0aedda433d115f86188d5a75`. The recovery ref
`codex/fpv-ground-motion-before-row-007` retains
`68c9611475eb1fd84e48d16a20203b84b8c1a3bb`. The source bridge rereads all
105 committed inputs and confirms exact equality to the qualified integrated
runtime c888. No production, generator or package-policy bytes changed for this
rebase or for restoring validation prerequisites.

Full Node 22 `npm --logs-max=0 run validate` passes, including both locales,
content validation and every canonical source projection. All three optional
packages pass one admission invocation, which builds each package twice and
requires byte-identical artifacts and verified committed inputs. Distribution
member counts are 48 for civilian-flight, 76 for Academy and 112 for Worlds.
The public-eligibility flag remains false; package admission does not replace
native, offline, device or publication gates.

Worlds has 105 original inputs totaling 16,981,627 bytes. Reserve is 3,989,893
bytes under the inherited 20 MiB ceiling; the inherited member ceiling is 128.
The distribution ZIP is 15,798,368 bytes, SHA256
`2d024ffcdd4d03b93e0039333ee7e0a2fac1081dabad691e21db074deb059dd2`.
The source inventory SHA256 is
`a842cc13d9c12987af0060e7c3ea6c24dff54f36cc12cf50c2d640737c9931d8`.

The complete immutable player is
`/private/tmp/fpv-ground-p1-admitted-player-328f4c537`; the sibling receipt
has SHA256
`9175e23b83972251dd50cf97daf49b25281fe1f8b9d28112a3432f9504c44008`.
All 243 staging checks pass. It contains exactly the 112 admitted members with
no runtime overlays: 78 verified immutable hardlinks and 2,700,759 new bytes.
Its hashes were reread after staging. This stage is not an editable source tree.

The first sparse-source materialization stopped at its 4 MiB local Git fallback
limit on `game/locales/uk/interface.json`. Its exact error and empty stdout are
retained. A read-only inventory established that the remainder comprised
1,112 exact-source APFS clones plus 62 locally present Git blobs totaling
2,232,130 bytes. The separately frozen second helper used that exact supplemental
byte cap and verified all 5,954 selected source files. No network fetch,
validation bypass or runtime correction occurred. Both full validation and
package admission passed their first actual invocation after this restoration.

The commands monitored available storage and would stop below 3 GiB.
Validation's minimum observed free space was 5,175,386,112 bytes; admission's
was 5,173,121,024 bytes. These observations describe local resource conditions,
not runtime performance.

[manifest.json](manifest.json) binds 25 lossless gzip archives by raw and stored
hashes, including complete logs, the retained materialization failure, command
statuses, source inventories, package/checksum/admission manifests, staging
receipt and manual helpers. Local ZIPs remain in
`/private/tmp/fpv-ground-p1-admission-328f4c537-r1`; their exact hashes are
preserved rather than duplicating binary packages into source.

The earlier c888 source checks (35 existing pursuit tests, the bounded identity
and retained-recording comparisons, and eight mixed-policy recordings) remain
bound to identical runtime bytes. They were not rerun merely for this data-only
rebase. Historical ca284 admission/native 8981 still describe the old 95-input,
102-member closure. Fresh integrated native browser, populated-storage/offline,
compatible cohort and Harbor publication checks remain separate and pending.
There is no new unit suite, full D6 regression, hardware, FPS or physical-input
claim in this package increment.
