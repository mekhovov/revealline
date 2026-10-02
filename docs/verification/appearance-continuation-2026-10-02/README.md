# Appearance continuation — 2026-10-02

This continuation follows [the acceptance pass](../appearance-acceptance-2026-10-02/README.md)
on draft PR #955. It integrates main `ba598ca65` (Neon content) in `a4b7c9d64`,
preserving both branches' locale entries and rebuilding their generated catalog.
The source manifests and checks in this directory identify the subsequent working
source, including files that were not yet committed when browser checks ran.

## Completed in this pass

- **Industrial states and media:** the game-level Reduced effects preference now
  wins over common button/link transitions. In the browser, 28 visible controls
  changed from 100 ms to zero-duration transitions without replacing focused
  controls. Story loading, verification, unavailable and preference-error notices,
  plus the Close accessible name, update with language changes in place.
- **Earned-picture presentation:** the Creator player's contain-fit image backing
  now uses the shared theme background. A legal playthrough earned the original
  picture; the optional celebration finished and Continue returned to the campaign
  menu. A second 390×844 Ukrainian/Large/reduced-effects check kept the exact image,
  focused Continue, readable Play/volume controls and no horizontal overflow.
  Video stayed paused at time zero with autoplay false. Only the letterbox backing
  changed; picture pixels, layout ownership and fit were preserved.
- **Neon authoring integration:** all 18 new interactive entrypoints use the shared
  bootstrap, stylesheet and appearance host. Both gallery generators emit the same
  integration. Authored preview art and launch behavior remain intact. The Mosaic
  gallery loaded all 38 SVG previews, showed Industrial chrome and had no horizontal
  overflow at 1280×720 or 390×844. Older archival contact sheets are not reclassified
  as interactive entrypoints by this work.
- **SIM badge legibility:** compatible collections choose contrasting objective
  text and give only the active badge a bounded screen-size boost. Near/far Hangar
  checks at Balanced confirm readable Industrial and Dnipro active numbers above
  clear gate openings. Noncollection authored rendering retains its original path.
  See [the scoped review](../appearance-acceptance-2026-10-02/sim-label-legibility-review.md).
- **Original marking source kit:** an 8,152-byte GLB with a 981-byte embedded atlas
  supplies gate plates, a pad H/ring/orientation mark and a neutral calibration
  wedge. It passes the real Khronos validator and existing World preparation with
  no colliders or gameplay anchors. The fixed preview decodes the same PNG through
  the pinned GLTFLoader's image-element alternative under the existing image policy.
  Static gate detail, pad, grazing and unlit wedge inspections passed. This remains
  an authoring proof; no installed collection revision was replaced.

## Evidence and boundaries

The source preview is an isolated copy on the existing authenticated localhost
server. No password gate or content-security policy was removed. Browser testing
restored English, Standard text and full effects afterward. It installed the supplied
Creator sample only in this local browser for the reward journey; that independent
review campaign and Studio workspace remain available, without changing main
campaign progress or publishing their content.

`industrial-earned-story-desktop.png` records the earlier navy backing that led to
the fix. `industrial-earned-story-uk-large-mobile.png` records the corrected state.
Gallery and marking screenshots in this folder show the actual rendered UI.
The marking close-up viewport captures are cropped by the normal page fold; they
are not evidence for unseen geometry. Node bounds checks separately cover the full
aperture and pad envelope.

The SIM screenshots come from immutable candidate
`84bdb5c902c0bbce576df433b0b4151ed0ffa84b918a9e551ada65ad9528879c`
(35 exact files). The first paired frame run overlapped local tests and is excluded
from performance acceptance. The subsequent [idle run](sim-balanced-frame-review.json) passed both pairs: themed
p95 9.1 ms versus authored 9.2/8.9 ms, with ratios 0.989 and 1.022. Repeated
collection resource counts matched exactly.
Browser frame cadence is not GPU timing or physical-device qualification.

Khronos' reference viewer loaded its stock model, but a local model chooser was
not available through the supported browser flow; no independent rendering-engine
comparison of this marking kit is claimed. The preview loader configuration also
does not establish that default runtime embedded-PNG loading works under every
packaged content-security policy. Runtime adoption must resolve that separately.

## Automated checks

The expanded 44-file preview cohort passed **364/364** cases with zero skips.
The marking viewer and its test changed during that aggregate run; its final
source subsequently passed **6/6** scoped checks. Read [the aggregate receipt](checks.json)
and [the final marking receipt](marking-followup-checks.json) together. Generated
bootstrap/SIM/marking sources, targeted lint, formatting and diff checks passed.
No full local build was attempted with less than 400 MiB of free disk. The preview
workflow builds exact-head game and World artifacts remotely.

Independent read-only reviews found no remaining blocker in the scoped changes.
The marking-loader issue found by the actual browser was fixed and rechecked.

## Remaining work, in priority order

| Priority     | Item                                                 | Why / completion gate                                                                                                                                                                                                                                                  |
| ------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1           | Finish Industrial screen, state and input acceptance | Rewards, reduced motion and new authoring chrome now have evidence. Complete remaining actual error/recovery dialogs, focus journeys, physical touch/controller and screen-reader checks before claiming whole-game usability.                                         |
| P1           | Complete SIM readability and device qualification    | Badge contrast is repaired. Dnipro's distant gate outline remains faint; review cue contrast, orientation, occlusion, grazing shimmer and all environment/preset combinations. Measure the 10% p95 gate on target devices with sustained resource switching.           |
| P1           | Adopt one reviewed production asset revision         | Compare the marking kit in an independent renderer, exercise embedded textures through packaged runtime paths, improve mip-safe gutters if needed, then bind an immutable successor collection and fly the actual gate/pad route. Preserve old recording dependencies. |
| P2           | Expand Industrial bespoke assets                     | After the representative asset gate passes, produce drone, vehicle, ground and wall assets with bounded decoration and semantic markings. Current shared material coverage is not complete bespoke art production.                                                     |
| P2           | Qualify and deepen additional themes                 | Prioritize Vyshyvanka and Dnipro, then Desktop 98, DOS, Tryzub, Orchard and Neon. They are functional families; each still needs its own full art/readability/input acceptance.                                                                                        |
| Release gate | Fresh offline/package installation                   | CI previews validate build identity and package limits. Verify a fresh offline install and optional-package recovery on final source; do not use an earlier artifact as evidence for newer code.                                                                       |

The redesign remains a draft. No merge, deployment, release-slot allocation,
physical-device certification or full matrix sign-off is implied by this pass.
