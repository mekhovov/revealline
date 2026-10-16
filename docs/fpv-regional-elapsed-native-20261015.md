# Regional elapsed-time native smoke and interruption receipt

The authoring-only endurance tool in PR #1348 (`aa01ebfed8c97d47f4495fdb73841b3e463a4c00`) was exercised in the native browser at port 9072 against the preserved production runtime from package source `2cfe7a25d6b87913dd4d9ddbc7b2bd7478068071`. This is a repeated synthetic six-cell corridor workload, not player input or a claim about every map.

The final tool includes the monotonic/wall-clock suspension guard. The review label remains unverified input in the report. Eight direct source hashes are recorded; the harness does not independently certify the whole runtime closure. The separately frozen package qualification supplies its package identity.

## Observed results

| Segment | Result | Evidence |
| --- | --- | --- |
| Final tool, 10-second target | Accepted: 10,006.8 ms monotonic / 10,007 ms wall time, 500 simulation ticks, 1,201 rendered callbacks | `fpv-regional-elapsed-native-smoke-20261015.json` |
| Final tool, 60-second target, explicit Stop | Correctly invalid: reviewer stopped at 57,346.7 ms / 2,867 ticks; `accepted:false` | `fpv-regional-elapsed-native-stopped-20261015.json` |
| Earlier one-minute attempt, before final wall-clock guard | Invalid at 2,391.8 ms / 69 ticks because a frame gap exceeded 250 ms | `fpv-regional-elapsed-native-gap-20261015.json` |

The completed smoke recorded mean callback interval 8.33 ms and maximum 13.8 ms. These are browser callback observations, not GPU completion measurements or a device FPS guarantee. No cell crossing or reversal occurred in this short segment. Peak regional ownership was two query worlds, six colliders, 101,904 geometry bytes and 84,872 source bytes.

The explicitly stopped segment crossed two cell boundaries. Peak regional ownership was four query worlds and 18 colliders; actual committed geometry reached 152,856 bytes. Its temporary reservation maximum was 8,693,600 geometry bytes and 254,616 source bytes. The reservation is an admission allowance, not measured allocated GPU memory. Both final-tool segments released their owned worlds, colliders, geometry, source reservations and renderer registrations; both reported `disposalZero:true`.

Before one start, the harness refused a zero-width canvas. Restoring an explicit 1280 × 720 viewport and preparing again allowed the smoke. Creating another browser tab or changing the outer browser viewport did not actually hide or resize the measured canvas during this review, so those actions are not recorded as hidden-tab or resize-negative coverage. An intermediate file named “interrupted” was only a running snapshot and is deliberately excluded.

## Limits and remaining work

The two-hour uninterrupted elapsed-time requirement remains **open**. Neither invalid segment contributes time to a passing segment. The earlier frame-gap failure is retained rather than replaced by the later short success. Hidden-tab, actual canvas resize, context-loss and system-suspension native negatives are not claimed by this receipt. Existing focused clock checks cover their invalidation logic separately.

This review did not write player progress, certify physical controller behavior, perform a browser restart, establish all-network offline support, measure opaque GPU allocations or qualify all worlds. The 9072 source is preserved for future independent segments.
