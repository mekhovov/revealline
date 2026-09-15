# Test results — v0.51.2

Base: `6cbe1c8` (v0.51.1). Node 20.19.5 on macOS. All 333 files from [the inventory](test-inventory.txt) were submitted to the repository-wide run. The run uses three concurrent files, a 600-second file limit and Node's force-exit option.

## Repository-wide run

**3,645 passed; 6 failed; 3 cancelled by the file time limit; 0 skipped. Exit status 1.** The full runner reports 3,654 tests. See the [complete compressed TAP output](full-suite.tap.gz).

The six assertion failures are the two corrected menu expectations and the four unchanged-base audio cases below. The three cancellations are Countercurrent, Fracture and route/world integration; the retry table records their separate final results.

The full run preceded the two menu expectation corrections and the final training-height regression. Their complete affected suites were rerun after those changes; the results below supersede the earlier results for those files.

## Focused verification and timeout retries

| Check | Final result |
| --- | --- |
| Flight layout geometry, adapter and training space | 42 passed |
| Field Kit menu destinations, deployment guard and return flows | 4 passed |
| Countercurrent chapter integration | 4 passed; 915.6 seconds |
| Fracture chapter integration | 4 passed; 1036.0 seconds |
| Route/world integration | 10 passed; 618.7 seconds |
| Source validation | Passed; v0.51.2; 569 files; literal references valid |
| ESLint for changed JavaScript | Passed, no warnings |
| Prettier for changed source | Passed |
| Responsive browser sweep | 230 recorded observations across 24 viewport configurations; see the main report for the per-screen matrix |

Reported retry durations sum the top-level test durations and exclude module initialization.

The chapter retries retain every assertion and use a single file with a longer time limit. Countercurrent uses 1,200 seconds; Fracture and route/world use 1,800 seconds. They exercise large authenticated images, multiple real wins, exact owners and fresh-profile backup recovery. All three timed-out files passed their complete retries. The original cancellations are not counted as successful checks. [Focused and retry output](focused-tests.txt) contains the exact results.

## Remaining failures reproduced on the base

Four audio host tests fail with this layout change disabled:

| Test file | Failure |
| --- | --- |
| `game/test/enemy-guide-host.test.mjs` | Returning from a lesson does not settle into resumed streamed music in the “streamed music continuing” case. |
| `game/test/soundtrack-host.test.mjs` | Settings → Studio stored-MP3 case fails its paused-state expectation at line 119. |
| `game/test/soundtrack-host.test.mjs` | Hide/focus does not restore the prior listening state. |
| `game/test/soundtrack-host.test.mjs` | Visible back/forward-cache pageshow does not restore the prior listening state. |

The baseline loader removes only the new `attachFlightLayout` import and call from `game/app.mjs`. That resulting file was compared byte for byte with `origin/main:game/app.mjs`. The audio implementation and these test files also match the base. The guide reproduction reports one failure with five unrelated cases skipped; the soundtrack reproduction reports three failures with five unrelated cases skipped. Skipped baseline cases are not counted as passing. [Baseline output](audio-baseline.txt) retains both reproductions.

The two additional Field Kit failures in the first run were stale expectations: the current title includes five game buttons **and** an edition archive link. The updated test asserts both, rather than treating the link's empty button ID as an extra game button. All four Field Kit tests pass afterward.

These findings concern the existing audio tests and are outside the responsive-layout changes. No claim is made that the complete repository suite is green.

## Reproduce

From the repository root:

```sh
python3 - <<'PY'
from pathlib import Path
import subprocess
files = Path('docs/research/mobile-ux-v0.51.2/test-inventory.txt').read_text().splitlines()
raise SystemExit(subprocess.call([
    'node', '--test', '--test-concurrency=3', '--test-timeout=600000',
    '--test-force-exit', *files,
]))
PY

node --test game/test/flight-layout.test.mjs game/test/field-kit-flow.test.mjs
node --test --test-concurrency=1 --test-timeout=1800000 --test-force-exit game/test/fracture-chapter-host.test.mjs
node --test --test-concurrency=1 --test-timeout=1800000 --test-force-exit game/test/route-worlds-host.test.mjs
node --test --test-concurrency=1 --test-timeout=1200000 --test-force-exit game/test/countercurrent-chapter-host.test.mjs
node scripts/game-cli.mjs validate
```

Physical Safari/iPhone, Android and controller testing was not available. Chromium viewport checks and synthetic host/model tests do not substitute for that final hardware pass.
