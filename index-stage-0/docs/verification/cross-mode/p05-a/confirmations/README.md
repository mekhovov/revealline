# Compact confirmation dialogs: scoped desktop evidence

Short `restart-dialog` confirmations use their content height while Title,
Missions and Collection retain their full-screen layout rules. This fixes a
mission-replacement prompt that inherited the generic full-height dialog rule
because the old compact exception required the particular `restart-dialog` ID.
The final stylesheet is SHA `de78f169100bd13c83bc16a4b95eca19e754b83ff95c2b73a1c59cbda20b8d98`.

The first compact candidate did fit its content, but its action selector tied a
later Field Kit control rule. That rule's logical `min-block-size` reduced the
intended 50px actions to about 44px. The final selector includes `.overlay-actions`
to win that cascade only within these confirmations. The [original failed size
observation](native-before-action-size.json), [raw events](native-root/events-before-action-size-fix.json)
and [original screenshot](native-root/compact-before-action-size-fix.jpg) remain
retained. No `!important`, general menu resizing or runtime behavior change was
needed.

## Actual successor observations

Root inspected the composite local preview on 2026-09-15 at a **1393×1348 CSS
pixel** desktop viewport. The [completion receipt](native-after-action-size.json)
pins the source and observations. The [combined event record](native-root/events-with-action-size-fix.json)
contains **13 events: three predecessor events and ten successor events**.
These counts are not additive across the two event files.

| Confirmation        | Standard width × height | Large width × height |
| ------------------- | ----------------------- | -------------------- |
| Mission replacement | 460 × 437.62px          | 460 × 514.78px       |
| Restart             | 460 × 392.62px          | 460 × 426.80px       |

All measured successor confirmation actions were approximately **50px high**.
Each measured confirmation had equal scroll/client heights, so its current copy
fit without internal overflow at this viewport. Missions retained its separate
approximately 1180×1347.8px panel. Actual Tab traversal reached the confirmation
action and wrapped to the safe action; Escape restored the mission-card or
Restart opener, and the flight remained visibly paused. See the original
[Large](native-root/compact-large-after-action-size-fix.jpg) and
[Standard](native-root/compact-standard-after-action-size-fix.jpg) captures.

These are observed desktop journeys. Accessibility snapshots and DOM geometry
were separately awaited; they are not an atomic browser-state measurement. Pause
continuity here is visible-state evidence, not a new replay/checkpoint or stored
byte-equality proof. Unchanged selector scope preserves Title/Collection rules;
this package does not claim a fresh exhaustive native review of those screens.

## Exact source and retained layout

The stylesheet work starts at P05 commit
`6e1040ba18c6f219288cbe3983bcd15bede7fac6`. Native review used exact Git fallback
`b67a739a5acc495f2b7aca0905d1a2de5e91e8a7` with frozen P03-G app/HTML from commit
`bb372a012ec2d12cf89bba1b251a4721e30b3c13` and this stylesheet. The
[preview binding](native-preview-binding.json), [handoff](handoff.json) and
[retained server source](serve-native.py) record that composite. The two frozen
P03 files independently match that commit's exact blobs; this CSS package does
not adopt or copy P03 runtime changes. The root receipt retains the exact
reviewed response/source SHA pins. No game-state injection was used.

[Evidence mapping](evidence.json) gives each original cache path and committed
copy. Native files, JSON receipts and the server text are byte-identical copies.
Original absolute/relative path strings remain unchanged as historical
provenance; the server is not a relocatable launcher. Historical preparation
records pin their then-current guide/skill, not the final documentation here.
The small predecessor CSS is reconstructed by reversing only the one-line
action-selector change; its SHA exactly equals the original held/native binding,
and the mapping labels that reconstruction explicitly. No image was resized or
edited and no asset, archive or full-source checkout was materialized.

CSS parsing/formatting and changed-source whitespace checks passed. Independent
source review checked the final selector against the actual later logical-size
rule. No DOM-model or CSS-pattern test was counted as native layout evidence;
runtime logic, producer inputs, generated files and existing functional tests
were unchanged by this work.

P05 remains partial. Narrow portrait, short landscape, zoom, real safe-area
hardware, physical touch/controller and assistive-technology checks remain
separate. Long-content scrolling is bounded by the CSS but was not exercised by
these fitting desktop copies. This package adds no version, PR, production
approval, offline acceptance or public-release claim.
