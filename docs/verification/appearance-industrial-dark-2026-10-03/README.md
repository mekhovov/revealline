# Industrial material restoration and dark collections — 2026-10-03

This follow-up to merged PR #955 restores the requested Industrial Workshop detail
while preserving immediate theme selection and quieter controls for other families.

## Design and implementation

Industrial Workshop has its own material treatment: corner fasteners, six-pixel
edge wear, deeper bevels and a static steel-seam backdrop. Existing immutable
material resources provide the frame. Reading centers retain exact semantic
background colors; primary and selected controls use the matching amber frame.
Decorative Off, high contrast and forced colors disable this treatment.

Three new original dark collections use the existing interface, Arcade and SIM
contracts. Each includes a brief English/Ukrainian explanation, all current
semantic roles, and seven original procedural SIM material finishes:

- **Obsidian Reliquary:** volcanic black stone, aged gold, bone labels and garnet.
- **Deep Space:** blue-black instruments, ice-blue indicators and warm navigation lights.
- **Moonlit Grove:** nocturnal forest, fern greens and silver moonlight.

The same catalog supplies the dropdown, instant preview cards, Studio and SIM.
Existing geometry, flight rules, course content and old pinned revisions remain.
These are coordinated material collections; they do not claim bespoke model libraries.

## References

[Factorio’s GUI tileset](https://www.factorio.com/blog/post/fff-243) was inspected
for reusable component framing, state hierarchy and readability. Its
[GUI design discussion](https://www.factorio.com/blog/post/fff-238) supports
restrained decoration around readable content. Our Industrial treatment is an
original interpretation, with decoration concentrated at material edges.

[Hades’ official game presentation](https://www.supergiantgames.com/games/hades/)
informed the dark stone/gold direction; [Starbound’s official media](https://playstarbound.com/media/)
informed the space-instrument direction. [Hyper Light Drifter’s official screenshots](https://www.heartmachine.com/hyper-light-drifter)
were inspected for layered pixel materials and separation of scenery from small
bright signals. [Celeste’s official site](https://www.celestegame.com/) provides
additional pixel-adventure context. These are visual interpretations, not
claims about their internal implementations or a popularity ranking. No artwork,
logos or interface assets from those games are shipped.

## Validation

The new branch integrates `8896c4976` (including warehouse PR #966) without
altering that renderer work. Runtime source for these checks is `2573ced30`.

The [browser receipt](browser-review.json) records 16 matching gallery/dropdown
choices, immediate click/Enter selection with focus preserved, and exact amber
selected backgrounds. Industrial has material borders; Off and high contrast
remove them. New dark themes retain quiet buttons. No game or SIM console errors
were observed.

- [Restored Industrial menu](industrial-home.png) and [settings](industrial-settings.png)
- [Deep Space](deep-space-settings.png) and [Moonlit Grove](moonlit-settings.png)
- [Ukrainian Obsidian cards](obsidian-uk-desktop.png)
- [Industrial candidate inside DOS Studio](industrial-studio-in-dos.png)
- SIM: [Obsidian](obsidian-sim.png), [Deep Space](deep-space-sim.png),
  [Moonlit Grove](moonlit-grove-sim.png)

The actual Studio candidate retains its steel material inside flat DOS editor
chrome, while the editor buttons remain flat. No workspace revisions were saved.
Game/editor appearance was restored to Industrial, English, normal contrast and
theme-default detail. All three new SIM collections render in Training Hangar /
Lift and land / Balanced at the same 198 calls, 7,490 triangles and 19 textures in
the fixed view. These counts are not a p95 performance qualification.

English and Ukrainian card text fits the observed 926- and 1280-pixel layouts.
The requested 390-pixel browser override did not affect the measured tab sizes;
no new mobile-width pass is claimed. The temporary override was reset.

Bootstrap now occupies **71,349 bytes**, down from 100,390 despite adding three
families; the 100 KiB cap stays unchanged. Exact old/current revision, Off and
high-contrast parity checks pass. Independent comparison of 15 malformed/custom
seed cases retained pre-compaction acceptance/fallback behavior. Old interface
documents, Arcade sprite pixels and all seven SIM source maps are checked against
an aggregate pre-change digest.

The integrated 51-file cohort passed **434/434 tests**, with zero failures, skips
or cancellations. See [the source hashes and command](integrated-checks.json) and
[full test output](integrated-tests.tap). Generated bootstrap/shared-SIM asset
checks, localization consistency (12,493 messages), touched-source ESLint,
formatting and diff checks pass.

Full local build remains deferred because the volume has less than 1 GiB free.
[Draft PR #967](https://github.com/mekhovov/revealline/pull/967) publishes this work.
The repository release gate requires an immutable release slot; this continuation
remains draft rather than allocating a release. Its Appearance preview workflow
builds game and optional archives;
its status is separate from these local checks. The prior main-line Company
Candidate artifact exceeded its 64 MiB ceiling, which this theme pass does not
raise or waive.

## Wider plan still open

Production marking revisions and model art, full environment/quality readability,
target-device p95 performance, physical controller/touch/screen-reader acceptance,
and fresh final-build offline installation/recovery remain separate gates.
