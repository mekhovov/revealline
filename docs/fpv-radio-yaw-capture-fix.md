# Radio yaw wizard: hardware-confirmed capture fix

## Root cause

During the reported Oxbot yaw stall, the displayed raw input was `[0.001, 0.001, 0.022, 1.000, -1, -1, -1, -1]`. Throttle was already correctly mapped to channel 2; yaw was held fully right on channel 3. The wizard remained on yaw's first endpoint with zero hold progress.

Its candidate ranking already excluded completed channels, but `otherAxesStill` still compared every other channel against the preceding baseline. Throttle at halfway therefore rejected valid yaw movement. The hold timer also compared all channels, so completed-channel motion/jitter could reset it. The earlier range-threshold correction did not address these conditions.

Isolation on physical hardware: the user kept yaw right and lowered throttle fully; the wizard immediately advanced. The user confirmed “It advances now.”

## Fix

- Completed channels no longer block new endpoint detection or later return stages.
- The current channel must still return to its own baseline, including immediately after it becomes mapped. Its return is never skipped.
- Endpoint dwell monitors the candidate channel. Return dwell monitors the current and unassigned channels; final-centering dwell monitors all four assigned channels.
- Ambiguous simultaneous movement between unassigned channels remains rejected. Minimum movement/span, measured center, unique assignments, focus/disconnect handling, final low-throttle validation and automatic persistence remain unchanged.
- The shared guide applies to Academy and Worlds, independent of channel ordering, radio model or connection profile.

## Evidence

After refreshing, the user repeated guided calibration with throttle around halfway during yaw, without pressing Continue, and confirmed **“Yaw advances automatically now.”** Browser inspection subsequently showed the completed Ready stage, **“Saved automatically on this device”**, live normalized stick readings and the new verified Oxbot calibration. Earlier saved profiles were retained.

- [Hardware Ready capture](evidence/fpv-combat/radio-yaw-capture-hardware.png)
- [Source identity and before/after observations](evidence/fpv-combat/radio-yaw-capture-delivery.json)
- [Package measurement](evidence/fpv-combat/radio-yaw-capture-package-measurement.json)

Syntax and whitespace checks passed. Both packages construct under unchanged policies: Academy 145 runtime /147 source files, 87,355 input bytes remaining; Worlds 208 /210, 512,434 input bytes remaining. Local package identities are placeholders, not release qualification evidence.

No automated suite was run. Physical coverage of every supported radio/transport and the wider input regression matrix remain pending; the observed hardware confirmation is specific to this Oxbot workflow.

## Integration

Focused child of frozen #1802 (`7df7908223ed48dc9fb34c7e5d1ea100b35df44e`), following #1799 → #1800 → #1801 → #1802. No frozen parent was changed. Coordinate semantic integration with Releases.
