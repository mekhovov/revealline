# FPV radio setup: guided actions and retained calibrations

Updated 2 October 2026. Focused increment after PR #944; applies to the shared
Academy and World Studio setup. Additional unit coverage remains in R7.

## Player flow

Connect the radio in USB Joystick mode and move a stick to expose it to the
browser. A single visible device is selected automatically. Existing verified
calibrations restore for one exact matching connected device; device slots are
not identities, and two indistinguishable connected radios require selection.

Start calibration once. Rest the sticks, move the requested axis to an endpoint,
hold, and return to rest. The guide advances automatically through throttle,
yaw, pitch and roll, including reversed axes. A progress bar explains each hold.
Manual buttons remain available. The flow then presents **Arm** followed by
**Reset**. Leave the selected switch OFF, hold ON, and return OFF; a momentary
Reset button uses press/release. The assignment finishes without another click.
For a three-position axis switch, ON is the opposite endpoint, not a middle-only
activation window. Pause can be assigned in the same visible switch card.

After checking directions and switches, rest with throttle low, hold yaw right
for one second, and centre to save and return. A distinct hold/centre gesture
can skip an optional action, retaining its current binding. The checkbox and
Save button remain available. Normal flight arming and pickup requirements still
apply. Calibration itself cannot acquire flight input, arm, or reset a level.

## Corrected switch detection

The previous two-click snapshot detector rejected EdgeTX Normal switch reports:
OFF→ON releases one position button and presses another. Continuous capture now
recognizes a single button, an inverted button, a mutually exclusive position
pair, or one unused switch axis. A stable ON and return to OFF must both be seen.

Flight axes, ambiguous simultaneous channels and aliases of an existing action
are rejected. Existing bindings remain until a completed replacement. Focus
loss, disconnect, device replacement, cancellation and invalid samples do not
commit partial assignments. Invalid advanced fields cannot stop the input loop.
Raw channels and numeric configuration remain available under advanced controls.

## Library and sharing

- Up to 16 validated calibrations are retained in a bounded 64 KiB library.
- The adjacent `.library.v2` key leaves original v1 storage intact for rollback.
- Saving another radio or flight response retains prior calibrations. A saved
  preferred calibration restores automatically when exactly its device is present.
- The setup includes a saved-radio picker, removal, full-library JSON download,
  selected-radio sharing download, file import, and legacy JSON import/export.
- Shared/imported profiles load as locally unverified drafts. Their serialized
  `verified` flag is not trusted. Identical already verified local calibration is
  retained; different mappings require checking and saving on this computer.
- Files are not uploaded automatically. Players can share `fpv-radio-setup.json`
  with the maintainer alongside radio model, firmware, USB mode, radio-side
  channel/mixer order, OS and browser. A reviewed community preset should retain
  that provenance and start as a suggestion, never a new universal verified default.
- Radio model backups and this simulator's JSON are different formats. The only
  bundled known-radio mapping remains the existing user-tested TX15 setup.
- Concurrent settings views preserve additions and deletions; delayed file reads
  cannot replace a newer setup choice. Failed writes explicitly remain session-only.

Browser storage is local to the app/site profile. Downloaded backups support
moving calibration to another browser or recovering after storage removal.

## Research decisions

[EdgeTX USB Joystick](https://manual.edgetx.org/color-radios/model-settings/model-setup/usb-joystick)
documents the per-position held-button representation, while its
[developer mapping guide](https://manual.edgetx.org/edgetx-how-to/joystick-mapping-information-for-game-developers)
explains Classic reports and configurable channel ordering. This supports
observing actual signals instead of guessing Arm from the transmitter name.

[Liftoff controller support](https://www.liftoff-game.com/support?category=1&post=44&topic=3)
and its [calibration fixes](https://www.liftoff-game.com/news/update-1410-released)
provide precedents for recognized devices, direction checking and preserving
assignments. [VelociDrone controller guidance](https://www.velocidrone.com/mobile_manual)
explains that switches need radio-side channels. If no raw signal appears, the
simulator cannot create that channel; the setup explains where to check.

No official cross-simulator calibration interchange was established. EdgeTX
[Advanced joystick configuration](https://manual.edgetx.org/edgetx-how-to/configure-advanced-joystick-with-edgetx)
allows different USB layouts, so presets require their matching transmitter
model configuration and a local verification step. No unlicensed preset packs,
firmware changes or guessed verified mappings were introduced.

## Qualification

The mounted browser fixture uses the production setup and runtime with controlled
Gamepad samples, real animation frames and disposable storage. Its 16 cases
include the entire four-axis→Arm→Reset→save path with one initial click, paired
buttons, axis switches, Reset, alias conflicts, cancellation, reconnect, import
trust, invalid fields and delayed imports. The guide-only real-DOM fixture passes
18 cases for stable holds, return gates, direction inversion, focus loss, timing
gaps, final confirmation and EN/UK copy. Receipts record source hashes.

Existing applicable radio/setup regression checks pass 22/22. Only existing
fixture scaffolding and the changed storage-key assertion were refreshed;
additional unit coverage remains deferred. The library has 31 passing production
module checks for retention, rollback, bounds, failed writes, selection
and concurrent settings.

These checks use controlled input, not physical TX15, Steam Deck or other radio
acceptance. Native hardware verification and public deployment acceptance remain
separate. Required package qualification and publication status are recorded in
the continuous delivery log.
