# Round 05 — prompt adjustments from gameplay inspection

Date: 12 September 2026. These changes refine the existing authoring templates; they do not implement new game behavior or produce assets. The catalog still contains **56 templates**. All IDs, modes, variables, reference requirements, status fields, families and existing variations are preserved. Only the prompt text of the 17 records below changed.

## Evidence that changed the guidance

The [legacy observation audit](../../docs/research/round-05-legacy-observations.md) directly inspected 32 timestamped Xonix/Super Qix video frames and public SeXoniX images. Xonix separates open-field hazards from enemies crossing captured land. Super Qix shows internal boundary traffic and a full-artwork reward while the recorded capture remains below 100%. SeXoniX supports the established decision to separate photographic artwork from arcade markers.

New direct Reloaded manual evidence resolves several earlier uncertainties. At 00:55 in [Lord Parker's settings/gameplay video](https://www.youtube.com/watch?v=SKKvpZ2DvUY&t=55s), the manual distinguishes walls blocking both sides, player-only slow terrain, player-lethal fields that do not affect enemies, line patrols, exposed-ground movers and an enemy that destroys exposed fields. See the [captured manual frame](../../docs/research/evidence/round-05/reloaded-manual-0055.png). The [source inventory](../../docs/research/round-05-xposed-source-inventory.md) retains edition boundaries and distinguishes earlier textual leads from direct footage evidence.

These references inform proposed design roles. Their existence in an old game does not make them supported by our framework. The current [primitive catalog](../schema/primitive-catalog.json) specifies a field bouncer and an **outer-border-only** patrol; interior-contour movement, revealed-ground roaming, erosion and local slow/lethal terrain need explicit extensions unless subsequently registered. Even registered primitives are not yet implemented.

## Exact records changed

| Prompt ID | Before | After and rationale |
|---|---|---|
| `fpv-04-enemies` | Generic pursuer, perimeter patrol, stationary emitter and sweep sheet. | Four distinct moving domains: field bouncer, changing-contour patrol, revealed-ground crawler and telegraphed territory eroder. Corrects unregistered homing assumptions; preserves fictional invading military identity and distinguishes painted vehicles. Adds separate wall/slow/lethal symbols. |
| `atlas-04-enemies` | Ink/knot/chip/ribbon roles with generic movement. | Maps ink, thread, dust and unraveling forms to four distinct domains. Keeps cultural subjects separate from hazards and uses material colors without imposing neon. Adds terrain semantics. |
| `retro-04-enemies` | Generic field/perimeter/emitter/sweep roles. | Uses glitch/spark/disk-error/dropout shapes for the four movement/erosion roles. Explicitly supports muted DOS palettes as well as neon. Adds terrain semantics. |
| `navi-04-enemies` | Duplicate/bottleneck/emitter/cloud obstacle sheet. | Uses duplicate records, bottlenecks, rework tickets and scope leaks for the four roles. Preserves friendly process-friction imagery; adds no military theme or real business claims. Adds terrain semantics. |
| `fpv-05-ui` | Field-controller frame and module cards. | Adds a separate teaching-key study for movement domains and three terrain meanings, without crowding the active arena. Claimed ground is not universally safe. |
| `atlas-05-ui` | Illustrated-atlas collection UI. | Adds the teaching-key study and a proposed full-artwork victory/gallery inset with the actual capture score kept separate. |
| `retro-05-ui` | Fictional software-shelf collection. | Adds the teaching-key study and the same proposed gallery/score distinction in the existing retro vocabulary. |
| `navi-05-ui` | Business-friendly game panels and value-points icon. | Adds the teaching-key study and domain distinctions while retaining the restrained business palette and separate real text. |
| `fpv-06-capture-fx` | Local signal closure and reduced-motion storyboard. | Adds a separate proposed victory/gallery inset. Regular cuts retain their exact fill geometry; full artwork is a reward, not a fictitious 100% capture. Replaces universal-safe boundary wording. |
| `atlas-06-capture-fx` | Material-specific local closure keyframes. | Adds full-artwork victory guidance while keeping the three traditions and capture geometry distinct. |
| `retro-06-capture-fx` | Local checker reveal and quiet boundary. | Adds complete-picture reward guidance with the actual percentage retained and ordinary cuts unchanged. |
| `navi-06-capture-fx` | Local connection reveal and illuminated workshop. | Adds the same gallery/score separation and replaces universal-safe route wording. No business metric is fabricated. |
| `shared-10-contrast-review` | General player/trail/enemy/objective contrast review. | Tests movement domains, internal contours, erosion warnings, wall/slow/lethal symbols, decorative-object confusion and honest victory percentages. Missing fixtures remain untested. |
| `shared-14-image-pack` | Twelve planned images with gallery captions and difficulty pairings. | Separates active-play coverage from proposed full-artwork gallery reward; optional mastery no longer needs to withhold the base image. No unsupported pack fields are invented. |
| `shared-15-challenge-author` | General closure, route, marker and mastery variations. | Prioritizes spatial lessons, domain combinations and explicit fill predictions. Adds distinctions for touch versus enclosure, local terrain, erosion, life-loss progress, delayed trail strikes and gallery reward as supported rules or extension proposals. |
| `shared-18-menu-state-kit` | Complete UI-state inventory. | Adds victory-to-gallery, accurate percentage/time/life records, immediate replay/next, optional mastery, role teaching and explicit failure/respawn feedback proposals. |
| `shared-22-pack-review` | Structural, asset and visual validation. | Audits domain claims against the registry, terrain semantics, gallery-versus-capture truthfulness and unsupported behaviors leaking into valid pack fields. |

## Guardrails that remain explicit

- The same fill-blocker symbol applies only to roles selected by the fill policy; movement alone does not imply a blocker.
- Interior-contour patrol is not silently bound to `enemy.patrol-boundary.v1`.
- Solid wall, player-only slowing terrain and player-lethal terrain are separate roles; ordinary walls are not damaging.
- Artwork style and theme stay independent of collision logic. FPV military imagery remains specific to FPV packs; Coupa retains process-friction metaphors.
- Full artwork on victory is a proposed presentation behavior. Until supported, it belongs in the design brief, not invented schema fields. The actual captured fraction stays unchanged.
- Image concepts do not prove sprite readiness, movement behavior, input quality, runtime events or device usability.

## Verification performed

A structural comparison against the pre-edit catalog confirmed **17 unique prompt-text changes**, **56 preserved templates**, and unchanged non-prompt fields for every record. Placeholder names exactly match each record's original variable list. All **56 templates rendered successfully** through `authoring/prompt.py` using representative text substitutions, with no unresolved placeholders. No image/audio generation, runtime test or gameplay validation is claimed for this prompt revision.
