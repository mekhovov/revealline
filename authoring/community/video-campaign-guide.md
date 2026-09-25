# Video campaign review

The Phase 3 media review uses the same local creator flow as picture campaigns. Select supported
PNG, JPEG, WebP, MP4 and WebM files together, then inspect the media before approving the enclosing
campaign.

1. Review automatic filename-stem suggestions. Filenames are hints; each stored dependency uses
   the hash of its exact bytes. If more than one file shares a stem, choose the intended image for
   each video or choose **Capture a frame from this video**.
2. For a video without a supplied poster, review frames requested at 10%, 50% and 90% of its
   duration. The midpoint is selected initially. Enter a time in seconds to capture a different
   frame. The review records both the requested time and the observed decoded-frame timing.
3. Set optional playback start and end times. These values choose the part played after a win. The
   complete original video remains in the portable package; this control does not trim its bytes.
4. Apply the media choices. Unsupported codecs, failed captures and ambiguous pairs remain attached
   to their files and block approval until corrected or excluded.
5. After a legal win, the poster is earned first. The video is an optional victory story with
   **Play**, **Skip** and **Replay**. A decoder error or browser autoplay refusal leaves the poster
   and **Next** available.

The media review controller produces a `revealline-creator-media-intake.v1` prepared result and a
strict `revealline-creator-media-dependencies.v1` closure. Campaign assembly must store those exact
manifest and asset bytes before the main creator page exposes video approval. The optional
[media editor](media-editor-guide.md) remains a separate local preparation step: trim, conversion,
resize or compression produces a verified MP4 that the creator must deliberately select as the
campaign input. A playback range alone still retains the complete original bytes.
