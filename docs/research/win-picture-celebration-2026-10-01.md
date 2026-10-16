# The picture is the prize

The completed artwork remains the main attraction. Solo and Journey no longer
open results automatically: the player can enjoy the full picture indefinitely,
then choose Continue. Results retain Next, Retry and View picture.

## References and decisions

- [Duolingo milestone animation](https://blog.duolingo.com/streak-milestone-design-animation/)
  uses timing and a recognizable celebration metaphor. Here, a short center bloom of
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
its exact original fit over 1.35 seconds. Three center bursts launch at roughly 0.08, 0.32 and 0.56 seconds.
Paper pieces expand radially, tumble, slow down and fade out by 3.8 seconds. The chime resolves over about 2.3 seconds. The picture then stays
still, with an explicit Continue action. Skip immediately leaves the clear picture.

## Verification boundaries

Host tests earn wins with actual simulation commands and check that waiting,
skipping and viewing the picture again preserve the accepted checkpoint and
collection data. Renderer tests check deterministic bounded particles, clipping,
pause, skip and reduced effects. Audio tests check routing through the real
director, envelopes, mute, deduplication and voice cleanup. Browser inspection
is separate from these modeled tests; physical-device and subjective listening
acceptance are not implied.

## Center-burst refinement

The follow-up uses [Canvas Confetti's Realistic Look, Fireworks and Stars examples](https://www.kirilv.com/canvas-confetti/)
and [party.js confetti/sparkles templates](https://party.js.org/docs/ref/templates/)
as references for staggered emission, varied speed, rotation and size, and radial stars.
The existing canvas renderer implements the effect without a new dependency.

A main 52-piece burst is followed by 32 and 20 pieces; up to 16 short-lived stars
lead the expansion. Analytic drag gives a fast outward pop and a floating finish.
A small gravity term gives the ribbons weight without turning the effect into a
falling shower. Pixel distances stay equal on both axes on portrait and wide
surfaces. A minimum size keeps ribbons readable on phones. Reduced effects,
pause, deterministic presentation seeds, clipping and the clear final picture
remain unchanged. This is an aesthetic choice, not a measured retention claim.

## Reveal, appreciate, expand (2026-10-02)

The completed board now holds its original position for 2.4 seconds, including
the existing 0.85-second cover dissolve. That leaves about 1.55 seconds to see
the fully opened picture before its container changes. It expands into the media
view over 650 ms with a gentle ease-out, calculated from the actual contained
picture bounds so portrait screens do not stretch the art. Video is admitted
only after 3.8 seconds; the retained poster stays beneath a 650 ms video dissolve
and remains visible while playback starts or is refused. Image-only rewards use
the same arrival and remain until Continue.

[Material's transition codelab](https://codelabs.developers.google.com/codelabs/material-motion-android)
informs keeping the same visual subject through a container change. We use that
continuity rather than a decorative wipe that hides the earned image.
[Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/provide-an-option-to-turn-off-hide-background-movement/)
and [Xbox XAG 117](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117)
inform preserving reduced-motion and autoplay controls. Reduced effects retain
the appreciation hold but omit expansion motion and automatic video playback.

Demo uses the same reveal, center confetti, arrival and movie dissolve. Only an
exact previously earned story receipt matching its clear picture can supply a
video. Hide pictures conceals even earned images and prevents video acquisition;
unearned artwork remains concealed after a demo win. Movie audio follows demo
Game sounds and the audio master. The recap waits for playing video, then leaves
its poster briefly before rotating. Demo still makes no progress/award writes.
