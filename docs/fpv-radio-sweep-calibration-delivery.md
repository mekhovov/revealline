# Direction assignment and full-range radio calibration

## Why the wizard changed

The player reported that a physically centered throttle was displayed at 74% and rejected. Live inspection showed raw throttle near -0.032 while the guide remained in its first return stage. The old procedure used an earlier stillness sample as the return target; its short automatic preparation could capture a low throttle before the player centered it. Altering the text did not remove that assumption.

The replacement separates channel/polarity identification from range and center measurement. It removes individual opposite-edge and return-to-old-baseline gates.

## Delivered workflow

1. Prepare at center. An unknown radio waits for the existing Ready action instead of guessing center from stillness. A previous verified calibration can prove center and advance automatically.
2. Follow one direction prompt for throttle, yaw, pitch and roll. Identify one distinct channel and its polarity per control. Completed channels remain excluded from later ambiguity checks.
3. Circle both sticks around their full outer edges, reaching full up/down/left/right. Both sticks may move simultaneously. Extrema are collected on every animation frame for the assigned channels; auxiliary channels do not contaminate travel.
4. Coverage requires the existing minimum 0.5 raw span and three alternating endpoint transitions per channel, with a minimum 2.5-second measurement interval. Per-axis check marks show coverage. When ready, the guide asks for center and uses the measured travel to accept a stable center sample.
5. Full-travel radios finish with a separate throttle-low check. Spring-centered adaptation retains its existing center rules. Complete profiles save automatically; flight remains paused with fresh-arm requirements unchanged.

The return region is the middle half of measured travel, constrained by the existing 0.1 center margins. It does not compare against the obsolete initial baseline. Measured center values then pass the existing profile validator.

## Visuals

Filled dots show live input; rings show required positions; dashed outlines animate the requested direction or circle. Direction trails and target rings scale with the diagram. All four stick modes use STICK_LAYOUTS. Completed sweep coverage changes the circular cue into a center-return cue, and final throttle-low has its own downward path and bottom ring.

Before the new range is measured, a previous verified same-device calibration may inform presentation only. A genuinely new controller has explicitly provisional raw preview until its range is measured. These display estimates never nominate channels, save settings or control flight.

Reduced-motion settings hide the animated outlines while retaining static paths and targets. Invalid/incomplete calibration does not replace the last usable profile. Existing device profiles and calibration formats are retained.

## Developer references

- [VelociDrone mobile manual](https://www.velocidrone.com/mobile_manual): direction-based control assignment and a separate live input display.
- [Uncrashed developer explanation](https://steamcommunity.com/app/1682970/discussions/0/3117046824717525711/): center alignment is a distinct calibration step.
- [FPV.SkyDive calibration FAQ](https://cdn.cloudflare.steamstatic.com/steam/apps/1278060/manuals/FPV.SkyDive_Calibration_FAQ__4_2022_.pdf?t=1650637488): input-type distinction, movement-based assignment, remembered controls and throttle-zero arming.

The combined direction-plus-circle sequence implements the player's requested design; these references do not establish that every cited simulator uses that exact sequence.

## Evidence and qualification

Syntax and whitespace checks passed. Academy and Worlds construct under unchanged policies, with no additional runtime files. Academy: 145 runtime /147 source files and 75,257 input bytes remaining. Worlds: 208 /210 and 500,336 input bytes remaining. Local package identities are placeholders, not release qualification.

[Source identities and scoped findings](evidence/fpv-combat/radio-sweep-delivery.json) and [package measurement](evidence/fpv-combat/radio-sweep-package-measurement.json).

The player completed the replacement workflow on their Oxbot radio and confirmed: “Yes, this works clearly now.” This confirms center recognition and live stick movement for that walkthrough. It is user hardware evidence, not full release qualification.

No automated suite was run. Complete model/transport coverage, all four physical stick layouts, reduced-motion browser acceptance and wider input regressions remain pending.

## Integration

Focused child of frozen #1803 (`e9678e107bee73bf602035dc25fbe68d1fd0d77f`). No frozen parent is changed. The style additions are handwritten, before .radio-values and outside generated SIM TOKENS/FULLSCREEN blocks. No play-shell or reaction projection body is changed. Coordinate semantic integration with Releases.
