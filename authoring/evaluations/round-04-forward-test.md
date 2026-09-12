# Round 04 — independent forward test of theme and level skills

Date: 12 September 2026. Tested the actual `xonix-theme-designer` and `xonix-level-designer` skill instructions against two realistic requests. This is an authoring usability exercise, not a game playtest. No images, example-pack edits or game code were produced. The only saved output is this evaluation.

## Inputs and exercised checks

Read both `SKILL.md` files and their brief templates, `authoring/CONTRACT.md`, the primitive catalog, relevant schema definitions, Atlas/Navi example packs and selected catalog prompts. The contract and prompt CLI were initially absent while the kit was being assembled; both subsequently appeared. The contract was read and `python3 authoring/prompt.py list --family cross-family` was executed successfully before finalizing this report. These were assembly timing issues, not remaining skill defects.

Executed `python3 authoring/scripts/validate_pack.py authoring/examples/ukraine-atlas.pack.json authoring/examples/navi-network.pack.json --mode draft --json`. Both passed. Atlas has 11 planned assets and Navi 10. Both reports explicitly warn that runtime primitives are specified, not implemented.

Also invoked the actual validator on temporary **in-memory copies** of those examples, without changing files:

| Probe | Observed result |
| --- | --- |
| Atlas art direction changed to watercolor/archive; first reveal uses `style="illustration"`, second `style="photograph"`, both linear sampled | Pass; planned-asset/runtime warnings remain |
| First reveal uses invented `style="watercolor"` | Reject: style must be one of pixel-art, illustration, photograph, scanned-art |
| Navi `completion.mode="sequence"` | Reject: mode must be all or any |
| Navi goal uses invented `goal.ordered-suppliers.v1` | Reject: unknown primitive |

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

**Request:** “Make a Navi Network challenge where the player must reconnect suppliers in a required order, with a five-level progression.”

**Proposed response:** Create the five-level design **Navi Network: Supply Chain**, while explicitly reporting that within-board supplier order is not expressible by the current contract. Its marker goal only counts captured markers; all/any goal composition and linear campaign order do not enforce a temporal supplier sequence. A counted-marker pack must not be presented as fulfilling this request.

**Actions and artifacts:** use the Navi example, `references/level-brief.md`, and an adapted `shared-15-challenge-author` prompt. Proposed outputs are a progression brief and a separate ordered-supplier extension brief under `authoring/drafts/navi-supply-chain/`. A draft of supported background/layout content could accompany those later, but the complete ordered challenge needs the extension. Do not add invented IDs to a pack claiming to pass the existing catalog.

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

1. **Good constraint handling:** both skills direct the agent to the actual catalog, distinguish specified from implemented behavior, support mixed reveal media, preserve geometry and forbid invented executable primitives. The negative probes confirm the validator reinforces those instructions.
2. **Prompt adaptation needs explicit priority.** `atlas-02-reveal-art` is hardcoded to Petrykivka and pixel clusters; `shared-04-style-painterly` specifies gouache and requires an existing inspected source. Neither is directly a new Carpathian watercolor prompt. Adapt medium/region or write a derived prompt and record the change; do not follow a mismatched template literally. The parent has been notified and is adding explicit adaptation guidance.
3. **Level prompt has scope drift.** `shared-15-challenge-author` prescribes six levels, named linked objectives, optional medals and a deterministic seed. This request asks for five levels; linked/ordered goals and automatic medals are not in the current contract, and a seed does not make a hand-authored level procedurally generated. The skill's catalog-first rule should be stated as overriding these prompt defaults.
4. **Several requested handoff details belong in companion briefs today.** Palette and reveal filtering have fields; source derivatives, atlas pivots, audio stems, detailed typography and reward animations do not all have formal fields. The theme template acknowledges this. Keep those as proposed asset briefs and do not add unknown properties merely to make the deliverable seem complete.
5. **Preservation needs a concrete review instruction.** The theme skill says keep rules independent and preserve topology/speed/collision, which is correct. A stronger reskin workflow would explicitly compare the source and resulting rulesets/geometry/entity positions so adaptation does not accidentally switch Atlas's largest-region fill to the military/Navi enemy-seeded fill.
6. **Validation wording is appropriately limited.** Draft success certifies structure and static semantics only. The skills explicitly require separate runtime/playtest checks; the exercise found no instruction implying a schema-valid draft is playable or fun.

**Assessment:** both skills are usable for these requests after the now-resolved assembly gaps. Mixed-media authoring is representable; ordered suppliers is correctly exposed as new capability work. The main improvement is making template adaptation and source-versus-output preservation checks explicit.
