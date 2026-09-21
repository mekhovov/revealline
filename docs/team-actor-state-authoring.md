# Team actor-state authoring

This P04/P08 feature connects optional Team body-state assets to the local Studio, the real Team painter and the game presentation loader. It does not ship a new reviewed artwork collection or change Team mechanics.

## Prepare and edit

1. Open Workshop → Asset Studio with a verified release collection.
2. Choose **Prepare Team actor slots**. It registers 32 optional contracts and seeds missing bindings in the selected theme from its current real actor images. Existing bodies, themes, artwork and player saves remain intact. Source-only recipe defaults cannot supply these images.
3. Search by role or state. Each player has compact 32×32 and detailed 64×64 slots for normal, cutting, downed, crawling, rescuing and recovery. Hunters have patrol, warning, charge and recovery slots; drifters have one slot; relay cores have shielded, exposed and secured slots.
4. Read requirements and copy the generated variation/edit/collection prompt. Upload a replacement or edit its sprite. Retain provenance and exact prepared geometry, including runtime motor hubs. Validate and stage the replacement.
5. Choose Field context → Couch Team. Compare First Connection and Relay Yard in applicable scenes. State/treatment messages distinguish a displayed asset from an inactive selection. Native size always inspects the selected bitmap. Crawling requires observed displacement; a held downed frame cannot prove it. FPV is currently the only edition with approved Team preview arena bindings.
6. Save a local revision or export `.rltheme`. Undo/Redo/reset manage the draft; removed slots are removed from collection prompt selections. Import supports the complete known 32-slot contract without changing historical records. Conflicting, incomplete and unknown additions fail before adoption.

Preparing contracts does not force later themes to reuse the first theme's artwork. A selected theme with missing Team bindings can prepare its own starting bodies, provided its shared sources are real images. Templates append new asset revisions. Existing Team bindings are retained. This authoring capability does not establish another edition's runtime compatibility.

## Runtime and publication

Themes without Team overrides retain their shared actor path. With overrides, the Team adapter selects by actual role and observed state, using the responsive compact/detailed treatment. Prepared images and their pivots/rotors are shared resources; the adapter never advances or writes the simulation. Number/shape identity, contact rings, warning labels, rescue progress and objective cues remain runtime-owned overlays.

The host loads declared Team images by exact hashes and deduplicates matching files. A declared image that is unavailable or malformed cannot silently fall back. Snapshot replacement remains atomic. Both Studio arenas prepare all declared state dependencies, even when a state is inactive in that arena.

The 32 seeded assets are explicitly **source**, not reviewed. Export is allowed for unfinished authoring. If a selected publication uses any Team actor override, the release declaration gate requires all 32 states and their nonempty review evidence. Passing this gate does not prove visual quality; actual art/state review and the phase's device, compatibility and public-play gates still apply. Older optional procedural sources remain valid.

This feature changes runtime presentation source and therefore requires coordinated production recipe review/reproduction on the final integrated source. Do not change frozen old release bytes or silently rewrite `base@1`.

## Remaining coverage

Anchor availability/capture, emitter warnings/sparks, Support pulses, rescue progress, joint capture and recovery effects still use their existing procedural cues. They need separate explicit editable contracts. The full theme benchmark, reviewed distinct state artwork, additional editions and full cross-mode acceptance remain separate requirements.

## Maintenance prompt

> Extend or repair Team actor authoring using the known optional contracts. Preserve every existing slot, asset, theme and collection record; select exact revisions. Exercise Prepare, collection prompts, Undo/Redo/reset, selected-theme preparation, save/reload and byte-preserving bundle export/import. Reject partial or conflicting contract imports and unreviewed publication. Inspect both real Team painters with active and inactive state messages, preserve previous snapshots on broken declared assets, and compare deterministic Team checkpoints. Record native browser evidence separately from modeled canvas/input tests and physical devices. Update the guide, prompts and release evidence against the integrated committed source.
