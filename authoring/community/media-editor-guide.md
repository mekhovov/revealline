# Optional media editor: first bounded slice

This Phase 8 slice extends the local [Video poster workshop](../video-poster/) without adding a
server upload or a bundled converter. It separates three operations that produce different
evidence:

1. **Poster capture** decodes one selected video frame and exports a PNG.
2. **Playback range** records where a victory story should begin and end. It keeps every byte of
   the complete original video in the campaign.
3. **Physical trim** asks an optional converter to create a different video file. The current
   build has no production converter, so the workshop reports this operation as unsupported.

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

Select **Check physical trim support** to inspect the local capability. In this build the result is
explicitly unsupported: there is no maintained conversion dependency installed and **no input or
output format is advertised for physical trimming**.

The lazy adapter boundary is ready for a later maintained, self-hosted converter. Before it can
offer a transformed download, it requires all of the following:

- a nonempty MP4 or WebM output in a format declared by the adapter;
- a SHA-256 different from the complete source;
- a fresh browser decode whose hash and byte count match the output;
- decoded duration within a bounded tolerance of the requested clip;
- the same decoded width and height as the inspected source.

This proves changed bytes, clip duration and decoded display orientation. It does not prove that
rotation metadata was removed, that other metadata was stripped, or that sound is synchronized.
Audio evidence remains **unverified** unless a future adapter reports its own timestamp check; that
adapter report is labeled `adapter-verified`, because the browser boundary does not independently
decode audio timestamps.

## Exact support and limits

| Operation | Accepted input | Produced output | Limits and evidence |
|---|---|---|---|
| Inspect/capture | Bounded MP4 (`isom`, `iso2`, `mp41`, `mp42`, `avc1`, `M4V ` brands) or WebM container | PNG poster | Up to 64 MiB, 120 seconds and decoded 1920 × 1080. The browser must actually decode the contained codecs. |
| Playback range | An inspected MP4 or WebM | No new media bytes | Full original is retained. Start/end are validated, not clamped. |
| Adjacent decoded frame | An inspected source whose capture returned a presented-frame timestamp | PNG poster | Bounded seek attempts; unavailable when the browser exposes playhead estimates only. |
| Physical trim | None in the production build | None in the production build | Optional adapter contract exists; output download remains blocked until byte and decode checks pass. |
| Resize/compress/convert | None | None | Deferred until a maintained converter is integrated and qualified. |

Codec support differs by browser and operating system. A recognized MP4 or WebM container is not a
promise that its video or audio codec will decode. Visual review remains required for every poster
and transformed result.
