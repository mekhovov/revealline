# Offline package measurements

Generated from the built distribution, version 0.132.1, build ID `757fd1ac920697fb0bc55ddef275173591f036c3d920855a0297044d141af6b8`. Source revision: not frozen (development build). Distribution SHA-256: `0db98ab66ad7501f39356f6ca9f3cd3c0a496e74bab52715e664c3718b697d57`.

Reproduce after building with:

```sh
node scripts/report-offline-packages.mjs --site .cache/offline-package-lazy --out docs/content-offline/packages
```

Decoded file bytes. MiB = 1,048,576 bytes. HTTP compression and protocol overhead are not measured.

| Selection | Decoded transfer by owner | Conservative transfer upper bound | Stored payload |
| --- | ---: | ---: | ---: |
| starter | 55.10 MiB | 56.86 MiB | 56.86 MiB |
| allCurrent | 494.49 MiB | 496.25 MiB | 496.25 MiB |
| allGameplayArchivesAndTools | 577.17 MiB | 578.93 MiB | 578.93 MiB |
| soundtracks | 346.78 MiB | 346.78 MiB | 346.78 MiB |

All gameplay selections include the edition runtime and the stable installed launcher. Soundtracks are an independent additional download. Archive and tooling packages are excluded from all-current. The complete shipped distribution payload is 591.72 MiB; this is not the starter download.

## Starter composition

The Solo Horizon starter contains 9 core missions, 9 original PNG pictures, the Horizon chapter snapshot, and no recordings. The remix is a separate package.

| Owner | Decoded transfer | Stored payload |
| --- | ---: | ---: |
| editionRuntime | 32.74 MiB | 34.50 MiB |
| officialContent | 22.34 MiB | 22.34 MiB |
| installedLauncher | 0.02 MiB | 0.02 MiB |

Runtime URL copies, official hashes and stable launcher URLs are separate owners. Matching bytes are not assumed reusable across owners. Runtime deduplication saves transfer when identical files exist at multiple URLs; these URLs still occupy separate cache entries. The conservative UI estimate counts those copies. The launcher owns 24,762 additional bytes. These figures describe a fresh cache; already verified files reduce subsequent downloads.

1 standalone chapter snapshots are in core. Current navigation metadata is 935,267 bytes; keeping it allows future chapters and existing progress to remain visible.

## Shared runtime composition

| File type | Stored payload |
| --- | ---: |
| .png | 17.06 MiB |
| .json | 9.71 MiB |
| .mjs | 4.96 MiB |
| .js | 1.36 MiB |
| .html | 0.53 MiB |
| .css | 0.32 MiB |
| .woff2 | 0.30 MiB |
| .ttf | 0.20 MiB |
| .txt | 0.04 MiB |
| .svg | 0.02 MiB |
| .pb | 0.00 MiB |
| .webmanifest | 0.00 MiB |
| .md | 0.00 MiB |

## Remaining work and interpretation

- This is a development build measurement, not a frozen release or physical-device certification.
- The starter has nine Horizon original pictures and no recorded music. Full current navigation metadata remains available.
- Solo uses navigation metadata and one opening-chapter runtime. Other executable chapters, Versus/Team host entry points and historical route sources are separate packages; shared compiler, replay, controller and presentation helpers remain in core.
- Versus and Team runtimes still include complete route sources needed by their existing browsers. Further mode-internal chapter splitting remains unqualified.
- Original PNG bytes are unchanged. These numbers do not assume new artwork or promise a final optimized image budget.
- Browser cache overhead, temporary verification buffers, imports, saves and retained previous editions require additional space beyond stored payload bytes.

The JSON companion records every group, its dependency closure, and the additional bytes after the starter or after all current gameplay. Shared images therefore contribute zero additional bytes when an already installed group owns the same official hash, while archived missions remain distinct navigation entries.
