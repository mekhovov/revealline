# Reserve illustrations · wave 2

Four new source illustrations extend [wave 1](../reserve-illustrations-wave-1/README.md)
from commit `ec052af43a53354e3b8df5733448adcbb0b020b1`. These are reserve
reveal-picture compositions: eight distinct reserve works across the two waves.
They add no maps, runtime assets, rewards, packs, animation rigs or release.

| Theme         | Selected illustration                                                    | New composition                                                                                                        |
| ------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| FPV Front     | [Reedwater Relay](originals/fpv-reedwater-relay.png)                     | A complete friendly FPV quadcopter, lantern and wet landing deck beside a quiet river pumping house at blue hour.      |
| Ukraine Atlas | [Moonlit Loom](originals/ukraine-moonlit-loom.png)                       | A timber loom and cream/red/indigo cloth, yarn basket and invented string instrument, overlooking a moonlit valley.    |
| 1994 Forever  | [Midnight Disk Station](originals/retro-midnight-disk-station-clean.png) | A cream CRT computer, starfield, floppy disks and unbranded gamepad; a rainy elevated railway and sleeping cat beyond. |
| Spend Network | [Cloud Cart Exchange](originals/spend-cloud-cart-exchange-clean.png)     | An original friendly logistics cart carrying useful materials through a bright cooperative market plaza.               |

The four selected files total **9,832,692 bytes**. Each is an unchanged
**1774 × 887, 8-bit RGB PNG**, exactly 2:1. The requested 1792 × 896 size was a
generation target; returned pixels are preserved without resampling. The
[manifest](manifest.json) identifies exactly four selected works.

The built-in image generator made four separate text-only scenes. Two additional
targeted edits removed decorative banner emblems from Spend and lettering-like
marks from retro equipment. All six tool outputs are retained, including the two
initial versions; those variants are provenance, not additional reserve works.
The selected edit outputs preserve the compositions while simplifying some
surface details; this is not a claim that every unrelated pixel remained exact.
Full requests and cleanup instructions are under [prompts](prompts/), with tool
paths, exact hashes, dimensions and clone identities under [provenance](provenance/).

The full originals were inspected with `view_image`, including both cleaned
versions. The [comparison page](provenance/index.html) places each selected wave2
scene beside its wave1 counterpart at 320 × 160 CSS pixels. This compares
composition and small-scale readability. Both author and parent reviewed the
[actual browser comparison](provenance/game-scale-comparison.jpg); all eight images
loaded at the specified CSS size. The retained screenshot is JPEG despite its
original capture filename ending in `.png`; its bytes are unchanged. An actual
map still needs its own capture-mask, crop and reward-timing checks.

Run the finite comparison server with `python3 provenance/serve.py` from this
cohort directory when wave 1 is checked out beside it. For separate sparse
worktrees, pass `--previous /absolute/path/to/reserve-illustrations-wave-1`. It
serves only the comparison HTML and eight images on a new loopback port.

The broad objects and warm/cool light provide connected foreground, middle and
distant discoveries. Fine reeds, woven threads, fittings and background windows
compress at small sizes. The style is pixel-art-inspired with stepped clusters,
not a measured fixed palette or uniform pixel grid. The loom and string
instrument are invented cultural imagery, without historical or construction
accuracy claims. FPV equipment and locations are fictional and non-graphic.
Spend's background figures are small fictional silhouettes, not identifiable
people; the cart is not an official Coupa/Navi mascot or a product feature claim.
The retro hardware evokes a general period rather than certifying a particular
machine or controller design. No legible text or branding is intended in the
selected files; initial cleanup targets remain visible only in retained variants.

Prompt examples: “one unmistakable foreground hero object readable at 320 by
160,” “a broad traditional wooden handloom with an unfinished cream textile,”
and “open trays holding neatly grouped reusable brass fittings, folded fabric
and plain small parcels.” Exact prompts contain the full fictional-scene and
no-text/no-logo constraints.

Workspace originals use separate-inode APFS clones of the preserved tool files.
Their logical sizes are not exclusive disk allocation. The cohort budget counts
all six tool originals, new Git object storage and small inspection evidence;
no original output was deleted, rewritten or locally resized.

The [measured storage record](provenance/storage-budget.json) accounts for
30,818,663 bytes including a 1 MiB metadata allowance, below the 32 MiB cohort
budget. This counts all six outputs, not only the selected four.
