# Seven FPV role presentations

Seven original body images and seven independently replaceable rotor recipes. The original source batch remains recorded independently in `presentations.json`. This branch additionally proposes the seven existing FPV roles through the current presentation catalog; it does not grant production-register approval or change unlock records. The existing game still owns all movement, abilities, collision and outcome rules.

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

Serve the repository with an ordinary static HTTP server and open [the preview](index.html). It calls the existing [character renderer](../../motion-lab/render-character.mjs) and [animation clock](../../motion-lab/animation.mjs), with the preserved pre-adoption sizing formula and two explicitly separate compact sizing studies. It shows a 128-pixel inspection image and a 1× CSS-pixel sample for 294, 390, 600 and 1152-pixel wide boards. Browser zoom and display scaling remain separate from the canvas measurement. Use light/checker backgrounds, north/east/south/west headings, rotor visibility, pivot/hub guides, pause and reduced motion. The default preview selects the proposed 20 CSS-pixel compact minimum; choose Current game for the preserved pre-adoption formula.

```sh
node authoring/library/fpv-role-presentations/verify.mjs
node --test authoring/library/fpv-role-presentations/test.mjs
```

`--tool-originals` additionally checks the authoring machine's retained default outputs; portable verification uses only repository files. `--record PATH` writes one new JSON receipt and refuses overwrite. The local RGBA decoder verifies every chunk CRC and every scanline with bounded inflation. It does not modify images. The small tests cover all five RGBA filters, damaged input refusal, finite rigs and the existing pause/reduced-motion clock.

The rig uses only the existing `rotors` component, with three blades per hub. Hub count is separate from blade count. Images contain motor hubs without baked moving blades. Coordinates use the complete original rectangle, not a cropped silhouette. All rotating envelopes fit that rectangle. The pivot is its center with north at zero; this is an authored presentation convention, not a measured center of mass. No sprite atlas, event-driven action state, scan ray, cable, shield or projectile animation is implemented here.

The bounded code-render study tried five settings for each role at a 294-pixel arena width. Doubling the body envelope, changing its aspect limits and switching to linear sampling did not increase any role’s major body span. Linear sampling changed Trapper’s minor dimension from 12 to 14 pixels; its major span stayed 14. The current renderer caps the complete source rectangle at 64 logical pixels: `64 × 294 / 1152 = 16.33` CSS pixels. Containment and size normalization cancel envelope-only increases. Larger legal rotor radii and blade widths improved Scout, light carrier, heavy carrier and fiber, and those four settings are retained. They do not enlarge the body or collider. Several body-only spans remain 12–13 pixels, with Impact at 8 × 13; the 14–16-pixel body target is therefore not met for every role. A later visual-size policy or newly generated tighter-padding original needs separate review. The arrow, pulse and lattice rigs retain their tighter settings to preserve the intended silhouette.

The author inspected original images, light/dark rendered pivots, four headings and actual-size code samples. A separate browser review on 2026-09-14 inspected the live authoring preview: all seven bodies loaded, north motion on the dark 294-pixel sample, east/light output and pivot guides at 1152 pixels, and selectable west/reduced-motion controls. Pause changed to Play, and two paused screenshots remained byte-identical after 700 ms. The initial unavailable-browser attempt remains a separate diagnostic. This accepts the authoring candidates for further review; Impact’s thin small body and the other under-target body spans still require a sizing decision. Physical-device readability, gameplay and runtime adoption remain unqualified.

## Compact sizing comparison

The source preview offers **Current game**, **Compact 20px minimum** and **Compact 24px minimum**. Both candidates allow the logical image rectangle to grow enough to honor their requested CSS minimum below a 480-pixel arena width. The old 64-logical-pixel cap remains exact under Current game; desktop output at 600/1152 arena pixels is unchanged. The complete original, motor anchors, aspect ratio and three-blade rotors remain together. No artwork bytes are edited and no collider changes.

At a 294-pixel arena, the CPU renderer measured the following visible body bounds. This is a north-facing fixed-frame sample with alpha ≥128 and brightness ≥80; other headings and subpixel positions still need inspection.

| Role          | Current | Proposed 20px | Comparison 24px |
| ------------- | ------- | ------------- | --------------- |
| Scout         | 13×10   | 16×14         | 18×16           |
| Light carrier | 14×12   | 18×16         | 20×20           |
| Heavy carrier | 12×13   | 16×16         | 18×19           |
| Interceptor   | 12×11   | 14×15         | 16×17           |
| Fiber         | 12×12   | 15×16         | 18×18           |
| Impact        | 8×13    | 12×15         | 16×19           |
| Trapper       | 14×12   | 16×17         | 20×19           |

The 20-pixel image rectangle is the preferred next gameplay candidate: it improves all seven major body spans to 15–18 pixels while remaining smaller than the 24-pixel comparison. It is not a uniform 14–16-pixel size guarantee. Impact retains a deliberately narrow shape. Existing animation pause/reduced-motion behavior and desktop sizes stay intact. Source checks pass on Node20/22; the first added comparison assertion incorrectly compared two different viewport widths and was corrected to compare the same width.

The actual render script, measured samples and labelled 1×/3× contact sheet are retained at `.cache/fpv-role-presentations/size-study-1/`. Native source preview evidence is separately retained under the root `.cache/round47/fpv-compact-native/`. These measurements and screenshots do not qualify runtime adoption, physical-phone readability, all movement phases or complete character production. A later integrated candidate must preserve cosmetic-only sizing, show actual collision/contact cues and verify saved appearance identity.

## Replace one set

Keep the other six sets unchanged. Generate a new original using the [prompt contract](PROMPTS.md), preserve its default output and create a new versioned candidate rather than silently changing an adopted body identity. Record exact bytes, alpha, dimensions and full effective prompt. Inspect the actual motor centers; recompute normalized coordinates as `pixel / naturalSize - 0.5`. Review the complete rotating envelope and north-facing pivot, then inspect both moving and stationary output at actual sizes on light and dark backgrounds.

For current adoption, register a new versioned body and rotor recipe in `authoring/motion-lab/presets.json`, then change only its declared `characterPresentations` set. Do not rewrite an immutable pack’s `theme.classBodies`. The adapter applies a recommendation only when the entire original theme identity and class map match; explicit appearance choices and original-file overrides retain their existing precedence. See [the source integration contract](../../../docs/fpv-role-presentations.md). It supplies seven candidates, not 56 completed theme/role sets, and does not grant production, human readability or physical-device approval.

## Current runtime source candidate

The separate preset mapping makes these seven starters available in solo and Couch without changing historical progress rewards. Only these registered bodies receive the compact 20 CSS-pixel image minimum; existing bodies, missing-image fallbacks and desktop sizes retain their prior policy. The seven original PNG bytes and this batch’s original provenance remain exact. Source integration, modeled checks, integrated native review and public release are separate states; the earlier authoring preview does not certify the new runtime candidate.
