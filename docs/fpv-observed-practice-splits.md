# Observed practice splits — R11A

Implementation: `a113208ce8e4076c19b2acc99332c3172e53bfcc` (tree `5b5c0a37e24fa91831464a86d579db2632bb17ca`), based on `ad7225621f0522d9a5d0c886a51e56aefc6f5274`.

## Delivered behavior

The Academy and World pause menus show completed objective durations for selected-aircraft course practice. The English/Ukrainian panel explicitly labels these as **unscored observations at 50 Hz mission steps**. Regional and other free-flight sessions explain that they have no course splits. Historical sector records and their existing comparison rules remain unchanged.

The observer consumes only accepted, still-current mission intervals. It retains at most 64 objective rows, supports validated safe-integer clocks beyond twelve minutes, and never writes to simulation configuration, replay, recovery, archives, records, ghosts, awards or scoring. Presentation updates are cached by objective changes and language, rather than rebuilding each flight frame.

A successful recovery clears observed history even when the restored clock and objective are unchanged. The first objective completed after recovery has an unknown starting time; later fully observed intervals can show a duration. Missing, duplicated, reordered or malformed observations cannot create a fabricated full split. Optional observer/presentation errors show unavailable timing without stopping flight or making a committed recovery fail.

## Verification

- Observer and recovery-control suites: **15/15 passed**, including clock bounds, 64-row bounds, recovery boundaries, same-tick recovery, stale owners, cancellation, and injected presentation failures.
- Actual physical lesson progression: **all 15 aircraft × Acro/Self-level = 30 cases passed**. Each observes the normal ground-check → takeoff → soft-landing route, then repeats the identical accepted controls without an observer. Complete `exportRecovery()` outputs match, including physical hashes, mission state and recorded input/checkpoint state. These are direct-session tests on one authored lesson, not browser or all-course qualification.
- The same mission-adapter test file's **four historical/compatibility tests passed** in a separate selected run. Together the two selections cover the file; intentionally skipped tests are not counted as passes.
- Host checks: the selected Academy physical host case passed; the World/Legacy-course/Regional × Legacy/Actual/Meteor75 matrix passed **nine cases**. These verify preparation, explicit arming, accepted pending steps, selected configuration, and the absence of Regional course splits. Unselected host tests are not presented as a full-suite rerun.
- ESLint on all nine changed source/test files and the whitespace check passed. Independent source/test review found no blocking issue.
- The first combined host command could not load the World file because a tracked dependency was absent from the sparse checkout. Restoring the unchanged committed dependency resolved this setup issue; separate Academy and World runs then passed.

The [package receipt](fpv-observed-splits-package-qualification-20261018.json) records fresh **19/19** packaging checks with zero skipped tests and actual committed input verification. It uses the actual standalone/candidate, offline transformation and native packaging APIs, rather than a projected byte delta or unrelated full-game build.

| Package boundary               | Measured bytes |        Cap |  Remaining |
| ------------------------------ | -------------: | ---------: | ---------: |
| Bundled Academy runtime        |     13,106,517 | 13,107,200 |    **683** |
| Academy original source inputs |     13,278,908 | 13,303,808 |     24,900 |
| World standalone runtime       |     18,608,143 | 20,971,520 |  2,363,377 |
| Native development runtime     |     18,997,958 | 33,554,432 | 14,556,474 |

The Academy selected source inventory is **151/151 files** and World is **211/211 files**. No cap or admitted file count changed. The native count excludes its manifest according to the existing budget contract; the receipt also records complete output size including the manifest. These are packaging checks, not evidence of operation on physical native devices.

## Local rendered acceptance

A root-owned browser check used the frozen `a113208ce` runtime from a local source preview: Meteor75, World **Meet your drone**, Self-level, keyboard. The three objective durations were **0.80 / 12.34 / 6.04 seconds** (19.18 seconds total). The flight remained paused at 20.32 seconds; restoring the 20.00-second durable checkpoint kept it paused, removed observed rows, and explicitly reported unavailable earlier timing. Switching through Settings verified the new timing panel’s Ukrainian recovery explanation, then English was restored. Existing recovery-operation status and archive-reason localization are separate findings; this check does not qualify those messages.

The existing local archive store already contained its maximum 16 entries. Archive saving stopped, while flight, lesson completion and checkpoint recovery continued; no archive was deleted. The original setup-library backup was restored with equal content apart from its revision changing from 0 to 2. The original My drone / Legacy settings, 10° camera tilt, 82° vertical FOV and Basic view remained. The test tab and temporary server were closed.

Screenshots are `sustained-flight/meteor75-observed-splits.png` and `sustained-flight/meteor75-observed-splits-uk-recovery.png` in the task's shared visualization folder. This is bounded local-source-preview acceptance, not public deployment, packaged offline, mobile, physical-radio or native-device acceptance.

## Remaining release and qualification boundaries

- **Only 683 bytes remain in bundled Academy.** Any later shared runtime change requires a fresh combined measurement; this result cannot qualify a future integration tree automatically.
- The bounded local rendered check above passed. Protected CI and publication remain separate gates; this document does not claim GitHub Pages deployment.
- Observed objective times are not verified performance records, substep-resolution timings, personal-best comparisons or competition eligibility.
- Real-radio/device qualification, measured aircraft behavior, and scored Advanced promotion remain separate work. This feature neither supplies nor bypasses those gates.
