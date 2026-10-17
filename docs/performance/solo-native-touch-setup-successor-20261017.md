# Native touch: retained setup failure and narrow successor

Run [39015298647](https://github.com/mekhovov/revealline/actions/runs/39015298647)
used tooling `c41a02216c0811952232a387fd1743e09452c269` and the exact successful
`a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4` package. Both D-pad jobs passed full
candidate archive, source and CSP admission, then stopped before any native row:
`realpath('/usr/bin/xdpyinfo')` returned `ENOENT`. Every intake command closed
with exit zero, no forced cleanup, no ambiguous identity and no surviving owned
process. All six D-pad observations remain not run. The two queued stick/swipe
jobs were cancelled after the repeated setup failure; their six observations
also remain unobserved. This is not a game or touch-latency result.

The complete small artifacts were independently read back with API identities,
ZIP CRC, member paths, sizes and hashes checked:

| Job            | Artifact    | Archive bytes | SHA-256                                                            |
| -------------- | ----------- | ------------: | ------------------------------------------------------------------ |
| Chromium D-pad | 12094696445 |        251883 | `2c8d9ab1f5b8231b30df84f0540e62e97e38d9665600013fd39d28f104f26409` |
| WebKit D-pad   | 12095080292 |        251745 | `5aea4b771609eba025d21c6dc1399844859bfede830beca90d8352cd9564fca7` |

Both archives contain 27 members. The compact initial readback is retained at
`.cache/solo-followup/final-native-c41/touch-dpad-setup-analysis.json`, 8716 bytes,
SHA-256 `180554bba95b63904ce71727c80b43680a6203ee5053c60bee54493eb26da63e`.
The later terminal API receipt is retained separately at
`.cache/solo-followup/final-native-c41/status-20261017T080116Z/`; the initial
receipt correctly has no whole-run conclusion because the queued jobs had not
then been cancelled.

The separate `solo-native-touch-v2-plan.json` and
`solo-remote-native-touch-v2-temporary.yml` preserve all twelve observations,
three repetitions, fixed preparation cadence, 24 meaningful trusted directions,
strict replay, input-latency verdicts, exact artifact/source identities and all
original owner/deadline/output limits. The original dispatched plan and workflow
remain byte-identical; the successor records their exact Git blobs and hashes
from the actual `c41a02216` source, both failed reports and both cancelled jobs.
It can run only on the next same-repository PR1544 synchronization from that
exact head. There are no automatic retries or headless fallback.

The only execution correction installs `x11-utils` explicitly inside the
existing ten-minute browser-dependency step, with a 120-second installation
limit. Ubuntu's [Noble package catalogue](https://packages.ubuntu.com/noble/x11-utils)
provides this utility package. Before artifact downloads, setup must record the
installed `x11-utils`, `xvfb` and `xauth` versions, verify all four executable
paths, hash them, and run the bounded `xdpyinfo -version` check. The original
owned Xvfb/`xdpyinfo` display observation remains mandatory afterward. The new
4 MiB setup log replaces the unused baseline-dependency log slot, retaining the
existing 24 MiB setup ceiling and 122/130-minute step/job envelope.

The concrete release controls reject changed historical evidence, source,
protocol, package installation, executable/version preflight, activation edge,
source checkout, deadlines and dynamic verifier closure. No new native or
physical-device observation is claimed by these controls. iPhone 17 Pro Safari,
Steam Deck OLED and WebKit continuous-touch behavior remain outside this hosted
input diagnostic's qualification scope.

The complete source-confined successor check ran 70 controls: 66 passed and four
Linux-only controls were skipped locally. All four actual bound job declarations
passed from the same copied source. The retained TAP is
`.cache/solo-followup/final-native-c41/touch-v2-confined-tests.tap`, 16735 bytes,
SHA-256 `647f8cf60d3a0a97b90d03f63e0618f566605c64a7d8e59871b212256e19e77f`.
These are tooling checks; they do not replace the pending native observations.
