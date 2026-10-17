# Held First Return route proposal — 2026-10-17

Status: model-tested proposal only. No remote release, native-browser pass,
30-minute completion, performance qualification or historical gate promotion.
The failed recipes and all twelve observations from run `38992974807` remain
unchanged; see [the sustained diagnostic report](solo-soak-diagnostics-20261017.md).

## Separate route

First Return starts at `(24.5, 0.5)` on the upper boundary. Replace its two
precision-timed commands with these public keyboard holds:

| Action                       |                            Hold | Intended boundary                                  |
| ---------------------------- | ------------------------------: | -------------------------------------------------- |
| Up                           |                        1,000 ms | Remain anchored at the authored upper edge         |
| Down                         |                        8,000 ms | Complete the full-height cut at the lower boundary |
| Result, snapshot, Retry/Next | Original controls and deadlines | Require a real public win before continuing        |

The long downward hold leaves room for ordinary callback quantization and the
older Phaser startup cooldown. It does not pause, resume, inspect mutable state
while playing, teleport, modify the mission, or change simulation/replay rules.
Nominal model output is one closure, 34 trail cells, 816 claimed cells, three
remaining lives and a won result. Coverage is 34.29%, exceeding the unchanged 30%
goal. The earlier route normally claimed 51.43%; these are different workloads,
so the new result cannot replace the old capture-cost observations. This route
does not claim the moving-turn workload exercised by the separate LongRail lane.

Three new fixtures in `fixtures/solo-remote-sustained/` are held:

- `soak-first-return-anchored.qualification.fixture`: keeps the 360-cycle cap,
  **1,800,000 ms minimum**, 2,400,000 ms scenario limit, all resource rules,
  result snapshots, Retry preparation, one-second post-Retry wait, and final
  fresh-attempt replay export. It explicitly opts into `snapshot-chunks-v1`
  storage; the Next and Retry fixtures retain inline evidence.
- `retry-first-return-anchored.qualification.fixture`: keeps exactly 20 public
  Retry transitions and the original 900,000 ms limit.
- `next-first-return-anchored.qualification.fixture`: changes only First Return's
  two holds. All ten Next controls and the other ten mission routes remain
  unchanged. Those other routes are **not** established robust by this model.

Nominal authored soak holds/waits total at least ten seconds per cycle, before
result and preparation overhead. The same 30-minute minimum remains a repeated
lifecycle session, not 30 continuous active minutes. At most 362 explicit
snapshot actions are possible (prepared, 360 completed, final); automatic or
failure observations need additional bounded storage allowance. All snapshots
must remain retained. The reviewed chunk-storage helper retains the existing
128 MiB total evidence cap, with a 96 MiB writer allowance and 32 MiB reserved
for sibling evidence. Its 512-snapshot limit accommodates this fixture, including
a final failure snapshot. A shorter native preflight must keep inline storage: it
does not meet the chunk-storage policy’s declared 30-minute-repeat requirement.
The evidence cap must not be raised or treated as a game crash.

## Finite model evidence

`scripts/test-solo-soak-anchored.mjs` passes all three tests, including **2,518**
declared timing schedules. Every schedule wins with three lives and the same
816-cell capture, and its unchanged model recording passes strict replay and
definition/mechanic checks. The core/replay and scene-clock source are unchanged
from `3adcd53792043ef02459e86168c6b33a66d6ef00`.

- Native scene-clock schedules at 30/40/45/60/90/120/144 Hz, half-callback input
  offsets, alternating rates and changes every twenty callbacks.
- Active startup admission delays from zero to two seconds; a separate first
  callback delayed by 200 ms.
- Independent −200/0/+200 ms hold changes and zero/200 ms inter-action gaps.
- An extra 200 ms callback delay during anchoring, cut entry or the cut itself;
  all declared callback intervals stay below the existing 250 ms pause boundary.
- The pinned Phaser 4.2.1 `smoothDelta` implementation with both zero and 120
  remaining cooldown callbacks, plus 100 seeded combinations of the above.

The original route still fails a declared cold-Phaser 30 Hz undertravel control:
it remains running with an unfinished cut. No neutral wait is credited as a
closure. Exploratory lateral-anchor routes and later-start failures are retained
in the local scratch reports; they were not remote qualification runs. In
particular, delays outside the declared admission envelope can move the keeper
into this route. Finite model coverage is not a universal scheduling guarantee.

The full model group passed on Node 22.22.2 in 38.8 seconds. Lint, formatting and
diff checks passed. The earlier 2,476-schedule pass is retained separately; the
final run adds 42 delayed-first-callback cases. The later soak-only storage
metadata change leaves those model inputs unchanged and has a separate passing
structural-preservation check. The model does not exercise the
DOM result countdown, media, native engine arithmetic, public Next preparation,
thermal behavior or actual elapsed 30-minute execution. A separately declared
short native preflight must verify public win/Retry/Next behavior and unchanged
strict replay before any new sustained release. No automatic retry is authorized.

## Retained identities

| New fixture | SHA-256                                                            |
| ----------- | ------------------------------------------------------------------ |
| Soak        | `079d4dd76fbd914ddd4da7311f8e6cee4a0ff4fc3bc951842b2921c94c53b8ff` |
| Retry       | `77458b3992e1f40b565bd57912bdc2b4e79ddadb8ce07b617456e220853fe9d1` |
| Next        | `17aa6627b51310ea2ccc4cca2d77a5a9f00d68c6a4edff114720480c208ae11b` |

Final TAP is `.cache/solo-followup/soak-route-model/anchored-model-v2.tap`.
Original fixture hashes, structural equality of every unmodified field, retained
run identities and source guards remain required for a prospective release.
