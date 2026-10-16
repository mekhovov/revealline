# WebKit acquisition-frame control — source `8c727777`

The separate compositor check **fails its strict identical-input control** in desktop WebKit 26.5. It uses the verified `8c727777` package, the same synthetic full-quality acquisition fixture and default browser settings. The original Canvas readback failure remains unchanged.

Fourteen page screenshots cover independent A/B/repeat-A painters and same-owner A→B→A replacement. The complete 48 × 36 board is captured at 400 × 300 CSS pixels, DPR 3 (1200 × 900 bitmap). Each explicit draw gets exactly two animation-frame opportunities. Run/checkpoint, owner, painter time/revision/generation and readiness witnesses remain identical before and after every capture.

| Comparison                                     |     Changed pixels | Maximum channel difference |
| ---------------------------------------------- | -----------------: | -------------------------: |
| Identical A/repeat-A at 0.10 s, complete frame | 40,713 / 1,080,000 |                          1 |
| A/B concealed interiors at 0.10 s              |   23,842 / 755,941 |                          1 |
| Identical A/repeat-A at 0.25 s                 |      0 / 1,080,000 |                          0 |
| A/B concealed interiors at 0.25 s              |        0 / 755,941 |                          0 |

All zero-delta controls and same-owner replacement/restoration comparisons match exactly. Exposed-picture and animation positive controls pass. The failed initial identical-input control leaves that concealed-image comparison unqualified; it does not establish a hidden-image leak or explain the difference. No tolerance or acceptance threshold changed.

The owned browser exits normally at 14:01:56.298 UTC, with no page/request errors or forced cleanup. All screenshots, witnesses, bound tools and original failed readback evidence are externally preserved and fully read back. [Exact reports and hashes](solo-compositor-8c727777.json).

This is instrumented synthetic presentation evidence, excluded from performance qualification. Screenshots observe captured composited submission; they do not measure physical display output, input latency or heat. A readback-only or privacy explanation is not established, and later matching samples do not turn the complete check into a pass.
