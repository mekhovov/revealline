# Material states across all themes

The shared runtime stylesheet now gives all 17 installed themes material-specific hover, pressed, selected, focus, loading and disabled states. Native inputs, selects, checkboxes, radio buttons, switches, sliders and file selectors use the same material vocabulary. The generated optional SIM stylesheet is byte-identical to its shared source.

Flight Deck, Ember Foundry and Polar Relay keep their machined steel details. Linen compresses into a quiet woven surface, porcelain gains glazed edges, copper uses brushing, wood uses planed relief, and stone/composite themes use restrained edge lighting. Desktop 98 retains its structural bevels, DOS stays flat, and Signal Blue remains a clean cyan console. Ornament Off, high contrast and reduced motion still override the theme.

## Evidence

- `gallery.jpg`: all 17 themes and 153 live controls, using independently resolved runtime scopes. `gallery-overview.jpg` is a readable excerpt with fixture controls.
- `<family>.jpg` and matching JSON: 41 paired states per theme. Each blank twin has the same paint as its labelled control, allowing background pixels to be measured without text antialiasing.
- `high-contrast.jpg` and JSON: the same 41 pairs in high-contrast mode.
- `rendered-contrast.json`: **738/738** reading areas pass (4.5:1 normal, 3:1 disabled, 7:1 high contrast), including an additional 0.2 margin for JPEG sampling. Every pixel in the reading rectangle is checked. This is rendered sampling, not lossless contrast certification.
- `accessibility.json`: **51 combinations / 2,856 semantic assertions** pass: every theme with decoration Off, high contrast or reduced motion, nested inside a textured Flight Deck scope. No decorative image leaks in Off/high-contrast states, and no settled press displacement in these three override modes.
- `tests.tap`: **56/56** focused tests pass, including compiled community export/cache reload. `final-checks.json` records exact test, lint, formatting and generated-asset commands.
- `sakura-game-settings.jpg` and `obsidian-game-settings.jpg`: actual Settings theme switching; restored the existing Obsidian selection after verification. Browser console errors: zero.

The loading oracle checks that a foreground progress rail survives default, selected and focused states. It caught an invalid composed shadow containing `none`; transparent zero shadows now keep flat/DOS and high-contrast indicators visible. A thicker steel rail clears the existing nine-slice frame. Validation keeps readable input text and combines with an independent focus outline.

Measurements use settled states after the short runtime transitions. Immediate measurements during a palette switch can observe intermediate shadow colors and offsets; those transient captures were replaced after paint settled. Motion overrides were checked on the resulting state.

## Scope and limits

No new asset paths, theme IDs, palette revisions, package limits, flight rules or physics changes. Existing material tiles remain 10 files / 11,086 bytes. This updates the shared game, creator and SIM presentation path; it does not assert that every screen was manually visited. Device p95 performance, Firefox/forced-colors rendering, controller hardware and full-flight qualification remain separate release gates.
