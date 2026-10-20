# Team Journey fixture contracts

Status: both corrected complete files passed on exact parent b2b9743d9c38d2b86c8de9d4f8ff216a0d5539e6: Difficulty 9/9 and Next 27/27. This is a three-path test prerequisite, with no production changes or F10 integration.

## Exact observed evidence

The original complete Difficulty file passed three and failed six at exact parent b2b9743d9c38d2b86c8de9d4f8ff216a0d5539e6, matching the feature run. The parent baseline took 16,009 ms (17.864 seconds wall), peaked at 328 MiB sampled group RSS and triggered no guard. Five failures conflated the existing statistics writer lease with Journey writes. The sixth targeted Retry hidden under Settings → Data.

The unchanged complete Next file on the frozen F10 candidate passed 25 and failed two of 27 cases (133,538.626 ms; 135.450 seconds wall; 674.1 MiB peak; no guard). Two original focus/foreground Skip cases were then selected explicitly against exact b2b runtime and both reproduced the same strict label failure at line 473: expected “Skip mission”, actual “Skip”. That attribution run was 0/2, 9,419.521 ms (11.824 seconds wall), 283 MiB peak, no guard. It was not a complete Next baseline run.

The paused/unarmed label producer is byte-identical on the feature, b2b and captured main cdbda99ac881eb9cac62d536543d9078b92ac081 (SHA-256 3993188e4cc7f9016a2490cebc1b263de5638b500a6e51fa241f51e4fd52da51). Each pin already selects nativeMenu.pauseSkip (“Skip”) while paused and skipMission (“Skip mission”) otherwise. Test source is unchanged on those pins. No newer-main execution is claimed.

## Preserved first proposal and observation

The first corrected Difficulty proposal (three-file manifest 5057a36977af51a3a0c3370162d76fd2a52ddf8dd798e981e993ceec8106f5ce) completed five passed / four failed on b2b: 11,457.035 ms (13.305 seconds wall), 349.6 MiB peak, no guard. Three newly added post-Skip checks omitted the legitimate first-cut teaching write. The fourth reached an original assertion that the earlier counter failure had hidden: the restored-form case read the initial three-reserve lobby HUD after its first Start activation was suppressed. Corrected Next was not run after that failure.

A separate explicitly selected one-case diagnostic (test SHA-256 575a50ed112660277e03405bea337f7b27ee975716df21d08b9059e0f1c00ec3) passed on b2b: 8,738.100 ms (10.741 seconds wall), 241.7 MiB peak, no guard. Public UI observations showed the first click left menu visible and play hidden with expert/Twin Landings prepared. One ordinary controlled frame followed by fresh visible Start hid the menu, showed play and displayed one reserve. No accepted wrong-rules run was demonstrated. This was selected diagnostic evidence, not a complete file pass. A prior wrapper preflight rejected an incorrect expected modified-path set before Node launched; all seven preimages were restored then too.

## Bounded changes

Difficulty captures the actual initialized writer UUID, asserts its exact key/value tuple and the complete ordered preference writes, and asserts no enemy defeat record exists. It never filters or clears writes, seeds statistics, or bumps an arbitrary count. At known post-Skip stages it additionally expects exactly the exported teaching format/key with introduced [“cut”] and completed [], retaining strict pre-Start write expectations. All compiled difficulty, exact payload, reserves, Skip, import, stale decoder, picture retry and prepared selection behavior remains covered.

Recovery uses visible Settings → Data → Retry. It asserts Data-owned focus and no launch after Retry, uses native Back (including compact category Back when applicable), checks return to the Settings opener, then activates visible Start. This replaces the obsolete automatic Start-focus expectation beneath an open Settings dialog with the current owners.

The restored-form case explicitly verifies suppression of the first activation, one normal neutral input frame without launch, then a fresh visible Start that admits Twin Landings/expert with exactly one reserve. It never bypasses the neutral guard, changes the expected reserves, or injects a run.

Next changes only two strict paused/unarmed expected text literals from “Skip mission” to “Skip”. Confirmation text, two fresh activations, exact mission identities, foreground tick, interrupted directions, no-awards and all other assertions remain unchanged.

Only two complete test files and this receipt are proposed. Shared helpers, runtime, localization, timeouts and source catalogs are untouched. The earlier separate two-file Difficulty proposal and first three-file proposal remain immutable.

## Qualification boundaries

Both corrected complete files ran serially in fresh Node 22 processes against exact b2b runtime, with the original five app/HTML/catalog/EN/UK files restored temporarily and only the proposed two test files substituted. Difficulty passed 9/9 in 11,602.144 ms (13.224 seconds wall), peak sampled group RSS 335.0 MiB. Next passed 27/27 in 132,186.188 ms (134.279 seconds wall), peak 663.9 MiB. Both exited zero with no skipped/cancelled cases, stderr, or resource guard.

Both runs used 1536 MiB V8 old space, a 2048 MiB process-group RSS guard, a 180-second per-file wall guard, and a 2 GiB free-disk floor. Minimum sampled free space was 3,514,638,336 bytes for Difficulty and 3,498,606,592 bytes for Next. All stdout/stderr was captured unfiltered in the tool transcript; no filtered test selection was used for these complete qualification runs.

The executed V2 three-path manifest was 9f4aab25267b30189bd670bd8298641ad871d0af525ceb5c75d0e0221879d8ff. The exact test hashes were b1c66af3678bd07de5c839020f36c5bcc93f2dbe07c43086e2592b0c7380afa3 and 3741ff060198319c52b0f9ab65ef24692f02d3d75f15ccbebd7572b80672fd64. The 77-file baseline source audit a9b633df2d3e817a3a857cf3b678f2c7d6d177561079e2a41f8d104727b0a0ef matched before and after each file. This receipt update changes documentation only; both tested files remain byte-identical.

The finally handler restored all seven original preimages and reverified all nine frozen F10 feature hashes (aff199dbf67c402b088f261f737aaee0c28127b642602088eaacb40703a04aa1), the unchanged b2b HEAD and original porcelain working state. Free space after restoration was 3,508,588,544 bytes. The feature's original test files were restored too; these baseline passes are not retagged as F10 integration passes.

Local ignored evidence is under `.cache/improvements-evidence/2026-10-19/`: `team-journey-fixture-contract-source-proposal-v2/baseline-qualification.json` records exact results and tool-output identifiers; `team-journey-fixture-contract-seven-preimages/manifest.json` records original-file backups; the initial two-path proposal, failed first three-path proposal, one-case diagnostic, and pre-receipt V2 document remain preserved separately. No current-main, full-source, actual browser, device or hardware qualification is implied.

The F10 candidate's historical complete native cohort remains 86 passed / eight failed across 94 cases; pure helper eight passed separately. The original incorrect-route new-host failure (10/13), corrected new-host pass (13/13), and initial disk-guard-stopped Next attempt (eight emitted passes without summary) remain separate evidence. This fixture proposal does not retag those results or turn the F10 feature green.
