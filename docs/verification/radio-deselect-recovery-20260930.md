# Radio device deselection recovery

The closed, unmerged PR #795 at fa22ab0ce85eca4960ab02ffa3c9240c4aa726f0 contained a device-deselection correction and regression fixture that are absent from main 5e23fa8a62accf7a719cca5dd45c0702b52d37a5.

Current source calls runtime.freeze when the device selector is empty. Freeze stops input but retains the selected device, profile and runtime verification. UI invalidate clears only the setup form's local verification. A later arm request can therefore reuse the previously selected mapping even though the UI says no device.

Restore runtime.select(null) for this exact branch. The existing runtime select operation freezes input and clears device, profile and verification; explicit device selection and re-verification remain necessary. Preserve all newer axis-switch, hysteresis, calibration, import/export and localization work. No saved profile is deleted and no gameplay or physics contract changes.

Restore the exact historical fpv-radio-deselect.test.mjs fixture (blob 0b674e0aeb39d57f719c53d36468f093761ff486). It covers deselection of a previously armed device, mapping revocation, failed re-arm, explicit re-selection without automatic verification, successful explicit re-verification, and animation-frame disposal.

Verification: source/caller review and syntax-only checks. The finding is source-derived, not a newly executed runtime reproduction. Automated tests remain WAIVED_SKIPPED_NOT_PASSED under the current user waiver. Required hosted admission and branch protection still apply. Packaged, public-browser and physical-controller acceptance are not claimed.
