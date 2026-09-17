# Motion imported-background conformance fixtures

17 September 2026. **Prepared fixtures and proposed native steps only. Native conformance has not been executed.** The frozen [Motion candidate](../p05-motion-successor-a13ab970/README.md) is unchanged. This packet is outside the source/release tree and contains no production art, asset replacement, renderer/API change, browser session, app test run or deployment.

The exact source base is `a13ab970222498d7c5fa7f62f9fc04fe436979d5`. [manifest.json](manifest.json) pins the relevant frozen proposal files, generator, runtime, all encoded bytes and the decoded synthetic frame inventory. Those pins describe what was inspected; they do not claim integration or release acceptance.

## Expected contract

WHATWG requires Canvas 2D to draw an animated image element's default image, or its first frame when the format supplies no default. Repeated `drawImage(HTMLImageElement)` calls do not request animation playback. [Canvas image sources](https://html.spec.whatwg.org/multipage/canvas.html#image-sources-for-2d-rendering-contexts)

`createImageBitmap` applies the same default/first-image rule to image elements and Blobs. It also introduces an owned bitmap lifetime and `close()`; changing APIs solely because GIF/WebP files are accepted is not an established fix. [ImageBitmap creation and lifetime](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#dom-createimagebitmap)

Motion currently imports an off-DOM image and uses `drawImage` for its local preview. Thus the specified outcome is a still image in Full and Reduced modes. These fixtures qualify that native outcome; they do not establish a bug in advance. The existing upload path is load-event based, with a 25 MiB file-size gate, but no explicit `decode()`, timeout or decoded-pixel budget. Those separate inherited limits are not qualified here. [Image decoding](https://html.spec.whatwg.org/multipage/embedded-content.html#dom-img-decode)

## Fixture inventory

All valid fixtures are 32×24, opaque and lossless. Each has fixed 2×2 black top-left and white bottom-right markers. Every expected still has center pixel `(16,12) = RGBA(224,48,64,255)`. The three animated inputs loop indefinitely on a 1000 ms cycle. The invalid fixture has no dimensions.

| File | Encoded bytes | Timed playback in an animation-capable image viewer | Expected Canvas still |
| --- | ---: | --- | --- |
| `static-default.png` | 122 | None | Red control |
| `animated-first-frame.gif` | 207 | Red 400 ms → blue 600 ms | Red first frame |
| `animated-separate-default.png` | 377 | Blue 400 ms → green 600 ms | **Red separate default**, outside the animation |
| `animated-first-frame.webp` | 164 | Red 400 ms → blue 600 ms | Red first frame |
| `invalid-signature-only.png` | 8 | Cannot decode: PNG signature only | Visible failure; retain the accepted background |

The APNG deliberately uses a `.png` extension and expected upload MIME `image/png`, matching Motion's existing file gate. If the environment reports a different File.type and the gate rejects it, record that separately from canvas behavior. Its PNG container has `IDAT` before the first `fcTL`, demonstrating the separate default. A native image viewer that cannot animate this fixture cannot provide an animation-playback control for it.

Exact SHA-256, every decoded frame's pixel hash, colors, dimensions, timings and APNG/WebP structure are in the manifest. Encoded fixture total: **878 bytes**. Manifest RGBA values are source pixels. Motion applies opacity, fitting, arena paint and overlays; raw source RGB is not the expected composited screenshot RGB.

## Reproduction

The existing bundled interpreter supplies Python 3.12.14, Pillow 12.3.0, libwebp 1.6.0 and zlib 1.2.12. No dependency was installed. The default `python3` lacks Pillow; do not substitute it silently. Pillow's retired `webp_anim` feature-query name is not a capability result; successful animation encoding and the inventoried `ANIM`/two `ANMF` chunks establish fixture preparation.

From this packet directory, rerun only when intentionally regenerating fixture bytes:

```sh
/Users/oleksandr.mekhovov/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 generate.py
```

[generate.py](generate.py) creates all images from constant colors/marker geometry and inventories its own outputs through Pillow plus PNG/WebP chunk readers. Encoding bytes may vary with encoder versions; compare the manifest rather than assuming another Pillow build reproduces the same bytes. No source image, artwork, player save or media database is read or written. Pillow's decoded frame inventory is preparation evidence, not a browser test.

## Native qualification steps — not executed

Use the release owner's authorized local served candidate and browser lane. Record exact candidate SHA/file pins, fixture hashes, browser/version, OS, viewport, settings and observation timestamps. Do not open another browser lane or modify the frozen candidate just to perform this checklist.

1. **Establish controls.** In an ordinary image viewer or independent native `<img>` surface, verify that each animated fixture really changes color over at least two cycles. Keep this surface separate from Motion; viewer motion is a fixture/control observation, not proof of Motion behavior. APNG playback must show blue/green while its expected canvas still is red.
2. **Inspect.** In Motion, pause and load `static-default.png`; choose Contain and a fixed opacity. Capture a visible patch outside actors, terrain, lines and labels. Replace with each animated fixture at the same settings. After more than two seconds, the background should match the static control. Confirm load status and reported 32×24 dimensions. Account for scaled marker edges and compositing; do not demand the raw source RGBA from an opacity-blended screenshot.
3. **Play and Pause.** Observe each imported background while the actual study runs for at least two cycles; capture the same unobstructed patch at different times. The study may animate; the imported patch must remain the default/first image. Pause and repeat the observation. A static paused canvas alone cannot prove repeated-draw behavior.
4. **Reduced and explicit redraw.** Enable the current reduced-effects control and inspect both running and paused behavior. Trigger actual redraws through opacity/fit and reading controls. Restore the control values before comparing pixels. Verify the image remains red and the study's existing explicit Play and settings-preservation contract is retained.
5. **Return.** Navigate away and Back. Record whether this was BFCache restoration or a new document; do not assume admission. A cached return should preserve the accepted background and remain paused until Play. A cold new document has no persisted local background and must not be recorded as a failed cached-return case.
6. **Corrupt replacement.** With a valid accepted image visible, select `invalid-signature-only.png`. Expect visible decode failure and the prior accepted image retained. Clear must remain usable and the original files unchanged. Record native failure delivery, not just the invalid file's signature.
7. **Pending replacement.** This tiny corpus is deliberately fast, so an ordinary click race or network throttle does not reliably hold a local Blob decode. If an in-flight operation is actually observable, select a replacement then Clear or depart before completion; stale delivery must not resurrect the image/status. Otherwise leave this native case unexecuted. For deterministic follow-up, the owner may authorize a separate native-image completion gate in an isolated harness: retain the real Image decoder and identify the evidence as **instrumented completion delivery**, not natural decoder delay. Cover replacement A superseded by B, Clear, cached departure, terminal departure and failure while preserving the previous accepted image. Do not replace Image with a fake and call it native evidence.

Expected owner result is per-format/per-case pass, fail or unexecuted, with observations. Do not infer other engines, devices, codecs, resource/memory release, zero hidden decoder work, actual font qualification or a public release from these cases.

## Existing modeled evidence boundary

The frozen host fixture uses a fake `Image` with manually delivered load/error handlers and records `drawImage` calls. It covers accepted-image identity through reading changes/cached return and fences late pending completion after terminal departure. It cannot establish image decoding, native format support, still pixels, animation-frame selection, real BFCache admission or memory release. This packet does not rerun or extend those tests.

[proposed-docs/background-policy.patch](proposed-docs/background-policy.patch) contains two additive documentation-only hunks against the pinned frozen Motion README and Animation Director skill. They state the normative still-preview contract and keep native evidence separate. The patch is proposed and unapplied; visible UI wording and any label code are owned separately.
