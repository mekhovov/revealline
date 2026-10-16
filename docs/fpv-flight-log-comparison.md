# Comparing recorded flight response

The local comparison tool measures differences between commanded and achieved
rotation. It accepts verified Advanced recordings and explicitly mapped CSV
exports. It never changes aircraft settings, imports PID values, grants a
qualification, or fits away response delay. Real-aircraft data and pilot assessment
are currently deferred by the user.

## Export a verified SIM trace

Export a recording from Advanced practice, then run:

```sh
npm run fpv:flight-log -- trace recording.json trace.csv trace-metadata.json
```

The complete recording is replayed and verified before any output is written.
The exporter first checks whether the union of command events and mission
observations fits the same 250,000-row limit used by the CSV reader. It rejects an
oversized union before replay when the recording's timing fields can be counted.
After verification, it checks the exact row count and the final CSV's UTF-8 size
against the reader's 32 MiB limit before writing either output file. A recording
can fit the 8 MiB recording quota yet produce an oversized diagnostic trace; that
export fails explicitly, without dropping command transitions or sequence events.
The CSV contains requested/achieved roll, pitch and yaw, throttle, battery voltage,
current, saturation, consumed-input sequence and browser sample age where known.
The metadata retains the frozen configuration, comparison identity, recording and
CSV SHA-256 hashes, and a ready-to-copy `mapping` object. Old supported recordings
without comparison metadata receive a derived comparison identity after replay.

Achieved telemetry is sampled at **50 Hz mission boundaries**, even when physics
runs at 250, 500 or 1,000 Hz. Commands use their exact recorded consumption times,
including transitions inside a mission interval. Extra event rows interpolate
achieved rotation and are labeled `achieved_observed: 0`; mission observations have
`achieved_observed: 1`. The metadata mapping's `achievedObservationColumn` makes the
comparator use only real mission observations for interpolation and resolution.
Battery/current/saturation are blank at interpolated rows. Sequence and sample age
follow the actual consumed event. The exporter includes the initial state. It does
not create additional sensor observations or hardware latency measurements. A recording with
fewer than two completed mission intervals is rejected before either export file
is written. The minimum trace spans **40 ms with three achieved observations**
at 0, 20 and 40 ms, matching the comparison reader's minimum.

## Prepare measured data

Use the maintained [Betaflight App](https://github.com/betaflight/blackbox-log-viewer)
or [Blackbox decoder](https://github.com/betaflight/blackbox-tools) to export CSV.
The standalone Blackbox viewer is feature-frozen, and decoder rotation defaults
can be **raw**. Select explicit rotation units, such as `--unit-rotation deg/s`,
and time units, such as `--unit-frame-time us`, when using the decoder. Check the
actual export headers and the source firmware's field definitions; do not assume
that similarly named fields are calibrated rates or share axis signs.

Identify the aircraft, source firmware, commanded-rate columns, measured-rate
columns and timestamp column. Split logs at timestamp resets or wraps. Retain the
original log and firmware/configuration beside the export. A measured source
requires `kind: "measured"` and a `firmware` label; a simulated source requires
`kind: "simulation"`, `backend` and `simulationIdentity`. Synthetic examples must
be labeled `kind: "synthetic"` and do not qualify aircraft parameters.

## Declare the comparison

Create a JSON file with this shape. The column names below are examples; replace
them with the exact headers in each file. Use `trace-metadata.json`'s `mapping`
object for a SIM export, including its expected digest.

```json
{
  "format": "FPVFlightComparison.v1",
  "reference": {
    "label": "Measured turn",
    "aircraft": "Identified test aircraft",
    "kind": "measured",
    "firmware": "Exact source firmware",
    "time": { "column": "time_us", "unit": "us", "offsetSeconds": 0 },
    "axes": {
      "roll": { "command": "roll_target", "achieved": "roll_gyro", "unit": "deg/s", "sign": 1 },
      "pitch": { "command": "pitch_target", "achieved": "pitch_gyro", "unit": "deg/s", "sign": 1 },
      "yaw": { "command": "yaw_target", "achieved": "yaw_gyro", "unit": "deg/s", "sign": 1 }
    }
  },
  "candidate": {
    "label": "Verified SIM replay",
    "aircraft": "Reference freestyle quad",
    "kind": "simulation",
    "backend": "COPY_FROM_TRACE_METADATA",
    "simulationIdentity": "COPY_FROM_TRACE_METADATA",
    "expectedSha256": "COPY_FROM_TRACE_METADATA",
    "achievedObservationColumn": "achieved_observed",
    "time": { "column": "time_s", "unit": "s", "offsetSeconds": 0 },
    "axes": {
      "roll": {
        "command": "command_roll_dps",
        "achieved": "achieved_roll_dps",
        "unit": "deg/s",
        "sign": 1
      },
      "pitch": {
        "command": "command_pitch_dps",
        "achieved": "achieved_pitch_dps",
        "unit": "deg/s",
        "sign": 1
      },
      "yaw": {
        "command": "command_yaw_dps",
        "achieved": "achieved_yaw_dps",
        "unit": "deg/s",
        "sign": 1
      }
    }
  },
  "window": { "startSeconds": 0, "endSeconds": 5 },
  "maximumGapSeconds": 0.025,
  "commandToleranceDegPerSec": 0.1
}
```

Each source declares time units (`s`, `ms`, `us`), rotation units (`deg/s`,
`rad/s`), and axis signs (`1` or `-1`). A sign applies to both command and achieved
columns for that axis; normalize an export first if those fields use different
conventions. Clock offsets are explicit and never automatically optimized.
When `achievedObservationColumn` is omitted, every row is treated as an achieved
observation. When supplied, it must contain only `0` or `1`, with at least three
observed rows covering the full comparison window. Interpolated rows cannot hide
an observation gap or improve the reported sensor resolution.

```sh
npm run fpv:flight-log -- compare measured.csv trace.csv comparison.json report.json
```

The tool requires complete time-window coverage and rejects missing-data gaps,
non-finite values, duplicate timestamps, ambiguous columns and malformed CSV.
Inputs and exported traces share the same 32 MiB UTF-8 and 250,000-data-row
limits; the header is not a data row. Inputs allow at most 128 columns. Comparisons
are bounded to twelve minutes. Existing output files are never overwritten.

## Interpret the result

The report records source hashes, mappings, observed time resolution and per-axis
command disagreement, response RMSE, maximum response error and tracking RMSE.
It aligns the union of both timestamp streams, so a short command pulse between
reference samples cannot disappear. Commands are held between samples; achieved
rotation is linearly interpolated. Squared linear error is integrated exactly
over time, preserving command discontinuities.

`comparable: true` means only that the requested angular motion matched within
the declared tolerance. It does not establish equal throttle, battery, environment,
aircraft, controller or assists. Review those settings and the frozen configuration
separately. For verified SIM ghosts, the production comparison-class check also
enforces the configured physical restrictions. CSV source labels alone are not
cryptographic proof that data came from the named physical aircraft.

Exit status is 0 for matched commands, 2 when command traces differ, and 1 for an
invalid input or export failure. A differing-command report is still saved and
explicitly marked ineligible. Every report retains `qualificationGranted: false`
and `tuneModified: false`.

Sparse 50 Hz traces can expose gross response differences but cannot validate
motor delay, gyro/D-term filtering, vibration or physical input-to-display latency.
Parameter fitting and real-aircraft qualification require appropriately sampled
measurements and held-out validation. See the
[reviewed completion plan](fpv-tuning-completion-plan.md).
