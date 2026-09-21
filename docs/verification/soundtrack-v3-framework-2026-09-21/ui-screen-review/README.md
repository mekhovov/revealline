# Soundtrack UI source and screen-evidence review

This independent review found **no new confirmed blocker in the reviewed CSS and credit-display integration**. It is a bounded source review, not final release approval, native browser qualification, or art/music approval. The companion [review.json](review.json) records exact file byte counts and SHA-256 hashes, the comparison base, the observed worktree changes, test results and limitations.

The target was source `ed039c08b68c7b2a59824a9e78f38ee5734308ef`, compared with `origin/main` at `14298758fee0f7af08dd87376187568ada531d0a`. The reviewed UI files matched the target commit except for the declared formatting-only change in `game/ui/soundtrack-player.mjs`. Nine formatting repairs were present; distribution-script repairs appeared concurrently and are recorded as outside this UI review. No runtime, generator, approval ledger or existing evidence was edited by this reviewer.

## Source findings

- The `field-kit-compiled.css` delta adds a 44 px music reserve only for a visible Solo Now Playing row in the existing running-landscape surface. Both the board center and its height-derived width subtract that reserve. The title cannot wrap within this fixed-height row; its full text remains in the DOM, and the source link does not shrink.
- Hidden, paused, muted, zero-volume and synthesized selections hide the credit row and therefore reserve zero music space. The shared player can expose a published MP3 as `kind: published`; the Solo and Couch displays accept that case. Missing original filenames are not invented: Couch reports missing metadata, while Solo exposes a retained filename through its title tooltip. Solo does not provide a separate always-visible filename label outside Studio.
- The existing, more-specific `body.field-kit.game-shell` rule in `device-controls.css` retains an effective 8 px bottom reserve despite the compiled stylesheet's 4 px default. The more-specific narrow-landscape header calculation also survives: at widths 521–680 px it is 168.1 px for Standard text and 200.7 px for Large text. The JSON arithmetic matrix includes these effective values, safe-area deductions and visible/hidden music cases. It is arithmetic evidence, not measured browser rectangles.
- Both non-running compact Solo grid templates now name and place a `music` area, preventing the new paragraph from relying on grid auto-placement. Existing fullscreen controls, the D-pad width cap, safe-area offsets and board aspect ratio remain independent of the music reserve.
- Couch credits remain in actual menu and arena flow: a wrapping Versus HUD row and a wrapping Team footer row. Short Team landscape retains its `auto auto minmax(0, 1fr) auto` grid so the footer reserves its actual height. Both Couch displays use the Standard/Large text token and 44 px source-link targets. Hidden controls stay hidden under the applicable page rules.
- Credit text is created with text content; source links allow only HTTP(S), reject credentials, and use `noopener noreferrer`. Couch position updates do not rewrite unchanged metadata or use an ARIA live region. The Versus controller filter accepts visible credit links within the existing navigation scope; mute/pause removes them from traversal.

## Focused checks run for this review

```sh
node --test --test-name-pattern='Couch music credits|Versus menu music source|Couch explicit scene' game/test/couch-audio-master.test.mjs
node --test game/test/board-footprint.test.mjs game/test/compact-arena-layout.test.mjs
```

The first command passed **3 tests**, with **18 unrelated tests skipped**. It verifies metadata and safe/stale links, master/music pause visibility, quiet position updates, cleanup, keyboard/controller source-link traversal, and explicit scene continuity. The second passed **9 tests**, covering independent whole-board fitting, resize/disposal recovery and authored compact-layout policy. All exited zero. Full TAP output was observed in the tool result and is not separately retained here.

These tests use finite DOM/audio/geometry boundaries. They do not execute CSS layout, native media decoding, real device controls or screen-reader speech. No full suite, build, browser action, screenshot capture, audio rendering or full-song listening was performed for this review.

## Existing native observations and their limits

The root agent previously reported Solo at **844 × 390** with the track title above the complete board and clear of the HUD. Root also reported Team at **844 × 390 with Large text**, where an imported direction sketch's title, artist, filename and source link fitted alongside the complete canvas, clock and Pause control. The retained [parent evidence README](../README.md) documents the source-preview sequence and its limitations; its hash is pinned in the JSON.

Those are attributed observations from the evolving source preview. This review did not reproduce them and does not associate new screenshots or a native exact-byte pass with the final source hash. They do not certify every compact viewport, safe-area configuration, long metadata string, First Flight state, paused/result state, published fallback or procedural selection. Very short windows and the narrower 521–680 px landscape header remain native checks if included in release qualification.

The smallest remaining native sequence is: verify visible/hidden credits and source-link focus in Solo, Versus and Team; repeat the running layout with Standard/Large text at 844 × 390 and a supported narrower landscape viewport; then exercise a real two-track transition, audition return and hide/restore without overriding music-only Pause. Packaged/offline asset delivery, browser retention and complete musical/cultural review require their own evidence. No original recording receives approval from this UI review.
