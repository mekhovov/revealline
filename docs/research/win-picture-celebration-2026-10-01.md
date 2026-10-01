# The picture is the prize

The completed artwork remains the main attraction. Solo and Journey no longer
open results automatically: the player can enjoy the full picture indefinitely,
then choose Continue. Results retain Next, Retry and View picture.

## References and decisions

- [Duolingo milestone animation](https://blog.duolingo.com/streak-milestone-design-animation/)
  uses timing and a recognizable celebration metaphor. Here, a single shower of
  paper confetti replaces the old equipment silhouettes and explosions.
- [NN/g on purposeful animation](https://www.nngroup.com/articles/animation-purpose-ux/)
  informed restrained feedback: one short reveal, a small settling movement,
  then stillness. No looping motion competes with the earned artwork.
- [W3C guidance on interaction animation](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions)
  supports an immediate still version for reduced motion. The existing game
  preference and operating-system preference remain authoritative.
- [MDN Web Audio practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
  informed a soft synthesized chime with audio-clock envelopes through the
  existing effects bus, user activation, mute and volume controls.

These are design references, not evidence of a measured engagement improvement.
The implementation adds no dependency, downloaded sound or external runtime service.

## Timing

The cover dissolves over 0.85 seconds. The artwork gently settles from 1.014× to
its exact original fit over 1.35 seconds. Paper pieces flutter down and fade out
by 3.8 seconds. The chime resolves over about 2.3 seconds. The picture then stays
still, with an explicit Continue action. Skip immediately leaves the clear picture.

## Verification boundaries

Host tests earn wins with actual simulation commands and check that waiting,
skipping and viewing the picture again preserve the accepted checkpoint and
collection data. Renderer tests check deterministic bounded particles, clipping,
pause, skip and reduced effects. Audio tests check routing through the real
director, envelopes, mute, deduplication and voice cleanup. Browser inspection
is separate from these modeled tests; physical-device and subjective listening
acceptance are not implied.
