# Immediate theme selection and quieter collections — 2026-10-03

This continuation of PR #955 addresses the latest screenshot review. It
builds on `9d093d676f66141b662d0627ad48d58fbe38a695`. It does not close the
remaining device, flight-distance, production-art or offline release gates.

## Changes

- One inventory supplies the dropdown and gallery: Follow campaign/community,
  Classic Field Kit, eleven coordinated families and any installed curated themes.
  Both interactions apply immediately through the existing atomic host. The Apply
  button is removed. Stable card nodes preserve keyboard/controller focus; stale
  or failed loads cannot replace the accepted presentation.
- Every built-in choice has a short explanation in English and Ukrainian. Curated
  community cards show their name and exact revision. Follow previews the resolved
  campaign/community choice; pinned curated swatches use the selected interface.
- Ordinary controls no longer repeat stitched, chevron or scratched nine-slice
  borders. Material fills, shallow bevels, focus rings and selected checkmarks stay;
  page decoration is restricted to a small edge accent. Off/high contrast remain
  supported. This shared CSS also ships inside standalone SIM.
- Vyshyvanka uses near-black `#08090a` / `#121314`, crimson `#d3222a`, warm ivory,
  neutral gray control edges and white primary text (5.21:1 on crimson). Interface
  and arcade are new r2 revisions; exact r1 documents and sprite pixels are retained.
  Its existing saturated-red SIM r1 material collection remains available.
- Pocket LCD, Copper Observatory and Sakura Station include interface, Arcade
  role treatments, SIM palettes/effects and all seven material roles. New original
  SIM recipes use inset housings, sparse engraved arcs and small ceramic stamps.
  Existing sampling, models, collider geometry and simulation behavior are reused.

## Design references and interpretation

The [National Museum of the Revolution of Dignity exhibition](https://www.maidanmuseum.org/uk/node/1607)
documents a red-and-black flag among its contemporary exhibits. It provides the
requested historical color reference; the UI hex values above are an original
accessible adaptation, not a claimed official flag color standard. The theme
continues to represent Ukrainian embroidery; no political insignia or slogans
are added.

[Pocket-era Nintendo display guidance](https://www.nintendo.com/es-es/Ayuda/Consolas-anteriores/Game-Boy-Color-619589.html)
informs Pocket LCD’s limited sage/ink palette. The colors are original rather than
an asserted hardware-accurate LCD emulation. Semantic flight cues remain distinct.
[Eastward’s official media page](https://eastwardgame.com/media/) describes its
combination of retro pixel art and modern lighting; [Sea of Stars’ press kit](https://sabotagestudio.com/presskits/sea-of-stars/)
describes its detailed pixel world and dynamic lighting. These informed the quiet
light/dark material contrast of Sakura Station’s garden ceramics and Copper
Observatory’s night instruments. No artwork, logos or game assets were copied.

## Validation

The [controls review](controls-review.md) and [collection review](registry-and-collections-review.md)
record focused handler, contrast and retained-revision tests. Independent review
caught a Classic Field Kit mismatch: its r2 selection inherited a hidden old menu
palette. Current r2 now applies its declared shared paint; exact r1 retains its old
adapter. SIM exposes Classic separately from Authored, and Studio includes admitted
custom themes without changing the authoring workspace.

The current PR's Hunt/Woodland updates were integrated from `2cf4dcf37` into
`10e3a4956`, with both locale changes preserved and the catalog regenerated.

### Actual browser

[Browser observations](browser-review.json) and the [13-choice receipt](live-selector-browser.json)
record matching inventories and immediate application in the integrated game.
Keyboard Enter applied Pocket LCD with its card still focused. High contrast
and ornaments Off disabled decorative texture. Classic Field Kit applied its fixed
shared palette. English and Ukrainian cards had no horizontal overflow at 390×844;
this second game tab correctly announced session-only saving. The original game
was restored to Vyshyvanka, English, normal contrast and theme-default detail.

- [Crimson Vyshyvanka and quiet controls](vyshyvanka-desktop-final.png)
- [Ukrainian Sakura Station at 390 pixels](sakura-uk-narrow.png)
- [Pocket LCD SIM materials](pocket-lcd-sim.png), [Copper Observatory](copper-observatory-sim.png),
  [Sakura Station](sakura-station-sim.png)

Calibration now includes Adventure courses and starts successfully at Coastal
Airfield / Lighthouse approach. The actual Training Hangar rendered all three new
collections and swatches at Balanced, with the same 198 calls / 7,490 triangles /
19 textures for each in this fixed view. No console errors appeared after the
repaired page reload. This is a bounded rendering check, not a frame-time,
sustained-switching, flight-distance or physical-device qualification.

### Integrated checks

The final 51-file preview cohort and source hashes are retained in
[integrated-checks.json](integrated-checks.json) and [integrated-tests.tap](integrated-tests.tap).
The integrated result is **432/432 passed**, with zero failures, skips or
cancellations across all 51 files. Focused counts above overlap this total.
Generated bootstrap and shared SIM assets, merged localization consistency,
touched-source ESLint, formatting and diff checks passed. The independent final
review found no remaining blocker in current/retained Classic, SIM Authored or
Studio custom selection.

Full local builds remain deferred with less than 1 GiB free. The exact-head PR
preview workflow builds the game and optional Worlds archives remotely; its result
and downloads must be checked on the published head before offline acceptance.

## Remaining priorities

1. Bind and fly one reviewed production marking revision, with immutable replay
   dependencies and mip-safe UV gutters.
2. Complete SIM readability across environments, presets, orientation, occlusion
   and grazing views, then target-device frame-time and sustained switching checks.
3. Finish actual input/error journeys, physical touch/controller and screen-reader
   acceptance; localize Replay validator diagnostics through a defined contract.
4. Validate final-head game and optional archives through fresh offline install,
   interruption and recovery. Package-limit checks alone do not close this gate.
5. Expand bespoke Industrial models and deepen each additional family after those
   representative acceptance gates pass.

This pass adds functional original collections and improves shared theme UX. It
is not a claim that every asset is bespoke or that every family is release-qualified.
