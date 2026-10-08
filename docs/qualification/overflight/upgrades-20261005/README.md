# Upgrade visuals and balance follow-up — 5 October 2026

This follows the initial candidate at `13241b30a2e9da7656f0278f7ffd4f3a6c78e432`.
The user reported that upgrade cards required too much reading and that a couple
of pulse upgrades made a stationary drone effectively unreachable.

Open [the interactive card review](review.html) through the repository's local
server to compare each family, language and reduced-effects setting. This uses
the native card component and does not change a player's run or preferences.

## Delivered change

Every one of the 24 branch/rank/utility offers now contains a Now → Next diagram.
Flight direction, stationary release points, areas, echoes, lateral shots, marks,
chains, shielding and collection are shown directly. Combat previews animate;
reduced effects/system reduced motion retains the full geometry as a static
comparison. The diagrams consume the same module parameters as the simulation.
Cards retain one explanation, rank/evolution progress and a complete accessible
verbal/numeric comparison. Highlighted titles inherit the control's contrast
color. Native keyboard/controller focus survives a locale/settings refresh and
moves to a valid choice when another earned draft opens immediately.

Pulses now charge through **90 units of actual flight**, with a small meter beside
the pulse module in the HUD. Full charge gives more reach, damage and knockback
and a shorter following cooldown. Standing still retains a weak defensive pulse.
Arena-clamped movement, an upgrade or replacement placement cannot manufacture
charge. A new run begins empty; a replacement retains only its previously earned
charge. Rank-one full charge deals 26 damage, below an opening enemy's 30 hull.

Slow fields have longer gaps and modest 4/6/8 damage per second. Overlapping fields
share one per-enemy damage cadence and cannot multiply the slowing effect.
The player baseline, encounter populations and the other systems' damage are
unchanged. Shared tuning now keeps every module's card and runtime in agreement.

| Pulse rank | Idle damage   | Fully charged damage | Idle / charged interval | Idle / charged radius |
| ---------- | ------------- | -------------------- | ----------------------- | --------------------- |
| 1          | 14            | 26                   | 3 / 2.4 s               | 62 / 76               |
| 2          | 18            | 36                   | 2.8 / 2.1 s             | 78 / 98               |
| 3          | 18 + 6 return | 52 + 38 return       | 2.8 / 1.6 s             | 84 / 120              |

## Balance evidence

The [summary](balance-summary.json) binds exact source hashes and full tuning.
The [reproduction script](reproduce-balance.mjs) uses ordinary movement inputs and
earned legal cards; it does not inject XP, hull, builds or benchmark immunity.
The before experiment loads exact source from the initial candidate's Git blobs.

| Ordinary one-airframe experiment | Earned pulse rank at | First damage after parking | Outcome           |
| -------------------------------- | -------------------- | -------------------------- | ----------------- |
| Previous rank 2, then stop       | 46.32 s              | 81.45 s later              | Lost at 139.27 s  |
| Rebalanced rank 2, then stop     | 44.77 s              | 11.45 s later              | Lost at 66.75 s   |
| Rebalanced rank 3, then stop     | 67.25 s              | 10.48 s later              | Lost at 92.60 s   |
| Rebalanced rank 2, keep moving   | 44.77 s              | No damage through 240 s    | 100 hull at 240 s |

All **27/27 active three-airframe routes** still complete across three builds,
three encounter sets and three seeds. Current full route receipts are in the
parent directory and pass `node scripts/qualify-overflight.mjs --verify-evidence`.
These checks establish a reachable stationary opening and viable automated moving
routes, not universal difficulty or human enjoyment. The new matrix peaks at
1,048 visible enemies on one route, above the intended 600–800 surge band; this is
an explicit pacing/performance review item, not a passed graphics qualification.

Mechanism tests deliberately construct controlled states for exact charge,
partial charge, cooldown, wall, pause, replacement and overlap assertions.
The fixed-player technical benchmark alone uses an explicitly labeled
`controlled-full-charge-release` policy to retain representative effect load;
ordinary sorties always earn charge through actual movement.

## Test results

- [83/83 Overflight checks](overflight-tests.tap) pass, including 34 core tests,
  all 24 preview cases in both languages, and card accessibility/selection tests.
- The broader [integration cohort](tests.tap) reports 335 passed / 6 failed.
  All six failures use an unchanged Solo picture-test canvas mock that supplies
  only `drawImage`, while the existing field guide calls `clearRect`.
  An [isolated exact-main run](baseline-modal-navigation.json) reproduces one
  representative failure after verifying all 599 loaded modules against baseline
  Git blobs. The other five report the same mock failure; they were not separately
  rerun in the isolated baseline. No unrelated threshold or production behavior
  was changed to make the broader cohort appear green.
- [6/6 CI-registration checks](industrial-tests.tap) pass.
- Formatting, ESLint and source-bound route verification pass. The new preview
  and card tests are registered in the existing local-UX CI cohort.

## Browser evidence and boundaries

- A [complete native Fan run](native-result.json) reached normal results at
  **05:39**, with 4,624 clears, 6,940 salvage, 22 hull and two airframes remaining.
  It matches the new headless route; [result capture](native-result.jpg).
- [Native earned draft](native-earned-draft.jpg): the real game paused on earned
  choices and displayed the actual card component.
- [Pulse comparison](pulse-comparison.jpg): three ranks in the actual card
  component, including a highlighted card with readable title. This is a review
  sheet, not an earned three-pulse draft.
- [Opening comparisons](opening-comparison.jpg) and
  [Ukrainian comparisons](pulse-uk-desktop.jpg) use that same component.
- [Geometry inspection](browser-preview-geometry.json) covers nine review groups
  in both languages, including all 24 unique offers. No SVG captions crossed
  their panels. Reduced-effects inspection contained zero animation styles.
- The live native HUD exposed a 29% pulse-charge value matching its 29% fill and
  localized flight guidance. [HUD capture](native-charge-hud.jpg) retains the
  paused native sortie at 04:19.

These are local in-app Chromium desktop checks. The attempted viewport override
did not change the observed review viewport, so no phone-layout claim is made.
The earlier full distribution build and previous complete-run screenshots retain
their original source binding and do not qualify this changed candidate. No new
60 FPS, hardware, five-player or publication acceptance is claimed.
