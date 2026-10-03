# Material-depth references and decisions — 2026-10-03

These are original game-design interpretations of primary references, not sourced textures, copied game artwork, or claims of traditional authenticity. This document records recommendations; it is not a screenshot or performance acceptance receipt.

The current gap is structural: distinct palettes often share identical panel construction and only a small corner motif. Treat surface finish, constructed edge, and large-panel/header ornament as separate roles. Full-surface finish should start around 1–3% tonal variation; assess final composited text contrast rather than assuming a fixed opacity is safe. Reserve stronger markings for an 8–14px header/outer band. Repeating the existing 48px nine-slice center would repeat corner fasteners and bevels through reading areas.

| Family / material                  | Surface and larger-panel detail                                                                       | Interaction                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Classic Field Kit / legacy         | Texture-free navy casing; crisp registration ticks in headers.                                        | Cyan edge; reversed pressed bevel. Preserve original r1 behavior.     |
| Industrial Workshop / steel        | Fine painted-metal grain, directional sheen, recessed seams; fasteners at outer corners.              | Machined raised lip, amber selected pair, compressed pressed edge.    |
| Vyshyvanka / linen                 | Near-black fine weave; crimson geometric stitch band at header/footer only.                           | Short red seam on hover; readable solid crimson selection.            |
| Dnipro Porcelain / porcelain       | Cool glaze and faint broad sheen; cobalt double rim and one header botanical/water mark.              | Stronger cobalt rim; inset glazed pressed tile.                       |
| Tryzub / brass                     | Navy enamel with satin variation; symmetric gold header rules.                                        | Gold edge catches light; inset enamel press.                          |
| Desktop 98 / classic               | Texture-free gray plastic with paired light/dark bevels; navy title bars and embossed group dividers. | Reversed bevel, dotted keyboard focus; no glow.                       |
| DOS Navigator / terminal           | Flat blue planes, double-line outer frames and single-line dividers.                                  | Immediate inverse selection and visible focus; no scanline filter.    |
| Orchard Workshop / wood            | Warm fine horizontal wood fibers, paper inserts; leaf/notch at header ends.                           | Brighter top grain and compressed lower lip.                          |
| Neon Ruins / composite             | Indigo ceramic with faint diagonal facets; asymmetric broken jade corners.                            | Narrow jade edge; restrained static focus highlight.                  |
| Pocket LCD / lcd                   | Sage display film, faint pixel matrix, molded housing bevel; housing grooves outside text.            | Hard monochrome inversion and physical button depth; no ghost text.   |
| Copper Observatory / copper        | Petrol enamel and brushed copper rails; engraved header arcs and calibration ticks.                   | Copper edge sheen; inset instrument selector.                         |
| Sakura Station / sakura            | Warm satin porcelain; one cherry petal header cluster and fine plum rule.                             | Plum hover rim; solid paired cherry selection.                        |
| Obsidian Reliquary / brass variant | Dark granular stone with broad facets; clipped corners, sparse aged-gold inlay.                       | Gold cut-edge highlight; recessed press, distinct from Tryzub enamel. |
| Deep Space / composite variant     | Blue-black horizontal anodized brushing; access seams and one orange header marker.                   | Cool-blue inset edge, without neon bloom.                             |
| Moonlit Grove / wood variant       | Dark green vertical fibers with cool satin edge; silver crescent/fern header detail.                  | Moon-silver hover edge and lilac selection, without particles.        |

## Primary references

- [Factorio GUI component work](https://factorio.com/blog/post/fff-243): component hierarchy and reusable material construction.
- [Museums Victoria embroidered blouse](https://collections.museumsvictoria.com.au/items/2634125): concentrated red/black textile ornament placement.
- [Ukrainian Museum Fund porcelain dish](https://museum.mincult.gov.ua/collections/blyudo-ovalne): quiet white field with blue rim.
- [UNESCO Petrykivka documentation](https://ich.unesco.org/en/RL/petrykivka-decorative-painting-as-a-phenomenon-of-the-ukrainian-ornamental-folk-art-00893): botanical ornamental tradition; not an assertion that every blue/white motif is Petrykivka.
- [National Bank of Ukraine state-symbol designs](https://bank.gov.ua/admin_uploads/article/Banknotes-and-coins-of-Ukraine_2022_en.pdf?v=16): blue/gold and engraved object framing.
- [Microsoft command-button guidance](<https://learn.microsoft.com/en-us/previous-versions/windows/desktop/bb246415(v=vs.85)>): control hierarchy and focus conventions.
- [FreeDOS Edit guide and screenshots](https://www.freedos.org/books/get-started/11-using-edit/): text-mode frames, inverse selection, keyboard indications.
- [Nintendo Game Boy hardware](https://www.nintendo.com/en-gb/Hardware/Nintendo-History/Game-Boy/Game-Boy-627031.html): LCD and molded enclosure distinction.
- [Science Museum astrolabe](https://collection.sciencemuseumgroup.org.uk/objects/co56975): engraved metal instrument detail.
- [Met cherry-blossom porcelain dish](https://www.metmuseum.org/art/collection/search/52281?locale=en): ceramic finish and reserved botanical composition.
- [Stardew Valley media](https://www.stardewvalley.net/media/), [Hyper Light Drifter](https://www.heartmachine.com/hyper-light-drifter), [Hades](https://www.supergiantgames.com/games/hades/), [Starbound media](https://playstarbound.com/media/), [FTL](https://new.subsetgames.com/ftl.html), [Eastward forest imagery](https://chucklefish.org/blog/eastward-winter-development-update/): distinct environmental/material identity and information hierarchy, interpreted originally.

## Consumer inheritance

`ResolvedPresentation.materialVariant` and `data-theme-finish` distinguish Obsidian/Tryzub, Deep Space/Neon, and Moonlit/Orchard. Installed interface IDs determine the variant. Community candidates use their explicit interface basis independently of their Arcade/SIM family. Unknown, unavailable, or incompatible bases use the shared material style. This derived field does not alter serialized interface documents, candidate IDs, existing SVG bytes, Arcade pixels, or SIM materials.

The first-paint reader accepts only installed style-compatible variant pairs; older seed records without the optional variant retain their shared material style until runtime resolution. Accessibility/ornament gates remain separate from identity: high contrast, texture Off and forced colors must remove decorative finishes without losing semantic state/focus cues.
