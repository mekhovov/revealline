# Offline package measurements

Generated from the built distribution, version 0.132.1, build ID `c3d139190236688c3ba0f50aa075686752daa7ebcf00c27db2b1609501861383`. Source revision: not frozen (development build). Distribution SHA-256: `30c29f57bc4d176ce2e206321f2d700c375ddc198f62c31bdfc35731be1d706f`.

Reproduce after building with:

```sh
node scripts/report-offline-packages.mjs --site .cache/offline-package-final --out docs/content-offline/packages
```

Decoded file bytes. MiB = 1,048,576 bytes. HTTP compression and protocol overhead are not measured.

| Selection | Decoded transfer by owner | Conservative transfer upper bound | Stored payload |
| --- | ---: | ---: | ---: |
| starter | 54.80 MiB | 56.55 MiB | 56.55 MiB |
| allCurrent | 492.43 MiB | 494.18 MiB | 494.18 MiB |
| allGameplayArchivesAndTools | 571.01 MiB | 572.76 MiB | 572.76 MiB |
| soundtracks | 346.78 MiB | 346.78 MiB | 346.78 MiB |

All gameplay selections include the edition runtime and the stable installed launcher. Soundtracks are an independent additional download. Archive and tooling packages are excluded from all-current. The complete shipped distribution payload is 585.42 MiB; this is not the starter download.

## Starter composition

The Solo Horizon starter contains 9 core missions, 9 original PNG pictures, the Horizon chapter snapshot, and no recordings. The remix is a separate package.

| Owner | Decoded transfer | Stored payload |
| --- | ---: | ---: |
| editionRuntime | 32.42 MiB | 34.17 MiB |
| officialContent | 22.36 MiB | 22.36 MiB |
| installedLauncher | 0.02 MiB | 0.02 MiB |

Runtime URL copies, official hashes and stable launcher URLs are separate owners. Matching bytes are not assumed reusable across owners. Runtime deduplication saves transfer when identical files exist at multiple URLs; these URLs still occupy separate cache entries. The conservative UI estimate counts those copies. The launcher owns 23,468 additional bytes. These figures describe a fresh cache; already verified files reduce subsequent downloads.

0 standalone chapter snapshots are in core. Current navigation metadata is 259,575 bytes; keeping it allows future chapters and existing progress to remain visible.

## Shared runtime composition

| File type | Stored payload |
| --- | ---: |
| .png | 17.06 MiB |
| .json | 7.52 MiB |
| .mjs | 6.57 MiB |
| .js | 1.37 MiB |
| .html | 0.72 MiB |
| .css | 0.37 MiB |
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
- Shared runtime still includes Solo, Versus, Team, replay and controller entry dependencies. Fully independent mode bootstraps remain to be implemented.
- Chapter snapshots are separate packages; the current route snapshot still retains complete authored mission definitions to preserve the synchronous host contract.
- Original PNG bytes are unchanged. These numbers do not assume new artwork or promise a final optimized image budget.
- Browser cache overhead, temporary verification buffers, imports, saves and retained previous editions require additional space beyond stored payload bytes.

The JSON companion records every group, its dependency closure, and the additional bytes after the starter or after all current gameplay. Shared images therefore contribute zero additional bytes when an already installed group owns the same official hash, while archived missions remain distinct navigation entries.
