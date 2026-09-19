# Artwork for historical Team imports

Historical Team packs keep their existing closed gameplay format. Valid imports outside a registered exact-binding namespace receive the approved generic FPV Orchard scene through an explicit presentation policy. This association supplies scenery; it does not approve an imported level's design or certify its playability.

## Exact artwork contract

The code-owned `COOP_HISTORICAL_IMPORT_PICTURE_POLICY` in [Team picture bindings](../game/couch/coop-picture-bindings.mjs) has version `revealline-team-historical-import-picture.v1` and the following exact identity:

| Field      | Value                                                              |
| ---------- | ------------------------------------------------------------------ |
| Theme      | `fpv`, revision `32`                                               |
| Collection | `null`                                                             |
| Slot       | `scene.reveal.wide`                                                |
| Asset      | `scene.reveal.wide.field-kit`, revision `2`                        |
| Original   | PNG, 1152 × 576, 52,720 bytes                                      |
| SHA-256    | `53f1206a11a8791892f5c844c0641529acbc2c09c8d558676d0d801d72113850` |
| Display    | Complete frame, contain fit, nearest sampling                      |

The same existing derivative is already part of the presentation assets. This feature adds no new image bytes. That does not establish a successful offline cold start or public deployment; qualification must verify the actual manifest, cached dependencies, decoded image and selected imported pack.

Each attempt captures the complete validated pack and selected level, including their canonical content hashes, together with the exact theme, collection and asset identity. Historical string level revisions remain strings; numeric revisions retain their original value. Neither a matching name nor a matching ID alone grants artwork authority.

Every namespace present in the exact binding table stays closed. In particular, `relay-rescue-starter` must match an approved full pack/level binding. Changing names, revisions or other pack/level content while retaining that pack ID cannot borrow its image or fall through to the generic policy. Theme or collection mismatch, missing required artwork, changed bytes and decode failure require visible recovery; they do not select another picture.

## Import, recovery and play

Choose a compiled historical Team pack in the existing import control. Reading, validation and picture preparation acknowledge progress immediately. The selected pack and its prepared image remain retained until the replacement pack and image are ready and its setup is successfully adopted. Start remains a separate action.

**Stop waiting** cancels adoption of that import attempt and preserves the selected pack. A file read or shared presentation load may still finish internally; its late result cannot adopt the abandoned selection. **Retry pack** retries the retained import draft. Choosing another file, selecting an arena or restoring the built-in pack retires the old draft. A failed replacement keeps the previous selection available and presents recovery.

After a successful import, the lobby teaser, progressive reveal, result picture and earned-picture viewer use the accepted binding. The artwork is decorative: scenery does not create walls, safe ground, anchors or relay cores. Actual map cells, objectives and threat cues remain authoritative for both coverage and multiple-stronghold maps.

**Retry** rebuilds the accepted gameplay recipe and reuses its exact prepared artwork; inactive setup drafts do not choose a different picture. **Next** follows the retained pack's authored order, prepares a separate successor and checks its first paint before replacing results. Cancellation or failure keeps the preceding result available. Imported selections do not overwrite the built-in arena preference. See [Team ordered results](team-ordered-results.md) for continuation ownership.

## Format and qualification boundaries

`readCoopPack`, historical pack fields and historical level fields stay closed. Adding `picture`, `presentation`, a URL or embedded image fields to those records remains invalid. Custom artwork requires a separate versioned presentation envelope in future work; this policy does not introduce one. It also does not qualify other themes, collections or imported artwork.

Required checks include valid coverage and multiple-stronghold imports; string and numeric revisions; changed starter-namespace content; failed or cancelled replacement; late read/decode completion; Retry and Next ownership; full-frame reveal and objective readability. Exercise the actual production picture reader, not only an injected resolver fixture. Record modeled tests, native browser review, physical inputs, offline checks and public verification separately. This guide describes the implementation contract, not completion of those release gates or all of P08-A.

## Copyable maintenance prompt

> Qualify historical Team import artwork through the actual host and production picture reader. Preserve the closed pack/level schemas and the explicit FPV revision 32, null-collection policy for scene.reveal.wide.field-kit revision 2: 1152 × 576 PNG, 52,720 bytes, SHA-256 53f1206a11a8791892f5c844c0641529acbc2c09c8d558676d0d801d72113850. Keep exact whole-pack/level hashes and typed string/numeric level revisions. Prove changed starter-namespace content cannot use generic artwork. Hold a replacement read and decode, choose Stop waiting, retry, replace the draft and complete stale work; retain the prior pack/image until successful adoption and require separate Start. Earn an imported multiple-stronghold result, use Next to a coverage map, change inactive setup drafts, Retry and earn the result again. Verify accepted picture identity, authored order, no built-in preference writes and no automatic Start from recovery. Inspect light/dark scenery, obstacles and objective cues without changing simulation geometry. Preserve existing image bytes; report source tests, native review, physical devices, offline and public acceptance separately. Keep custom-art envelopes and other theme collections explicitly pending.
