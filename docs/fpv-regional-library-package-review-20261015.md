# Packaged regional Library and cached flight — 2026-10-15

The exact combined regional Library candidate passed normal player installation and flight in the native browser. After stopping its isolated package server, the same packaged page reopened, retained the installed region, and launched it disarmed through the ordinary **Fly** action. Deliberate arming and flight still worked.

This closes the earlier distinction between a packaged host loading an external review fixture and a player downloading a pinned regional world through the shipped Library. It is a bounded same-browser, origin-unavailable result, not a browser-restart, all-network-offline, device-performance or public-release claim.

## Exact candidate

- Combined [PR #1287](https://github.com/mekhovov/revealline/pull/1287) head `9e43fc7f8c12fda0a0475e04b50ac93943d9d5ee`, tree `16c112649cc99c400a2f35ed06b646015b801531`. Library PR #1293 was merged into that feature parent; the receipt does not misidentify it as a main-branch merge.
- [Cloud run 38653769049](https://github.com/mekhovov/revealline/actions/runs/38653769049), [artifact 11935183630](https://github.com/mekhovov/revealline/actions/runs/38653769049/artifacts/11935183630). The optional-practice job passed; the broader company candidate was still running when this receipt was written.
- Version `v0.151.1`, Worlds revision `b2613678aa1949fd22bef8e1e1f9b68cc3af08f3a9f28ac4b5f66f376863b984`.
- Committed input verification and two reproducible builds are recorded by the candidate. `publicEligible` is false.
- Independently verified all 15 top-level checksums and every member of all six runtime/source archives. Worlds contains 156 manifest dependencies, 157 runtime ZIP members and 159 source ZIP members. The source archive is 17,411,223 uncompressed bytes, below the unchanged 20 MiB ceiling.
- All 157 staged immutable runtime members were compared byte-for-byte with the archive: 17,368,260 bytes unchanged. The harness only supplies ordinary routing metadata; no regional fixture or renderer substitution is injected into the package.

The installed world is the shipped immutable `urban-earthworks-study` / `review-r1` pin from source commit `9d97e70c18729c3f399b90610380274e50d7d0df`. Its descriptor is 6,615 bytes with SHA-256 `1ba27d2242d61d61c0552564d75baa5f3e313e63a78c2ef434f63cdc7dbab94c`; its 38-file content closure is 1,455,090 bytes. This remains an original review-quality Urban region, not a claim of finished scenery or unlimited terrain.

## Native player journey

The fresh isolated origin was `http://127.0.0.1:9043`. Runtime bytes remained under `/revealline/practice/fpv-worlds/releases/v0.151.1/site/`; the canonical launcher was under `/revealline/practice/fpv-worlds/app/`.

1. **Download for offline use** completed on the first attempt and reported **Ready offline**. **Open prepared practice** opened the actual packaged home.
2. **Home → Explore → regional Download** fetched the shipped remote immutable pin. The ordinary card reported **Saved**, revision `review-r1`.
3. **Fly** opened the actual regional host at 3 m with zero input, ready and disarmed. Deliberate **Arm**, W and Shift+Up produced visible movement (5.3 m height, +5.3 m/s vertical and 1.0 m/s drift). Space paused; V switched to Chase. No error logs were observed before the origin-stop test.
4. Only the owned 9043 server was stopped. An independent transport request returned connection refused / HTTP 000; the frozen package files and browser storage were unchanged.
5. Reloading the same packaged URL restored the cached home. Explore retained **Saved review-r1**. **Fly** again opened at 3 m with zero input, disarmed, preserving Chase selection.
6. Deliberate **Arm** and W for 2 seconds, then Space, produced a paused moving flight state (0.2 m height, +1.0 m/s vertical and 69% throttle). The scene rendered from the installed content while the package origin remained unavailable.
7. The owned server was restarted and the exact packaged entry returned HTTP 200. No player storage, saved worlds, recordings, unrelated origins or server processes were removed.

The [machine-readable receipt](fpv-regional-library-package-review-20261015.json) contains archive identities, exact counts, screenshot hashes and explicit evidence boundaries. Screenshots remain in the external evidence directory rather than expanding the runtime package.

## Remaining qualification

- This frozen head predates the stricter cross-manifest pairing correction in [PR #1291](https://github.com/mekhovov/revealline/pull/1291). The valid Urban bundle is unchanged, but a final latest-main candidate must include that correction and the combined UI/texture closure.
- [PR #1297](https://github.com/mekhovov/revealline/pull/1297) independently validates transitive imports in the admitted archive. Its checker passed all three runtime archives of this candidate; those source changes are not retroactively attributed to the frozen package.
- The stopped-origin test did not disable the wider network, restart the browser process, induce actual storage eviction, or establish every device/controller/layout combination. Cache-only regional loading is also covered by its separate delivery contract tests; the native observation is not relabelled as a network-wide experiment.
- Broader company checks, final merged-candidate admission and public publication remain separate from this exact optional-package result. No sustained FPS, two-hour gameplay, every-region or final-art acceptance follows from this journey.
