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

Pending final integrated checks and actual browser review.

## Wider plan still open

Production marking revisions and model art, full environment/quality readability,
target-device p95 performance, physical controller/touch/screen-reader acceptance,
and fresh final-build offline installation/recovery remain separate gates.
