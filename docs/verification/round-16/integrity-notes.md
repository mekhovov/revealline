# v0.6.0 release integrity

Verified on 12 September 2026 with Node 22.22.2 and Python 3.14.4 on macOS. Frozen `releases/v0.6.0` passes source identity, ZIP CRC, individual asset, offline-artifact and reproducibility checks. Exact commands, environment, byte counts and digests are in [release-integrity.json](release-integrity.json).

The annotated `v0.6.0` tag object `eff751d470acef2ca2e56f5d346f94ced2f2af71` peels to **e88bab7e9677c82419aca35557c858c670425f16**. That commit matches the release record, build information, manifest and source archive PAX revision. A fresh `git archive` of the same commit matches `source.tar` by SHA-256 and complete byte comparison. The archive is **109,936,640 bytes**, containing **617 regular files** totaling **109,402,430 extracted bytes**. Archive entries were checked for unsafe or duplicate paths, traversal, links and unsupported types before extraction.

| Artifact         | SHA-256                                                            |
| ---------------- | ------------------------------------------------------------------ |
| Source archive   | `8b0ad855a170c16d9d217aa9bc25619d518b4b74d16a25889c2c46989a21388d` |
| Distribution ZIP | `5eb72e65a262a57cbbff7d3c485c0a99d3857c3bfe2233092e8463e50b8b042d` |
| Manifest         | `6803d6dc471165de4ab4a61af7c5a24ec8472e47f55b0a2d9c1a6324ddadd2c3` |

The **20,068,956-byte ZIP** contains exactly **111 entries**: 110 manifest assets plus `manifest.json`. Every entry passes CRC and matches its loose site file byte for byte. All asset sizes and SHA-256 values match the manifest; the assets total **20,036,841 bytes**. The checksum sidecar and release links match. The loose site contains exactly those entries and the expected ZIP, checksum sidecar and internal build marker, with no unexpected files.

## Rebuild from the archived source

Verification used a fresh owned directory, `.cache/round-16/integrity/v0.6.0-run-20260912T091732708525Z/`. After safe extraction, the archived source's own CLI ran:

```text
node scripts/game-cli.mjs build --out <verification-directory>/rebuilt-site --version v0.6.0 --revision e88bab7e9677c82419aca35557c858c670425f16
```

The actual command used the pinned Node 22.22.2 executable, absolute extracted CLI and output paths, and the extracted source as its working directory. No package installation or working-tree game code was used. The rebuilt ZIP, manifest, checksum sidecar, internal build marker and every inventoried asset are byte-identical to the frozen release. The recorded build/comparison interval was 437 ms on this host; it is not a runtime or device-performance measurement.

## Offline artifact identity

The offline inventory contains **107 files totaling 19,999,500 bytes**. It exactly matches the distribution manifest after excluding `_headers`, `offline-cache.json` and `service-worker.js`; every entry's size and hash matches the actual file. The worker equals the archived worker template with the exact compact cache configuration inserted. The cache sidecar also matches its expected JSON serialization.

The build ID was independently recomputed from frozen build information, the archived template, generated assets and HTML bytes with their injected build ID normalized back to the fixed placeholder:

```text
d83c1461133c5980cfa0ce4b9863edb8252a0f80c67c0acd0954976fc9e6ccd9
```

All **five game HTML pages**—solo, couch, playground, Replay Theater and Controller practice—carry that version/build ID and resolve their scope and worker to this distribution root. The web app manifest starts at `./game/`, scopes to `./`, and references three existing icon files. These checks establish offline artifact consistency; browser installation and offline navigation require separate live evidence.

## Earlier releases remain unchanged

All **nine earlier releases** pass fresh source/ZIP/manifest checksum, ZIP CRC, exact inventory and individual asset checks: v0.1.0, v0.1.1, v0.1.2, v0.2.0, v0.2.1, v0.3.0, v0.4.0, v0.4.1 and v0.5.0. Their identities match the previously observed values collected in the [Round 15 integrity baseline](../round-15/release-integrity.json), including its earlier release records. Every earlier tag object and peeled source revision also matches its prior identity. The baseline evidence file itself stayed byte-identical throughout verification.

Only owned cache artifacts and these new Round 16 evidence files were written. Runtime files, frozen releases, tags, native projects and running servers were not changed, and nothing was published. Packaging reproducibility on this host does not establish physical controller/iOS support, native signing or store readiness, public-host deployment, accessibility acceptance or player enjoyment; those remain separate [public-release checks](../../public-release.md).
