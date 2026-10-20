# Character-caption reading time

The existing character-reaction settings offer **Standard** and **Extended (2×)**
reading time in English and Ukrainian. This affects temporary character captions
during play and their timed, silent preview. It does not change critical flight
warnings, the existing recent-message reader, or static result captions.

## Timing contract

- Standard retains the existing text budget: the larger of three seconds or the
  word count divided by 2.5 words per second, rounded up to a millisecond.
- Extended doubles that text budget once. An accepted voice can extend either
  choice to its decoded duration plus 350 ms. This is a presentation setting, not
  a change to playback speed or the simulation clock.
- Each accepted caption captures its timing choice. Later setting changes apply
  to new captions and previews, without truncating or replaying the current one.
- A live locale change stops existing speech and gives the translated caption a
  complete reading interval under its captured choice. Its deadline never moves
  earlier; the director's busy deadline and subsequent 12-second quiet interval
  extend with it. Superseded timer callbacks cannot hide the translated text.
- Danger still interrupts decorative audio while retaining readable text. Pause,
  page hiding, reset and disposal cancel captions and timed previews; resuming does
  not replay them. The existing three-incidental-reactions budget is unchanged.
- Preview uses an incidental line, expires with the selected text budget and
  retains focus. It does not play sound, create a voice context or simulate an
  event. Result captions remain visible until their existing owner removes them.

## Preference compatibility and consumers

The existing `revealline.reaction-presentation.v1` storage key remains the single
owner. A V1 record loads with Standard timing while retaining every saved sound,
speech, subtitle, volume, size and background choice, without a write. Explicit
changes/Retry save a `ReactionPresentationV2` record containing `readingTime: 1|2`.
Older readers reject this future record rather than overwrite it. Current readers
retain corrupt/future bytes and expose the existing session-only failure status.
This slice retains the owner's existing pending-intent and peer/storage-event
semantics; it does not claim transactional concurrent writes across tabs.

Capture, couch Duel/Team, Classic Snake, Survival/Raid commentary, Rooms and Replay
Theater consume the same canonical caption owner. SIM Hunt uses its checked
`world-reaction-runtime.mjs` projection, regenerated from canonical sources. The
separate result-only owner reads the same preference but does not start a timer.

## Verification boundaries

`reaction-reading-time.test.mjs` executes the actual shared settings and caption
owner with a deterministic presentation clock, modeled DOM/storage, and one valid
PCM container plus modeled decoder/voice. It checks deadlines, longer text, voice
minimum, locale changes, stale callbacks, incident budget, cancellation, preview,
legacy/future records and failed-save recovery. It does not measure audible sound.

`reaction-reading-time-host.test.mjs` executes the actual Solo host, legal movement,
Pause and Settings handlers. Timing/locale changes retain the accepted checkpoint,
focus and other saved owners. Browser layout, listening, assistive technology and
physical-device qualification are separate evidence and are not implied by these
finite-model tests.
