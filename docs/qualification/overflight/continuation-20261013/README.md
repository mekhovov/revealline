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

## Local qualification in progress

- Current-candidate browser soak, graphics recovery and retry checks.
- Prepared-distribution offline launch of Survivor, Raid and Snake.
- Native seed-42 Veteran completion capture.

Three additional Team/VS Download & play host tests fail identically in the
shared checkout on untouched code. They are outside the Overflight changes;
their failed receipts will remain separate from Overflight's passing tests.

## Next delivery

Continue the C1 Riy prototype with one leader, two distinct escorts and one
focus command, reusing the accepted renderer, assets, fixed-step combat and
upgrade shell. Expanded formation design and character-specific progression
remain follow-on design work. Publication is still a separate action.
