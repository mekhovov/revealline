# FPV rates, throttle and drone setups

The SIM's **Rates & throttle** editor keeps pilot preferences separate from radio calibration, drone camera settings and aircraft response. Profiles are stored on this device. They do not imply an account, cloud synchronization or multiple local pilot accounts.

Existing settings migrate to **Legacy feel**. Existing attempts and recordings retain their original response. New profiles start with **Actual** rates; creating a profile does not assign it automatically.

## Start with a profile

1. Open **Rates & throttle** in the SIM.
2. Choose **New Actual profile**, or duplicate a profile to experiment independently.
3. Give it a recognizable name. Choose **Make player default** to use it for drones that inherit your default, or select it under **Rates used by this drone** for one saved drone setup.
4. Adjust the three axes and throttle, then use **Test draft · unscored**.
5. Choose **Return to tuning**, compare the saved and draft curves, and save or revert.

**Save for next flight** persists the changes without restarting the active attempt or changing its profile assignment. **Apply & restart** explicitly assigns the selected profile to the current drone, saves and starts a new attempt. A recorded attempt retains the settings with which it started.

A named profile can be shared by several drone setups. The editor lists its users before you change it. Duplicate the profile first if only one drone should change. Deleting a profile requires a replacement; its explicit users and the player default are reassigned together.

## Rates and throttle

Each profile uses one rate algorithm for all three axes, with separate roll, pitch and yaw values:

| Algorithm  | Main controls                                           |
| ---------- | ------------------------------------------------------- |
| Actual     | Center sensitivity, maximum rate, expo                  |
| Betaflight | RC rate, super rate, expo                               |
| Quick      | RC rate, maximum rate, expo and the RC expo mode switch |
| KISS       | RC rate, rate and expo                                  |
| Raceflight | Rate, Acro+ and expo                                    |

The editor displays each algorithm's own units. Changing algorithms retains the values entered for each algorithm during the current edit instead of interpreting the old numbers as another model. Optional linked roll/pitch editing leaves yaw independent. Numeric entries are normalized to the firmware's supported increments when committed: for example, an Actual maximum of 895°/s becomes 900°/s. Saving, exporting and testing also commit pending entries. Empty or out-of-range entries require correction before those actions.

Unfinished numeric entries also survive profile/algorithm navigation, closing and
reopening the editor, and language changes. They remain visibly invalid until
corrected; the graph continues to use the last valid value. Explicit revert,
revision restore or import replacement replaces that draft. These unsaved drafts
last for the current SIM session, not a browser reload. If you edit a number while
an import preview is still being checked, that preview is cancelled so it cannot
replace the newer edit. Preview again when you are ready.

Each axis also has a commanded-rate limit. The new rate profiles support limits up to 1,998 degrees per second; Legacy feel retains its original range. The curve shows the requested rotation. The aircraft's response, self-level assistance and available motor authority determine the achieved rotation.

Throttle has midpoint, expo and Off/Scale/Clip limiting. The **Betaflight 2025.12 / 2026.6** throttle model also exposes a hover point. The older **Betaflight 4.5** curve and the newer curve are different models, so changing versions can change flight feel even when their numeric controls look alike.

The graphs overlay a solid draft curve and a dashed saved curve. Axis toggles and center, half-stick and full-stick readouts make comparisons easier. The optional rotation animation uses the same rate evaluator. Diagnostics distinguish raw input, calibrated input, requested rotation and achieved rotation. Browser sample age and observed timestamp cadence are shown only when measurements are available; they are not a claim about radio polling speed or simulation frequency.

Diagnostics name the active source: keyboard, touch, game controller or calibrated
radio. While tuning is open, they identify either a live radio preview or the last
accepted flight input. The achieved rate always identifies its last accepted
flight step; it is not presented as the response to a new draft. A connected radio
in the background does not replace another source's readings.

Radio endpoint calibration and device dead zones remain in the radio setup. Betaflight import does not import receiver calibration, RC smoothing or extra deadband stages. Self-level maximum tilt and the existing airframe's response time remain separate from portable rates.

In Academy and World, importing a radio calibration or calibration library leaves
your Rates & throttle profiles and current attempt unchanged. Any legacy flight
response included in that file is validated but not applied, and the import
message explains this. Use the Rates & throttle editor to transfer flight feel.

## Drone setups and camera

A saved drone setup has its own name, stable identity, rate-profile assignment and camera settings. It is independent of a visual skin. Duplicate a drone setup when you want another saved combination.

Choose **Player default** to inherit the current default, or assign a complete named profile. Assignments do not merge selected fields from different profiles.

Camera tilt is measured in degrees. **Vertical FOV** is the vertical field of view in degrees, not horizontal or diagonal FOV. Camera settings are saved with the drone and excluded from portable rate files. Existing camera values are preserved during migration.

Camera tilt accepts 0–60° and vertical FOV accepts 40–140°, including fractional
degrees. Incomplete or out-of-range entries stay editable, including when you
switch profiles or reopen tuning. Correct them before saving the setup,
duplicating the drone or starting a draft flight. Rate-only exports do not use
camera settings and remain available while a camera edit is unfinished.

Unsaved drone names, assignments and camera settings remain with their drone setup when you switch rate profiles, switch setups or close and reopen tuning. **Save drone assignment & camera** saves the selected setup independently. **Revert draft** restores the selected profile and setup; **Refresh library** discards all retained drafts before loading saved settings. Unsaved drafts survive within the open SIM session, not a browser reload.

If a setup switch fails because storage is full or another tab saved newer data,
the selector returns to the current drone and retains your edits. Correct the
storage problem or refresh the library before retrying.

The resolved flight configuration carries a fingerprint of its response settings and any saved Advanced aircraft/controller tuning. Names, profile/setup IDs, aircraft labels and camera settings do not affect that fingerprint. The simulation's recording identity also includes its backend, timing, world and rules; the configuration fingerprint alone does not establish replay compatibility or comparison eligibility.

## Import from Betaflight

Paste CLI text or upload a text/JSON file in **Import / export**. Choose the operation deliberately:

| Operation              | Treatment of omitted values                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| Complete configuration | Reconstructs the selected rate profile using the verified firmware schema and its defaults. |
| Sparse diff            | Reconstructs against verified defaults for the exact source release.                        |
| Snippet / preset patch | Applies only supplied fields to the selected baseline and preserves everything else.        |

The verified source releases are **4.5.2, 4.5.5, 2025.12.4, 2025.12.5 and 2026.6.2**. A version header is not required in the file, but complete configurations and sparse diffs need a source version selected when no header is present. Headerless `dump rates` files are normal. Choosing firmware defaults as a patch baseline also uses the file's verified version header when no version is selected. Conflicting headers and unverified versions are rejected instead of guessed.

Development, release-candidate and custom build suffixes are part of the source
version. For example, `2026.6.2-dev` does not count as verified `2026.6.2`. Selecting
a supported release cannot override an explicit unsupported header in the file.

Assignments and `defaults` commands are processed in order. PID profiles and rate profiles are separate namespaces. By default, the final selected rate profile is previewed; the source-profile control can select another supported profile explicitly. The current importer qualifies the upstream four-profile layout, indexes 0–3. Custom firmware builds with different counts or defaults need separate verification.

Choose **Preview import** to review the resulting curves, changed fields, inferred defaults, firmware normalization and unapplied settings. Then choose **Save import as new profile** and assign that new profile explicitly. A malformed import does not partially modify a saved profile.

If you edit the rates after previewing, **Save import as new profile** requests another preview instead of saving the older imported curve. Use **Save for next flight** to retain your edited draft as an ordinary profile revision without the original import receipt.

Saved imports retain an **import receipt** with the original text digest, firmware
assumptions, operation, source profile, baseline and applied/unapplied settings.
Preset receipts also retain resolved file digests, ordered includes and option
choices. Long reviews are explicitly truncated with their original counts. The
receipt is inert history, not a firmware authenticity check. Renames, duplicates,
revision history and complete-library backups preserve it. Editing rates removes
the current receipt; the previous revision retains the original import record.

This is **rate/throttle compatibility**, not a copy of the whole aircraft. PID, feedforward tuning, filters, TPA, RC smoothing, motor-output limits and hardware settings are reported as unapplied. CLI commands are parsed as text and are never executed. Unsupported settings do not become active automatically after an update.

The importer rejects a throttle patch when its source curve model differs from the selected baseline. Choose a baseline using the matching firmware model, or import only rotation-rate settings. Group-specific `defaults group_id` resets require resolved CLI text; they are not inferred.

## Local preset bundles

Upload a local preset folder and choose its entry file. **Resolve preset and review options** shows the dependencies, descriptions, warnings and available choices. After changing choices, resolve again before previewing the patch against its baseline.

Changing an option or entry invalidates the prior result; **Preview import** and
**Save import as new profile** cannot apply the old generated text. Switching
entry files clears the previous file's option choices. Pasting new CLI text
deliberately replaces the preset input. **Save for next flight** still saves the
visible rate draft as an ordinary profile revision.

Includes may be relative to the including file or rooted at the bundle's `presets/` directory. Includes are processed in order, and repeated includes remain meaningful. Missing files, cycles, paths outside the bundle and unsupported nesting reject the resolution. The resolver never fetches dependencies from a network location.

The entry preset exposes its options and defaults. Options in an included preset need matching entry-preset options, following Betaflight's dummy-option convention; otherwise they remain inactive and are reported. Exclusive groups allow at most one selected option. Descriptions, warnings and links remain inert text.

There is no online preset catalog or native importer for other firmware in this release.

## Export, history and recovery

**Export SIM rates** produces a portable rate/throttle file. **Export rate-only CLI** targets a selected verified Betaflight release. **Include throttle settings in CLI export** is enabled initially; clear it to export rotation rates across different throttle-model versions. With throttle included, an incompatible target is rejected. With throttle omitted, the receiving configuration's throttle settings remain untouched. Exports omit receiver calibration, camera settings and aircraft tuning.

Each profile retains up to 24 prior revisions. **Restore revision to draft** lets you inspect an older version before saving it. **Revert draft** discards the current experiment and reloads the saved settings.

**Backup complete library** includes named profiles, history, drone setups, camera settings and saved Advanced aircraft/controller tuning. **Download file** requests a JSON download for profiles/backups or a plain text download for CLI settings. In the iOS wrapper it opens the native share sheet; cancellation leaves the displayed text available. The app reports a requested download or confirmed sharing without claiming that the destination saved the file. **Restore library backup** validates the entire backup before replacing the library. A corrupt saved library is preserved until you explicitly restore a valid backup.

The library supports up to 32 profiles and 32 drone setups, with a 512 KiB storage/backup budget. The editor's uploads also use a 512 KiB budget; preset folders allow up to 128 files. Storage failures are displayed and do not silently discard the last saved state. Keep an exported backup when storage is unavailable or full.

If another tab changes settings, export an unsaved draft before choosing **Refresh library**. Revision checks reject stale saves; browsers supporting Web Locks also serialize cross-tab writes.

## Historical reference-backend scope

This section describes the earlier experimental reference arena and its original
compatibility boundaries. It is not the current aircraft-catalog or recording
compatibility guide. For the thirteen-aircraft practice backend, Setup Workbench,
continuous archives and current priorities, use the
[current completion plan](fpv-current-completion-plan.md),
[workbench guide](fpv-setup-workbench.md) and
[aircraft completion record](fpv-aircraft-completion.md).

### Experimental Advanced practice

The tuning editor can open **Advanced reference practice**, an unscored arena using a separate fixed-step controller and aircraft model. Choose a whoop, freestyle or racing reference template, adjust its SI-unit aircraft/controller values, and explicitly restart to test the draft. **Save aircraft for next flight** keeps the running attempt unchanged. These templates have not yet been matched to measured real aircraft, and their controller gains are not Betaflight PID numbers.

While an aircraft save is pending, another Save is disabled. You can continue
editing; those later edits remain marked as an unsaved draft when the earlier
save finishes. **Revert aircraft draft** returns to the last successful save.

Choose **Hover and land**, **Turn and stop** or **Throttle pulse** for timed,
repeatable cues. Restart from the same launch point and follow them manually.
**Revert aircraft draft** restores the last saved aircraft/controller values.
Return to Rates & throttle to compare, save or revert the rate draft.

Under **Unscored comparison**, keep a completed practice as a reference or import
an arena recording. The complete recording is checked in a separate worker before
its cyan ghost can appear. The ghost follows its own recorded position and
orientation at the same flight time and has no collisions or score. Rotation
rates may differ; aircraft, controller, throttle limits, timing and arena must
match. Cancelling or failing verification preserves the previous reference.
Restart practice to compare from time zero. The reference is temporary; export it
before leaving if you want to import it in another tuning session. Regional
recordings are not arena ghosts.

For numerical response analysis, the [flight-log comparison tool](fpv-flight-log-comparison.md)
exports verified replay telemetry and compares explicitly mapped CSV data. Its
50 Hz telemetry cannot establish motor-delay or sensor-filter fidelity.

The Advanced controller includes a separate feedforward low-pass cutoff. New tunes default to 30 Hz to make stick transitions consistent across physics frequencies; zero explicitly disables it. Older experimental v1 tunes retain their unsmoothed choice when migrated. The revised experimental v2 backend rejects v1 Advanced recordings rather than replaying them with changed physics. Legacy Academy/World recordings remain supported.

In Regional flight, the pause menu offers **Try Advanced here**. It starts an Acro practice flight above the selected starting point using the same streamed and verified terrain. The physics worker handles ground and roof landings, takeoff and wall collisions using the verified collision meshes. Missing terrain and region boundaries still reject the whole mission interval and pause flight. **Use Legacy** restarts with the existing Regional model. Advanced Regional flights remain unscored, and contact behavior has not yet been matched to measured real aircraft.

Regional recordings include the collision geometry and ordered terrain changes needed to replay their flight. Recovery files also retain the current controller, motors, battery and terrain state. Importing recovery checks the region and starting point, replays the consumed flight history in a separate worker, and compares the complete restored dynamics before adopting it. The current flight stays paused and unchanged during verification. **Cancel recovery verification** stops the candidate worker; failed or cancelled recovery preserves the current flight. A maximum-duration recording may take several minutes to verify, with a seven-minute limit. Older experimental Regional recovery files cannot resume the new contact backend; the reference arena and historical Legacy flights keep their existing identities.

Advanced recording and aircraft exports use the platform's file/share support. Backgrounding, app inactivity or graphics loss pauses practice; returning never resumes automatically. Physical-device qualification and verified/default Advanced rollout remain gated.

The rates and import features work independently of the later aircraft-physics rollout. Matching a rate curve does not establish matching real-world flight dynamics. Legacy airframe response remains a separate setting, and historical lessons and recordings retain their original behavior. Advanced physics qualification, measured aircraft templates, hardware-specific response matching and real-pilot comparison sessions are separate acceptance work.

### Compatibility references

- [Betaflight control-rate definitions, 4.5.2](https://github.com/betaflight/betaflight/blob/4.5.2/src/main/fc/controlrate_profile.c)
- [Betaflight control-rate definitions, 2026.6.2](https://github.com/betaflight/betaflight/blob/2026.6.2/src/main/fc/controlrate_profile.c)
- [Betaflight preset specification](https://github.com/betaflight/firmware-presets#preset-specifications)
- [Betaflight tuning interface](https://betaflight.com/docs/wiki/app/pid-tuning-tab)
