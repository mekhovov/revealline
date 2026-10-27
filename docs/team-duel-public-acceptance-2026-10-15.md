# Team and Duel public acceptance — 15 October 2026

Continuation source: `859d5cfc927daff2a350318b2325486a58959648`, obtained by rebasing the attached worktree onto latest fetched main without conflicts. New work uses `codex/team-duel-public-acceptance`; the original workspace remains untouched. Paired human balance/enjoyment testing remains waived.

## Published delivery

**16 October continuation:** the [fresh dependency receipt](verification/team-duel-public/public-delivery-2026-10-16.json)
passes the same 180 missions and 357 URLs, now totaling **251,342,372 bytes**, at
public source `b11745223861c3973ad4bf440cc536198b8e0371`. The manifest remained
stable with SHA-256 `41d5ae845b2f78df91634850fed6f6f45ece01459476bb3e811547a5e6d301da`.
This supersedes the dependency audit below only for that measured rolling source.
It does not include unmerged PR #1496 fixes or repeat the native journeys below.

The [public dependency receipt](research/multiplayer-public-acceptance-dependencies-2026-10-15.json) passes against `https://mekhovov.github.io/revealline/` at source `3fe21888bfa4b406c51e1ab165c0782d5d936af0`, version label `0.151.1`:

- Exact 96 Team, 72 Duel and six Hunt missions per mode, including all 24 expansion chapter groups.
- All 357 required dependency URLs match their manifest byte counts and SHA-256 digests: 251,341,753 bytes.
- The catalogue is bound by the manifest and the final manifest reread is unchanged.
- GitHub comparison confirms the public revision contains merge `58d398aa12eb3eba6ee34c57d29f80d9e918f9a1`, with 316 subsequent commits and none behind it.

This verifies the current dependency closure, including additions inherited from main; it does not count those additions as new expansion missions. The public revision contains the earlier Team launch/recovery fixes. It predates this continuation's offline activation and Sound Studio fixes. The native observations below occurred on this rolling origin during the audit; they are not a captured trace proving every browser module came from a frozen revision.

## Native browser observations

The Mac in-app browser used normal public UI and native keyboard input. No simulation state, completion record, player position or clock was injected. Existing access remained authorized; no new credentials or permissions were created.

| Scenario                                   | Observed result                                                                                                                                                                                                                                                                                  | Limit                                                                                                                                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team library and Harbor launch             | Public library listed 116 Team choices, with the 12 expansion chapter families and six Hunt lessons. Selecting Harbor Handoff prepared and started the correct shared arena with a 56% goal.                                                                                                     | Library total includes pre-existing levels; it is not a new-content count.                                                                                                                                                                            |
| Team earned completion                     | Both players drew cuts using WASD/arrow keys. A first Harbor attempt completed at 88.5% in 0:55; the native result named Tidal Ladder as the next arena. The library subsequently showed “Completed · best stars not recorded · Cleared on standard · selected edition”.                         | Native elapsed time includes idle observation time and pauses. It is not a pacing benchmark. The result copy was read from the host DOM after Escape returned to the menu; the saved clear was visibly verified in the library.                       |
| Fresh attempt and safe replacement         | Selecting Harbor again started at 0.0% and two reserves. Subsequent play used reserves and remained unfinished. Choosing Highland Reunion kept the old attempt/picture available during preparation and required “Replace & play”; the new field showed the correct 68% goal and current arrows. | The first earned clear remained saved. Replacing an unfinished attempt is not a mission completion, and no finale win or result-Next transition is inferred.                                                                                          |
| Physical controller enumeration/assignment | Two actual DualSense controllers appeared in the Controls selector. Explicit Join Player 1 and Join Player 2 produced distinct Standard assignments and the visible two-controller status.                                                                                                       | The user subsequently confirmed “both controllers work”. A later local-source Team Player 2 disconnect/reconnect sample passes as recorded in the native controller report below; that later source is not relabeled as this rolling public revision. |

| Duel earned completion and save recovery | After a temporary storage delay, the visible Retry progress save action reported local saving restored. Harbor Gambit started through the library. Native WASD/arrow cuts completed both boards at 55.8%, three lives and 12,950 points, producing “Draw. First clear.” | This is one actual public mission completion. The result promised Next but its parent navigation was hidden, so result → Next failed this check and prompted a source fix. |

Evidence: [Duel earned clear](verification/team-duel-public/duel-harbor-earned-clear.png), [saved Harbor clear](verification/team-duel-public/team-harbor-completed.png) and [two assigned physical controllers](verification/team-duel-public/team-two-physical-controllers.png).

## Duel result continuation correction

The public earned Harbor result exposed a real navigation defect: the result text promised Next, but `race-journey-next` remained inside `race-journey-controls`, whose shipped CSS hides the live-board controls when play finishes. The single existing Next button now lives beside Rematch in the result action stack. Existing result visibility, preparation, ownership and keyboard-navigation guards remain responsible for its behavior.

The actual-host regression earns a clear through both keyboard routes, checks visibility through every ancestor under the shipped nav-hiding rule, visits Settings without losing the result, then activates Next through the real Rematch keyboard link. It failed before the markup move and passes after it. The combined continuation, markup, navigation and continuous-Next cohort passes **44/44** with no skips or failures. This uses finite DOM/image/CSS adapters and is supplemented by the native check below.

In the local Mac browser, the corrected source earned a second Harbor draw at **56.9% / three lives / 13,210 points per board**. [Next: Short Shore is visibly present](verification/team-duel-public/duel-next-visible-fixed.png). Native Return on that action prepared and started the following 50% goal arena on both boards. Both players then captured 9.3% and consumed one life; Pause → Restart reset both to 0.0%, three lives and zero points. This establishes a bounded native result → Next → play → restart flow. The subsequent arena was not completed. Public deployment of this new markup remains a separate acceptance step.

```sh
node --test game/test/duel-result-continuation-host.test.mjs game/test/couch-markup.test.mjs game/test/couch-navigation.test.mjs game/test/versus-continuous-next-host.test.mjs
```

## Later native continuation

The [physical controller report](team-duel-controller-native-2026-10-15.md) adds a controlled live Player 2 power-off → automatic shared Pause and a separate reconnect/rejoin → retained Pause → explicit Resume sample on local source `90616ad44…`. Player 1 retained its seat, and the accepted 31.0% arena/two reserves survived the recovery. It does not certify native Duel or other controller families.

The [Studio report](team-duel-studio-acceptance-2026-10-15.md) adds actual upload, Undo/Redo, save, export, independent-origin import, explicit save and full page reload. A new export preserves all 133 incoming original blobs; the selected capture record retains its other fields under the import namespace. The restored capture then passes 35 native digital audio checks for Team and both Duel owners, ready-bank precedence, mute/pause, delayed decoding and no replay. Acoustic listening and other imported slots/codecs remain separate.

## Acceptance still to establish

The corrected public result → Next → Retry flow and creator backup flows need broader coverage across the dependency/mechanic families and both modes. The Harbor clear is concrete progress, not a replacement for that matrix. The new source-level offline tests establish controlled failure preservation but do not certify native browser eviction, disk exhaustion or a published immutable release upgrade. Native Duel and other-controller lifecycle checks remain separate from the completed Team Player 2 sample. Full decoded/GPU memory, assistive technology and subjective audio listening remain outside the evidence above. No human balance study is scheduled.
