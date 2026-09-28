# Four-controls learning fixture

Open Controller Practice → **Explore four controls**. The native dialog is an
untimed, civilian educational diagram. It has no aircraft connection, physics,
scoring, completion event or player-storage access. Opening it disconnects the
Controller Practice virtual pad; closing does not reconnect or resume practice.

The shared `mountControlLab` renderer accepts a fixture and a `beforeOpen` input
release callback. Another viewer can use the same component, provided it loads
`ui/control-lab.css`. The caller remains responsible for pausing its own game.
No game progress object or completion callback belongs in this interface.

## Author and exchange a fixture

1. Open **Author / exchange this fixture** inside the dialog.
2. Choose **Prepare fixture JSON**, then copy the text into a `.json` file.
3. Edit the English/Ukrainian explanations and cited source references.
4. Paste the file into the same field and choose **Preview validated fixture**.
5. Review all four controls, both languages and static diagrams before sharing.

`validateControlLabFixture` accepts plain data or JSON, up to 64 KiB. Format
`revealline-control-lab.v1` requires a stable `id` and `revision`,
`scenario: "civilian-training"`, `layout: "mode-2"`, English/Ukrainian title and
summary, and exactly one `throttle`, `yaw`, `pitch`, and `roll` definition. Each
control has bilingual title/explanation/negative/neutral/positive copy and
`sourceIds` referencing the fixture's HTTPS sources. Unknown fields, executable
values, duplicate controls, missing translations and undeclared citations fail
before the active fixture is replaced. The JSON exchange preserves all fields.

Mappings, ranges and diagram behavior are shared renderer definitions. An author
cannot add real transmitter settings or change earning rules through a fixture.
Changing a command updates a static illustration; it does not accumulate a
flight path. Diagram angles and percentage inputs are illustrative. Neutral
attitude commands and idle throttle are not a hover command.

The original example was reviewed against [ArduPilot's Mode 2 description](https://ardupilot.org/copter/docs/common-radio-control-calibration.html),
[PX4 Manual/Stabilized](https://docs.px4.io/main/en/flight_modes_mc/manual_stabilized)
and [PX4 Position](https://docs.px4.io/v1.17/en/flight_modes_mc/position) on
2026-09-28. Those sources distinguish stick layout from flight-mode behavior.
Physical controller calibration, real flight instruction, the separate
simulator, and drill qualification are outside this fixture.
