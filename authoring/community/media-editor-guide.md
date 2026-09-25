# Optional media editor: verified browser trim, resize and compression

This Phase 8 slice extends the local [Video poster workshop](../video-poster/) without adding a
server upload. It separates three operations that produce different evidence:

1. **Poster capture** decodes one selected video frame and exports a PNG.
2. **Playback range** records where a victory story should begin and end. It keeps every byte of
   the complete original video in the campaign.
3. **Physical trim, resize and compression** lazy-loads pinned
   [Mediabunny 1.59.1](https://mediabunny.dev/) only after you check support. The bounded production
   path accepts one silent MP4 or WebM video track that this browser can decode and exports a newly
   encoded AVC MP4. A separate parser pass authenticates the source and output hashes and requires
   both containers to have zero audio tracks. Fresh browser decodes also compare the selected
   source start/end pictures with the exported start/end pictures before a download appears.

Before checking support, choose one reviewed output profile:

- **Keep source size** retains the inspected display dimensions and uses the encoder default.
- **Balanced** fits inside 1280 × 720 without upscaling and requests a 2.5 Mbit/s AVC target.
- **Compact** fits inside 640 × 360 without upscaling and requests a 0.9 Mbit/s AVC target.

The bounded profiles derive exact even dimensions from the inspected display aspect, preserve
portrait/landscape orientation, and allow at most one percent aspect-ratio rounding drift. They do
not crop or stretch. A profile change invalidates the earlier capability result and requires a new
check. Selecting Balanced or Compact can transform the complete video without also shortening its
playback range.

## Capture and move between decoded frames

1. Open the Video poster workshop through localhost or HTTPS.
2. Choose one MP4 or WebM file. Inspection remains local and muted.
3. Enter a time and select **Capture poster**.
4. Review the requested seek, observed frame timestamp, PNG hash and source hash.
5. If the browser reported a presented-frame timestamp, use **Step toward earlier frame** or
   **Step toward later frame**. The workshop repeats a bounded series of seeks and publishes a
   result only after the browser reports a different timestamp. A browser may skip more than one
   frame, so the observed timestamp and captured PNG remain the authority.
6. Download the exact PNG after visual review.

Browsers without `requestVideoFrameCallback` still capture a poster from the decoded playhead.
They leave frame-step controls disabled because a requested decimal is not proof of a distinct
frame. The tool does not invent a frame rate or frame number.

## Choose a playback range

Enter a start and end within the inspected duration and select **Apply playback range**. The range
must have a positive duration and is never silently clamped. The evidence panel repeats that the
complete original remains unchanged. Phase 3 campaign packages therefore continue to include the
full selected video.

## Physical transform boundary

Select **Check trim/conversion support** after applying the wanted playback range and output plan.
The workshop then
loads the self-hosted converter and inspects the exact owned source. Support is advertised only
when all of these statements are true:

- the file is an MP4 or WebM with exactly one video track and no audio track;
- a separate exact-byte inspection authenticates the selected source and reports zero audio tracks;
- the converter and browser agree with the already inspected display dimensions;
- this browser can decode and encode AVC through WebCodecs; and
- the range has a positive duration inside the inspected source.

Additional tracks, every audio-bearing input, unavailable source decoders, and browsers without an
AVC encoder stay unchanged and show the exact unsupported reason. The complete source remains
available for playback-range packaging. This is capability detection for the selected bytes; it is
not a promise that every codec permitted by MP4 or WebM will decode in that browser.

Before the adapter offers a transformed download, it requires all of the following:

- a nonempty MP4 or WebM output in a format declared by the adapter;
- a SHA-256 different from the complete source;
- a fresh browser decode whose hash and byte count match the output;
- decoded duration within a bounded tolerance of the requested clip;
- decoded width and height exactly equal to the reviewed output plan;
- a second exact-byte audio-track inventory whose hash and byte count match the output and whose
  audio-track count is zero.
- fresh presented-frame captures from the exact source and output at both boundaries, with
  authenticated PNG hashes, aligned observed timestamps and bounded normalized RGB error.
- for a bitrate profile, an exact output-byte/duration whole-container average no greater than two
  times the target plus 256 kbit/s. This deliberately conservative allowance catches an ignored
  profile without presenting a variable-rate encoder target as an exact achieved video bitrate.

The boundary reopens both exact videos instead of trusting adapter output labels or an earlier
poster. Each comparison downsamples the freshly decoded PNG to a 24 × 14 RGB grid and records both
mean error and the fraction of substantially changed samples. Missing browser frame timestamps,
missing pixel decode support, a changed edge picture, or evidence bound to another hash, duration
or playback range keeps the transformed bytes private. A visually static picture can establish
visual equivalence, but cannot prove a unique frame number; creators still review the exported
clip.

## Qualify portrait display orientation

Maintainers can create a temporary owned MP4 whose encoded samples are landscape but whose display
matrix presents them as portrait:

```sh
node authoring/video-poster/generate-fixture.mjs \
  --out .cache/video-poster/NEW_PORTRAIT_FIXTURE \
  --kind portrait-rotation
```

This diagnostic route requires existing `ffmpeg` and `ffprobe` executables. It installs nothing,
requires a new ordinary directory under this worktree's `.cache`, refuses symlink ancestors and
never overwrites an earlier fixture. It encodes a silent 640 × 360 test pattern, losslessly remuxes
it with a 90-degree MP4 display matrix, verifies the matrix through `ffprobe`, and records both
commands, tool versions, exact bytes and SHA-256 in `fixture.json`. The expected browser display is
360 × 640. The Compact plan must therefore be 202 × 358 rather than a landscape plan.

Open the workshop, select that MP4, and require all of these results before recording orientation
qualification:

1. Browser inspection reports 360 × 640 and four seconds, while `fixture.json` retains the native
   640 × 360 encoded dimensions and 90-degree matrix evidence.
2. A complete 0–4 second range plus Compact produces a reviewed 202 × 358 / 0.9 Mbit/s plan.
3. The reopened output reports exactly 202 × 358, one AVC track and zero audio tracks.
4. Both decoded visual-edge comparisons pass, the download becomes visible, and the asymmetric
   pattern remains upright portrait artwork on visual review.

The generated file and record are temporary acceptance inputs, not repository fixtures or browser
evidence by themselves. Repeat this check in every supported browser because display-matrix decode
behavior can differ by browser and platform.

The built-in browser completed this route on 2026-09-25. It inspected the exact 223,097-byte source
as 360 × 640, derived the 202 × 358 Compact plan, and exported a 159,517-byte AVC MP4 with SHA-256
`1d2a620c2ae711cd775b2c08a14972540f57f51c012f7c8540f9fa05705e3f2b`. The fresh output decode
reported 202 × 358, four seconds and zero audio; its whole-container average was 319,034 bit/s.
Start/end RGB errors were `0.017472` and `0.019686`, the verified download appeared, and the browser
reported no warning or error. This is one Chromium-platform qualification; it does not replace the
per-browser repeat above.

This proves changed bytes, clip duration, decoded display orientation and the absence of audio
tracks in both authenticated containers. The audio inventory reopens the bytes through the same
pinned media parser; it is a separate inspection pass, not an independent decoder. Adapter-supplied
audio labels are ignored. The conversion writes an empty metadata-tag set, but this does not prove
that every container-level metadata field is absent. The supported path labels audio
`not-present`; it never presents silence as proof of audio synchronization.

[Mediabunny currently documents](https://mediabunny.dev/guide/converting-media-files#trimming) that
any nondefault trim start forces both video and audio transcoding. Audio-bearing inputs remain
unsupported until RevealLine can independently inspect the decoded output audio timestamps and
synchronization instead of trusting successful encoding alone.

## Exact support and limits

| Operation              | Accepted input                                                                        | Produced output                            | Limits and evidence                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inspect/capture        | Bounded MP4 (`isom`, `iso2`, `mp41`, `mp42`, `avc1`, `M4V ` brands) or WebM container | PNG poster                                 | Up to 64 MiB, 120 seconds and decoded 1920 × 1080. The browser must actually decode the contained codecs.                                                                                                                |
| Playback range         | An inspected MP4 or WebM                                                              | No new media bytes                         | Full original is retained. Start/end are validated, not clamped.                                                                                                                                                         |
| Adjacent decoded frame | An inspected source whose capture returned a presented-frame timestamp                | PNG poster                                 | Bounded seek attempts; unavailable when the browser exposes playhead estimates only.                                                                                                                                     |
| Physical trim/convert  | One silent, browser-decodable MP4 or WebM video track                                 | Newly encoded AVC/H.264 MP4                | Mediabunny 1.59.1 loads on request; download remains blocked until changed-byte, fresh source/output boundary-frame decode and exact-byte zero-audio-track checks pass. Audio and multi-track inputs remain unsupported. |
| Resize/compress        | The same bounded silent source using Balanced or Compact                              | Exact reviewed dimensions in AVC/H.264 MP4 | No upscaling; aspect/orientation preserved; target bitrate and observed whole-container average remain in evidence. Output is withheld on dimensions, codec, audio, bitrate allowance or visual-boundary drift.          |

Codec support differs by browser and operating system. A recognized MP4 or WebM container is not a
promise that its video or audio codec will decode. Visual review remains required for every poster
and transformed result.
