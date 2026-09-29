# Production63 adoption and retained62 compatibility

Production63 adopts the bounded review continuation described in `README.md`.
The existing review JSON, renderer evidence and historical production records
remain immutable. This adoption does not broaden their qualification scope.

The ledger advances Field Kit/FPV 62 to 63. Its 42 new asset records comprise
37 Team recipe successors (revision 3 to 4) and five equipment successors
(revision 2 to 3). Their recipe payloads, geometry and file identities are
unchanged; only their reviewed evidence and successor metadata change. All
previous slots, assets, themes and collections are exact canonical prefixes.
All 132 binary originals remain byte-identical. The ledger contains 335 slots,
1,771 asset records and 64 theme records.

| Output                 |     Bytes | SHA-256                                                            |
| ---------------------- | --------: | ------------------------------------------------------------------ |
| `production.rltheme`   | 8,368,235 | `06005f9cddf4cd820f132028393157a6edabbaa5da7a000a10991093bec0b875` |
| Current `runtime.json` | 1,104,575 | `bd5905930ca99b540ea91ac4199c05d8b2be63847209acf3dd47fcbe98ec9572` |
| Retained62 runtime     | 1,094,096 | `b4a7285520550e4cd04c7b9e80b4c6468c0a914faac77c05fa7f86a72c8a3c8f` |

The retained62 input is the original `game/presentation/compiled/runtime.json`
from published integration commit `2e64c130d219dfece5134ba9119b85a5bf34904d`.
The compiler authenticates its size, hash, source/theme identity and complete
lazy dependency set. It emits an exact hash-addressed alias alongside the
previous retained54,58 and60 aliases. Formatting current output cannot rewrite
these inputs. The compiled set has 140 files and 4,009,342 binary asset bytes.

The two starter-arena bindings and historical-import scene policy now explicitly
admit the complete63 theme. The complete58–62 identities remain admitted with
their exact picture hashes. The finite historical-policy limit increases from
five to six records; it still rejects duplicates, a seventh entry, unsupported
themes/collections and changed content or image identity. The binding resolver
never selects a "latest" picture or substitutes missing artwork.

Qualification uses production reproduction, ledger-prefix and binary comparison,
retained-runtime corruption/dependency tests, the original scoped review suite,
and the complete Team picture/successor/import suites. The latter exercise real
modeled Team host preparation and explicit Start for every retained58–62 and
current63 theme. Current actor source revisions, PNG hashes and dimensions remain
unchanged. These are source, automated and modeled-host observations; they are
not physical-device, public-release, offline or comprehensive P08-A acceptance.

Readiness reports 194 reviewed required slots and 141 optional slots, with
coverage missing0/source99/produced0/reviewed236. This is the existing declaration
gate, not an inference of new subjective visual approval. The release coordinator
must run committed-ledger readiness after committing these exact bytes and still
complete the remaining release and public-play gates.
