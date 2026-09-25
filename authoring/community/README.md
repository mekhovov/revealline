# Create and recover a community game candidate

Start with the [beginner creator guide](index.html), the [single-picture walkthrough](image-campaign-guide.md), or the Phase 2 [batch campaign walkthrough](batch-image-campaign-guide.md). The single-image creator provides generation, review, portable `.rlpack` files and installed Custom gameplay; [its acceptance record](phase1-acceptance.md) tracks verification and public release separately. Batch creation remains an implementation candidate with [its own open acceptance gates](phase2-acceptance.md). The [framework reference](framework-reference.md), [maintainer guide](maintainer-guide.md), and [phased delivery register](delivery-plan.md) distinguish released behavior from mixed-media and community-store work. The historical manual trials below retain their original scope and identities.

The [combined creator feature acceptance record](combined-release-acceptance.md) is the current
source and release authority for the consolidated implementation. Individual phase records remain
supporting evidence and do not imply separate releases.

The [video campaign review guide](video-campaign-guide.md) documents the Phase 3 mixed-media review contract, exact pairing corrections, poster choices, playback ranges and optional post-win story behavior. The main creator flow now persists those exact dependencies before approval; the [Phase 3 acceptance record](phase3-acceptance.md) separates completed browser evidence from the remaining player-story and release gates.

The account, resumable upload, exact validation, automatic catalog publication, report and
unlisting service is documented in the [Phase 4 acceptance record](phase4-acceptance.md) and
[`services/community/README.md`](../../services/community/README.md).
The [Phase 5 community-store acceptance record](phase5-acceptance.md) documents the integrated
client candidate, exact immutable install/update/offline behavior, reference-aware recovery
removal, and the remaining hosted-production gates.

The [optional media editor guide](media-editor-guide.md) documents the bounded Phase 8 slice:
playback ranges, evidence-backed decoded-frame stepping, and verified physical trimming for a
single silent AVC/H.264 MP4 track. [Its acceptance record](phase8-acceptance.md) preserves the
explicit limits: audio-bearing, WebM, non-AVC, and multi-track inputs are not physically trimmed.

This is a tested local authoring guide for Reveal Line. It covers a small mission project and a separate editable presentation collection. It does not claim that a finished DroneAid/community edition, catalogue installer, or public release has already been produced.

Use [Content Studio](../../game/studio/index.html), [Asset Studio](../asset-studio/index.html), and the [copyable community prompts](../prompts/community-creation.md). Start from the [example project](example-project.json) when reproducing this guide. It is a small greybox with Solo/Versus support, not a finished campaign.

The browser trials used exact source checkpoints `eab879c`, `a840a5e6`, `86618bfc` and `499d716e`. The later integrated candidate `dceafec3` contains the crop and geometry-review safeguards; its native Studio checks reconfirmed both. Source verification and public release acceptance remain separate. Check the [execution register](../../docs/cross-mode-execution.md) for delivered versions; do not infer publication from this guide.

## What each tool produces

| Tool or file                     | Purpose                                                                              | What it does not do                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Content Studio                   | Maps, missions, campaign/pack ordering, rules and local checkpoints                  | Publish content or certify playability                                         |
| Content Studio **Export backup** | The current `ContentProjectV1` JSON snapshot                                         | Include all local checkpoint history or the complete presentation media bundle |
| Asset Studio                     | Asset replacement, pixel edits, geometry, provenance, immutable presentation history | Change mission mechanics or player saves                                       |
| Asset Studio `.rltheme`          | Validated presentation records and retained original/derivative bytes                | Automatically make the public game use the theme                               |
| Content CLI                      | Shared compiler output, mode/preset resolution and authored pacing diagnostics       | Approve art, difficulty, offline readiness or public release                   |

Use a desktop keyboard/pointer and file chooser for this authoring workflow. Ordinary players should use the game's compatible-content browser; authoring imports are not normal campaign installation.

## 1. Create a small playable project

For an exact repeatable starting point, use **Inspect import** on `example-project.json`, inspect the source, then **Apply inspected source**. To practice creating it yourself, follow the steps below. Keep an export of any existing project before using the same ID. Copy the example and choose a new project ID for a different community; IDs are machine identities, while names are player-facing labels.

1. Open **Content Studio** from Workshop. Choose a unique local project ID, for example `community-guide-qa`, and choose **New project**.
2. Inspect the staged starter source, then choose **Apply inspected source**. Confirm the URL/project selector shows your project and the save status names a checkpoint.
3. Open **Organize missions, campaigns & packs**. Choose Campaign → Rename, select Horizon School, enter **Community Pilot**, then **Validate & apply structure**.
4. Choose **Save checkpoint / retry**. Confirm the campaign summary changes. Record the resulting checkpoint number; do not assume another workspace uses the same numbers.
5. Choose **Play exact Solo preview**, then **Start mission**. The starter's island provides a safe first exercise: travel down from the starting boundary to the reclaimed island. Our native trial closed a legal line at 0.6% coverage and 140 practice score with all three lives retained.
6. Press Escape to pause; Resume stays explicit. **Close preview** returns focus to the Play opener and retains the project. Reload and confirm the saved campaign remains.

This starter is a greybox. Its disconnected-foundation and missing-background warnings are meaningful authoring diagnostics, not proof that it is a finished community mission. Add one deliberate route decision at a time; record the lesson, threat, counterplay, mastery opportunity and playtest findings before expanding the campaign.

## 2. Recover an earlier checkpoint safely

1. Enter the desired checkpoint and choose **Inspect saved**. The currently accepted workbench should remain unchanged while inspected source appears in the editor.
2. Choose **Apply inspected source** only when the inspected project is the intended one.
3. Save. Restoration creates a newer checkpoint; it does not erase the intermediate history. Our trial restored checkpoint 1 as checkpoint 3, then restored checkpoint 2 as checkpoint 4.
4. Inspect a newer historical checkpoint again to confirm it remains reachable.

Checkpoint numbers are local history. They are not the immutable project revision or a public game version.

## 3. Export and restore the mission project

1. Choose **Export backup** and verify the actual downloaded JSON exists. The UI says download requested because the browser owns the final download.
2. In another workspace, choose **Inspect import** and select that JSON. Inspection must not immediately replace the accepted draft.
3. Choose **Apply inspected source**, then **Save checkpoint / retry**. Reload to verify restoration.
4. Export the restored project again and compare the bytes. The guide fixture produced identical 1,773-byte files, SHA-256 `4a5290829dff769cc22bb3d383625cf8812fd8127dab96f8ac5e1dab870198e1`.
5. Test rejection with a separate malformed copy, never by altering your only backup. Our invalid-identity fixture left Apply disabled and preserved the accepted project.

A clean workspace begins new checkpoint history from this imported snapshot. Keep the source originals and theme bundle separately; the project JSON is not an all-media backup.

## 4. Create a presentation candidate

1. Open **Asset Studio** and wait for the release collection to load. Search for a stable slot ID; the guide trial used `hud.life`.
2. Read its exact dimensions, transparency, sampling, usage and geometry contract. Slot requirements belong to that element; an icon, actor body, illustration and font have different constraints.
3. For a small raster, open **Pixel editor → Edit current raster**. Arrow keys position the cursor; Space applies the tool. Exercise Undo/Redo before proceeding. Our test added one corner pixel solely as a QA fixture; it is not proposed production art.
4. Choose **Prepare edited sprite**. Alternatively use **Choose replacement file** to upload an original, set its crop, then **Prepare derivative**.
5. After changing any crop field, prepare again. Invalid crops and valid but unprepared changes must not stage old pixels. If preparation fails, correct the fields and explicitly prepare before continuing.
6. Enter actual Creator, Source, License/rights and the effective generation/edit prompt. Keep community branding provenance separate from gameplay mechanics. Do not invent authorship or rights from a generated image.
7. Choose **Validate and stage replacement**, inspect the comparison, then **Save local revision**. Reload and check the selected revision.
8. Metadata edits retain image bytes but create a new produced candidate with empty review evidence. A changed pivot, rotor layout or nine-slice needs its own review. The approved original stays intact in history.

For generated alternatives, use the selected slot's **AI prompts** and preserve its effective contract: dimensions, alpha, palette, silhouettes, anchors, dependencies, output names and actual-size checks. A candidate is technically prepared before it can be visually reviewed; copying a prompt or passing a decoder never grants review approval.

## 5. Transfer a theme and restore its original

1. Export the actual `.rltheme` file. Keep it with your project JSON and source originals.
2. In a clean Studio workspace, choose **Import collection**, select the bundle, wait for complete validation, then save.
3. Re-export and verify retained payload hashes. Our test retained all 128 payloads exactly. The complete bundle differed because imported records were correctly namespaced and their history changed; whole-file equality is not the right test for a presentation adoption.
4. Open **Asset revision history**, locate the exact approved original and choose **Bind this revision**. This stages another immutable theme revision.
5. Exercise Undo/Redo, save and reload. Both the edited candidate and approved original must remain in history.
6. A corrupted bundle must fail before adopting anything. A one-byte-corrupted payload produced a hash-mismatch error in the native trial and left the accepted saved collection unchanged.

Do not use **Record reviewed revision** merely to remove a warning. Review the actual affected screens, supported modes, native-size rendering, contrast, motion and accessibility; record the checks you actually performed.

## 6. Recover when two tabs disagree

1. If Save reports that another tab changed the draft, keep the unsaved tab open.
2. Choose **Export .rltheme** in that tab, verify the actual download, and retain it. Our exported manifest kept the stale tab's distinct unsaved description.
3. The Studio's **Reload saved** refuses to silently discard staged work. Once the export is safe, choose **Reset to saved**, then **Reload saved**.
4. Confirm the other tab's accepted revision is now loaded. Recover or combine the exported work through a separate deliberate import/review step.

This is conflict protection, not an automatic merge. The native trial proved that an older tab could not overwrite the accepted newer revision, and that its own work remained exportable.

## 7. Check the project through the shared CLI

From a checkout of the exact source being qualified, run the following against the supplied example. Substitute your downloaded project filename for your own project:

```sh
node scripts/compile-content-project.mjs authoring/community/example-project.json --check
node scripts/compile-content-project.mjs authoring/community/example-project.json --mission nearby-shore --mode solo --difficulty gentle
node scripts/compile-content-project.mjs authoring/community/example-project.json --mission nearby-shore --mode solo --difficulty standard
node scripts/compile-content-project.mjs authoring/community/example-project.json --mission nearby-shore --mode solo --difficulty expert
node scripts/compile-content-project.mjs authoring/community/example-project.json --mission nearby-shore --mode versus --difficulty gentle
node scripts/compile-content-project.mjs authoring/community/example-project.json --mission nearby-shore --mode versus --difficulty standard
node scripts/compile-content-project.mjs authoring/community/example-project.json --mission nearby-shore --mode versus --difficulty expert
node scripts/compile-content-project.mjs authoring/community/example-project.json --journey --pack opening --mode solo --difficulty standard
node scripts/compile-content-project.mjs authoring/community/example-project.json --pacing --pack opening --mode solo
```

All commands above passed for the guide fixture on Node 20.19.5. Gentle/Standard/Expert resolved to 5/3/2 lives; each preset retained the same simulation identity across Solo and Versus. The check deliberately reports `readyForRelease: false`, and pacing reports authored ratings rather than measured enjoyment or route quality.

The starter declares Solo and Versus only. Requesting `--mode team` fails with **Mission does not support this mode.** Author and qualify a compatible Team mission; do not relabel a Solo result as Team evidence. Studio's Team test export is a separate geometry/rules workflow and must retain its stated artwork limitations.

## 8. Export and test a Team mission

This additional native trial uses exact source `499d716e` and the bundled **Inspect Team Signal greybox** action. Inspect first, then **Apply inspected source** to accept the separate Signal partners project. The current project remains unchanged during inspection.

1. Select **Shared detour** and the intended Gentle, Standard or Expert preset. Read the terrain warnings and both spawn locations.
2. Choose **Export exact Team test mission** and retain the actual `shared-detour-<preset>-team-test.json` download. This is geometry/rules only; it does not carry the authored mission picture or grant Journey awards.
3. Open the linked **Team test player**. Expand **Play a created co-op pack**, then **Open a Team pack or artwork bundle** and choose the downloaded file.
4. Wait for **Imported Team picture ready** and the Shared detour selection. Verify the locked Challenge matches the exported preset, then choose **Start together**. Our three exports started with 4/2/1 reserves for Gentle/Standard/Expert respectively.
5. On Standard, steering Sunflower upward from its foundation created a legal 0.4% capture without losing reserves. Pause, cancel Retry with **Stay**, then deliberately retry. Stay preserves the paused attempt; confirmed Retry resets the same mission.
6. For recovery testing, use a disposable malformed copy. A width-zero pack was rejected visibly, retained Shared detour and left Start available. A subsequent valid import recovered normally.

All three actual downloaded files matched the shared compiler using the Studio's `campaignTheme: true` candidate option. These checks prove export/import and basic play, not a complete clear, fairness, custom Team artwork, physical controls or public/offline readiness. The Team mission preset is fixed by its export: choose another preset in Studio and export again rather than expecting the player to rewrite authored rules.

## 9. Brand the community without changing its mechanics

Write a short edition brief before replacing assets: community name and rights holder, authorized source links, palette, ornament rules, player roles, threat meanings, supported modes, language requirements and content framing. For DroneAid, keep the requested Support/Combat framing explicit; do not assume all community imagery or missions use combat. For cultural, retro and spend-management editions, explain hazards using their own visual language while retaining readable warning/counterplay cues.

Resolve each slot from the selected theme and collection. Replace actors, HUD, terrain, effects, objectives, reveal pictures and audio through their respective contracts. Keep player number/shape cues and warning contrast across every palette. Translate UI through real text; do not bake labels into images. A logo, palette change or alternate picture alone is not a complete game theme.

Begin with one reviewed Solo/Versus mission and one compatible Team arena. Inspect actual previews and runtime renders before expanding. New reveal pictures receive new revisions; Retry, saved flights and earned originals keep their accepted pins. Never replace old records in place to make a new community look complete.

## 10. Prepare the release handoff

The preceding local workflows are tested. The following acceptance remains open for a finished community edition:

- Complete original/authorized community branding, artwork, actors, audio and exact presentation bindings; no required source recipe or placeholder is counted as finished.
- Qualify every advertised mode and difficulty with real routes, fair warning/counterplay, progress/Retry/Next and appropriate multiplayer objectives.
- Inspect shared components, fonts, global preferences and all affected screen states, including portrait/landscape, keyboard, touch and physical controllers separately.
- Verify the actual catalogue installation, all pinned offline dependencies, recovery/export/import and unchanged historical ownership.
- Update version, source documentation and prompts; run all six release gates plus applicable build/production/artifact checks on the exact committed source.
- Freeze and publish through the existing release coordinator; verify the actual deployed bytes and play the public routes before accepting delivery.

A browser upload changes only the local authoring workspace. It does not install a campaign for ordinary players, alter a public edition, or close the complete community-guide phase.
