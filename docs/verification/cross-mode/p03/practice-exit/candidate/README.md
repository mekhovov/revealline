# Complete Controller Practice correction candidate

Base: immutable source `76dc4bf36baec11ce4dff6ca49773d3b9d6c0ae5`. Root owns integration and release. This directory did not modify the dirty root, an integration index, a remote, the active preview server, or any prior evidence.

`complete.patch` composes the registered keyboard frame-exit correction and the repeated Pause focus correction into **11 paths**, against the base directly. Apply the complete patch once to a clean compatible source; do not stack it over the earlier exit patch. `proposed/` holds the exact replacements; `source-pins.json` and `manifest.json` identify all original and final bytes. A separate `apply-check/` reconstructed only the required original Git files, applied the patch without an index, and matched all eleven final hashes.

The runtime app is still SHA `d3b34c3dc43dfe57da8a2e7075fedfd9b7ed583509ea993702538e8ba9e6931c`, matching the root's current native preview. The four other runtime replacements are unchanged from the exit candidate. The added host test was formatted; the guide, maintainer skill and prompt now explain repeated Pause ownership, inactive-child focus, actual app blur coverage and checkpoint preservation.

## Verification

- `runs/affected-final-node20/`: Node 20.19.5, all six complete affected test files, **160/160 passing**, no skips/cancellations/todos.
- `runs/affected-final-node22/`: Node 22.22.2, same six complete files, **160/160 passing**, no skips/cancellations/todos.
- `runs/format-check/`: all eleven proposed paths pass.
- Both complete runs used the same **319 ordinary files / 21,700,860 bytes** in the finite overlay. Every input hash was unchanged by testing. Integration source/tracked status was unchanged. Test temporary directories were empty.
- `runs/format-write/` retains original formatting output and its before/after hashes; formatter compile-cache files are recorded separately.

The six files are controller-navigation, controller-lab, controller-preview, practice-navigation, key-capture-navigation-host and controller-practice-pause-host. No full suite, production regeneration, build or release qualification was run.

The earlier pause baseline remains at `../p03-controller-practice-pause-proposal/runs/pause-baseline-node20/`: **0/3 passed** with real assertions, then `pause-corrected-node20/`: **3/3 passed**. The earlier exit baseline and 157-test results remain untouched in the exit proposal. Counts represent repeated executions, not distinct additive coverage.

## Actual browser evidence and boundaries

Root-owned `../p03-controller-practice-pause-native/observations.md` records the same runtime app bytes. It passes Ready forward/backward exit, paused forward/backward exit, selected Restart focus after Settings, real Settings modal containment, focus return remaining paused, and explicit Resume followed by a real 52.2% win. The record explicitly leaves moving-cut lifecycle and physical controller/touch verification open. No native evidence is fabricated by this candidate.

The host tests cover repeated suspension after Settings, both paused boundaries through the real app blur handler, first blur from a moving cut without reclaiming focus, unchanged authoritative checkpoints/profile and explicit Resume. Their cross-document bookkeeping is simulated browser behavior; it does not replace the remaining native routes. Full P03 and public patch acceptance remain open.
