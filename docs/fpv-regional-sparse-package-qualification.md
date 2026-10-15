# Sparse regional scenery — exact package qualification

This receipt covers source `c5b20b47f990f06f68cb0422b4e74cc5b7643e2f` from merged #1341, tree `83f329552f8a827e5c430bb4fa0ec1dc37516f37`, version `v0.151.1`, and package revision `35419d7c1859b16ea9dc7c377e0e498590de31d7adce4434794d9106e56b129d`. Cloud run `38680606503` produced artifact `11948720358`. The artifact ZIP is 23,069,092 bytes, SHA-256 `9a393ffdcc1d2480719277892bb9575b5f689cd10bfb3190370eff774b4aeb79`. It is not marked publicly eligible.

## Archive and dependency results

All 15 top-level checksums and every member of all six runtime/source archives match their exact hashes, lengths and inventories. Worlds has 160 runtime files using 17,439,288 uncompressed bytes and 162 source files using 17,482,630 bytes. Both fit the unchanged 162-file/20 MiB limit. Civilian Flight remains 94/96 files within its 96-file/8 MiB envelope; Academy remains 101/103 within its 104-file/8 MiB envelope.

The transitive import validator, policy, ZIP reader and pinned parser were retrieved from this exact source revision and verified against their Git blob identities. Finished archive import graphs pass with no source fallback: Civilian Flight 68 modules/96 imports, Academy 81/152, Worlds 132/334.

## Actual packaged runtime checks

All seven sparse scenery functional groups pass against the extracted cloud runtime:

- Strict v1 validation and complete explicit sparse coverage, including rejected missing, duplicate and unknown declarations.
- Empty cells with zero source payload, meshes or colliders, while outside/unprepared cells remain unknown.
- Mixed empty/populated transitions with real terrain support and scenery collisions; corrupt staging retains the old pair.
- Cancelled staging cannot replace the retained pair.
- 2,200 shared-flight ticks across four crossings with exact conservative-reference state parity and zero scenery requests.
- Declared 256 m coverage and fractional saved-position restoration while disarmed.
- Regional delivery v2 closure, rejected v1 downgrade and missing declared payload, and compatible old v1 delivery behavior.

Only scenario import locations were redirected to the extracted runtime. The authoring-only delivery builder came from the exact published source and used the packaged manifest validator; it is not claimed to be part of the player archive. An ES-module declaration sits outside the extracted runtime for Node verification. Shipped runtime files were not modified.

## Remaining acceptance

This establishes the packaged sparse-region capability, not availability of the new 8 km Canyon. Its immutable content, trusted Library entry and the exact package containing that entry still require the normal player download/Fly journey. No Library row was injected into this frozen package. This receipt also does not establish browser offline behavior, physical-controller acceptance, a two-hour flight, universal map coverage or public deployment.

Detailed local receipts and the untouched archives are retained externally under `fpv-package-qualification-20261014/sparse-scenery-c5b20b47`.
