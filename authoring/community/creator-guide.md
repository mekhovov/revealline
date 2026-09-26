# Add your own levels and campaigns

Open the [picture campaign creator](../../game/creator/) for the shortest supported workflow:
choose pictures or videos, generate bounded gameplay, review it, then install or download one exact
portable campaign. Creation and media inspection stay on your device and require no account.

The creator uses complete, versioned layout variants. Every current generated mission has interior
collision obstacles and one moving field keeper; some variants also use safe islands, slow material
or lethal material. Media bytes and filenames do not determine geometry. The generator verifies
recorded legal routes for the exact compiled mission, difficulty, steering policy and runtime seed.
That evidence establishes feasibility for those configurations, so you must still review the map
and playtest its pacing.

## Map → mission → campaign → pack

| Term     | What you create                                                     | Example                                    |
| -------- | ------------------------------------------------------------------- | ------------------------------------------ |
| Map      | Board dimensions, walls, foundations, terrain and spawn locations   | An island with two approaches              |
| Mission  | A map plus actors, objectives, rules, difficulty and reveal picture | Reach the island while avoiding its keeper |
| Campaign | An ordered sequence of missions                                     | My holiday, pictures 1–12                  |
| Pack     | A transferable campaign and its exact required dependencies         | My holiday `.rlpack`                       |

Modern Studio projects keep these definitions separate. Legacy expansion JSON embeds complete
playable levels inside campaigns. Studio JSON, legacy expansions, `.rlpack`, `.rlsource`,
`.rlteammedia` and `.rltheme` files have different purposes and are not interchangeable.

## Create a campaign from pictures and videos

1. Open the [picture campaign creator](../../game/creator/) and enter a collection name. Select one
   or many PNG, JPEG or static WebP images, MP4 videos, or WebM videos. One image opens the compact
   single-level flow; several media files open the ordered campaign review.
2. For mixed media, inspect the proposed pairs. An unambiguous image/video pair with the same
   normalized filename stem becomes one mission and uses the image as its poster. Filenames are
   suggestions only; exact hashes identify every stored asset. Correct ambiguous pairs explicitly.
3. For a video without a supplied poster, inspect the frames requested at 10%, 50% and 90% of its
   duration. The midpoint starts selected. You can capture another time. The review retains the
   requested time and the observed decoded frame time.
4. Set a playback range if the celebration should start or stop at different times. This range
   changes playback only. The complete inspected video remains in the `.rlpack`.
5. For a batch, check natural filename order, reorder cards, choose pacing and select **Generate
   included levels**. Preparation processes one full-size image at a time. A failed item keeps its
   own error; correct it, regenerate it, or explicitly exclude it before approval.
6. Review every picture, title, story binding, generated map, enemy/obstacle summary and route
   result. **Regenerate** selects another bounded variant. Advanced Studio can edit an independent
   source copy, but a gameplay change invalidates the template route evidence until valid evidence
   is produced again.
7. Check the package and staging estimates. Large campaigns can be split into smaller ordered
   packs; the creator never silently drops a video or failed item to fit storage.
8. Approve the exact prepared bytes, then choose **Install campaign** or **Download .rlpack**. Any
   later gameplay, media, title, range or credit change invalidates that approval.

The current limits and exact format are recorded in the
[creator bundle reference](creator-bundle-reference.md). Image packages contain reviewed PNG
derivatives rather than private source originals. Video missions retain the complete inspected
original because it is the victory story. Neither a shareable pack nor a source backup includes
unrelated library media or player progress.

For screenshots and detailed controls, see the [single-picture walkthrough](image-campaign-guide.md),
[batch walkthrough](batch-image-campaign-guide.md) and [video review guide](video-campaign-guide.md).

## Play and recover an installed campaign

Installed editions appear under **My installed creations** and in the game's **Custom** library.
The current project-backed creator player provides ordinary Solo progression: difficulty and
steering selection, Retry, Next, unfinished-attempt recovery, completion records and exact earned
pictures. After a legal win, a video mission keeps the earned poster and offers **Play**, **Skip**
and **Replay** without blocking Next or changing progress.

Generated v3 missions and packages already carry replay qualification for equal-board Versus.
Installed exact editions can launch through the real two-board Versus host, retain their verified
difficulty and runtime seed, award edition-scoped progress and pictures, and continue to the next
mission. Automated host coverage exercises legal completion, Retry/Next behavior, storage-failure
recovery and a fresh host reopening the clear. A physical fresh-browser import/reload acceptance
run remains pending. Team uses separately authored cooperative templates and the
[Team campaign creator](../../game/creator/team.html).

Each installed edition is immutable and identified by the complete package SHA-256. Installing an
update beside an older edition does not reinterpret the older edition's saved attempt, completion
or earned picture. A matching official name never turns Custom content into Journey content.

## Back up or edit the source

- Creator drafts autosave as immutable checkpoints. Reload the same draft URL to restore its latest
  checkpoint. A stale browser tab cannot silently replace a newer checkpoint.
- **Back up source project** downloads `.rlsource` with the editable project, fitting information,
  required picture inventory and retained originals available to that draft. It does not establish
  approval, installation or progress.
- A `.rlpack` can reopen as editable source, but it cannot recover image originals deliberately
  excluded from the shareable artifact.
- **Open advanced editor** creates or reopens an independent Content Studio copy. Save it there,
  return to the creator and choose **Load saved Studio edits**. Content Studio preview remains
  practice and does not award installed progress.
- Keep the approved `.rlpack`, private `.rlsource` and personal save/recovery exports separately.
  Test each recovery path before deleting an original.

## Share or publish

Sending a `.rlpack` needs no game release. The recipient opens the picture campaign creator,
expands **Open a pack, restore a draft, or back up your source**, selects the file, reviews its exact
contents, and installs it. Import repeats media, manifest, compiler, compatibility and route checks;
an uploaded success flag is never trusted.

The repository also contains a [Community campaigns](../../game/community/) client and a
self-hosted service for accounts, resumable upload, isolated validation, automatic listing,
immutable downloads, reports and owner unlisting. Browsing and installation are account-free;
publishing requires a creator account and an already approved `.rlpack`. These controls work only
when an operator deploys and configures the service. The current static site does not by itself
provide a live public catalog, account backend or upload destination. See the
[maintainer guide](maintainer-guide.md) and [Phase 4/5 acceptance records](delivery-plan.md) for the
production gates.

| Action                             | Scope                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------- |
| Save/import in creator or Studio   | Editable local draft and checkpoints in this browser                      |
| Run a creator or Studio preview    | Practice; no installed progression                                        |
| Install a reviewed `.rlpack`       | Playable immutable Custom edition on this browser                         |
| Send a `.rlpack`                   | Recipient reviews and installs their own exact copy                       |
| Publish through a deployed service | Validated immutable catalog edition; creator account required             |
| Integrate into an official release | Maintainer qualification and release; never inferred from names or upload |

## Optional physical video editing

Playback ranges retain the complete video. To create different physical bytes first, use the
[video poster workshop](../../authoring/video-poster/) and follow the
[media editor guide](media-editor-guide.md). The bounded editor currently accepts one silent,
browser-decodable MP4 or WebM video track, then emits and re-verifies AVC/H.264 MP4 with optional
Balanced or Compact resize/compression. Audio-bearing and multi-track physical conversion remains
disabled. Browser support depends on successful decode/encode probes; only the built-in browser has
the recorded trim/conversion evidence, while Firefox, Safari and physical mobile remain open.

The transformed MP4 is a new input. Select it deliberately in the campaign creator and repeat media
review. The editor does not silently replace a previously approved campaign dependency.

## Manual alternatives

- [Playground](../../game/playground/) can paint or generate a legacy map, embed a reveal image and
  export a ready-to-install `.expansion.json`. It keeps the supplied image bytes and does not
  promise source-metadata removal. Use the [Two crossings example](examples/two-crossings.expansion.json)
  to practice legacy installation and continuation.
- [Content Studio](../../game/studio/) authors arbitrary maps, missions, campaign order and packs as
  editable `ContentProjectV1` source. Its JSON export is a source backup, not a general modern
  Custom installer. Use exact previews and the shared compiler, then integrate unsupported custom
  geometry through the maintainer workflow.
- [Asset Studio](../asset-studio/) edits presentation collections and transfers `.rltheme` files.
  Theme history is separate from gameplay, media campaigns and player saves.

## Troubleshooting

| Symptom                                      | Next step                                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio JSON is rejected by the pack importer | Reopen it in Content Studio. It is editable source, not `.rlpack` or legacy expansion data.                                                                   |
| Two files paired incorrectly                 | Review normalized-stem suggestions and choose the exact poster for the video. Resolve ambiguous stems manually.                                               |
| Video poster capture or playback fails       | Keep the original and use a codec the current browser actually decodes. Renaming the extension does not convert it.                                           |
| Physical video download stays disabled       | The editor accepts one silent decodable track only. Keep audio videos unchanged for victory playback, or prepare a verified silent derivative.                |
| Generated item fails                         | Read that card's error, correct or regenerate it, or explicitly exclude it. Other completed cards remain reviewable.                                          |
| Storage is full or unavailable               | Keep the page open and download the approved pack or source backup. Review a split for large batches; writes can still fail after an advisory quota estimate. |
| Another tab changed the draft                | Export the unsaved source, reload the accepted head, and reconcile deliberately.                                                                              |
| A friend has no picture or cannot resume     | Reinstall the exact immutable `.rlpack`; transfer saved progress separately.                                                                                  |
| Catalog/account controls report unavailable  | The self-hosted API is not deployed or reachable on that origin. Local creation and already installed play remain available.                                  |
| A changed campaign starts fresh              | The changed bytes created another edition identity. Open the older installed edition for its exact attempt and rewards.                                       |
| A download says “requested”                  | Confirm that the browser actually saved the file; the application cannot prove the final download destination.                                                |
