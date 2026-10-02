# Center-burst confetti verification

The shared celebration renderer now emits three radial bursts with tumbling paper,
long ribbons and short-lived stars. The total effect remains 3.8 seconds and leaves
the earned media unobstructed afterwards. No runtime dependency was added.

## Browser evidence

- `center-bloom.png`: actual renderer frozen at 0.7 seconds over the supplied image,
  in a temporary visual preview at desktop width. This is a renderer preview, not
  a gameplay screenshot.
- `portrait-bloom.png`: same preview at 390 × 844, after increasing minimum ribbon
  sizing for phones.
- `video-launch.png`: actual Social Drone · Sky Watch win, earned using the normal
  Start mission → ArrowDown crossing. Video playback and the center burst are
  visible together. The browser announced Story playing. Viewport overrides were
  reset afterwards; the temporary preview page was removed.

## Checks

37 tests passed across celebration-confetti, rewards, win-picture-host and
combat-presentation. They cover radial launch, expansion in all quadrants,
portrait/wide circular geometry, seeded determinism, pause/reduced-effects/skip,
end cleanup, persistent wins and gameplay presentation. Changed-file ESLint,
Prettier and `git diff --check` passed. The broader build and video/studio
qualification are documented in the preceding win-video verification; they were
not rerun for this renderer-only refinement.

References and design choices: [celebration research](../../research/win-picture-celebration-2026-10-01.md).
