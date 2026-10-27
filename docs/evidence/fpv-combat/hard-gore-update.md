# Hard gore animation update

20 October 2026. Local isolated workspace; not published.

## Changes

- Fresh defeat bursts receive a bounded allocation before remains are admitted. Missing streamed support or a large nearby body cluster no longer suppresses the hit's entire burst.
- Brutal enables stronger lethal breakup, including ordinary localized defeats. Blood independently controls spray, exposed organic detail and blood marks; Remains controls persistent presentation. Protected actors and reduced-motion suppression retain their gates.
- A short rupture leads into directional jets, radial sheets, heavier tumbling droplets and delayed fine spray. Explosive defeats spread fragments around the impact; strength also uses accepted severity rather than projectile speed alone.
- A shared procedural soft texture replaces solid smoke polyhedra. Blood mist and mechanical smoke face the camera, share bounded batches, sort by distance and release their texture on disposal.
- Existing detailed character regions retain clothing, equipment and wound surfaces. Current-art cut surfaces have extra folds and core details; authored remains receive deeper raised details.
- Multiple supported ground splashes spread at different times. Detached regions leave pools at their actual contacts. Origin shifts preserve mark-cache identity. Paused previews can finish validating their remaining footprints across rendered frames.
- The existing Low/High/Ultra limits, gameplay damage, radio controls, recordings and shared settings remain in force.

The actual SIM uses the generated `world-reaction-runtime.mjs`; it was refreshed from the canonical presentation module.

## Inspection and scope

Inspected the production Worlds Studio preview with the installed detailed character appearance:

- Bomb / explosive at 0.16 seconds: dense burst, mist and separated regions.
- Three seconds: zero moving pieces, 57 settled pieces, zero pieces waiting for a surface.
- Clean preview: no blood or exposed organic breakup.

Screenshots: [burst](hard-gore-burst.png), [settled](hard-gore-settled.png), [clean](hard-gore-clean.png).

Targeted lint and whitespace checks passed. Final package measurement passed: Worlds uses 208 runtime files / 19,275,740 bytes and 210 source files / 19,325,968 bytes, within the existing 210-file / 20 MiB policy; input headroom is 503,645 bytes. Academy and Flight gym remain within their policies. [Measurement evidence](hard-gore-packages.json) uses synthetic working-tree identities and is not publication qualification. No automated test suite or full gameplay/performance qualification was run for this visual update. The earlier radio test results do not qualify these new effects.

## Design references

- [Bethesda: DOOM Eternal's demon destruction](https://bethesda.net/en-US/news/put-an-end-to-hell-on-earth-in-doom-eternal%27s-single-player-campaign): damage should visibly break recognizable regions and communicate weapon impact.
- [Blizzard: Diablo IV visual effects and skill-driven deaths](https://news.blizzard.com/en-us/article/23746639/diablo-iv-quarterly-updatedecember-2021): directional impact data, attack-specific outcomes and stronger visual emphasis for powerful attacks.

These informed the treatment; no game assets were copied.
