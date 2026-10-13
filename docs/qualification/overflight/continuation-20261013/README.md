# Seeded sorties and warning-aware qualification

Implementation `ddd3d3602cd1026740163a33644c72163499a719`, rebased onto main
`45e943bd4`. This continues the [readability packet](../readability-20261013/README.md).

## Completed

- Corrected the explicit review pilot to read lane, fan and ground warnings using
  the same visible geometry as gameplay. Previously it treated every warning as
  a small circle, steering through fan rays. Ordinary controls and game balance
  are unchanged; the pilot cannot change hull, enemies, rewards or offers.
- All three seed-42 Veteran Breakthrough Systems routes now finish: tight
  **340.67s / 7 hits**, orbit **331.07s / 7 hits**, figure-eight **337.85s / 13 hits**.
  Earlier failed attempts remain in the previous packet and the retained traces.
- Repeated the three-seed / two-difficulty / three-encounter / three-build matrix
  with three airframes: **54/54 groups have a completion**, **58 attempts**,
  including **four failed attempts**. [Full matrix](survivor-matrix.json.gz).
  This establishes scripted reachability, not human difficulty or enjoyment.
- All eight rank-two-pulse passive probes still lose with three airframes:
  stationary, tiny-circle, wall and edge-loop in Standard and Veteran.
  [Probe results](passive-probes.json.gz).
- Fixed native built-in sorties so URL seeds, New sortie and difficulty changes
  regenerate the encounter definition using the actual run seed. Same-seed retry
  retains the same definition. Installed, Studio-authored and legacy projects
  retain their exact layouts. Native seeded play now matches the project's
  deterministic qualifier instead of combining two different seeds.
- **250/250 Overflight/Raid tests pass**, including the new seeded-content and
  warning-geometry regressions. **7/7 CI-registration checks pass**. Scoped lint,
  formatting and whitespace validation pass. Test cohorts overlap.

[Tests](tests.tap) · [CI registration](ci-registration.tap) · [source binding](source.json).
The first full attempt lacked four sparse-checkout asset fixtures; restoring
those tracked inputs resolved the file-not-found failures before the full rerun.

## Explicitly skipped at the user's direction

On 13 October the user said **“we don't have that, skip and go to next items”**
in response to the request for Iris Xe Windows hardware, M1 Safari, a physical
controller/phone and five players including two newcomers.

Those checks are **waived for this delivery, not passed**. No target-hardware FPS,
physical-control usability or human enjoyment/readability acceptance is claimed.
They do not block continuing to the next prototype items in this task.

## Local qualification completed

- Native seed-42 Veteran Systems completed in **5:40**, with 3,553 kills and
  ten upgrades. [Result](veteran-seed42-result.png).
- A 30-second warmup plus **15-minute measured soak** completed with 1,500 alive
  and 700 visible actors. No dropped simulation time or sample overflow. The
  sprite pool reached 1,843 and remained there through the final eight minutes;
  two textures used 16,908,544 base RGBA bytes (retained canvases counted separately).
  [Raw download](soak-raw.json.gz) and [summary](overflight-soak-summary.json.gz).
  This local 120 Hz browser ran alongside validation/build work: its observed
  119.19 Hz, p95 10.4 ms and p99 13.9 ms are lifecycle evidence, **not** an isolated
  performance trial or a substitute for waived target hardware.
- Deliberate WebGL context loss/restoration rebuilt the scene and required explicit
  continuation. Continued simulation advanced afterward. Ten native Restart actions
  retained the renderer/appearance and did not grow the canvas count (16 total,
  including shared menu thumbnails; exactly one gameplay canvas checked on retries 6–10).
  [Recovery](overflight-recovery-after-resume.json.gz) ·
  [retry receipts](overflight-native-retries.json.gz).
- Prepared the canonical main-pages distribution at `2e6b81a7b` in memory. Using
  Settings → Install & offline play, downloaded the Overflight and Snake selections
  and observed “verified and ready offline”. Closed the HTTP listener, then opened
  **Raid, Snake and Survivor**, pressing native Start successfully in each. Raid
  and Snake were first visits at this origin. The main home password gate was not
  bypassed: testing used the modes' existing Settings entry.
  [Build](offline-build.json) · [Raid](offline-raid.png) · [Snake](offline-snake.png) ·
  [Survivor](offline-survivor.png). Optional recorded soundtracks were not downloaded;
  master sound was muted, so this is no subjective audio qualification.

Three additional Team/VS Download & play host tests fail identically in the
shared checkout on untouched code. They are outside the Overflight changes;
their failed receipts will remain separate from Overflight's passing tests.

## Next delivery

Continue the C1 Riy prototype with one leader, two distinct escorts and one
focus command, reusing the accepted renderer, assets, fixed-step combat and
upgrade shell. Expanded formation design and character-specific progression
remain follow-on design work. Publication is still a separate action.
