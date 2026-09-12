# Round 04 — independent forward test of theme and level skills

Date: 12 September 2026. Tested the actual `xonix-theme-designer` and `xonix-level-designer` skill instructions against two realistic requests. This is an authoring usability exercise, not a game playtest. No images, example-pack edits or game code were produced. The only saved output is this evaluation.

## Inputs and exercised checks

Also invoked the actual validator on temporary **in-memory copies** of those examples, without changing files:

| Probe | Observed result |
| --- | --- |
| Atlas art direction changed to watercolor/archive; first reveal uses `style="illustration"`, second `style="photograph"`, both linear sampled | Pass; planned-asset/runtime warnings remain |
| First reveal uses invented `style="watercolor"` | Reject: style must be one of pixel-art, illustration, photograph, scanned-art |

The positive mixed-media probe checks representation, not a completed chapter. It does not certify art, rights, playable media or solvability.

## Request 1: Carpathian watercolor and archival-photo chapter

**Request:** “Make a Ukraine Atlas Carpathian chapter using watercolor and archival-photo backgrounds while preserving the existing capture game.”

**Proposed response:** Develop **Carpathian Water and Memory**, a calm discovery chapter with original watercolor landscapes and separately sourced historical photographs. Keep the golden-bird pixel overlay, existing board geometry and capture behavior. Do not regenerate photographs and call them archival records.

**Actions and artifacts I would produce in ordinary authoring:** adapt `authoring/examples/ukraine-atlas.pack.json` into a new proposed `authoring/drafts/ukraine-atlas-carpathians.pack.json`; write its theme brief and source ledger beside it. Those paths are proposed, not files created by this test. Use `references/theme-brief.md` and adapt `shared-14-image-pack`, `shared-10-contrast-review` and `shared-22-pack-review` from the prompt catalog.

| Planned image | Treatment | Research/provenance task |
| --- | --- | --- |
| Mountain morning | Original watercolor illustration, broad mist/forest masses, warm paper | Identify intended locality before writing a factual caption |
| Workshop light | Original watercolor of a Kosiv ceramic workshop | Distinguish observed Kosiv color/material references from invented composition |
| River and footbridge | Original watercolor, quiet central space for pixel threats | Identify locality or label fictional Carpathian-inspired scene |
| Carpathian album study | Actual archival photograph, preserved tone and original composition | Choose exact archive item and document creator/date/location and reuse evidence |
| People and place | Actual archival photograph with visible context | Obtain suitable item-level provenance; protect faces and documentary details from cropping |
| A remembered ridge | Actual archival landscape photograph if a suitable item can be sourced | Record uncertain dates/places as uncertain; do not invent attribution |

Primary research performed during the exercise: [UNESCO's Kosiv entry](https://ich.unesco.org/en/RL/tradition-of-kosiv-painted-ceramics-01456) supports its distinctive ceramic tradition, materials and green/yellow palette. The [Urban Media Archive's Ihor Kalynec collection](https://uma.lvivcenter.org/en/collections/83/photos) lists Carpathian photographs with identifiers and date ranges, making it a concrete source-discovery lead. No particular image was downloaded or cleared for game use; an archive listing is not permission or proof of suitability.

**Exact contract choices:** `theme.family="ukraine-atlas"`; watercolor maps to `revealArt.style="illustration"` (or `scanned-art` for an actual scan of physical work), never a new watercolor enum. Archive images use `photograph`. Set `sampling="linear"`, preserve source, begin with `fit="contain"`, and keep `cropApproved=false` until there is an actual crop review. Pixel gameplay continues with nearest sprite sampling. Source records stay `status="planned"` until actual files and evidence exist. Record watercolor technique in `artDirection`, asset `brief` and the companion brief.

**Rules preserved:** reuse `fill.keep-largest.v1`, `goal.coverage.v1` at the source's 0.6 target, `goal.capture-markers.v1` with two markers, existing enemy primitives and existing motion/life/timer settings. Keep 48×36 geometry, starts, blocks, marker coordinates and collision roles. The existing `flower` marker tag can remain an internal identifier while its visible description becomes a discovery medallion. No photo subject becomes a collider.

**Open production items:** choose usable archive originals; inspect images/crops at actual sizes; commission or generate watercolor drafts; verify overlay contrast and final runtime behavior. None blocks a truthful theme brief and planned draft pack. No new runtime primitive is required to represent these two media styles in the current contract.

## Request 2: ordered supplier reconnection with five levels

**Five-level proposal — all values are untested design parameters:** use a stable 48×36 board, source player start `(24,0)`, three lives, current player speed and `fill.enemy-seeded.v1`. Marker anchors A `(8,8)`, B `(36,26)`, C `(34,8)`, D `(10,26)` and E `(26,24)` are illustrative, separate from background imagery. Use existing enemy/effect primitives for the supporting challenge.

| Level | Required supplier sequence, pending extension | Learning beat and pressure |
| --- | --- | --- |
| 1 — First delivery | A → B | Teach the next highlighted supplier; one slow field bouncer, no timer |
| 2 — Opposite shores | A → C → B | Plan a return to safety before changing direction; retain enemy count/speed |
| 3 — Busy perimeter | A → C → B | Repeat the sequence with one boundary patrol; learn departure timing |
| 4 — Recovery route | A → D → C → B | Four stops; a separate optional captured marker can clear a named speed modifier |
| 5 — Connected city | A → C → E → D → B | Five stops; retain prior speeds and add a clearly communicated provisional timer |

Existing primitives suitable for supporting the design: `enemy.bounce-field.v1`, `enemy.patrol-boundary.v1`, `goal.coverage.v1`, `effect.clear-modifier.v1`, `modifier.speed-scale.v1`. A five-entry `campaign.levelIds` array with `progression="linear"` represents level order. These are still specified future behaviors, not a running challenge. No real supplier data or customer savings claim is needed.

**Bounded extension brief:** proposed ordered supplier objective, deliberately without assigning an accepted primitive ID. State includes required marker-ID order and current position. Trigger it from committed captures after fill, before goal evaluation. Recommended strict variant: each required supplier is captured on a distinct successful cut; capturing a future supplier early, including in the same cut as the current supplier, fails this challenge. Ordinary non-supplier markers do not affect order. This is a provisional design choice to review for fairness, not a hidden validator assumption.

The extension needs parameter validation for a unique bounded marker sequence, clear failed/succeeded evaluator states, a next-supplier indicator, documented same-tick ordering, and save/replay state. It must not change territory fill. Three acceptance cases: A then B across cuts succeeds; B before A fails with readable feedback; A and B captured in one cut yields the documented failure regardless of marker-array order. Save/reload midway must preserve the expected next supplier. If that strict rule proves frustrating, redesign it explicitly rather than silently accepting unordered captures.

**Blocker:** no sequence goal/failure state exists in the current schema/catalog/runtime. The skills correctly direct this toward an extension brief. Five-level design remains possible now; a complete executable pack matching the requested behavior does not.

## Skill usability findings

**Assessment:** both skills are usable for these requests after the now-resolved assembly gaps. Mixed-media authoring is representable; ordered suppliers is correctly exposed as new capability work. The main improvement is making template adaptation and source-versus-output preservation checks explicit.
