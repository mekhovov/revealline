# Journey actor material studies — source review, not runtime enrollment

The12 existing Journey campaign palettes still resolve the same retro body family.
Source `35419a1d4a6081f56b7815646820658e0acf6159`, corrected by
`b539592c98de670548f1878a376727b9ec2af12c`, adds twelve original code-native
material studies across all seven existing enemy roles. It extends the project's
pixel-drawing approach, not third-party pictures or generated bitmap assets.
There are84 body recipes, not84 new enemies or mechanics. No production host,
renderer, theme registry, mission, simulation, save, release or deployment changes.

## Intent and boundaries

Enamel, seedpods, porcelain, smoked glass, rivets, basalt, prism facets, copper,
lacquer, sail weave, gilt and polar ice provide campaign-specific material ideas.
The seven role outlines remain different within each treatment. Bounded silhouette
tabs vary across three placements, while every campaign has a distinct pixel
pattern; this is not a claim of84 wholly different outlines. These are abstract
body studies, not final character portraits or complete campaign presentation.

Critical meaning must not depend on color or texture alone. That follows
[Xbox Accessibility Guideline103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103),
which recommends additional information channels and explains that simulated
checks do not replace testing with actual players. Existing contact rings, role
badges, warnings and audio must remain independent when runtime integration is
reviewed. This document does not claim accessibility certification or blind-play
support from a visual contact sheet.

The renderer accepts only an explicitly selected registered material and existing
enemy type. It draws body pixels in a28×28 logical envelope. Recipes are frozen
and precompiled once; no per-frame recipe generation, randomness, timers,
network, image decoding or gameplay mutation. Dormant color treatment remains
subdued. Unknown materials/types and ordinary Legacy frames draw nothing, leaving
the caller's existing fallback available. Nothing currently calls this from play.

## Review and evidence

`game/presentation/journey-actor-review.html` is a read-only contact sheet with
16/24/32px body-size choices and ink/paper/neutral-grey surfaces. Every specimen
has an accessible name identifying its material, role and movement domain.
The sheet neither saves preferences nor modifies Studio drafts. It explicitly
labels live-board recognition and human testing as pending.

Four dedicated suites pass on Node20.19.5 and22.22.2. They exercise all84 recipes:
bounded/frozen coordinates, unique role silhouettes, connected pixel clusters,
campaign pattern differences, deterministic drawing, preserved input fields,
dormant colors and safe rejection of unknown/prototype-key inputs. These source
checks do not establish recognition, perceived hitbox alignment or live performance.

Native in-app-browser review served exact commits read-only on port8814. The first
390×844 review exposed soft edges from scaling fillRect coordinates directly.
Correction `b539592c` renders at native28px then samples nearest-neighbor at the
chosen display size. Its native16px/paper,32px/ink and24px/neutral-grey views were
visually inspected at390px and1280px viewport widths. The desktop DOM had12 cards,
84 labeled canvases and no horizontal overflow at1280px; temporary sizing was reset.
The browser's read-only DOM interface did not expose canvas pixel readback, so no
alpha-value measurement is claimed. The screenshot API initially encountered a
zero-size default viewport; explicit responsive sizes were used for these checks,
not evidence of a game layout bug. A full-page capture had stitching artifacts;
ordinary viewport screenshots and DOM geometry were used for inspection instead.

## Next integration gate

Coordinate the shared actor-presentation hook with the existing release/renderer
owner. Select an explicit new theme/presentation edition; do not reinterpret old
theme IDs or replays. Preserve uploaded-body and explicit skin precedence. Qualify
actual Solo, paired-board Versus and Team painters, all functional badges/contact
cues, reduced effects, completed pictures and exact authoritative checkpoints.
Review against original mission pictures, not only flat surfaces. At16px material
differences are deliberately subtle and cannot carry rule meaning. Human role
recognition and aesthetic review, accepted-source integration and Pages publication
remain open. No published character/material requirement is closed by this study.
