# Create and share a picture campaign

Open [Picture campaign creator](../../game/creator/). This is the Phase 1 implementation; its public release and browser acceptance are tracked in [the acceptance record](phase1-acceptance.md).

Choosing one picture keeps this compact workflow. The Phase 2 multi-picture interface and its release requirements are documented in the [batch campaign draft](batch-image-campaign-guide.md).

## Make your first campaign

1. Choose one PNG, JPEG or static WebP picture, or drop it onto the picture area. The current input limits are 4 MiB, 8192 pixels per side and 16 megapixels. This release creates one Solo mission per campaign.
2. Give the collection and level names you want other players to see. Describe the picture, choose **Fit whole picture** or **Fill board**, and review the creator, picture credit and sharing terms. The filename is only an initial editable title; it does not determine the map or asset identity.
3. Choose **Generate and review**. The creator prepares an oriented 1280 × 640 PNG, a small thumbnail, and one deterministic layout from six bounded families and twelve reviewed variants. Every current variant has interior collision walls and one moving field keeper; some also use safe islands, slow material or lethal material.
4. Review the picture, map, title, obstacle and enemy counts, and credits. The seed selects a complete authored layout instead of scattering arbitrary objects. The creator replays that exact compiled map, enemy, difficulty and runtime seed for Gentle, Standard and Expert with both steering modes. A successful replay establishes feasibility for those six configurations, not human playtesting or a quality rating.
5. Choose **Approve this picture and level**. The prepared edition is immutable. Changing the source, title, art or credits requires another review and approval.
6. Choose **Install campaign** or **Download .rlpack**. Installation shows the package size, required staging space and shared media usage. When storage is unavailable, the approved download remains available.
7. Open **Play installed campaign**. Select a difficulty and steering style, then start. Arrow keys or WASD set your direction; Escape pauses. After a verified legal win, the campaign retains its exact earned picture. **Retry** starts the same rules and seed; the final continuation returns to your creations.

Installed content is listed under **My installed creations** and the game's **Custom** mission library. A matching official title or project ID does not make a campaign Journey content. The dedicated Custom player uses the existing compiler, attempt preparer, renderer, input adapter and replay/session verifier. It keeps progress in an edition-scoped profile.

## Give the campaign to someone else

1. Download the approved `.rlpack` and send that file through your normal sharing method.
2. The recipient opens Picture campaign creator, expands **Open a pack, restore a draft, or back up your source**, and selects the downloaded file.
3. The game checks its exact media bytes, manifest, compiler output, compatibility and completion evidence. The recipient reviews, approves and installs it, then plays normally.

A share pack contains editable gameplay, required runtime PNG bytes, scoped theme data, credits, template provenance, compatibility and automated replay evidence. It excludes retained source originals, unrelated media and player saves. There is no account, hosted upload, public catalog or automatic community publication in this phase.

## Edit or recover your source

- Drafts autosave after edits settle. The page URL identifies the draft; reload that URL to restore its latest immutable checkpoint. If another tab changes the same draft, an old writer cannot overwrite the newer head.
- **Back up source project** creates a private `.rlsource` file. It includes this draft's gameplay, runtime picture, fitting information and retained original if one is available. Import it through the same file chooser. A `.rlpack` can also reopen as editable source, but does not recover an excluded original.
- Open **Optional edits → Open advanced editor** for an independent Content Studio copy. Save a checkpoint there, return to this creator draft, and choose **Load saved Studio edits**. Opening the editor again reuses that copy and does not overwrite its existing edits.
- Titles, credits and artwork can be revised without changing simulation identity, but the resulting pack still needs visual review. Moving an enemy, wall, island or terrain zone is a gameplay change and cannot borrow the template's old route evidence. Keep the edit as a draft, or choose **Regenerate template gameplay** to select the next verified variant. Supplying an arbitrary custom completion recording is not exposed by the Phase 1 UI.
- Source checkpoints and media use the existing 256 MiB managed-media budget. Each creator draft retains at most 50 checkpoints. To continue beyond that, download its source backup, start a new draft, and import the backup. This phase retains originals and editions; reference-aware offloading is later work.

Advanced Studio previews remain practice. They do not award installed Custom progress. Source checkpoints and source backups do not contain player progress.

## Saves and troubleshooting

The Custom player periodically saves unfinished attempts and saves on Pause. Reload and select **Resume saved attempt**, then **Resume**. Recovery verifies the input recording against the exact installed edition. **Saves and recovery** can separately download/restore an unfinished attempt or back up/restore that campaign's progress.

- **Unsupported or too large picture:** prepare a smaller static PNG/JPEG/WebP externally and select it again. Animated pictures, arbitrary remote URLs and scripts are not accepted.
- **Changed approval or installation review:** generate/review again. A change in shared media storage between review and installation requires another storage review.
- **Storage full or unavailable:** keep the page open and download the pack or source backup. Failed writes do not publish a partial installed index. Progress that cannot persist remains explicitly session-only and exportable.
- **Another player tab owns saving:** close that tab and reload this player. The writing lease prevents concurrent attempts from silently replacing one another. Progress export remains available.
- **Old edition versus update:** an edited pack has a new full SHA-256 edition identity. Installing it retains the previous edition's attempts, completion records and earned poster. Open the old edition to continue its attempt.
- **Missing bytes or invalid evidence:** restore the exact original pack, or regenerate the source and review a new edition. Uploaded success flags do not establish playability.

The current acceptance record distinguishes tested in-app browser behavior, isolated browser storage, modeled tests and unavailable engine checks. Physical mobile support is not claimed.
