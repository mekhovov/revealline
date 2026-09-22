# Journey local performance observations

Status: DONE_WITH_CONCERNS. No comparison baseline exists; no regression or
performance improvement is claimed. See the [evidence note](../../docs/verification/journey-performance-observations.md)
and [machine-readable observations](2026-09-21-benchmark.json).

Actual local browser observations, not mock-DOM test timings. The benchmark
skill's browser driver was replaced with the supported native in-app browser
and a page-owned, read-only timing observer. No remote telemetry. The full
LCP/slowest-resource inventory and stable repeated-run baseline remain open.

| Budget                    |               Solo |             Versus | Conclusion                                    |
| ------------------------- | -----------------: | -----------------: | --------------------------------------------- |
| FCP <1,800 ms             |              44 ms |                N/A | Solo paint only; not playable readiness       |
| LCP <2,500 ms             |                N/A |                N/A | Not collected                                 |
| JS <500,000 bytes         | ≥4,270,474 decoded | ≥2,612,068 decoded | Over budget in this unbundled preview         |
| CSS <100,000 bytes        |   ≥217,661 decoded |   ≥171,949 decoded | Over budget in this unbundled preview         |
| Transfer <2,000,000 bytes |         ≥4,703,876 |         ≥6,888,686 | Over budget                                   |
| Requests <50              |               ≥250 |               ≥250 | Over budget; resource buffer may be saturated |

Grade D for this local preview under the skill's generic budgets, not a grade for
the deployed game. Early boot FCP is not the game's reveal image or playable UI.
Resource sums cover only entries returned at menu readiness; no complete network,
install-size, memory or compressed-production-bundle claim is made.

Next: capture a three-run baseline with a complete resource inventory, profile
the critical module graph and compiler, then measure any bounded loading change
against the same source, server and device. Validate the public distribution
separately, followed by physical low-end/mobile/controller testing.
