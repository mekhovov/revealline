# Team picture correction and batch acceptance — 15 October 2026

## Tested source and correction

Continued from reviewed main `95703ee32224d061c5c6f1e85e4627b99ce92a99` on
`codex/creator-batch-team-acceptance-20261015`. The shared development checkout was not changed.

The real Team creator produced and installed a two-mission media campaign, but selecting its
first Custom mission failed with “Team picture does not match this prepared arena presentation.”
The media lease checked the exact pack, picture bytes and decoded dimensions, but returned a null
presentation snapshot and omitted the level identity required by the renderer.

The lease now captures the host's prepared presentation and the authenticated level ID/revision.
The host supplies its existing presentation reader. Picture hashes, immutable editions, geometry,
decoding bounds and the renderer's rejection checks remain in force. A regression test passes a
real prepared media binding into the real Team painter; it also rejects another mission or a
mismatched presentation, and checks that a retained binding keeps its original look.

## Built-in desktop browser evidence

Used the local no-store server on port 8794 and the normal existing access session, with a temporary
1280×900 viewport. Files are owned synthetic test-pattern images, not user media. No named
Firefox/Safari, physical audio, peak browser memory or physical mobile qualification is claimed.

### Team

- Generated `Desktop Team acceptance`, seed 0, with Mirrored crossing and Relay pincer.
- The creator verified 12 configurations. Attached a landscape picture and a portrait picture,
  prepared their 1152×576 derivatives, approved and installed edition prefix `2528276ffa21`.
- Reproduced the mission-selection failure before the correction.
- After the correction, the same installed edition opened in the normal Team host. Both pilots
  responded to keyboard controls; enemies caused a joint recovery and reduced shared reserves.
- Restart prompted to replace the saved test attempt. Confirming restarted the same mission at
  zero territory with three reserves. Pausing retained the correct campaign title and picture.
- This does **not** close Team victory, earned-picture ownership, or Next-mission acceptance.

### Twelve images and campaign progression

- Selected eleven distinct landscape PNGs and one portrait PNG through the normal file picker.
- All twelve prepared successfully. Review cards showed enemies, walls, safe islands or terrain
  as applicable, and actual route evidence. Balanced pacing selected Open terraces, Ember garden
  and Island chain variants in this sample; it is not a six-family playtesting result.
- Approved and downloaded an actual **1,698,912-byte** `.rlpack`, SHA-256
  `c562c197dce3eca60e9f0124c63a15955c38a997e508ce837b2d22163efc44cf`.
- Installed edition `42e35df77cabd453c17416dac4933b92b5717af7341a710e58c5718693d8a70d`.
- Completed picture01 on Standard at 70%, three lives, 14,080 points; Continue → Next opened
  picture02. Completed that mission at 50%, three lives, 11,660 points with its distinct poster.
- Reload selected `picture-3` as the next uncleared mission in the same edition. This closes a
  representative Solo multi-mission continuation/reload check, not all twelve mission wins.

### Fifty images

All fifty distinct synthetic PNGs passed ordinary browser preparation and one approval. Downloaded
the actual **7,491,379-byte** `.rlpack`, SHA-256
`ae3a2b87ff0749a7c1f37c3e38b6b66b0565c5da76c3521bb1fb5246569ce02e`, and installed edition
`98046ef91681ab4627d0650322160b5906a1f039e08dd2e952f5ea4d3e7f645c`. The installed library
reported fifty missions. An attempted cancellation was not confirmed before preparation completed,
so browser cancellation remains open. These small synthetic source images do not establish
worst-case memory safety, a clean-profile transfer, or fifty completed missions.

## Automated checks

- Team media, Studio recovery, real Team renderer and creator Team host: **37 passed**.
- Batch preparation, portable bundles, UI state and checkpoint recovery: **28 passed**.
- Full `npm run validate`, changed-file ESLint and formatting passed.

Automated batch checks include 1/12/50 missions, duplicate names, corrupt media, explicit exclusion,
sequential processing, cancellation, capacity splitting, exact dependency closure and recovery.
These are not measurements of real browser memory or quota exhaustion.

## Remaining priorities

1. Team legal win, retained reward and Next across both cooperative templates; broader gameplay review.
2. Complete fresh-profile batch transfer and browser cancellation; duplicate/corrupt input
   interaction, safe quota-failure recovery, package splitting at capacity and peak-memory evidence.
3. Named desktop-browser and physical-audio checks, followed by public creator checks on the exact
   deployed source. Physical mobile remains deferred by the desktop-first decision.
4. Hosted community operations: backend, mail, operator and isolated restore environment still
   need selection. GitHub Pages remains the static host and does not supply these services.

PR #1491 is merged. Its initial Pages run was superseded by newer main publications; the public
identity observed at the start of this session was `d040b6b632a802c0ddcf348244d1475a5602a65f`,
which predates that correction. Do not infer successful deployment from merge alone.
