# Compact FPV enemy originals

Seven independently generated body images explore bright, broad silhouettes for the seven existing enemy types. These are source candidates; they are not installed in the game, player presets, an enemy registry, or a release.

| Existing type | Body cue |
| --- | --- |
| bouncer | Wide continuous treads, pale edges, amber north nose |
| border-patrol | Four separate rotor rings and an open X |
| contour-patrol | Two side nacelles, crossbar and a long rear boom |
| claimed-rover | Six separate round wheels and amber cabin |
| eroder | Large north-pointing triangular drill and narrow rear pod |
| lane-boss | Wide amber bar and three spaced feet |
| relay-sentinel | Bright center aperture with four diagonal shield fins |

Each PNG has its own exact [prompt](prompts/), original path and preserved default tool output in [provenance.json](provenance.json). All seven used separate built-in imagegen calls with no image inputs. The earlier detailed atlas was inspected as a concept reference and remains unchanged. None of its cells was cropped into these originals. All source bytes and embedded provenance are retained; there was no background extraction, palette reduction, stretching, resizing or image editing.

The requested format was 1024×1024. Every actual original is **1254×1254 RGBA8**; together they occupy **6,522,849 bytes**. The exact measured alpha-zero counts, partial/opaque counts, alpha≥128 bounds and color counts are in [inspection.json](inspection.json). A sequential Pillow verify/load pass read all seven in about 0.45 seconds and checked each source hash before and after. The retained first inspection assumed more than10% exactly alpha255 and refused the hunter; the corrected measurement uses near-opaque alpha≥250, retaining the actual255 count. Most body pixels are alpha253/254, with real alpha0 backgrounds. No source bytes were adjusted to pass.

The palette brief asked for12–16 colors, and the output **does not meet that count**: actual visible RGB colors at alpha≥128 range36,614–63,141. Shading and low-alpha fringes remain. At the threshold used for the brightness measurement, only drill, emitter and relay exceed50% mid/light near-opaque pixels. Substantial widths range73.13%–98.09%, meeting the70% broad-shape aim but often exceeding the requested82–88% framing. The relay ring is closer to octagonal than the requested hexagon. Keep these differences visible in any future selection decision.

Open [the source preview](index.html) through a static server to compare full unchanged originals at16/24/32/64 CSS pixels on light and dark backgrounds and rotate their north heading. The center cross is the declared image-frame pivot, not a calibrated physics or optical pivot. Root reviewed all seven North and East in the source browser preview:24/32/64px shapes were distinct and clearer than the detailed atlas, while the twin-rotor body remains thin at16px. This accepts the source direction and does not certify all headings, motion, gameplay or physical devices. Full-page screenshots may be rescaled or stitched and do not establish physical device sizes.

These static images include baked rotor blades and other fittings. They do not provide moving rotors, treads, wheels, an auger, radar sweep, shield states, attack poses, collision variants, timings or animation rigs. A future body/rig feature must preserve functional warning and contact overlays, uploaded-image precedence, enemy type/skin identity and current collision rules. No56-set target or gameplay/device quality approval is claimed.

For repeatable read-only measurements, run `python3 inspect.py` with Pillow installed from this directory; it emits JSON to stdout and writes no images or source files. The recorded inspector was run from an equivalent cache copy. It checks the finite seven-type order, exact originals and real transparency; it deliberately reports palette deviations rather than quantizing them. Package originals individually only after a separate measured runtime budget and visual review. The existing detailed atlas and all player/art history remain outside this source cohort.
