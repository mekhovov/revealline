# Civilian FPV practice

Serve the repository and open `optional-practice/civilian-fpv/index.html`, or use
**Flight practice** from FPV Home/Controller Lab when its independent package is
published. Local Home links identify source previews as unqualified. The historical
`civilian-flight` assisted overhead gym keeps its own installation and transcripts.

This package provides first-person, chase and overview cameras over a simplified
civilian flight model. Self-level and Acro both use manual throttle. It has no live
aircraft connection, aircraft configuration import, position hold or altitude hold.
Without WebGL, the descriptions remain readable but flying and replay are unavailable.
Human learning, physical-radio compatibility and device ergonomics remain deferred;
a working source preview or synthetic controller test does not qualify them.

## Play and radio setup

Choose a drill, **Flight mode** and **Input**, then use **Arm / resume**. All twelve
drills are available without unlocking earlier ones. Keyboard uses W/S pitch, A/D
roll, Q/E yaw and Up/Down for persistent manual throttle; Shift makes smaller
adjustments and P pauses. Touch offers Mode 2 sticks. Release centres attitude
controls while keeping the chosen throttle; centred sticks do not stop momentum.

For a USB transmitter, select its USB joystick mode and interact with the page
before opening **Radio & response**:

1. Choose **Find devices** and select the actual device. Check **Live raw channels**;
   a blocked Gamepad API or absent device remains an explicit unavailable state.
2. For each control, use **Identify moving axis**, move only that control, then
   **Use moving axis**. Check **Reverse** if its displayed direction is wrong.
3. Use **Record full travel**, move each mapped control to both endpoints, then
   **Finish travel** and **Measure centre**. Choose the correct throttle type:
   full-travel radio endpoints map to 0–100%; a spring-centred gamepad's centre is 50%.
4. Inspect the animated sticks. Use **I checked the animated sticks and their
   direction**, then **Save verified profile**. A matching saved or imported profile
   still needs verification after selecting its device.
5. If used, configure **Optional switches** with a button channel, **Activation
   threshold** and **Reverse** for Arm/disarm, Pause or Reset to launch. Blank means
   no binding. Check the raw button values before assigning one.

**Stick diagram** Modes 1–4 illustrate the selected layout; they do not remap
channels. Calibration does not add sensitivity curves. **Flight response — separate
from calibration** previews a linear/cubic blend, maximum angular rate in
degrees/second, self-level tilt in degrees and response duration in 50 Hz steps.
**Apply response** saves that response and resets the attempt. This is an original
simulator profile, not a Betaflight import; radio-side mixes and curves still apply.

Initial arm requires low throttle and neutral attitude controls. Pause, focus loss,
long frame interruptions, disconnection or a changed device/profile clears live
input. Airborne radio resumption requires matching the saved controls; reset returns
to launch disarmed. A latched arm switch must first be observed off and then deliberately
on in the foreground. Radio ownership never silently falls back to keyboard.

## Author a course

Open **Controls → Course Studio**. Changes stay in the Studio instance until exported;
save the JSON before closing or reloading the app.

1. Select **Course** and **Criteria for mode**. Edit both languages' **Title**,
   **Cue / objective** and **Discovery explanation**.
2. Edit the **Ordered criteria**. **Type** offers `hold`, `land` and `gate`;
   use **Add criterion**, **Remove criterion** or **Move earlier** deliberately.
   Volume coordinates are millimetres, speeds are millimetres/second, tilt is in
   hundredths of a degree and hold durations are 50 Hz ticks. A gate also declares
   its axis, crossing direction and opening. Check both modes' criteria separately.
3. Supply a new **Revision** for a changed course and a new **Reward revision
   (change when rebinding the course)** when its exact reward binding changes.
   **Apply guided fields** validates the course and preserves imported reward copy.
   **Advanced course JSON → Apply JSON** uses the same validation. Apply current
   fields before changing the course, mode or selected criterion; those selectors
   load the corresponding draft fields. Changing display language preserves edits.
4. Choose **Preview without earning**, then arm the preview explicitly. It is
   labelled **Authoring preview · cannot earn**. **Try this drill** leaves the
   custom preview and starts the flight app's selected built-in drill; it does not admit the
   imported course to the notebook.
5. Optionally supply **Optional exact demonstration JSON**. It must have a
   `demonstration` session and replay to completion against this exact course.
   Leave it empty when no such demonstration exists; a normal player transcript
   is not a Studio demonstration.
6. Choose **Export course, rewards and demonstration**. Copy the resulting
   **Flight Studio bundle JSON** to a file. Paste it back into that field and choose
   **Import studio bundle** to verify the round trip before distribution.

The `FlightStudioBundle.v1` packet contains one course, one practice reward and an
optional demonstration; its limit is 2 MiB. It preserves the imported reward's
bilingual payload rather than rewriting a promise whenever course text changes.
To edit reward copy, export the bundle, edit its existing `rewards[0]` with a new
reward revision, then reimport. Ownership, scope and exact course requirements
must still match. The lightweight packet accepts knowledge payloads only: images,
teasers, audio, video and cosmetics require a separate admitted asset adapter.

A Studio import is not a package installation or a catalogue update. Publishing a
changed or additional course still requires the registered package source,
matching demonstrations, explicit reward definitions and normal qualification.
It cannot change the current twelve-drill finale simply by appearing in a local
selector. A new revision does not make an old transcript valid for a replacement
course or change an existing player's promised requirements. Preserve the exact
prior package/course for recovery and check upgrade/finale behaviour before
promotion. Company/Level Studio continues to author arcade missions and discoveries;
Company Studio provides guided lesson fixtures. Use the
[discovery author guide](discovery-rewards-author-guide.md) for that route.

## Keep the four transfer routes distinct

| Surface and actions                                                                            | Transferred data                                                                  | What import does                                                                                                                                          |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Radio & response → Export profiles / Import profiles**                                       | `FlightProfiles.v1` in the **Profile JSON** text box; calibration plus response   | Validates settings and resets the attempt. Select the device and reverify controls; it does not arm or grant a completion.                                |
| **Controls → Export recorded inputs / Import a recorded flight**                               | One recorded-input JSON download/file, up to 1 MiB                                | Replays an exact available course for observation. It does not add notebook completion, including when the file describes a completed practice attempt.   |
| **Flight notebook → Export verified flight proofs / Import and reverify proofs**               | `FlightProofBackup.v1` in **Flight proof backup JSON**; up to 128 proofs / 32 MiB | Replays all input proofs against the available course/model/response before accepting notebook evidence. Only completed normal practice sessions qualify. |
| **Controls → Course Studio → Export course, rewards and demonstration / Import studio bundle** | `FlightStudioBundle.v1` in **Flight Studio bundle JSON**                          | Restores an authoring draft and its optional ineligible demonstration. It does not import player evidence.                                                |

The three text-box exports need to be copied into a saved file; they are not automatic
downloads. Profile export includes saved/applied settings, not unfinished field edits.
Keep the exact course and package release with proof backups. The notebook export is
a proof transfer, not a copy of its earned Discovery receipts or an archive of older
course implementations. An unavailable historical course cannot be reconstructed from
a receipt or replaced by a newer course with the same name.

Notebook imports verify cooperatively and offer **Cancel import**. Closing the app
cancels pending work. Cancellation during verification accepts no candidates; completed
saves are retained if cancellation occurs later. The pasted backup remains available.
On a session-only warning, copy the proof backup before leaving and use **Retry saving**
when storage is available. Missing saved proofs stay explicit even if an already-earned
discovery is retained. Arcade Journey, optional-learning and Discovery backups use
their own settings controls and cannot substitute for flight proofs.

## Rewards and package admission

The notebook uses the [shared typed practice reward model](discovery-practice-rewards.md).
Evidence pins the flight model, course, mode, response and verified attempt digest.
Twelve distinct drills, each in either allowed mode, unlock the main notebook;
twelve in Acro unlock a separate distinction. Repeating one drill cannot fill a
missing requirement. Demonstrations, reviews and authoring previews do not earn.
An accepted live completion verifies asynchronously while Next/Retry stays usable.
The notebook wing cosmetic changes presentation only.

Opening practice is explicit. **Controls → Prepare offline package** prepares only
the exact optional package; **Remove this offline package** removes its offline
installation without removing another package. An authoring export does not approve
media rights, add a dependency to an arcade edition, publish a release or install
an optional worker. Follow [optional package candidate delivery](optional-package-candidates.md)
for exact source/runtime admission, immutable versions and reviewed deployment.
Keep the 8 MiB / 64-file limits for both optional runtime and selected source.
Real installation, rollback, physical-radio and learning claims require their own
recorded evidence; see the [installation method and limits](optional-installation-observer.md).

## Model and replay contract

`civilian-quad-fixed.v1` executes 50 steps/second. Position is integer millimetres,
velocity is millimetres/second, angles are hundredths of a degree and quaternions
use a scale of 1,000,000. Checked-in rotation values and bounded integer operations
control authoritative state; Three.js floating-point camera rendering is cosmetic.
World +X is right, +Y is up and forward is −Z. Positive pitch tips forward, positive
roll tilts right and positive yaw turns right. Gravity, tilted thrust, drag and
momentum remain active in both modes. Self-level seeks attitude targets; Acro seeks
angular rates. Neither is a hidden position or altitude hold.

A directional gate requires starting strictly on its approach side and crossing its
plane through the inclusive opening; swept rational tests handle between-step
crossings. Hold ticks must be consecutive. Landing records impact speed/attitude,
so settling after a hard impact does not turn that landing into a valid one. Primitive
obstacles use stable ID order and conservative swept contacts. Each frame stores
four quantized controls; 36,000 frames fit a full twelve-minute attempt. The recorder
refuses overflow instead of truncating proof.

Run `npm run practice:test` for focused automated checks. Numeric portability can be
repeated with `scripts/verify-fpv-portability.mjs`, a separately installed Playwright
module path, a source server URL and output JSON path. The renderer is admitted as
exact upstream Three.js 0.186.1 core/module files and MIT licence. The optional runtime
and applicable source archive each retain the 8 MiB/64-file limits. Playwright and
its browsers are test tools and are not game dependencies.

`node scripts/observe-fpv-runtime.mjs plan.json /absolute/path/to/playwright/index.mjs /new/evidence/directory`
admits an existing frozen optional candidate rather than rebuilding development
source. It checks twenty drill/reset cycles and four viewport layouts, samples
final-circuit frame pacing, then verifies actual WebGL context loss during active
practice. It uses installed Chrome and an isolated instrumented host with
packaged-preview headers. The report pins runtime, source and observer authority;
its scoped measurements do not establish a matched performance regression, radio
hardware or learning transfer. See the [frozen runtime plan](fpv-runtime-observer.md)
and [separate retention procedure](fpv-retention-observer.md).
