# Neon Hearts

Playable reconstruction of the third user-supplied screenshot, 30 September 2026.
The earlier Neon Channels and Neon Crossroads levels are unchanged.

Run `node scripts/game-cli.mjs serve --port 8770`, open
<http://127.0.0.1:8770/authoring/library/neon-hearts/>, and choose **Play Neon Hearts**.
The page supports immediate and grid-center turning. `scenario.json` imports into
Playground; `pack.json` is an independent single-mission pack.
Regenerate with `node scripts/build-neon-hearts.mjs`.

The measured source tile layout is approximately 92 × 46, projected onto the
runtime's 72 × 36 grid. It preserves six small lethal hearts in alternating
high/low positions, the larger central lethal heart, the broken cyan wall outline,
the revealed central return surfaces, eight pink bouncers, two cyan border patrols,
and the bottom-center player start. No slow terrain, pickups or diamond enemies
are added. The gap between the upper and lower wall sections is kept open.

The source recipe contains an explicit tile mask. Projection produces disjoint wall and safe-foundation rectangles, plus 46
lethal rectangles forming seven connected heart shapes. The lower wall narrows
to preserve both safe stair-step passages after grid rounding. Source pixels are not embedded. Original procedural
pink orb, cyan patrol, tiled wall, red cross and yellow player sprites are included.

The still establishes positions and appearance, not speeds or exact behavior.
Pink orbs use existing bouncer behavior and cyan sparks use border patrols; movement
directions follow their visible trails where possible. Cyan tiles are solid walls,
red hearts are lethal until captured, and purple revealed areas become permanent
safe foundations. The background uses existing retro reveal art; faint off-board
visual effects are not added as obstacles. Three lives, a 75% goal and no timer
are authored defaults. Grid rounding and runtime actor badges affect appearance.

Verification covers import validation, artifact regeneration, seven separate lethal
components, reachable central safe ground through the openings, and a legal 140-cell
capture without losing a life with exact replay in both turning modes. Browser
launch and visual layout are checked separately. Full-clear balance, physical
device qualification and public deployment are unverified.
