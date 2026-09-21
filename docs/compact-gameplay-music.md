# Compact gameplay music — follow-up contract

Status: implementation queued after accepted v0.78 integration. This is not a delivered one-row HUD or device acceptance.

The user's small-screen priority is maximum usable arena and ideally one compact HUD row. PR209's music contract also requires current title, artist, original filename and source website to remain available across Solo, Versus and Team. Simply hiding the strip would discard part of that contract.

Keep an identifiable current-track control in compact play. Put complete metadata and attribution in the existing Pause/Music surface. A bare music note with metadata available only in a mouse tooltip is insufficient. Preserve the same behavior in all three modes and the current full credit presentation outside compact gameplay until the replacement is qualified.

## Interaction and rendering

- Prioritize coverage/target, lives or partner status, required timer and Pause. Score and full track details can use paused/results surfaces.
- Opening track details pauses through the existing host path. Closing details returns to the paused owner and never resumes flight. Preserve pending turns and both couch continuations.
- Details show title, artist, exact filename and a safe source link, with truthful missing-field fallbacks. Track changes update identity without stealing focus, restarting transport or announcing every playback tick.
- Controller users reach the same information through Pause/Settings/Music. Touch targets remain at least 44px; keyboard focus follows visible layout. A source-site visit cannot be necessary to resume play.
- Switching tracks must not resize the arena mid-cut. Reserve a stable footprint instead of adding/removing a 44px credit band.
- Keep Large/Plain text, Ukrainian/English and safe-area clearance. If one row cannot fit readably, preserve those requirements and record the exception. Do not describe two rows as one.
- Keep authored stronghold instructions and independent danger captions visible. They are gameplay information, not removable decoration.

## Acceptance

Use actual Solo, Versus and Team hosts with two tracks having different titles, artists, filenames and source sites, plus a missing-metadata case. Verify all four fields through the player journey, not just catalogue records. Exercise mute, late preparation, track change while details are open, previous/next, close/Back and explicit Resume. Presenting credits cannot introduce duplicate Pause/save or autoplay attempts.

Measure arena and HUD before/after track changes at 390×844, 568×320, 600×400, 844×390, 960×540 and 1024×600. Include Large/Plain text, stronghold objectives, both touch sizes, two visible pads and one-seat controller handoff. Check readable warnings, reachable targets, complete artwork and stable arena geometry. Retain screenshots and exact source hashes.

Earlier landscape measurements and the clean CSS merge do not verify a new compact control. Final integration, physical iPhone/Steam Deck, source gates, version/PR/Pages and public checks remain required.

## Research

[Apple's game interface guidance](https://developer.apple.com/design/human-interface-guidelines/designing-for-games) supports a focused presentation and virtual controls over game content. Its [advanced-games session](https://developer.apple.com/videos/play/wwdc2024/10085/) demonstrates contextual touch controls that reduce obstruction. These inform the direction without prescribing this particular HUD.

[Xbox text guidance](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101) applies text adjustments to important HUD/overlay information. Fitting the arena must not undo readability preferences. [Xbox navigation guidance](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112) supports consistent UI structures and interactions.

The [composition rehearsal](verification/handheld-music-integration-rehearsal/README.md) pins the current extra 44px credit band and held landscape correction.

## Browser-input limitation revalidation

A second temporary preview on exact PR209 source and the composed stylesheet was opened with the browser visible. Artwork preparation settled and Start was enabled/focused. Enter, accessibility Start activation and the exposed Help Expand action did not advance the page. No console errors were observed. Hidden-browser presentation is therefore not a sufficient workaround; this is neither a proven game defect nor successful native input. The tab was closed afterward. Further identical input attempts should wait for changed tooling/browser state.

A later [bounded Team browser recheck](verification/handheld-music-integration-rehearsal/recovered-input/README.md) recovered native input without product changes. The earlier no-op result remains historical. First Connection geometry and both pad actions are now observed on the composed preview; the full MP3-credit and compact-track replacement still require their own checks.
