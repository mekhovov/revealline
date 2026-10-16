# Integrated web, edition and native static qualification

**Source: `c5e3419eecd564621470a654ce071f0f83d5984f`. All packaging checks below passed against the frozen integrated runtime, including the shared Confirm corrections.** The package/build-config label is **0.142.3**, unchanged. This is development qualification, not release admission or publication.

## Exact source and web build

The ordinary `game-cli.mjs build` completed with its standard localization, references, content, campaign, theme, class, pack and optional-content validation enabled. The `--revision` argument binds the integrated commit in the generated manifest. **1,985 captured source inputs / 546,229,078 bytes are identical before and after the web build, both native stages and all fourteen edition compilations.** `source-verdict.json` records the comparison; `source-before.json.gz` and `source-after.json.gz` retain every captured path/hash. Test and evidence files do not enter the packaged source inventory.

- Web payload: **1,893 files / 755,905,217 bytes**.
- Web manifest SHA-256: `cc9a329986242fc136d3a68efe283f3a645625df6e90192e93e5650ee782a515`.
- Independently verified distribution ZIP SHA-256: `a67d0d021851a6e9bbfa416219d9eabc8f998563aa18afad09f87a0de0f0035f`.
- The ZIP was removed only after recording its actual size/hash and retaining the manifest, to conserve disk. The verified web site body remains at the location in `native-locations.json`.

## Desktop and iOS static stages

| Stage   | Files | Payload bytes | Result                                                                                   |
| ------- | ----: | ------------: | ---------------------------------------------------------------------------------------- |
| Desktop | 1,893 |   755,905,217 | Exact web manifest and every payload byte verified                                       |
| iOS     | 1,898 |   755,988,886 | Verified web payload with the official bridge, four diagnostics and existing HTML policy |

The desktop source manifest is byte-identical to the web manifest. The real desktop resource loader accepted the complete inventory; **38 requests through its actual `revealline://app` handler** returned the expected bytes and MIME responses, including the Demo Worker, clock, audio, analog rendering, catalogue, all twelve replay variants and selected DroneAid artwork. Unlisted paths and external navigation remain denied.

The iOS manifest SHA-256 is `45f89abcff078a12bdb0c38ecd46b4e8a66019b90d06a8c0de486627d4a930f3`. All **34 HTML files** exactly match the existing `iosHTMLPolicy` transformation. Other web payload records remain byte-identical, and the only five additions are the official bridge and four diagnostic files. The reused bridge is **62,090 bytes**, SHA-256 `aea5880c04f915d7424e4f309de546c6ef65a99691fd731c83bc908a5f928fb4`; current bridge inputs and dependency locks match the workspace which produced it. This task reused that verified bundle and did not rebuild native plugins.

`native-command-results.json`, platform stage/verify reports, complete native manifests and `web-native-static-audit.json` retain the checks. Generated native bodies were removed after their exact proofs were saved; `native-body-cleanup.json` records each removal. Neither a desktop executable nor an iOS app was built or launched.

## All fourteen installed editions

The unmodified `scripts/check-menu-editions.mjs` completed **14/14** against this integrated source. The largest offline inventory is **droneaid-nl-community: 66,932,972 bytes / 693 files**, leaving **175,892 bytes** beneath the unchanged **67,108,864-byte (64 MiB)** cap. All other editions fit their existing limits.

`edition-audit.json.gz` contains **506 exact source/output/offline-inventory checks**: 36 shared required paths per edition, plus the selected Dutch background derivative and supplied wordmark. The shared closure includes the Worker, audio, background clock, analog effects and all twelve frozen replay variants. The selected lossless WebP is shipped only in its intended aggregate; the unchanged original PNG is retained in source without adding a redundant offline copy. Browser test harness files are excluded. No content, compatibility assets, frozen recordings or capacity checks were removed.

All fourteen offline inventories and build manifests are saved under `edition-inventories/`; `edition-compilation.json` is the complete checker report. Its built-in `sourceRevision: "development"` label remains unchanged; the external source snapshots and this report bind the compilation to `c5e3419ee`. These are web editions, not fourteen individually staged native apps. Edition bodies were removed only after verifying all retained manifest pairs and readbacks; `edition-body-cleanup.json` records the cleanup.

## Commands and evidence boundaries

```sh
node scripts/game-cli.mjs build --out /private/tmp/revealline-demo-qualification-web-final-20260929 --revision c5e3419eecd564621470a654ce071f0f83d5984f
node scripts/native-cli.mjs stage --platform desktop --site <verified-web-site> --out <owned-desktop-stage>
node scripts/native-cli.mjs verify --site <owned-desktop-stage>
node scripts/native-cli.mjs stage --platform ios --site <verified-web-site> --out <owned-ios-stage> --bridge <pinned-official-bridge> --diagnostics platforms/ios/diagnostics
node scripts/native-cli.mjs verify --site <owned-ios-stage>
node scripts/check-menu-editions.mjs /private/tmp/revealline-demo-editions-qualification-20260929-3vaq5o0d/editions-integrated-c5e3419ee
```

Commands used Node **22.22.2**. Exact native command arguments and durations are retained in the JSON receipts. Temporary path names in cleanup receipts are historical and must not be interpreted as retained downloads.

The initial 64 MiB failure, lossless repair and earlier passing packaging results remain under the parent directory and `../final/`. They bind the source before Confirm integration and are not counted as the current fourteen-edition or native proof. Earlier focused test totals are likewise not relabelled as a new test run here.

This evidence covers compilation, exact asset closure, preserved limits, static security transformation and packaged protocol responses. It does **not** establish executable launch, native IndexedDB durability, live Worker gameplay, audio audition, controller/touch hardware, physical iOS operation, signing/notarization, release admission or public deployment. Browser and wall-clock observation evidence belongs to its separate report.
