# v0.28 candidate — pause, learning and readable settings

The requested ‘Take a breath’ panel was the ordinary Pause state, also reached after focus loss and returning from game menus. It prevented unnoticed movement and preserved an unfinished cut. The candidate removes its full-screen explanation, background dimming and repeated reading controls. A compact Paused / Resume / Main menu dock retains explicit resumption and the saved heading. At phone widths the dock sits below the complete arena and inactive flight buttons hide until Resume.

The candidate also supplies an eight-topic Field Guide with four appearance themes and isolated practice, a persisted Standard/Large text option, actionable optional-chapter failures and bounded archive hosting. The Field Guide teaches the delivered seven enemy roles and R3 travelling impacts. It is not a claim that all planned Tactical roles or the full campaign are complete.

## Evidence before freezing

- Existing continuous-host, terminal-navigation and reading regression batch: 25/25 pass. Pausing still retains directions/queued turns and never resumes on an accidental input.
- Guide affected batch: 48/48 pass, including real parent and child hosts across modeled browser boundaries. Five parent cases retain exact run/profile/attempt bytes, isolate controller polling and preserve music-only Pause and stream position. Two additional embedded course Pause → End cases pass in the 17-test reading/course batch.
- Text-size persistence/compatibility batch: 135/135 pass; six actual-host settings tests pass for startup, both steering modes, failed storage, merged preferences and complete-backup/Undo.
- Chapter failure/mission picker batch: 13/13 pass. Real host failures retain the live cut and deliberately retry; a late failure cannot replace a newer choice.
- Source browser: keyboard menu → Settings → Large → Field Guide → impact Observe → actual loss → Return → ordinary game. 390×640 and 320×568 portrait were inspected. The 320px check initially exposed 6px of header overflow and a dock obscuring the arena; corrected padding and below-board pause placement remove both. These are desktop browser viewport checks, not physical phones or controllers.
- Independent review found and fixed an embedded course reader refresh omission and parent audio restoration during child practice. Tests ran with the fixes present; no executed pre-fix failure is claimed.

## Reference decisions

A clear Paused label and Resume action, concise instruction and readable cross-device text are consistent with [Google’s playable game design guidance](https://developers.google.com/youtube/gaming/playables/certification/best_practices_design). Adjustable text and preserved preferences are also recommended in [Microsoft’s accessible game guidance](https://learn.microsoft.com/en-us/windows/uwp/gaming/accessibility-for-games). These support the interface decisions; they do not certify accessibility or establish XPOSED’s exact input behavior.

## Delivery gates

The archive infrastructure is committed as `b2e1ff3e99da1731429f50a306e756593f296cba`. The initial archive deployment succeeded but excluded historical `.xonix-build.json` files through the upload action’s default hidden-file filter. A corrected upload includes the strictly constructed artifact’s hidden metadata; public hash verification and old-scope browser migration must pass before main routing changes. Historical frozen sources/tags remain untouched.

Exact candidate SHA, full source gates, immutable release hashes, PR, public deployment and final browser evidence are recorded after they actually complete. This document currently records candidate work only. See [the roadmap](../../implementation-roadmap.md) for unfinished phases and [archive hosting](../../archive-hosting-design.md) for URL/offline limits.
