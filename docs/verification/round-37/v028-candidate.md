# v0.28 implementation evidence — pause, learning and readable settings

The requested ‘Take a breath’ panel was the ordinary Pause state, also reached after focus loss and returning from game menus. It prevented unnoticed movement and preserved an unfinished cut. v0.28 removes its full-screen explanation, background dimming and repeated reading controls. A compact Paused / Resume / Main menu dock retains explicit resumption and the saved heading. At phone widths the dock sits below the complete arena and inactive flight buttons hide until Resume.

v0.28 also supplies an eight-topic Field Guide with four appearance themes and isolated practice, a persisted Standard/Large text option, actionable optional-chapter failures and bounded archive hosting. The Field Guide teaches the delivered seven enemy roles and R3 travelling impacts. It is not a claim that all planned Tactical roles or the full campaign are complete.

## Focused implementation evidence

- Existing continuous-host, terminal-navigation and reading regression batch: 25/25 pass. Pausing still retains directions/queued turns and never resumes on an accidental input.
- Guide affected batch: 48/48 pass, including real parent and child hosts across modeled browser boundaries. Five parent cases retain exact run/profile/attempt bytes, isolate controller polling and preserve music-only Pause and stream position. Two additional embedded course Pause → End cases pass in the 17-test reading/course batch.
- Text-size persistence/compatibility batch: 135/135 pass; six actual-host settings tests pass for startup, both steering modes, failed storage, merged preferences and complete-backup/Undo.
- Chapter failure/mission picker batch: 13/13 pass. Real host failures retain the live cut and deliberately retry; a late failure cannot replace a newer choice.
- Source browser: keyboard menu → Settings → Large → Field Guide → impact Observe → actual loss → Return → ordinary game. 390×640 and 320×568 portrait were inspected. The 320px check initially exposed 6px of header overflow and a dock obscuring the arena; corrected padding and below-board pause placement remove both. These are desktop browser viewport checks, not physical phones or controllers.
- Independent review found and fixed an embedded course reader refresh omission and parent audio restoration during child practice. Tests ran with the fixes present; no executed pre-fix failure is claimed.

The final menu review also added a direct **Picture collection** title action and renamed the separate library entry **Scores & saves**. Two actual-host keyboard/controller cases preserve a paused cut while visiting both destinations; their affected batch passes 17/17. The source-browser Enter action opens the picture collection without using the header or winning first.

## Reference decisions

A clear Paused label and Resume action, concise instruction and readable cross-device text are consistent with [Google’s playable game design guidance](https://developers.google.com/youtube/gaming/playables/certification/best_practices_design). Adjustable text and preserved preferences are also recommended in [Microsoft’s accessible game guidance](https://learn.microsoft.com/en-us/windows/uwp/gaming/accessibility-for-games). These support the interface decisions; they do not certify accessibility or establish XPOSED’s exact input behavior.

## Frozen release and delivery boundary

This implementation is now frozen as **v0.28.0** from `f79f3c56b0a3cd88ca4e98b7f31689398523da74`. All six exact-source gates and **2,311 tests** pass. Independent reproduction verifies 209 files, 205 manifest entries, 206 ZIP entries and the 201-file / 56,469,824-byte offline inventory; all 32 earlier releases and 33 prior tags remain exact. See [the release verification record](v028-release.md).

The canonical archive's corrected public audit passes all 3,888 files; local migration and an actual saved-profile public-canonical journey also pass. The earlier successful workflows that omitted hidden metadata remain historical failures, not accepted inventory checks. Actual main routing cutover is separate and pending at this handoff.

[PR #3](https://github.com/mekhovov/revealline/pull/3) is under CI review. The [GitHub Release delivery record](https://github.com/mekhovov/revealline/releases/tag/v0.28.0) will carry final merge, Pages and public verification evidence after those actions complete. This report does not claim that v0.28 is already deployed. See [the roadmap](../../implementation-roadmap.md) for unfinished phases and [archive hosting](../../archive-hosting-design.md) for URL/offline limits.
