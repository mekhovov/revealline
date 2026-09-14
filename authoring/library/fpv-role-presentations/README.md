# Seven FPV role presentations

Seven original body images and seven independently replaceable rotor recipes. These are source candidates for the seven existing FPV roles, with no runtime, unlock, registry or production-register binding. The existing game still owns all movement, abilities, collision and outcome rules.

| Role key      | Candidate body ID      | Distinguishing shape                     | Hubs |
| ------------- | ---------------------- | ---------------------------------------- | ---- |
| `scout`       | `fpv-scout-v1`         | Ivory camera body and broad shoulders    | 4    |
| `bomber`      | `fpv-light-carrier-v1` | Open X frame with one sand support pod   | 4    |
| `carrier`     | `fpv-heavy-carrier-v1` | Six arms and two parallel cream pods     | 6    |
| `interceptor` | `fpv-interceptor-v1`   | Compact arrow/capsule with short fins    | 4    |
| `fiber`       | `fpv-fiber-relay-v1`   | Large right spool and left counterweight | 4    |
| `impact`      | `fpv-impact-v1`        | Long blunt module and split rear tail    | 4    |
| `trapper`     | `fpv-trapper-v1`       | Square frame with four lattice windows   | 4    |

The generated PNGs are all **1254 × 1254**, despite a requested 1024 × 1024. Each is below the existing 4 MiB image bound. They are unchanged copies of the default tool output; no crop, stretch, background removal or resampling was applied. Most visible pixels have alpha 252–254 and faint fringe pixels remain outside the main silhouette. `verify.mjs` reports both all nonzero alpha bounds and substantial bounds at alpha ≥128. These originals have real transparency, not perfectly binary cutouts.

The fictional craft use broad silhouette inspiration from the user's drone references. They do not reproduce actual equipment, text or logos, and make no equipment capability claim. Full effective prompts, default output paths, byte hashes, observations and requested/actual dimensions are in the seven [provenance records](provenance/scout.json); all records are indexed by [presentations.json](presentations.json).

## Inspect and verify

Serve the repository with an ordinary static HTTP server and open [the preview](index.html). It calls the existing [character renderer](../../motion-lab/render-character.mjs) and [animation clock](../../motion-lab/animation.mjs), with the exact pure sizing formula from `game/ui/render.mjs`. It shows a 128-pixel inspection image and a 1× CSS-pixel sample for 294, 390, 600 and 1152-pixel wide boards. Browser zoom and display scaling remain separate from the canvas measurement. Use light/checker backgrounds, north/east/south/west headings, rotor visibility, pivot/hub guides, pause and reduced motion.

```sh
node authoring/library/fpv-role-presentations/verify.mjs
node --test authoring/library/fpv-role-presentations/test.mjs
```

`--tool-originals` additionally checks the authoring machine's retained default outputs; portable verification uses only repository files. `--record PATH` writes one new JSON receipt and refuses overwrite. The local RGBA decoder verifies every chunk CRC and every scanline with bounded inflation. It does not modify images. The small tests cover all five RGBA filters, damaged input refusal, finite rigs and the existing pause/reduced-motion clock.

The rig uses only the existing `rotors` component, with three blades per hub. Hub count is separate from blade count. Images contain motor hubs without baked moving blades. Coordinates use the complete original rectangle, not a cropped silhouette. All rotating envelopes fit that rectangle. The pivot is its center with north at zero; this is an authored presentation convention, not a measured center of mass. No sprite atlas, event-driven action state, scan ray, cable, shield or projectile animation is implemented here.

The bounded code-render study tried five settings for each role at a 294-pixel arena width. Doubling the body envelope, changing its aspect limits and switching to linear sampling did not increase any role’s major body span. Linear sampling changed Trapper’s minor dimension from 12 to 14 pixels; its major span stayed 14. The current renderer caps the complete source rectangle at 64 logical pixels: `64 × 294 / 1152 = 16.33` CSS pixels. Containment and size normalization cancel envelope-only increases. Larger legal rotor radii and blade widths improved Scout, light carrier, heavy carrier and fiber, and those four settings are retained. They do not enlarge the body or collider. Several body-only spans remain 12–13 pixels, with Impact at 8 × 13; the 14–16-pixel body target is therefore not met for every role. A later visual-size policy or newly generated tighter-padding original needs separate review. The arrow, pulse and lattice rigs retain their tighter settings to preserve the intended silhouette.

The author inspected original images, light/dark rendered pivots, four headings and actual-size code samples. A separate browser review on 2026-09-14 inspected the live authoring preview: all seven bodies loaded, north motion on the dark 294-pixel sample, east/light output and pivot guides at 1152 pixels, and selectable west/reduced-motion controls. Pause changed to Play, and two paused screenshots remained byte-identical after 700 ms. The initial unavailable-browser attempt remains a separate diagnostic. This accepts the authoring candidates for further review; Impact’s thin small body and the other under-target body spans still require a sizing decision. Physical-device readability, gameplay and runtime adoption remain unqualified.

## Replace one set

Keep the other six sets unchanged. Generate a new original using the [prompt contract](PROMPTS.md), preserve its default output and create a new versioned candidate rather than silently changing an adopted body identity. Record exact bytes, alpha, dimensions and full effective prompt. Inspect the actual motor centers; recompute normalized coordinates as `pixel / naturalSize - 0.5`. Review the complete rotating envelope and north-facing pivot, then inspect both moving and stationary output at actual sizes on light and dark backgrounds.

For later adoption, map the existing role key to a reviewed body through `theme.classBodies` and register its recipe through the normal character catalog. Keep manual selection, earned unlocks, old pack-owned themes and saved contexts intact. This source batch does not perform that adoption. It supplies seven candidates, not 56 completed theme/role sets, and does not grant production, human readability or physical-device approval.
