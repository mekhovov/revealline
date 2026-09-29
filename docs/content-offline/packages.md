# Offline package measurements

Generated from the built distribution, version v0.141.7, build ID `d33419007107875684452bea03dd553107d6eb10dc7b5316b0e3d92abbc0bc3c`. Source revision: efbb3882b4edd447c8e9f60ed60c536a956d78f3. Distribution SHA-256: `ce653828fa11497567fcb39e370b744bd97d0c78ccb9d173fc7fc8edb7fcdacd`.

The three published metadata files match the frozen manifest. Package sizes are declared payload bytes; individual gameplay assets, the archive and installed-device storage were not re-downloaded or verified by this report.

Reproduce with:

```sh
node scripts/report-published-offline-packages.mjs --version v0.141.7 --out docs/content-offline/packages
```

Decoded file bytes. MiB = 1,048,576 bytes. HTTP compression and protocol overhead are not measured.

| Selection | Decoded transfer by owner | Conservative transfer upper bound | Stored payload |
| --- | ---: | ---: | ---: |
| starter | 61.47 MiB | 63.47 MiB | 63.47 MiB |
| allCurrent | 565.39 MiB | 567.39 MiB | 567.39 MiB |
| allGameplayArchivesAndTools | 688.66 MiB | 690.66 MiB | 690.66 MiB |
| soundtracks | 346.78 MiB | 346.78 MiB | 346.78 MiB |

All gameplay selections include the edition runtime and the stable installed launcher. Soundtracks are an independent additional download. Archive and tooling packages are excluded from all-current. The complete shipped distribution payload is 705.29 MiB; this is not the starter download.

## Starter composition

The Solo Horizon starter contains 9 core missions, 9 original PNG pictures, the Horizon chapter snapshot, and no recordings. The remix is a separate package.

| Owner | Decoded transfer | Stored payload |
| --- | ---: | ---: |
| editionRuntime | 39.03 MiB | 41.03 MiB |
| officialContent | 22.34 MiB | 22.34 MiB |
| installedLauncher | 0.09 MiB | 0.09 MiB |

Runtime URL copies, official hashes and stable launcher URLs are separate owners. Matching bytes are not assumed reusable across owners. Runtime deduplication saves transfer when identical files exist at multiple URLs; these URLs still occupy separate cache entries. The conservative UI estimate counts those copies. The launcher owns 98,456 additional bytes. These figures describe a fresh cache; already verified files reduce subsequent downloads.

1 standalone chapter snapshots are in core. Current navigation metadata is 1,363,574 bytes; keeping it allows future chapters and existing progress to remain visible.

## Current gameplay official payload

This excludes the separately counted runtime and launcher above. All current gameplay lists 0 MP3 files. Optional soundtrack downloads remain independent.

| File type | Stored payload |
| --- | ---: |
| .png | 306.29 MiB |
| .rlmedia | 116.60 MiB |
| .json | 102.03 MiB |
| .mjs | 0.99 MiB |
| .ttf | 0.15 MiB |
| .html | 0.14 MiB |
| .css | 0.05 MiB |
| .js | 0.01 MiB |
| .txt | 0.00 MiB |

## Shared runtime composition

| File type | Stored payload |
| --- | ---: |
| .png | 17.06 MiB |
| .json | 15.70 MiB |
| .mjs | 5.41 MiB |
| .js | 1.40 MiB |
| .html | 0.56 MiB |
| .css | 0.34 MiB |
| .woff2 | 0.30 MiB |
| .ttf | 0.20 MiB |
| .txt | 0.04 MiB |
| .svg | 0.02 MiB |
| .pb | 0.00 MiB |
| .webmanifest | 0.00 MiB |
| .md | 0.00 MiB |

## Remaining work and interpretation

- These are manifest-declared payload sizes, not physical-device certification or measurements of browser cache overhead.
- Starter counts describe the selected base group. Full current navigation metadata remains available; a displayed chapter is not evidence that its assets have been downloaded.
- Solo uses navigation metadata and one opening-chapter runtime. Other executable chapters, Versus/Team host entry points and historical route sources are separate packages; shared compiler, replay, controller and presentation helpers remain in core.
- Versus and Team runtimes still include complete route sources needed by their existing browsers. Further mode-internal chapter splitting remains unqualified.
- Original PNG bytes are unchanged. These numbers do not assume new artwork or promise a final optimized image budget.
- Browser cache overhead, temporary verification buffers, imports, saves and retained previous editions require additional space beyond stored payload bytes.

The JSON companion records every group, its dependency closure, and the additional bytes after the starter or after all current gameplay. Shared images therefore contribute zero additional bytes when an already installed group owns the same official hash, while archived missions remain distinct navigation entries.
