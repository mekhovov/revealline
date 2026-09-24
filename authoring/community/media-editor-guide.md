# Optional media editor: verified browser trim

This Phase 8 slice extends the local [Video poster workshop](../video-poster/) without adding a
server upload. It separates three operations that produce different evidence:

1. **Poster capture** decodes one selected video frame and exports a PNG.
2. **Playback range** records where a victory story should begin and end. It keeps every byte of
   the complete original video in the campaign.
3. **Physical trim** lazy-loads pinned [Mediabunny 1.59.1](https://mediabunny.dev/) only after you
   check support. The first production path accepts one silent AVC/H.264 MP4 and exports a newly
   encoded AVC MP4.

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

## Physical trim boundary

Select **Check physical trim support** after applying the wanted playback range. The workshop then
loads the self-hosted converter and inspects the exact owned source. Support is advertised only
when all of these statements are true:

- the file is an MP4 with exactly one AVC/H.264 video track and no audio track;
- the converter and browser agree with the already inspected display dimensions;
- this browser can decode and encode AVC through WebCodecs; and
- the range has a positive duration inside the inspected source.

WebM, additional video tracks, non-AVC video, and every audio-bearing input stay unchanged and show
the exact unsupported reason. The complete source remains available for playback-range packaging.

Before the adapter offers a transformed download, it requires all of the following:

- a nonempty MP4 or WebM output in a format declared by the adapter;
- a SHA-256 different from the complete source;
- a fresh browser decode whose hash and byte count match the output;
- decoded duration within a bounded tolerance of the requested clip;
- the same decoded width and height as the inspected source.

This proves changed bytes, clip duration and decoded display orientation. The conversion writes an
empty metadata-tag set, but this does not prove that every container-level metadata field is
absent. The supported path has no audio and labels that fact `not-present`; it never presents
silence as proof of audio synchronization.

[Mediabunny currently documents](https://mediabunny.dev/guide/converting-media-files#trimming) that
any nondefault trim start forces both video and audio transcoding. Audio-bearing inputs remain
unsupported until RevealLine can independently inspect the decoded output audio timestamps and
synchronization instead of trusting successful encoding alone.

## Exact support and limits

| Operation               | Accepted input                                                                        | Produced output             | Limits and evidence                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inspect/capture         | Bounded MP4 (`isom`, `iso2`, `mp41`, `mp42`, `avc1`, `M4V ` brands) or WebM container | PNG poster                  | Up to 64 MiB, 120 seconds and decoded 1920 × 1080. The browser must actually decode the contained codecs.                                                      |
| Playback range          | An inspected MP4 or WebM                                                              | No new media bytes          | Full original is retained. Start/end are validated, not clamped.                                                                                               |
| Adjacent decoded frame  | An inspected source whose capture returned a presented-frame timestamp                | PNG poster                  | Bounded seek attempts; unavailable when the browser exposes playhead estimates only.                                                                           |
| Physical trim           | One silent AVC/H.264 MP4                                                              | Newly encoded AVC/H.264 MP4 | Mediabunny 1.59.1 loads on request; download remains blocked until changed-byte and fresh decode checks pass. Audio, WebM and other codecs remain unsupported. |
| Resize/compress/convert | None                                                                                  | None                        | Deferred until a maintained converter is integrated and qualified.                                                                                             |

Codec support differs by browser and operating system. A recognized MP4 or WebM container is not a
promise that its video or audio codec will decode. Visual review remains required for every poster
and transformed result.
