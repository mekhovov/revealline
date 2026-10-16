# Creator browser verification — 15 October 2026

This record closes the password-access blocker for the local creator. The owner supplied the
existing credential and the normal form was used. The credential is not recorded here.

## Source and environment

- Tested fix: `d83bf3c37aeb4b5e2a87eb4d6a8fb0bd2550672b`, merged by
  [PR #1347](https://github.com/mekhovov/revealline/pull/1347) as
  `d6b0cae9df77688f75992279f8cdc181f4f84bcd`.
- Codex built-in desktop browser. Its exact engine version was not available through the browser
  inspection surface, so this does not qualify a named Chrome/Safari/Firefox version.
- Local source served on port 8793. Creation used `127.0.0.1`; portable transfer used `localhost`.
  These are separate storage origins in one browser, **not separate physical browser profiles**.
- The browser initially reported a zero-width body and blank screenshots. A temporary
  1280×900 viewport made the actual board and reward visible. This is a test-environment observation,
  not evidence of a game layout defect at an ordinary desktop size.
- Input: the repository-owned 173,394-byte six-second AVC/AAC fixture and its 640×360 first-frame
  PNG. No personal media, account or public submission was used.

## Verified through ordinary controls

1. Selected the MP4 and same-stem PNG using the actual file chooser. Inspection paired them into
   one mission. The former MIME-label rejection did not recur.
2. Generated First crossing: 72×36 cells, one enemy, two walls, verified route, one poster and one
   complete six-second victory story. Approved and installed through the visible controls.
3. Downloaded the actual `.rlpack`: **339,128 bytes**, SHA-256
   `aeda23b557768f22ee754f4cd95dc55ce9f55f4db84d28b8f5b826d90bbe4c51`.
   Installed edition: `9c5c53d1ff75f7612300f19a0d8894cf7403184c4e7df8573bbc0c591dfb3952`.
4. Started ordinary Solo play and used the Down arrow for the legal crossing. The result showed
   **50% revealed, 3 lives, 11,620 points**, and completion on Standard with the supplied poster.
5. Replayed the victory video. The actual media element reported 640×360, duration 6, readyState 4,
   advancing playback, not paused, unmuted and no media error. Skip returned to the unchanged poster;
   Continue remained available. This confirms native playback, **not a human listening assessment**.
6. Reloaded and opened Settings → Progress & Collection. The earned poster and Standard completion
   remained. The ordinary progress download contained the exact edition profile and legal Solo clear.
7. Imported the actual downloaded `.rlpack` into the second origin, whose installed list was empty.
   Review and installation retained the same edition. Started, paused and reloaded an unfinished
   attempt; Continue restored 0% / 3 lives / 0 points. The transferred mission then completed through
   the visible movement control, with the same result, poster and ended victory story.
8. Selected the MP4 alone. Native capture produced candidates at **0.60, 3.00 and 5.40 seconds**,
   with the midpoint selected. The poster visibly showed frame 30 at 3.0 seconds. Generated Soft
   current included one enemy, two walls and one terrain zone. Its reviewed poster and map were
   visible at the desktop viewport. Installed and completed through ordinary Solo play: **51%
   revealed, 3 lives, 12,000 points**, Standard completion, retained midpoint poster and ended
   victory story. Edition: `3f890ab9a25259332c76360a5bedb8198b14e9eff255074578567151e4e040b0`.

## Limits and next checks

This is a bounded built-in-browser acceptance of paired/video-only intake, ordinary paired and video-only play,
portable transfer and unfinished/earned recovery. It does not close desktop cross-browser coverage,
physical sound, a genuinely clean profile, multiplayer continuation, Studio navigation, broad
layout balance, large-batch memory/storage pressure or public community operations.

The generated samples contain obstacles and enemies, but both retain deliberate straightforward
completion routes. A playtesting pass across all layout families remains necessary before making
claims about challenge, variety or pacing.

The source PR is merged. Its existing [Pages publication run](https://github.com/mekhovov/revealline/actions/runs/38742017511)
was running when this record was prepared. Merged source and successful local play do not establish
that the public site has deployed the fix. Verify the deployed identity and one public upload after
that run completes. No new immutable release tag or distribution is claimed by this receipt.
