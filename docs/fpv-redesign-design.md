# RevealLine — Pixel FPV Field Kit

Research and source-original links below open the versioned repository online. They are reference evidence, separate from this release’s playable assets and offline help.

Design specification and review atlas for the whole-game redesign. The selected production direction is **Pixel FPV Field Kit**: a complete original FPV presentation, supported by an extensible asset and theme framework. Ukrainian, Retro and Coupa remain future presentation collections; this redesign does not claim their artwork is complete.

Open the [interactive design atlas](../authoring/design-atlas/index.html) through the repository’s local server. It provides desktop, tablet and phone layout studies, alternative screen states, English/Ukrainian type specimens, a screen matrix, palette roles and reference comparisons. The studies are HTML/CSS illustrations, not gameplay. Their example scores, maps and objectives do not replace authored mission data.

## Evidence and direction

All 64 images in `docs/research/_xposed-reloaded_reloaded_examples/` were inspected: 48 level layouts across four packs and 16 menu, gameplay and result references. The title uses few actions and one strong image; the gallery combines artwork, level labels, medals and high scores; a bright active cut gives way to a quiet captured contour; results explain earned rewards and provide direct repeat actions.

The [official PlayStation listing](https://store.playstation.com/en-us/product/UP2538-CUSA28099_00-XPOSEDRELOADED01) describes picture exposure, coverage goals and pack progression. The [related Nintendo release](https://www.nintendo.com/en-ca/store/products/xposed-switched-switch/) supplies useful context but is not assumed to be mechanically identical. Existing [motion observations](https://github.com/mekhovov/revealline/blob/290aeb7ed4b31cb81271bea8a58f6fdef0734266/docs/research/round-07-reloaded-ui-motion.md) and [manual/still analysis](https://github.com/mekhovov/revealline/blob/290aeb7ed4b31cb81271bea8a58f6fdef0734266/docs/research/round-05-reloaded-stills.md) remain the evidence for temporal behavior and terrain meaning; new screenshots alone do not establish those rules.

Xposed combines smooth illustrations with pixel UI. Our chosen direction keeps its composition and attention hierarchy while unifying new artwork around original, restrained pixel FPV imagery. Do not copy its logo, sprites, music, pictures or proprietary control glyphs. Reference screenshots remain source research and are excluded from playable distributions.

The priority order is consistent everywhere:

1. Player center and unfinished cable.
2. Imminent threats, route restrictions and the current frontier.
3. Ability, pickup, objective and status information.
4. Revealed artwork, environment props and atmosphere.

## Shared visual system

- Use an ink/navy stage, restrained cyan navigation and boundaries, warm amber player/reward accents, coral danger, off-white reading text and muted secondary information. These are semantic roles; themes may replace their values without changing meaning.
- Use original recognizable quad silhouettes: compact frame, separate propellers, front camera and antenna. Keep the core, pivot, route connection and gameplay footprint unambiguous. Decorative components never change collisions.
- Use stepped edges, crisp brackets, short dividers and patterned terrain. Reuse them across title, missions, dialogs, HUD, authoring and recovery states. Avoid dashboard card density in player flows.
- Handjet provides large square display lettering; Exo 2 provides UI and reading text; IBM Plex Mono provides stable numbers, bindings and technical metadata. Use the shared local Field Kit font/token files and [typography specification](fpv-typography.md). The entire Ukrainian alphabet, including Ґґ Єє Іі Її, must render without missing glyphs or shape mismatches.
- Start from 18 px reading text, 16 px controls and 14 px secondary text; large pixel display begins at 40 px. The atlas’s small annotations are review labels, not production HUD size recommendations. Standard and Large text are supported layout modes, not browser zoom substitutes.
- Keep scanlines, noise and glow off text, active paths and fine boundaries. Reduced effects retains every meaningful state without camera shake, large flashes or excessive particles. No cosmetic signal readout should imply a gameplay mechanic that does not exist.

## Screen and interaction contract

The atlas’s 32-row matrix is the working screen inventory. Its “Study” and “Planned” statuses describe the new visual treatment; existing game features are not treated as newly implemented merely because a mockup represents them.

| Journey                      | Required behavior                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch and title             | One primary Continue/Deploy action. Continue names the saved campaign destination and appears only when that destination exists. Do not imply an unsupported mid-flight save. Missions, Collection and Settings are secondary.                                                                                       |
| Mission gallery              | Artwork-led cards, level names, medal conditions/progress and personal best. Three columns on desktop, two on tablet, one on small phones. Six visible desktop cards are a viewport, not a pack limit; preserve selection/scroll after preview or play. Unrevealed pictures and locked missions are separate states. |
| Mission preparation          | A compact summary of selected craft, difficulty and actual objectives, with optional changes. Detailed preparation is available before deployment, but Retry reuses the same setup. Next carries forward compatible choices. Speed medals and true failure timers have different labels.                             |
| Arena                        | Stable lives/coverage/score/timer grouping with actual class/ability state. A fixed simulation grid across resizing and device changes. A bright player center and unfinished cable remain readable over every background and during every effect.                                                                   |
| Pause, help and confirmation | Conceal gameplay, artwork and actors completely with an opaque pause surface; stop simulation; focus Resume. Settings and Field Guide return to the paused session. Destructive restart/leave behavior retains existing confirmation rules and avoids accidental double activation.                                  |
| Results and collection       | Present earned territory, revealed artwork, explained medals and score as distinct rewards. Make Retry/Next directly available; finishing an animation must not activate the next action. Picture preview restores the same gallery selection.                                                                       |
| Supporting destinations      | Hangar, story, scores, achievements, mastery, optional worlds, replays and controller practice share frames, controls and focus vocabulary. Couch Play belongs under play mode/Missions; Saves under Settings; Field Guide is available during preparation and pause.                                                |
| Workshop                     | Group asset, sprite/rig, level, enemy, image, motion, viewport, production and prompt tools behind a named Workshop entry. Preserve their functionality and give them the shared type, control and state system. Player menus do not expose a wall of tool links.                                                    |
| Recovery and platform states | Loading, empty, unavailable, offline, stale release, download progress, failed import, invalid content, lost controller/focus, native safe areas, credits and version history all receive the same visual treatment and clear actions.                                                                               |

The title study includes a secondary Workshop route for review; production routing must retain source-only tools only where they are actually available. A compiled atlas may retain official reference links, but must not request or bundle the local Xposed captures.

For each control or component, cover default, hover, keyboard/controller focus, pressed, selected, disabled, busy and error states where applicable. State is conveyed by shape/outline plus color and readable text. Device prompts reflect active bindings. Touch image preview uses a tap/toggle; a hold may remain an optional controller shortcut.

On small screens, reflow information before reducing text size. Touch controls sit outside playable cells and above platform safe areas. A short landscape phone must show the complete arena, critical HUD and controls together. Avoid a sticky mission footer that covers cards or becomes an extra vertical panel. The gallery study intentionally shows only the first viewport; production requires reachable paging/scrolling and selection restoration.

## Asset and theme framework

Every replaceable visual, font, audio item and coordinated collection has a stable semantic slot and a discoverable record. The record connects its current asset, exact specification, description, source/license/provenance, preview contexts and a copyable AI brief. Required geometry, frame order, state names and filenames come from that record; prompts do not invent them.

Each asset family needs native-size, enlarged and in-context previews. Relevant requirements include dimensions, format, transparency, palette roles, pixel grid, pivot, bounds, rig/animation contract and maximum footprint. Screen UI, controls, terrain, every registered player/enemy role, abilities, particles, backdrops, mission thumbnails, story/collection artwork and audio belong in the same inventory.

The admin flow is **inspect → upload/edit → validate → preview draft → apply/export**, with an explicit revert route. Preserve the source when cropping. Small single-layer sprites up to 128 px can be edited directly; larger artwork uses upload/crop/metadata tools. Rig and animation editing must respect existing runtime contracts rather than turn this phase into a general illustration editor. Invalid files retain the current asset and explain the failed requirement.

Coordinated replacements apply atomically: validate the collection and all required members before changing any current asset. A collection brief carries a shared style/palette/lighting contract plus exact per-slot outputs. Support later theme collections without mixing presentation and gameplay rules. The initial FPV collection is complete only when every registered role and surface has coverage, including alternate states, error states and reduced-effects variants.

AI skills and example prompts cite the current style/slot contract, explain native-size review and preserve source metadata. Refresh examples alongside the release that changes those contracts. Do not claim an AI-generated candidate is approved simply because it loaded.

## Phased delivery and acceptance

| Phase                       | Reviewable outcome                                                                                                      | Acceptance gate                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Atlas and font sources  | This original review atlas, evidence links, screen inventory, selected fonts/provenance and design specification.       | Original mockups clearly labeled; all controls usable; desktop/phone layout review; Ukrainian font coverage; no Xposed art in distribution.                 |
| 1 — Shared foundations      | Font roles, semantic tokens, shared controls, Standard/Large text and focus treatment integrated across existing pages. | Existing navigation remains usable; real minimum-size text and Ukrainian specimens verified; no hidden controls or unintended overflow.                     |
| 2 — Game shell and journey  | Title, mission/gallery flow, preparation, pause, results and supporting screens rebuilt around the same system.         | Complete input journey with mouse, keyboard, touch and controller; preserved selection/saves; immediate repeat flow; consistent recovery states.            |
| 3 — Asset framework         | Registry, previews, exact briefs, local upload/edit, validation, draft/revert and atomic collection handling.           | Single and collection replacement exercised; invalid assets leave current content intact; originals preserved; prompt requirements match runtime contracts. |
| 4 — Complete FPV collection | Original production art, role/state sprites, terrain, HUD/control assets, effects, world art and audio treatment.       | Every required slot covered; native-size and context review; no collision/appearance drift; dense board, reduced effects and phone readability checks.      |
| 5 — Whole-game verification | Every inventory surface and state receives visual/input review, including couch, tools, offline and native edges.       | Source tests plus actual browser/device journeys; screenshots from the real game; source/archive/Pages release identity verified.                           |

These phases describe future completion gates, not work already shipped. The parent execution plan may split them into smaller releases to keep changes reviewable. Each completed phase/feature receives its own related-hunk commit, game version bump, updated prompts/skills and release evidence; then push and deploy the matching GitHub Pages release for testing. Do not commit unrelated working-tree changes or use a version bump as evidence that the redesign is complete.

The atlas itself is a review artifact. Its interactions change only local DOM presentation; they do not import the game engine, write saves, apply assets or produce campaign progress. Test its screen/state switches, viewport controls, bilingual specimens, inventory filters, prompt-copy fallback and unavailable-reference behavior. Final production acceptance always uses the actual game, not a successful atlas screenshot.
