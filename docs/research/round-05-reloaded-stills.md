# Round 05: Reloaded stills, terrain semantics and visual readability

Research date: 12 September 2026. This supplements the [earlier six-image inventory](xonix-and-xposed.md), using newly inspected in-game instructions to distinguish visual motifs by their actual roles. Motion, fill timing and enemy behavior over time belong to the separate motion audit.

## Verified vocabulary before interpreting the stills

The following comes directly from the newly inspected in-game manual frames, rather than color-based guesses:

| Visible mark | Meaning stated in the manual | Design consequence |
|---|---|---|
| Repeated small blue symbols, with dark gaps | Slowdown field: slows the player; enemies ignore it. | A traversable region with unequal movement cost. It is not a wall. |
| Repeated red X-shaped marks | Death field: player contact is fatal; enemies are unaffected. | A route restriction for the player, not a projectile/enemy barrier. |
| Dense cyan square tiles with a dark grid | Wall: neither player nor enemies can pass. | A solid barrier that affects traffic on both sides. |
| Cyan spiked badge with a bright central pattern | On-line enemy: patrols lines. | New internal capture contours can be threat routes; safety cannot be communicated merely as being near a line. |
| White ring with pink/red center | Exposed enemy: wanders on exposed fields. | Reveal state does not guarantee freedom from every threat type. |
| Large magenta diamond | Big enemy: destroys exposed fields. | A distinct large silhouette communicates an enemy that changes territory. |

Evidence: [manual at 00:45](evidence/round-05/reloaded-manual-0045.png) and [manual at 00:55](evidence/round-05/reloaded-manual-0055.png). The images establish these categories but not speed multipliers, collision radii, turn rules, or reclaiming rates.

## Official stills revisited with those meanings

All six numbered files below were visually inspected after successful rendering. They are browser screenshots of the official image pages, provided by the parent research task. Their source mapping is in [official-still-sources.json](evidence/round-05/official-still-sources.json); it points to the same six Sony-hosted source images in the earlier inventory, so the source list is not duplicated here. The saved review images are 1280 × 720; the parent browser reported the source images as 3840 × 2160. Four initial browser captures were blank despite DOM image completion. Those were replaced with visibly rendered captures before observation; none of the blank files is counted as evidence.

### 1. A sparse, layered reward hierarchy

[Official still 1](evidence/round-05/reloaded-official-still-1.png) places the level label and completion message above three very large magenta stars. Beneath them, three smaller labelled stars explain completion, preserving every life, and finishing within 60 seconds. The large yellow 11450 score and new-high-score badge form a second reward. Menu, restart, and play-next actions sit apart along the bottom, each with a controller glyph. The result is mostly empty dark space; it does not show the revealed artwork behind the results in this particular frame.

The grid in the letters and stars plus their soft surrounding glow provides the retro identity. The action labels use a smoother thin font, demonstrating that the whole interface need not share one bitmap font. The smallest medal labels will need separate responsive treatment on phones.

**Transfer:** explain three achievable goals directly on results, make retry and advance immediate, and reserve the largest visual emphasis for newly earned accomplishments. Keep the complete-artwork reveal as its own reward stage if selected; this results still alone cannot establish that stage's timing. The 60-second goal is specific to this pictured level, as the later 150-second result demonstrates.

### 2. Warning typography is lethal terrain

In [official still 2](evidence/round-05/reloaded-official-still-2.png), red X tiles spell “DON'T TOUCH” across a largely open dark field. The manual now establishes this as player-lethal terrain, rather than merely decorative lettering. Normal enemies can ignore that terrain; the visible yellow bodies and magenta trails must not be interpreted as being confined by the lettering.

The active path runs up from the left and then a long way right, ending in a bright yellow tip. It is much thicker than the thin blue contour around captured territory. Several cyan patrol sprites appear at the outer perimeter and at the stepped lower internal contour. A newly cut boundary is therefore part of the threat vocabulary, not simply a decorative outline. Most of the board remains quiet black, making the path, letter shapes, and sprite cores immediately prominent. The revealed blue-purple illustration is smooth, while the foreground glyphs and HUD are deliberately pixelated.

**Transfer:** make occasional levels recognizable through playable silhouettes: a Ukrainian ornament, an abstract military warning symbol, a cassette outline, or a business-flow diagram. The silhouette must use a consistent terrain rule. Keep inactive art below the contrast of the active path, and make contour patrols recognizable wherever the contour moves.

### 3. A maze for the player, not solid walls for enemies

[Official still 3](evidence/round-05/reloaded-official-still-3.png) uses broad red X bands to form two spiral-like mazes connected by narrow channels. These are lethal fields. Their visual resemblance to maze walls must not imply the cyan wall rule: the manual states enemies ignore death fields. Small pink enemies sit on or beside those red bands, so enemy contact can threaten a player navigating an opening even when the terrain resembles a protecting wall.

The captured contour wraps the remaining dark regions with sharp orthogonal steps, revealing a smooth blue-purple space illustration around and between them. A narrow upper-right notch contains a cyan patrol. The central reveal has a green outlined hexagonal marker with a symbol inside; a large red effect appears near the lower-right reveal. Their exact triggers cannot be established from this still, and neither should become a new powerup or enemy rule on this evidence alone.

**Transfer:** test whether players understand that a death field restricts their route while allowing incoming threats. Differentiate it from a solid wall through texture, edge treatment, animation, and a taught example. Use the inner turns of authored maze levels for planning, but avoid terrain that falsely promises cover.

### 4. A central reveal pocket and nested visual landmarks

[Official still 4](evidence/round-05/reloaded-official-still-4.png) has an outer rectangular belt of sparse blue slowdown symbols, split vertical blue columns, and inner red lethal columns/corners. Small dense cyan wall pieces appear beside the central pocket. These three textures remain distinct even in the same composition.

A narrow revealed stem from the bottom opens into an irregular ring around a large red skull image. The skull is not drawn with the repeated X texture, so its visual meaning must not be equated with a verified death-field rule. This still alone does not establish whether it is scenery, an effect, or another level feature. A magenta diamond is visible beside it. Two cyan patrols occupy the lower internal contour at different depths, while yellow ringed sprites appear elsewhere among the field bands. Smooth streaks and gradients of the revealed background contrast with the foreground tile patterns.

**Transfer:** a central landmark can give a level a memorable composition, with a narrow approach and a broader reveal around it. Keep landmarks in the art layer unless they have an explicit authored gameplay role. Use consistent silhouette and contour alignment for patrols so their danger remains clear inside an elaborate background.

### 5. A neighborhood of different traversal rules

In [official still 5](evidence/round-05/reloaded-official-still-5.png), hollow cyan rectangles around red interiors, small solid cyan squares, long red columns, and a segmented blue/red belt create a repeating street-like arrangement. The cyan rectangles are walls, rather than already captured islands; the red interiors and bands are death fields. The sparse blue segments between red runs are traversable slowdown fields. Calling all of these “obstacles” would conceal the central route choice.

Magenta round enemies with particle tails occupy spaces beside and within red bands, consistent with the manual's statement that death fields do not constrain enemies. A cyan patrol sits at the lower contour. Near the lower-left reveal, the thick active line turns right and down through a narrow local opening, with a bright yellow endpoint. Its thickness is approximately one terrain cell; the permanent contour is far thinner. Smooth dark mountain/landscape art is visible beneath the jagged lower reveal boundary.

**Transfer:** introduce each material separately, then combine a repeated module with one changed opening. The player can learn a local pattern and decide where to commit. Theme packs should replace material textures and background art without changing wall/slow/lethal identities. Expose those roles in the editor and in a short player legend.

### 6. Scattered fields, large moving silhouettes, tiny foothold

[Official still 6](evidence/round-05/reloaded-official-still-6.png) distributes red lethal clusters and blue slowdown clusters in staggered rows. The clusters leave crossing gaps instead of forming a continuous maze. Eight conspicuous yellow ringed sprites with tails occupy different parts of the board, including positions over terrain motifs. Their behavior or exact manual category cannot be identified solely from their ring-shaped artwork; different colors and sizes should not create invented species in our design audit.

The revealed area is a small stepped foothold near the bottom, against a mostly black board. Cyan patrols are visible at the lower perimeter and at the raised internal contour. This makes the start position visually vulnerable despite the small captured percentage. The small yellow glow within the revealed pocket is less visually dominant than the ringed sprites; the player needs a reliable way to relocate their avatar when effects compete for attention.

**Transfer:** use scattered islands of different terrain as a distinct authored layout family. Budget threats by their occupied visual area as well as their count and speed. Give the player a unique core shape and consistent outline, and keep optional trails/effects subordinate to it. A dense level should receive actual minimum-size readability testing before being offered on phones.

## Scale and presentation implications

At the 1280-pixel review width, active sprite cores occupy only a small part of the arena; particle trails and glow make their footprint appear larger. The underlying collision size cannot be measured from these effects. A terrain cell and active line are visually around a dozen pixels wide, while the static contour is near a hairline. Shrinking the same complete board to a roughly 390-pixel phone width would reduce a cell to only a few screen pixels. This is an estimate from the displayed still, not a measured game resolution or a mobile usability test.

Keep a challenge's arena dimensions, geometry, collision space, and simulation fixed across devices and during resizing. A replay or leaderboard entry must always describe the same challenge. For a board whose complete view becomes too small on a phone, prefer an appropriate orientation and readable controls; optionally author a smaller mobile variant with fewer repeated modules, its own challenge ID, and a separate leaderboard. Never silently change the grid during responsive layout. Keep the whole active board visible, and put touch controls in a dedicated area outside it. Retain a stable inner shape for each sprite, using glow only as an outer effect; red/blue color changes alone should never identify a rule. Backgrounds can be detailed pixel art, smooth illustration, photography, or company art if the reveal mask and contrast treatment maintain the same foreground readability.

## Supplemental gameplay stills already inspected

- [Pack 1 at 11:23](evidence/round-05/reloaded-pack1-1123.png) makes the three terrain vocabularies especially clear: red X columns outside blue patterned slowdown columns, then dense cyan wall columns around a central channel. The central reveal is a smooth, full-color night-street illustration. A cyan patrol sprite sits on an internal contour beside a narrow revealed branch, while another is near the outer edge. A large diamond occupies the upper central region. These roles should remain legible when translated into Ukrainian military or cultural art.
- [Pack 1 at 15:57](evidence/round-05/reloaded-pack1-1557.png) shows a nearly rectangular belt assembled from alternating slowdown and death regions, with isolated death-field crosses in the interior. The player has carved a tall revealed pocket and a low narrow connection. A cyan patrol is positioned at that internal low contour. A route near the arena perimeter therefore still has meaningful local danger.
- [Level 8 results at 13:40](evidence/round-05/reloaded-pack1-1340.png) explicitly uses a 150-second medal target. That differs from the first-level 60-second marketing result screen, demonstrating that a single screenshot's target must not be generalized across all levels.

## Representation requirements for our framework

1. Store walls, player-only lethal fields, and asymmetric slowdown fields as separate rule types. A single generic `obstacle` record loses essential behavior.
2. Store movement domain independently from appearance: open area, contour graph, exposed interior, stationary emitter. A recolored sprite must never silently change its rules.
3. Give gameplay entities a compact, high-contrast core and optional decorative glow. Enemy trails and particles should not be mistaken for the vulnerable player trail.
4. Give every background style its own presentation transform, while preserving the same collision plane. Smooth revealed illustration beneath pixel sprites is faithful to Reloaded's actual mixed-media presentation.
5. Test real minimum-size gameplay, because a marketing image cannot demonstrate whether its narrow corridors or small sprites remain usable on a phone.
