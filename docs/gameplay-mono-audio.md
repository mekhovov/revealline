# Mono effects and voices

F29a adds an opt-in **Mono effects and voices** control to the existing Audio
settings. It combines game effects, menu sounds and character voices into both
output channels. **Music and videos keep their original audio.** This is a
bounded first F29 deliverable; native music/video mono remains open.

## Output ownership

| Playback owner                                                                        | Included in this choice                                                                            | Route                                                                                                   |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Capture, Creator player, Duel/Team, Snake, Survival/Raid, Rooms and replay Soundscape | Procedural and recorded gameplay effects, radio, movement, menu cues, human reactions and dialogue | SFX/menu/dialogue → gameplay gain → existing master/compressor                                          |
| Academy, Worlds and the optional 2D gym                                               | Motor, ambience, movement, interface cues, human reactions and dialogue                            | Canonical World audio → same gameplay gain; Academy/Worlds use regenerated projections                  |
| Procedural music                                                                      | No                                                                                                 | Music bus → existing master, bypassing gameplay gain                                                    |
| Native soundtrack decks and imported MP3 auditions                                    | No                                                                                                 | Existing media element playback, master mute/volume binding retained                                    |
| Reward audio/video, story playback and reference media                                | No                                                                                                 | Existing native media transport retained                                                                |
| Survival review recording                                                             | Chosen effects mix is included                                                                     | Existing post-master tap; native media remains outside its recorded graph                               |
| Authoring and audio review tools                                                      | No universal output promise                                                                        | Tools that reuse Soundscape inherit its effects mix; independent media/audition routes remain unchanged |

Recorded voices may be stereo and effects may be panned. Existing mono noise
buffers and centered oscillators therefore did not make the complete effects
mix mono. The new stage sits **after** these effects' panners. Its default is
unchanged channel propagation (`max`). Mono uses `explicit`, one channel and
`speakers` interpretation; the downstream stereo destination receives the same
mono signal in both channels. Toggling configures that existing node; it never
reconnects the master, compressor, music path or recording taps.

Native media deliberately stays outside this graph. In particular, trusted
GitHub release soundtrack streams intentionally omit anonymous CORS. The
[Web Audio Recommendation's media-source security rule](https://www.w3.org/TR/2021/REC-webaudio-20210617/#MediaElementAudioSourceNode-security)
requires silence for non-CORS cross-origin content rerouted through a media
source node. A universal graph conversion would therefore risk silencing valid
streams. This implementation never calls `createMediaElementSource` or changes
their CORS attributes. The same recommendation defines the
[stereo-to-mono mix](https://www.w3.org/TR/2021/REC-webaudio-20210617/#down-mix)
and [mono-to-stereo expansion](https://www.w3.org/TR/2021/REC-webaudio-20210617/#up-mix).

## Preference and lifecycle

The single boolean is stored separately under
`revealline.gameplay-audio-output.v1` as `GameplayAudioOutputV1`. Existing strict
mute/volume records and their owner stay unchanged. This feature depends on the
reviewed F31a parent (#1691); it does not import or replace the separate F15b audio
persistence changes (#1632).

Opening settings, restoring a preference and choosing mono cannot create or
resume an audio context. The graph owner attaches only after its normal
activation path creates the graph. Until then the UI says the choice applies
when game sound starts. Node configuration is read back; an unsupported browser
gets an explicit unconfirmed-channel notice independently of saving success.

Saving is read back too. Blocked, full, silent-write and unreadable/newer records
keep session intent and report the specific reason. Retry is explicit; a success
clears the failure and returns focus from Retry to the checkbox. Unreadable or
future bytes are never overwritten by this owner. Pending intent survives
storage/restoration events; accepted current storage events refresh idle owners.
Same-page subscribers share accepted session changes. This is a single boolean,
not a transactional multi-field merge or a cross-tab lock guarantee.

Both graph owners dispose the added node and preference listeners. Changing the
choice does not restart active voices, advance a run, seek native media or change
the master mix. English/Ukrainian copy updates without rebuilding the control.

## Verification boundaries

- Deterministic tests execute the preference, settings, graph and both engine
  owners, including silent-write recovery, preserved future bytes, newer
  reentrant choice, peer/storage filtering, unsupported configuration and disposal.
- A paused actual Duel handler regression retains its checkpoint, existing master
  record, soundtrack cursor and native media transport while changing only this
  choice. Finite DOM geometry is not browser layout evidence.
- An actual soundtrack-owner regression plays a modeled trusted release stream
  and checks unchanged native source/time/play count/CORS/mute/volume after mono
  changes. It proves owner continuity, not a network stream or acoustic result.
- The browser review fixture renders deterministic stereo samples through the
  actual graph using `OfflineAudioContext`. Channel sample evidence, visible
  settings/focus and storage fixtures are recorded separately when reviewed.
- Real listening, mono speakers/headphones, hearing-assistive hardware, screen
  readers, mobile interruption and native music/video mono are not qualified by
  these tests.
