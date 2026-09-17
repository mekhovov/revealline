# v0.60.0 affected public browser acceptance

Observed 2026-09-17 in the Codex in-app browser, actual HTTPS GitHub Pages, temporary tab 19. This is an agent-operated browser journey, not a human playtest or physical-device certification. Source `170508f11dd41204b7e24917a823f21701c15961`; deployed publisher `0d1f8a281a3c01768e69ac7a7de05094d03f0ee7`. Public file/authority verification remains separate.

## Game, Studio and shared reading preferences

- The ordinary `/revealline/game/` route reached `/revealline/releases/v0.60.0/site/game/index.html`, displayed VERSION V0.60.0 and focused Start. Keyboard navigation opened Workshop and its Asset Studio destination.
- Studio loaded the existing local FPV Field Kit document revision 25 / local save 1, with 293 slots and zero missing slots. These are this retained local workspace's counts, not a claim that this release produced 293 new assets. No document edit, save, import, export or discard was performed.
- Expanded Interface and used keyboard select controls to choose Plain and Large. The surrounding Save control computed to system-ui / 20px. Filtered inventory to the three fonts and selected Handjet, then Exo 2 and IBM Plex Mono using Tab/Enter. Each newly rendered selected inventory control retained focus. The selected slot and ready saved/draft preview changed together, without dirtying the document; Reset draft remained disabled.
- Handjet's original specimen retained its loaded asset-specific family `RLAsset-4797c11d5e17c3f5f9b5b3fa96efb4fd2aabb877fb4d625dfc8eb7465464e145` at weight 600, separate from the Plain host interface. Exo 2 showed weights 400/500/600; IBM Plex Mono showed 500. Each actual specimen included English, Ukrainian including Ґґ Єє Іі Її, punctuation and numerals. An inline screenshot showed the readable surrounding controls and distinct original font specimen. This is actual rendered UI inspection, not a complete glyph/font-platform certification.
- Two locator attempts did not match this browser adapter's labels/roles (`Kind`, Handjet checkbox); no state changed. After observing the actual DOM/AX controls, the real filter and inventory controls worked. These are retained automation-targeting misses, not inferred product failures.
- Used Studio's real Return to game link; the title returned with Start focused. Keyboard Collection → Flight records → Escape restored focus to Flight records in Collection; Escape restored the title's Collection control. The existing empty records/Collection remained empty.

## Replay keyboard journey

- Keyboard Workshop → Replay Theater reached `/revealline/releases/v0.60.0/site/game/replay-theater/`. Startup initially showed Preparing the theater, then Copper Crossing example verified and loaded, tick 0 of 1305, paused. Startup did not move focus from the document.
- Keyboard expanded Interface: Plain/Large and Reduced effects off were inherited from Studio. Tab through its controls to Jump to playback, Enter focused Play; Space started playback. Space paused at tick 512 / 1305, 4.27 / 10.88 seconds, 2.2% covered, three lives, 340 recorded points. Focus stayed on Play.
- Navigated backward by keyboard, enabled Reduced effects, changed Large to Standard and Plain to Theme, then disabled Reduced effects again. The replay stayed paused at tick 512. Re-entered Jump to playback: Play received focus again. Final restored preferences were Theme (`pixel`), Standard, Reduced effects false. No audio preference was changed.
- Space resumed the recording. It completed at tick 1305, 10.88 seconds, 74.1% coverage, three lives and 12,590 recorded points. The page reported `Final checkpoint matches · 861a6de2ffd7e119 · No progress awarded.` Play and Step became disabled, and focus moved to the available Restart control with a visible focus ring. An inline screenshot showed the completed board and controls.
- Six Shift+Tab commands reached the real Back to the game link. Enter returned to the v0.60.0 title with Start focused. This is a read-only recording, not an earned player win.

## Publication and predecessor route

- Keyboard title → Release explorer opened `/revealline/releases/`, reporting Current v0.60.0 and preserving v0.59.1 in the next row.
- Activated the actual v0.59.1 Play link. Its bridge reached `https://mekhovov.github.io/revealline-archive-15/releases/v0.59.1/site/game/`; initial boot completed and displayed VERSION V0.59.1 with Start focused. No predecessor run was started.
- Browser Back returned to the actual release selector; the v0.60.0 Play link returned to the current game's route. The current tab is retained for user testing; the pre-existing user tab remains untouched.

## Scope and limits

Pass for the listed affected public Studio/Replay journeys, shared preferences, focus behavior and current/predecessor routing. The complete public-byte audit checks all 2,649 deployed bodies; it does not replace these browser observations. Qualified source/native evidence covers earlier error/lifecycle fixtures separately.

No actual game win, save migration, custom asset upload, offline/disconnected execution, controlled full browser restart, BFCache lifecycle, physical controller, real touch/multitouch, Safari, device performance or human enjoyment assessment was performed in this public pass. The broad P03/P05 phases and P18 remain incomplete. Existing source-qualified behavior is not relabeled as physical hardware acceptance. Studio workspace and original Theme/Standard/reduced-off reading settings were preserved/restored; no player rewards were granted by these actions.
