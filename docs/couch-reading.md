# Couch Help: visible exits and current input prompts

P03 candidate, based on `03d12fb5bfd6315a2d6f71720b3e4987549ae69d`. This slice does not accept P03 or publish a release. Integration follows the current P02 release and must retain its newer audio behavior.

Both Couch Help surfaces use the existing reader with a visible Read controls / Done reading toolbar and a status hint beside the text. Team previously sent its reader hint to the collapsed Options area. Versus displayed controller-only instructions after keyboard entry. These defects were observed in the actual baseline browser as well as the source.

Keyboard prompts name Enter, Space and Escape. Controller prompts name the Couch router's fixed South/East bindings. Pointer and touch prompts name Done reading. Short text says all text is visible; longer text names scrolling. A fresh input changes the prompt; neutral controller polling does not take it back. The reader continues to own scrolling and return focus. No new game action, preference, storage owner or input binding is introduced.

`attachControllerReading` accepts an optional `surfaceDefinitions` list of `[regionId, entryId, label, unitId]` tuples. Each region owns stable `-done` and `-hint` siblings. Omitting the list keeps the existing Solo definitions and extensions. Hints remain outside the reading region because content equality protects the active reading session. The pure `readingInputPrompt` helper formats copy only; hosts still own current modality and controller labels.

Done is an end-only button. Its initial press keeps reading alive for the ordinary click; cancellation relinquishes reading without starting or resuming. Enter, Space, Escape and controller exits return to Read controls once. Closing Help or leaving the active surface invalidates reading. Terminal teardown removes the reader's listeners before destroying navigation. These contracts preserve the existing pause, neutral-input and focus rules.

[Xbox Accessibility Guideline 112](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112), reviewed on 16 September 2026, recommends consistent navigation and clear ways to leave a focused interaction using supported input methods. It also calls for navigation to follow layout changes. This supports the shared toolbar and the separate responsive checks; it does not certify this game or substitute for device testing.

## Integration and qualification

- Run the complete shared reader/navigation files, the new Couch reading cases and both existing Couch host/navigation suites. Preserve the source and logs of failures before correction. Run the actual Solo reading host separately to check default compatibility.
- The new host cases use the real page markup, event registrations, navigation and simulations with finite DOM, frame, controller and decoding boundaries. Versus compares both authoritative checkpoints. Team compares paused HUD/progress and the real painter command stream; this is not a direct private-state checkpoint or physical rendering claim.
- Verify actual keyboard Help entry, exits and prompt switching; pointer Done; scrollable text; focus visibility and button dimensions at desktop, portrait and short landscape sizes. Keep physical touch and controller tests distinct from modeled inputs.
- Adopt the newer P02 audio test and HTML hunks. Preserve `c93019a3`'s storage-failure/recovery case, Mute/Unmute semantics, and separate permanent `coop-audio-note` / mutable `coop-audio-status`. Retain the P03 fixture's presentation mount before Team import and readiness wait after import. Do not bypass real picture preparation to make an integration test pass.
- Rebase or integrate only these reviewed hunks into the phase owner. Choose the next unused release version there, qualify the exact combined source through the six release gates, freeze immutable bytes, deploy and verify public play before phase acceptance. This preparatory branch does not compete with P02 publication.

Source tests, local browser evidence, physical devices, full-source checks and public release acceptance remain separate records. The original 132-mission production plan and the wider P03/P07/P08 requirements remain open.
