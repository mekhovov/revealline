# Echo flight and priority-sound follow-up

15 October 2026. Runtime: `a972ed4b7d8452af1d11cbda0f419081d0ab0ece`.
Main `d6f93f71d` was merged without rewriting the pending PR #1503 history.
This delivery does not change ordinary combat damage, encounter populations or
upgrade thresholds. The new route is an explicitly requested review control.

## Implemented

- Local hostile warning-charge rungs and foreground damage/armor cues borrow
  the existing soundtrack player's gain at **0.55 for 0.35 gameplay seconds**.
  Overlapping tails share one lease. No independent music bus, saved-volume
  edits, wall-clock timers or extra audio owner are introduced.
- Pausing, upgrades, fixture entry, retry, owner replacement and disposal release
  this lease. Distant warnings and routine friendly impacts do not request it.
  An overlapping commentator lease retains its own gain and ownership.
- `reviewRoute=lure-and-return` commits to valuable salvage patches for up to
  2.4 seconds, then uses an approach/exit pass around the final tank. A local
  pickup grid scores exact patch values. Ordinary terrain and swept avoidance
  still choose the steering/boost input. Normal starts, older review defaults,
  Raid policies, player power and records remain unchanged.

## Fixed controls: a useful headless completion, not native qualification

`comparison.mjs` runs the same Riy Echo / Slowing Trail / Breaker Burst / Shield
preferences, Receiver Gardens, seed **202604**, Standard, three airframes.
Upgrades are earned, drafts resolved legally, and simulation state is never
changed by the controller. `comparison.json.gz` is complete and its imported
source hashes remained stable throughout both trials.

| Route | Outcome | Simulation time | Choices | Hull damage | Salvage collected / earned |
| --- | --- | ---: | ---: | ---: | ---: |
| Figure-eight control | Lost | 336.20 s | 9 | 300 contact | 1,621 / 2,917 |
| Lure-and-return | Won | 500.67 s | 10 | 220 contact | 3,760 / 4,721 |

The latter evolution was earned at 100.30 seconds. Its last two drafts arrived
at 249.15 and 337.98 seconds: **83.10 / 88.83-second gaps remain unsatisfactory
review questions**, despite eventual completion. It lost two airframes. A
headless win establishes reachability under this controller, not ordinary-player
difficulty, enjoyment, a six-minute clear or broad build acceptance.

Preserved exploratory ablations lost with only the tank-pass change (308.35 s)
or only salvage-patch commitment (355.82 s). Combining both won. Exact sources
and receipts are retained in `exploration.json.gz`. Those prototypes ran outside
the repository: their original relative-path hash keys could collapse for
external files; the archive therefore supplies explicit SHA-256 hashes of all
preserved bytes. The committed portable comparison above is the accepted repeat.

## Native result contradicts a blanket viability claim

The same displayed seed, Standard, three balanced Scout airframes, and route
completed a native review **with a loss at 05:19**, nine upgrades, 1,782 kills,
1,769 collected salvage and 300 contact damage. Its final tank retained 100%
armor and hull. The native results screenshot and text are retained. The run
included a manual pause at approximately 78 seconds to select built-in music,
and two video captures. It is **not performance evidence**.

A fresh same-seed retry was downloaded through the normal Measurements control
and left paused at 5.62 seconds. `native-identity.json.gz` confirms the actual
`lure-and-return` control and project identity `bdafec1ca5d66423`, matching both
headless cases, seed 202604 and balanced flight. Its opening counts match a Node
run using the native review controller at tick 337. This rules out a simple
wrong-route or wrong-project explanation; it does **not** identify the first
later divergence. Browser arithmetic, host/pause interactions and other causes
have not been established or excluded. Do not describe this as a native win or
change weapon strength to make the controller pass.

## Pacing hypothesis: data only, not released tuning

`pacing-hypothesis.mjs` authors a comparison project with only thresholds 9/10
changed from **1,400 / 1,900 to 1,250 / 1,550**. The first eight thresholds,
weapons, enemies and legal upgrade preferences are unchanged. All three final
cases completed with stable source hashes in `pacing-hypothesis.json.gz`.

| Mode / route | Thresholds | Outcome | Time | Longest completed draft gap |
| --- | --- | --- | ---: | ---: |
| Riy / lure-and-return | Proposed | Won | 528.83 s | 52.92 s |
| Single Drone / figure-eight | Current | Lost | 316.33 s | 66.97 s |
| Single Drone / figure-eight | Proposed | Won | 404.17 s | 43.02 s |

Riy's last choices moved to 218.97 / 262.73 seconds. The proposal improves these
measured pacing gaps; it also changes later flight and took longer to win in
Riy. It has **not** passed the matched native or mature unattended matrix,
multiple layouts/seeds, Veteran or all build directions. It is not installed in
built-in projects. Legacy/imported project data is untouched.

The first pacing invocation stopped when its diagnostic assumed every mode had
Riy state. `rejected-pacing-partial.json.gz` and its exact probe source are kept;
that partial receipt is excluded. The corrected complete run is separate.

## Native sound and visual samples

- `native-synth-mix-a972.webm`: 20-second opening sample beginning around 01:25.
  The shared player was explicitly playing **Signal Afterglow** from the
  RevealLine synth collection. This records synthesized music plus enabled
  effects/reactions through the existing post-master capture branch.
- `native-dense-synth-mix-a972.webm`: 20-second sample beginning around 04:53,
  approaching the final encounter. The same built-in playlist remained active
  and advances tracks normally; exact per-frame track attribution was not logged.
- `native-lure-a972.png`: actual native scene at 02:43.
- `native-result-a972.png` / `.txt`: the actual failed native result.
- `native-last-diagnostics.json`: last displayed renderer counters, at 292.98 s;
  it is not the terminal report or a successful benchmark.

Both WebM files contain stereo 48 kHz Opus audio. Opening peak/mean levels were
-18.6/-40.7 dB; dense sample -16.3/-42.7 dB. These establish non-silent signals,
**not** warning intelligibility or a pleasing mix. External MP3 playback is
covered by mixer integration tests and a native playing-state check; the native
recorder still excludes external media tracks. Boss-only full-mix review,
Classic/Reactions comparison and subjective listening acceptance remain open.
The original Ukrainian/Carol of the Bells selection, paused transport and mute
were restored after capture; volumes and reaction choices were preserved.

## Verification and remaining gates

`checks.tap`: **112/112 passed**, zero failed/skipped. This includes real synth /
MP3 shared-player leases, volume edits and commentator overlap; audio lifecycle;
native route forwarding; terrain avoidance and committed pass inputs; existing
no-pulse wins and simple unattended defeats; Riy squad and recorder regression.
An initial command named a nonexistent test file and ran no tests; its rejected
invocation is retained separately. Changed files passed ESLint and diff checks.
Offline inclusion checks are recorded separately, not counted in the 112.

Next priorities:

1. Establish where matched native/headless playback first diverges, and review
   actual flight choices before accepting Echo/Riy build viability.
2. Repeat the proposed late pacing across the accepted active/unattended matrix
   before any default changes. Do not tune early evolution or add blanket power.
3. Review the supplied complete built-in mixes audibly, then add a boss sample
   and explicit Classic/Reactions comparison. Audio gain correctness is tested;
   final sound quality remains a listening judgment.
4. Continue full-build/map readability, provisional medal/Marathon review,
   imported-library anomaly monitoring and selective cross-mode presentation.

External hardware and five-player trials remain **skipped, not passed**.
No new full-content performance, stress, soak or fresh offline installation
qualification is claimed for this follow-up.
