# Ukrainian community and cultural scenes: first C5 source cohort

Three retained original reveal-art candidates: a community workshop, a Poltava
courtyard and a Synevyr-inspired lake. The current priority is A current
characters/reliable play, then B encounter variety and C one finished cohort,
with necessary authoring work in parallel. C2’s human study remains last. This
is not a published theme, approved DroneAid branding or a new mission. Existing pictures and historical ownership remain unchanged.

## Use the real Studio workflow

Open `/authoring/asset-studio/`, then **Artwork collection**. Import
`collection.json` together with all three `*-original.png` files. The panel validates the
packet, exact original bytes and decoded image dimensions before showing the
preview. Export its `.rlart` packet, reload the page and reimport that downloaded file to verify the
collection policy and original-image round trip. No file is fetched from the
reference URLs. The tool does not publish or approve the artwork.

## Source facts and visual review

All three generated outputs are **1774×887**, exact 2:1. Total encoded originals:
**7,633,598 bytes**. Combined decoded RGBA lower bound: **18,882,456 bytes**,
excluding decoder/GPU copies. Exact hashes, file facts, sources and full effective
prompts are recorded in `collection.json`.

| Source                | PNG bytes | Pending visual check                                                                                                                                                                            |
| --------------------- | --------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workshop              | 2,408,056 | Actor/outline contrast over bright workbenches and dense equipment                                                                                                                              |
| Poltava courtyard     | 2,914,645 | Cultural review: generated paired shutters and ornamental beam ends need correction/review against the textual single-leaf shutter reference; do not call this an exact Kuntseve reconstruction |
| Synevyr-inspired lake | 2,310,897 | Contrast over reflections and shorelines; fictional geography, no exact-site claim                                                                                                              |

Workshop details:

- Original: **1774×887 PNG**, **2,408,056 bytes**; exact 2:1 composition.
- SHA-256: `8782c3642af6866d09e441891b34876e0c8fa3197a018d9e0cef562699a79cf8`.
- Decoded RGBA lower bound: **6,294,152 bytes**; excludes decoder/GPU copies.
- Built-in image generation; the full effective prompt is preserved in
  `workshop-prompt.txt` and the collection packet. No CLI fallback or image edits.
- Requested workshop 1536×768 and courtyard/lake 1152×576 differ from actual
  output. Preserve the original. Separately identified board candidates have
  now been prepared through Studio: see
  [the retained revision 5 packet](board-candidates-v1/README.md). The revised
  Poltava source and its [revision 7 wide derivative](../community-art-cohort-v2/board-candidates-v1/README.md)
  preserve the earlier originals. These are candidates; gameplay contrast,
  cultural/art review and production adoption remain open. Never relabel an
  original as having its derivative’s dimensions.

The generated scene has two equipped workbenches, open-frame craft without
mounted propellers, shared electronics work, transport cases, practical lighting
and Ukrainian blue/yellow accents. It has no invented gameplay obstacles or UI.
The dense foreground and warm work surfaces require actor/outline readability
checks on real boards before adoption. This is pixel-style scene artwork, not a
claim that a generator produced a hand-authored 32/64px sprite grid.

[DroneAid’s workshop description](https://drone-aid.nl/en) informed the learning
and equipment setting. [Social Drone UA](https://www.socialdrone.com.ua/) supplied
broad community context. Both are **reference-only**; no website photographs,
logos or text pixels were used. The scene is fictional and does not represent an
exact community premises or endorsement.

## Remaining C5 work

Board preparation and native packet round trips are recorded in the linked
revision 5 and revision 7 evidence. Full/partial reveal readability and production
review remain open; adopt through versioned presentation bindings only after
those checks. Complete community actor/state/branding cohorts, regionally coherent cultural scenes, Retro and Coupa treatments. The
Poltava courtyard and Synevyr-inspired source scenes are now included; their
cultural/readability review and adoption remain open. The original Poltava image
here remains unchanged; later architecture corrections belong to its separately
identified revision 6 source and revision 7 derivative. The separate optional
CC0 photograph is preserved in `../real-world-references/`.
No C5 cohort is declared production-complete by this first source image.
