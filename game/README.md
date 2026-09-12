# Play and author RevealLine

This is the playable browser application. Run `npm run dev` from the repository root and open [the game](http://127.0.0.1:8768/game/). It uses a local Phaser 4.2.1 bundle and a plain JavaScript [simulation core](core/README.md). The earlier [motion lab](../authoring/motion-lab/README.md) remains a separate experiment with its own ability and collection formats.

## The loop

Leave claimed ground to start a vulnerable cut; return to claimed ground to close it. The cut and connected regions without a field enemy become revealed. Enemies on both sides can leave a trail-only capture. Permanent walls block movement and are excluded from the coverage denominator. The whole entered cut tile is vulnerable, shown by a bright centerline and tile overlay.

Reach the level's coverage target and capture its required objectives. A failed cut costs a life and clears that cut while retaining previously captured territory. The clock affects optional medals; it does not end play. Victory shows the whole picture while the result continues to report the actual captured percentage.

Eight authored missions introduce field bouncers, outer-border patrols, objectives, obstacles, supplies and a telegraphed lane boss. Four worlds change the presentation: FPV Front, Ukraine Atlas, 1994 Forever and Spend Network. The business theme and its helper are original game concepts, not official Coupa product behavior or real customer savings.

## Controls and choices

| Input | Action |
|---|---|
| Arrows / WASD | Move in four directions; release to stop |
| Shift | Boost while held |
| E | Use the selected class ability |
| R | Collect supplies when nearby and applicable |
| Escape / P | Pause or resume |
| Touch direction buttons | Hold to move; optional Tap steering latches direction, tap again or press ■ to stop |
| Standard gamepad | D-pad / left stick, button 0 action, button 2 supply, right shoulder boost, Start pause |

Gamepad labels commonly correspond to A/X/RB; hardware mappings vary. Pause and focus loss clear held controls. Controller support in code does not certify every device.

**Immediate** changes cardinal direction at the current position. **Grid + buffer** turns at cell centers and buffers the latest held direction between centers. Releasing stops and clears the buffer. The [core contract](core/README.md) describes restart, walls and contact order precisely. The fixed 48 × 36 board keeps its geometry at every viewport size.

Five class recipes use four implemented primitives: Scout scans, Bomber and Carrier place supply-dependent stun fields, Interceptor uses a protective shield, and Trapper places a slowing field. Ability values live in [classes.json](content/classes.json). Changing class or steering starts a new attempt. Selecting a body, world or animation look does not change the class, collider or capture rules.

Sound starts only after the sound control is activated. The current soundtrack and cues are synthesized in [audio.mjs](ui/audio.mjs); imported music packs and richer adaptive stems are future work. Reduced effects is available independently of sound.

## Playground and local progress

Open [the playground](http://127.0.0.1:8768/game/playground/) to paint a map, generate a seeded candidate, edit level/theme/class JSON, replace eight image roles, export a scenario, or compare viewport sizes. **Play configuration** starts the same engine in practice mode. Its viewport frames are layout previews, not phone emulators.

The accepted scenario format is `xonix-playground.v1`; a single `xonix-level.v1` file can also replace the current playground level. Read [assets and configuration](../docs/assets-and-configuration.md) for exact roles, limits and source preservation. The earlier content-pack/media/collection documents require an explicit adapter; renaming their file extension does not make them playable.

Normal campaign clears update local progress and cosmetic unlocks. Practice, imported scenarios, demonstrations and replay verification grant no campaign rewards. Local saves and replay checksums are not authenticated achievements. The game reports storage problems and preserves incompatible/corrupt save data for recovery rather than treating it as a successful save. Campaign save keys separate development and release builds and distinct version labels. Serve different releases on separate ports when full origin isolation is needed.

Use **Export replay**, then the playground's verification control, to reconstruct a recorded run and compare its full authoritative state. See [replays](../docs/replays.md). The checked-in [campaign routes](replays/campaign-routes.json) complete all eight levels in both steering modes using legal inputs from fresh normal runs; that is completion evidence, not a claim about human difficulty or enjoyment.

## Develop and share

Read [development](../docs/development.md), [deployment](../docs/deployment.md), [versioning](../docs/versioning.md) and the [implementation plan](../docs/round-10-implementation-plan.md). AI-assisted changes should use [Runtime Maintainer](../authoring/skills/xonix-runtime-maintainer/SKILL.md) alongside the relevant art or design skill.

Static browser distribution is implemented. Native wrappers and offline caching are separate work; physical phone, controller and sustained performance checks need actual hardware. The [reference research](../docs/research/round-10-reference-and-import.md) and [earlier XPOSED inspection](../docs/research/xonix-and-xposed.md) distinguish observed references from this game's choices.

Touch Boost follows the steering preference: hold it in hold mode, or tap to toggle it in Tap steering mode. Stop and pause clear it. Assistive click-only activation toggles Boost because it has no hold-release event. The action affects the same simulation multiplier as Shift or the controller shoulder.

In v0.1.1, a completed mission offers **View picture**; **Results** restores the same outcome. Export replay also exposes copyable JSON, and the playground measures control visibility as well as arena fit. Mobile and tablet layout presets use 44 CSS-pixel control targets; the desktop mouse layout retains smaller buttons. These are layout measurements, not physical-device certification.
