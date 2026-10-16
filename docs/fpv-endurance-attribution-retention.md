# Retain endurance attribution when observer entries arrive

The authoring diagnostic previously stored long-animation-frame timing/scripts, then matched them to phase spans only when producing a snapshot. A final snapshot only has the last 128 spans. Earlier frame associations could disappear, and a span unfinished when received could be rewritten as completed later.

The existing five-minute native report exposed four retained LoAF entries at about 42s, 101s, 199s and 290s, all older than the final phase ring around 299758ms. All reported empty overlaps. This identifies a diagnostic retention defect; it does not identify the cause of any slow frame. The raw report and prior failed segments are preserved unchanged, and are not retroactively repaired.

## Correction

The observer callback now copies associations from its current 128-span window as each entry arrives. Each of the existing 16 retained frame rows holds at most 12 overlap examples. Known-match, unfinished-match and discarded-example counts remain explicit. Receipt time, retained window and overwritten span count are disclosed; after any overwritten history the observed match count is conservatively labelled a lower bound. An unfinished overlap retains null duration and its incomplete flag. Final snapshots clone these captured facts without joining against newer spans.

This is authoring-only receipt behavior. Production input/rendering, flight clock, routes, duration options and the 250ms acceptance limit are unchanged. The correction is separate from the duration-option work in #1510.

## Verification and remaining gates

Six deterministic regression tests cover delayed final snapshots after ring wrap, more than 12 matches, unfinished spans completing later, observer delivery after history was already lost, mutation isolation and stop/drain/freeze behavior. The existing attribution verifier also passes its seven groups, including 128-span/16-frame/8-script bounds, privacy, observer failures, finalization and the unchanged clock rejection. These are injected timing tests and establish no elapsed flight, device performance, GC, caller causality or GPU completion.

The new unit file is first in the existing recordings phase; all prior phase entries are retained. Local lint and repository formatting pass. Exact-head cloud checks, source review and root's fresh native diagnostic remain open before this increment is considered verified in the browser. Existing raw reports and frozen origins remain distinct evidence.
