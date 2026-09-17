# Reveal Line archive 14

## Append v0.59.0 for historical preservation

This successor preserves the published v0.59.0 original ZIP and exact six-gate source qualification alongside v0.57.0. Frozen game source is `76dc4bf36baec11ce4dff6ca49773d3b9d6c0ae5`; no game is rebuilt, retagged or reformatted. All 659 existing v0.57.0 canonical rows remain exact.

The combined inventory is 1,342 files / 625,582,144 bytes, below the unchanged 800,000,000-byte archive budget. Existing extraction, ordinary-file, CRC/hash, no-clobber and capacity guards are unchanged. The workflow additionally fetches the original v0.59.0 tag. All large payload work stays on the hosted runner.

A successful hosted extraction and independent full reread, a complete canonical HTTP audit and scoped native preservation checks are required for admission. Earlier deployment and browser records remain historical evidence, not acceptance of this successor. This infrastructure does not change the current game selector and does not establish offline, physical-controller or full P03 acceptance.

Preserve the original v0.57.0 release from source `b7db0134d4ede3452dc90b5d3f7ffb1491a0579b`, tree `7cd40e4ef8bf975e7eb2795cdd2669aa18811a57`. The source tag, release metadata, original ZIP and source qualification are pinned in `source-lock.json` and `input-authority.json`.

This is an archive of historical behavior, not P01 acceptance. The public portrait offline-panel displacement discovered in v0.57.0 remains in its immutable game; the forthcoming v0.57.1 patch is qualified separately. No original game assets or source are rebuilt or replaced.

`tools/prepare.py` runs only in a fresh hosted workspace with at least 3 GiB free. It checks the clean pinned extractor checkout and annotated tag, validates every local metadata/qualification pin, downloads the original ZIP once, verifies every ZIP member, copies the original qualification, and rereads all 662 artifact files (312,553,884 bytes) before reporting success. The independent verifier rejects missing/extra/changed/unsafe/link files. The 800,000,000-byte archive limit remains unchanged.

The canonical playable route is `releases/v0.57.0/site/game/`. Original manifest/checksum/build marker remain beneath `site/`; original release and source-qualification records are beside it. The original ZIP and source TAR remain GitHub Release attachments. Root links the original ZIP directly. `/releases/` redirects with an accessible fallback to the main release explorer, preserving Back behavior without altering frozen game files.

The workflow checks out only the pinned extractor/tests from the game repository. It does not build game source, modify source tags, change other archives or select the main website release. All payload preparation is hosted. Tiny local checks: `python3 -m unittest discover -s tools -p 'test_*.py' -v`; the pinned extractor's four corruption tests also run in CI.

After review/creation, a successful hosted deployment still requires the original hosted receipt, a complete streamed HTTP/MIME/hash audit of every inventory file, a native historical-game play/capture/pause and release-explorer Back sample, and admission into a separate reviewed main-controller publication. Source qualification, archive byte checks, browser scope and physical-device limits are distinct evidence. No candidate or source check alone grants publication admission.
