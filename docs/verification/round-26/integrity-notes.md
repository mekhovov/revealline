# v0.16.0 independent release integrity

Verified on 12 September 2026. **Pass:** the frozen source reproduces the complete web distribution byte for byte. The [machine-readable report](frozen-integrity.json) records the commands, artifact hashes, source correspondence and retained release checks.

## Frozen identity

| Artifact           | Verified result                                                            |
| ------------------ | -------------------------------------------------------------------------- |
| Annotated tag      | `v0.16.0`, object `39f071ae3ad38d648f8bd2fa82a79bccce33fc84`               |
| Source commit      | `8fb6b5782a6fee85211b9bbbfb3d13a1d1a60c43`                                 |
| Source TAR         | 121,292,800 bytes; 970 safe regular files totaling 120,464,027 bytes       |
| Manifest           | 138 assets totaling 20,670,171 bytes; manifest itself 22,507 bytes         |
| Distribution ZIP   | 20,710,534 bytes; 139 entries, all CRCs and payload bytes verified         |
| Rebuilt loose site | All **142 files** identical, including generated metadata and hash sidecar |

SHA-256 values:

- [Source TAR](../../../releases/v0.16.0/source.tar): `e6013ffbe06e28eb17b142ea0c7b10eb045985fe33e4f12e66abcfaa8faa6e0e`.
- [Web ZIP](../../../releases/v0.16.0/site/distribution.zip): `186abf3723ddd5c3683f453a1c21ad3defe4c020856702d27680b568ee86c6df`.
- [Manifest](../../../releases/v0.16.0/site/manifest.json): `1ebb79d210361574f9adba9a2ddb8ff05f7d0a437573ee30cc18e1d63f5b3043`.

A fresh `git archive` from the exact commit matches the frozen TAR byte for byte, including its recorded revision. Archive inspection rejects unsafe names, duplicate entries, links and unsupported special files before extraction. The TAR fits the verifier's limits of 20,000 regular files, 1 GiB total and 256 MiB per file. The ZIP has no duplicate, encrypted, linked or escaping entries and matches the exact manifest inventory.

## Rebuild and tested source

The build used Node v22.22.2 and the extracted source's own [CLI](../../../.cache/round-26/integrity/v0.16.0-run-20260912T152036023490Z/source/scripts/game-cli.mjs), bundled assets, version and revision. It completed in **1,416 ms** with exit code 0. Output is isolated in [the fresh rebuild directory](../../../.cache/round-26/integrity/v0.16.0-run-20260912T152036023490Z/rebuilt-site/). No current game modules, dependency installation or network input were used.

```text
node source/scripts/game-cli.mjs build --out rebuilt-site --version v0.16.0 --revision 8fb6b5782a6fee85211b9bbbfb3d13a1d1a60c43
```

All **331 final source inputs** match their archived bytes. Their aggregate SHA-256 is `a3532d1582596ffee7d1ab3413699bee752b9ee33dc8e6ecb893dd93c753e1f6`; the [final inventory](source-inputs-final.json) has SHA-256 `5b376c936837fa429dc7810773e5f03f896d45321b3b5556fd390901234b3635`.

The evidence has two distinct scopes. The [six-gate run](source-gates.md) passed **1,521 unique tests** on the preceding inventory, aggregate `3343c7a0d7c7480b5046e53d9bdffafbbf0ebd8b1aedcbbd783a9e8dd392932f`. A subsequent version-label correction changed exactly `scripts/game-cli.mjs`, `site/index.html` and `site/landing.mjs`. The [affected-check follow-up](source-label-followup.md) passed 23 existing CLI tests, lint, formatting and validation with the final inventory stable. Those 23 tests are a rerun, not additional unique tests. The integrity check verified this exact three-file difference and the archived bytes of both reports and inventories; it did not repeat the full suite after the label correction.

## Offline artifacts and retained history

The offline inventory contains **135 files / 20,624,650 bytes**, within the 2,000-file and 64 MiB limits. Every asset hash matches. The service worker matches the archived template with its generated configuration. The independently recomputed build ID is `88feeb938b2a1742a483a7cdb650de7e94ba05da85863c9a6f8fa4cdbe55763d`. All five game HTML entry pages have matching version/build markers and local-root worker scopes. The web manifest starts at `./game/`, scopes to `./` and references existing icons.

The original [pre-v0.16 baseline](../../../.cache/round-26/integrity/frozen-releases-before-v0160.json), SHA-256 `c4a89d3b4401ac7ec699f5d936e80de716d80a58bdab93173e1ec9a441be78ac`, still matches **19 older release trees, 2,054 files / 2,591,153,392 bytes, and 20 prior tags** before and after this verification. Tag checks include object IDs, types, peeled commits and raw object-text hashes.

Earlier in Round 26, the concurrent deployment script deleted the older source TARs. Its owner removed that operation and restored the archives; the [source-gate incident record](source-gates.md) remains preserved. This verification compares every restored file against the original baseline and independently checks every older archive, ZIP and manifest. It establishes exact restoration and subsequent preservation, not uninterrupted availability across the incident. This task changed no frozen files, tags or prior evidence.

These checks establish archive integrity, deterministic packaging and offline artifact configuration on this host. Actual browser installation, disconnected navigation and saved progress are separate browser checks. Physical controllers/devices, native distribution, public hosting and player enjoyment are outside this report.
