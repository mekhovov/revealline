# Motion APNG default-preview correction

17 September 2026. **Scoped modeled successor; native correction and source/release acceptance remain pending.** Apply this incremental `candidate.patch` after the Motion startup/reading patch and then the reading-label follow-up. The immediate parent patch is `d9522de3fe9345962837eb3d8c4236270befa58ea30b3a0ff1e82e0c76737b33`, on exact a13 source/tree recorded in `candidate-pins.json`. Package/build version remains 0.60.3. No source worktree, index, version, commit, browser or remote was changed.

## Established trigger

The root-owned native record reports that the valid 32×24 separate-default APNG displayed its blue first animation frame rather than its red IDAT default after redraw. Preserve [the original native review](../p05-motion-native-a13ab970/root-native-review.json), screenshots and AX unchanged. Its running screenshot did not show the arena, so it is not a running-animation observation. GIF/WebP redraw, corrupt replacement/Clear and layout observations are scoped separately. The [research packet](../p05-motion-apng-research-a13ab970/README.md) establishes that the two fixtures have identical default IDAT bytes and explains the browser decoder distinction.

## Changes

`png-preview.mjs` performs a pure bounded PNG container transformation, not image decoding. It validates the complete file signature, chunk lengths/names/CRCs, core header/order/palette/transparency structure, and APNG frame sequence/count/bounds. It requires a terminating IEND and rejects malformed or unknown critical chunks. It removes only acTL/fcTL/fdAT, preserving ordinary chunks, color metadata and exact compressed IDAT. Static PNG returns its existing byte view; animated PNG produces a bounded derived buffer. The original File is untouched.

The existing 25 MiB encoded cap remains; the helper also limits the full walk to 16,384 chunks. No compression/decompression, image codec, canvas re-encoding, dependency or image editor is added. This does not validate every ancillary metadata schema or compressed pixel stream: native Image still decodes the result. It also does not establish a decoded-pixel/memory budget.

Motion claims upload generation and operation status before the new asynchronous PNG byte read. Clear, a newer upload and departure invalidate it. Success/rejection after the await checks current ownership before URLs, pending-image state or status can change. The accepted background stays until replacement onload; malformed/read/decode failures preserve it. Cancellation can safely retire pending byte preparation that has no Image or URL yet. GIF, JPEG and WebP still use their existing original-File native-image path; no frame-selection API was changed for them.

The app, new helper and build include are the only runtime/build changes. The Motion README, Animation Director skill and runtime-maintainer skill receive short contract/prompt additions. Five exact synthetic fixtures are added under game/test/fixtures/motion-background for tests, totaling 878 bytes; they are not production art. No generated runtime derivative or original artwork was altered.

## Checks and retained correction

| Check | Result |
| --- | --- |
| Node 20.19.5, 1024 MiB, concurrency 1 | 181/181, 15 complete scoped files, 2.95 seconds; no failures/skips/cancellation |
| Node 22.22.2, same scope/limits | 181/181, 2.36 seconds; no failures/skips/cancellation |
| Input identity | Both runs used the same 90 files / 1,776,210 bytes; 77 inherited inputs unchanged |
| Exact incremental patch | 13 paths; all parent preimages verified, check/application in temporary cache reproduced every output byte |
| Scoped formatting, test-module lint and JS syntax | All passed; not the six full source/release gates |

The cohort keeps all 14 previous complete files and adds the complete parser file. The new cases are 12 parser tests and nine composed host tests; 181 is the complete cohort count, not 181 new tests. Both runtime counts are duplicate execution coverage, not a combined 362-test qualification. Original receipts, complete logs and input pins are under runs/node20-final and runs/node22-final.

The first Node20 run passed 180/181. One test incorrectly labeled `teXt` as an invalid reserved-bit chunk name; uppercase third character X is valid, so the parser correctly preserved that unknown ancillary chunk. The intended invalid name is now `texT`. The original test, log, pins and explanatory correction remain under runs/node20-first. Runtime was unchanged for that correction.

Parser checks cover exact default derivative identity, default-as-first APNG, original immutability, metadata and split/empty IDAT preservation, missing/duplicate/truncated/order/CRC/header errors, APNG sequence/geometry and limits. Host checks cover actual supplied APNG bytes reaching a derived Blob, original GIF/WebP object identity, byte reads superseded/cleared/departed, current/late read rejection, native-image decode failure, accepted-art/focus retention and existing lifecycle behavior. Images/DOM/transport in the host harness remain modeled; these tests cannot establish native decoding or actual BFCache admission.

## Root handoff and remaining gates

1. Review `candidate-pins.json`, parser and app delta; compose this patch only after the two frozen parent patches. The existing served candidate is preserved. In a fresh native packet, replace app.js with this exact output and add png-preview.mjs; all other Motion runtime overlays remain the previous composed bytes. Use the same original background fixtures by direct upload.
2. Through actual UI, compare static control and separate-default APNG at identical palette/fit/opacity. Require red IDAT default after acceptance, explicit redraw, Play/Pause and reduced effects. Record the new still-preview status. Keep the original blue failure. Check invalid PNG now reports preparation failure while retaining accepted art; native decode failure is a different path.
3. Repeat original GIF/WebP and Clear; confirm reading changes keep current background/settings. Natural pending byte/decode delivery and cached versus recreated History return need actual evidence where observable; no synthetic browser events are part of this packet.
4. Full source/build/production/public/physical-device gates remain root-owned. The prior missing 200% zoom, Plain-face native observation, custom long-caption native case, running/full-effects frame behavior and broader performance/offline qualification remain open. The unrelated Turn policy label-association observation is not changed here.

No new release or full P03/P05 acceptance is claimed.
