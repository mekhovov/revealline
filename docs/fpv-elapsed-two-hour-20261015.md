# Two-hour elapsed regional flight receipt

The uninterrupted native-browser segment completed **7,200.0052 monotonic seconds**
(7,200.015 wall-clock seconds), with 360,000 production simulation steps and
863,999 rendered frames. It made 53 reversals, 268 cell crossings and 269 origin
recentres, with zero contacts. The clock reports completed and the segment is
accepted; no stopped or invalid prior segment contributes to its duration.

## Exact workload and identity

- Frozen production source: `2cfe7a25d6b87913dd4d9ddbc7b2bd7478068071`.
- Package revision: `cc681b907bb9414034650dad0045699f7febee60e7b6d4a10c800bb6190fece3`.
- Authoring harness: `aa01ebfed8c97d47f4495fdb73841b3e463a4c00`.
- All 159 runtime files (17,407,409 bytes) compare byte-for-byte with the original
  qualified distribution archive and its manifest. All four harness files match
  their Git revision. The eight browser-observed direct hashes match that closure.
- Reviewer machine: Mac16,7, macOS 26.7.1; Codex browser Chrome 155. The browser's
  user-agent compatibility string reports Intel Mac OS X 10_15_7; it does not
  independently establish the hardware model or current OS.
- Measured viewport 1280 × 720, DPR 1; canvas 1280 × 417.59375 CSS pixels,
  1280 × 418 backing pixels. Balanced, Chase view, Self-level, repeated synthetic
  six-cell corridor. Other engineering work continued on the machine, but no
  additional review canvas was opened during the uninterrupted segment.

The raw report keeps its original unverified-label flags. The separate archive and
Git comparisons above provide the identity evidence; the report was not rewritten
to turn reviewer labels into automatic assertions.

## Observations

| Measurement                                    |                Observed |
| ---------------------------------------------- | ----------------------: |
| Frame interval mean / maximum                  |        8.3334 / 62.9 ms |
| Physics callback mean / maximum                |         0.1536 / 4.0 ms |
| Draw submission mean / maximum                 |         0.4060 / 2.1 ms |
| Peak query worlds / colliders / rigid bodies   |              4 / 18 / 0 |
| Peak tracked resident geometry                 |           152,856 bytes |
| Peak reserved geometry allowance               |         8,693,600 bytes |
| Peak tracked source / source reservation       | 127,308 / 254,616 bytes |
| Peak renderer geometries / textures / programs |              53 / 7 / 9 |

The reservation is an allowance, not measured allocated GPU memory. The existing
mixed-window allocator has a 10 MiB combined ceiling and an 8 MiB scenery slice;
no limit was raised for this run. Source-study admission separately retains its
stricter 8 MiB retained-plus-candidate acceptance. Keep these quantities distinct.

After disposal: zero query worlds, colliders, rigid bodies, owned geometry/source
reservations, root children and registered geometries/materials/textures. Renderer
bookkeeping reports zero geometries/programs and one internal texture after the
context is explicitly lost. This is not a claim of measured driver/GPU reclamation.
The report retains 121 minute samples and the last 120 second samples, so diagnostics
remain bounded over the full run.

## Scope and remaining work

This closes the real-elapsed corridor endurance case. It does **not** qualify every
large region, all flight modes, actual player input, mobile or Steam Deck FPS,
network-wide offline operation, browser restart or final visual quality. CPU
submission and animation cadence do not measure GPU completion. Physical-device
and full-region coverage remain in P4/D6.

Raw evidence is in `authoring/fpv-worlds/regions/elapsed-receipts-r2/`:
`two-hour.json`, `runtime-closure.json`, and `harness-closure.json`. The earlier
stopped/frame-gap negative receipts remain preserved. The completed native view was
saved externally as `fpv-temp/endurance-2h-final-20261015.png`; the temporary viewport
was reset and the completed review tab closed before other native checks resumed.
