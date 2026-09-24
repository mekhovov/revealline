# Add your own levels and campaigns

Start with the [browser guide](index.html), [Playground](../../game/playground/), or [Content Studio](../../game/studio/). Creation stays on your device. You do not need an account or a terminal for the single-map workflow below.

This guide describes the framework shipped before automatic media campaigns. **A Studio project is editable source; a Playground expansion is currently the file you can install for ordinary Solo play.** Selecting an image in Studio's reference workbench does not generate a level or bind its reveal reward. The planned `.rlpack` creator is tracked in the [delivery plan](delivery-plan.md).

## Map → mission → campaign → pack

| Term     | What you create                                                         | Example                                    |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| Map      | Board dimensions, walls, foundations, terrain and spawn locations       | An island with two approaches              |
| Mission  | A map plus actors, objectives, rules, difficulty and reveal picture     | Reach the island while avoiding its keeper |
| Campaign | An ordered sequence of missions                                         | My holiday, pictures 1–12                  |
| Pack     | A distributable collection of campaigns and their required dependencies | My holiday collection                      |

Modern Studio projects keep these definitions separate. The older expansion format embeds complete playable levels inside each campaign. File formats are not interchangeable merely because both use JSON.

## Quick start: install the supplied campaign

1. Download [Two crossings](examples/two-crossings.expansion.json). Retain the actual file from your browser's downloads. It contains two small maps and procedural scenery, with no uploaded media or player saves.
2. Open the [game](../../game/). Choose **Settings → Game data → Installed chapters** to open the expansion library. Older editions also offer **Library & saves → Expansion packs**.
3. Choose **Install a pack file** and select the downloaded JSON. Wait for validation and a successful installation message. A failed import should leave existing content intact.
4. Choose **Play Creator guide · two crossings** in the installed card, then **Start mission**. You can also find it under **Missions → Collection → Custom**. Older editions use Pack/Level selectors.
5. Steer down from the starting boundary to the opposite boundary. This deliberately easy example has no enemies. After the legal win, check the earned picture and choose **Next** for **Second crossing**. Try **Retry** on that mission.
6. Reload and find the installed campaign again. Keep the original pack for recovery. Your player backup and unfinished-attempt export are separate from the content file.

These two maps teach installation and continuation. They do not demonstrate balanced generated challenges, custom image decoding, multiplayer or video support.

## Create one image level without editing JSON

1. Open [Playground](../../game/playground/). Start from an included map, or enter a **Generator seed** and choose **Generate map**. A seed generates geometry; it does not analyze your picture. Generated candidates still need playtesting.
2. Choose **Role → Reveal background**, choose **Background fit**, then **Choose PNG / JPEG / WebP**. Select your own small image and wait for validation/decoding. Use **Contain whole image** if cropping would hide an important part. Review the actual preview.
3. Optionally paint walls, enemies, objectives or a start position. **Paint by coordinates** provides keyboard editing. Change **Coverage target %** and other settings only when needed; use **Undo** to return to the previous configuration.
4. Choose **Play configuration**. Complete a legal win and try loss, Pause, Resume and Retry. The preview is practice and does not award campaign progress.
5. Expand **Complete pack JSON** and choose **Export map as expansion**. Check the downloaded `.expansion.json` file. **Export scenario** is an editor/practice file; **Export loaded library** retains the loaded original campaigns rather than merging your working edits into them.
6. Install the exported expansion using the quick-start steps above. Play it through **Custom** and verify the picture after a win and reload. Send that content file to a friend, who uses the same import steps.

The existing Playground embeds image bytes as supplied; it does not promise removal of personal metadata. Use an image you intend to distribute. Do not share **Export complete backup** as a content pack: that backup can contain personal progress, preferences and other installed content. Automatic image normalization and a scoped, reviewed export are Phase 1 work.

## Author an ordered campaign in Content Studio

1. Download the [editable example project](example-project.json). Open [Content Studio](../../game/studio/), choose **Inspect import**, and select it. Inspect the source before **Apply inspected source**. Export your current project before reusing an identity.
2. For your own project, choose a unique **Local project ID** and **New project**, then inspect/apply it. Names are player-facing labels; IDs identify content and must remain stable across its history.
3. Open **Organize missions, campaigns & packs**. Use its create/duplicate, rename, membership and order operations to build the campaign. Choose **Validate & apply structure** after each prepared change. Maps and missions must exist before a campaign can reference them, and campaigns before packs reference them.
4. Select a mission, edit its map and rules, then **Play exact Solo preview → Start mission**. Test every advertised difficulty. A source compiler pass or authored difficulty rating does not prove a winning route.
5. Choose **Save checkpoint / retry**, then **Export backup**. Keep that JSON with separately retained media. Reload and verify the saved checkpoint. To recover history, **Inspect saved**, review, apply and save; recovery creates a new checkpoint without erasing the intervening ones.
6. Share the project JSON with another creator for **Inspect import → Apply inspected source**. This is editable-source exchange. The current Studio export does **not** install an ordinary modern Custom campaign. Use the current maintainer integration path below until the `.rlpack` workflow ships.

The [existing community walkthrough](README.md) covers presentation editing, conflicts, CLI checks and the separate geometry/rules-only Team test export. Do not advertise Team support based on a Solo preview.

## Add pictures, presentation or victory videos today

- Use Playground's reveal-background file chooser for a picture embedded in a legacy map expansion.
- Use [Asset Studio](../asset-studio/) for a theme collection and `.rltheme` transfer. Theme editing and mission mechanics are separate.
- Existing Still Media and Story workshops assign retained pictures and video stories to supported exact campaign/picture identities. Follow the [story authoring guide](../../docs/story-workshop-authoring.md). Their media exports are separate files and are not a complete campaign installer.
- Current video playback ranges choose where playback starts and stops; the original video remains in the bundle. They do not physically trim the exported file. Automatic pairing, poster selection and self-contained video campaigns belong to Phase 3.

## Install locally, share a file, or publish

| Action                                  | Who can see it?                  | What happens?                                              |
| --------------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| Import/edit in Studio                   | This browser workspace           | Editable local draft and checkpoints                       |
| Run a preview                           | This browser                     | Practice; no ordinary progression                          |
| Install an expansion                    | This device's game library       | Playable Custom content                                    |
| Send an expansion to a friend           | People receiving the file        | They explicitly install their own copy                     |
| Integrate into a game release           | Players of that reviewed release | Maintainer qualification, immutable release and deployment |
| Publish to the future community catalog | Catalog users after validation   | Planned Phase 4; currently unavailable                     |

For maintainer distribution, use the [publishing guide](maintainer-guide.md). There is currently no public upload button or community account flow. A filename matching an official campaign does not grant official Journey ownership.

## Troubleshooting and recovery

| Symptom                                             | Next step                                                                                                                                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio JSON is rejected by the game's pack importer | It is a different format. Reopen in Studio; use a Playground expansion for today's manual install path.                                                           |
| The preview picture is different                    | A reference image is an editing overlay. Bind the reveal background using the supported tool and review the exported artifact.                                    |
| Import or image decoding fails                      | Keep your original, read the item error, and retry with a supported smaller file. Renaming the extension does not convert it.                                     |
| Storage is full or unavailable                      | Keep the page open and export unsaved work. Verify the download before clearing anything. Browser storage can be evicted; it is not a backup.                     |
| Another tab changed the draft                       | Export your unsaved snapshot, inspect the saved version, and deliberately reconcile. Do not overwrite a newer checkpoint blindly.                                 |
| A friend has no picture or cannot resume            | Give them the exact content edition and required media, then import their separate saved attempt. A player-library export alone does not install missing content. |
| A changed campaign starts fresh                     | Changed content may have a new progression identity. Preserve the old edition and backups rather than rewriting old saves.                                        |
| A download says “requested”                         | Confirm that the browser actually saved the file. The application cannot prove the final download destination.                                                    |

Keep exact originals, exported content and personal backups separately. Test a restore in a separate browser profile before relying on a backup.
