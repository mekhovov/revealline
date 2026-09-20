# Shared master sound — P02-A

Status: P02-A was accepted within its v0.58.1 scope; see the [retained acceptance](cross-mode-execution.md#retained-p02-a-accepted-scope). This does not certify later Studio changes or complete P02-B.

Historical v0.58.0 preparation: v0.58.0 is deployed and byte-verified; P02-A requires the v0.58.1 Team-notice correction before acceptance. The [public review](../publishing/pages-controller/delivery/evidence/cross-mode-p02-a/public-v0580/README.md) records both full 4,332-test hosted families, exact frozen source `c113a348`, source PR #62, publication PR #69 and all 2,505 verified public files. Native sound/transport checks passed within their documented scope. Successful Team sound edits erase its permanent visual-feedback-only notice; keep that explanation in a separate paragraph while the original status node continues to report storage warnings. The correction needs its own source and public gates. Historical preparation below remains scoped to its original source; see the [execution register](cross-mode-execution.md) for current priority.

## Player behavior

Master Mute silences existing music, effects, music-library audition, victory/Collection video and Asset Studio previews. It preserves the song, queue, position, local volumes and intended playback. Unmute only opens that gate; it never issues Play, resumes a paused song or resumes flight. Music Pause controls the playlist. Lifecycle suspension remains separately owned by each page; a hidden page never gains playback because a volume changes.

Mute commands change their accessible name between Mute and Unmute, so they use ordinary button semantics without `aria-pressed`. The next action is explicit, while volume and transport remain independent. This follows the [W3C APG button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/); it does not establish screen-reader or device certification.

Solo keeps its quick sound control and existing master fader. The Music Library has its own reachable master controls inside the modal. Versus and Team expose them in Options; Asset Studio has controls outside mutation/loading regions. Team currently has visual feedback only: the shared preference does not imply a delivered Team soundtrack. Its permanent explanation remains visible independently of transient storage warnings and successful-warning clearance. Custom Versus/Team MP3 libraries and the finished album remain P02-B.

Play and audition are transport actions, including while muted. The Library explains that the master is muted. The next explicit Play can retry a browser-denied request; an asynchronous success cannot change master preference. The authoring preview supplies a labelled local audition fader: native media events are governed by the same gate and cannot replace explicit master or local intent.

## Implementation boundaries

- `game/ui/audio-master.mjs`: synchronous `{ muted, volume, revision }` authority and independently disposable media bindings. It owns no storage, playback context or transport. Zero master/local volume also closes the media mute flag. Equality/readback guards avoid endless `volumechange` loops, including browsers that ignore a requested volume.
- `game/audio-preferences.mjs`: versioned origin-local `revealline.audio-master.v1` record containing exactly `{ muted, volume }`. Reads validate shape/range/length. Creation never writes. Only explicit actions save; unavailable/read-only storage preserves session intent and reports the limitation. Stale events re-read the current record. A failed write protects unsaved local intent from later cross-tab events. No existing profile schema changes.
- Solo uses its old audio preferences only as a fallback when no valid shared record exists. A newly restored profile never overwrites current master intent. Explicit actions mirror compatible legacy fields through the existing profile writer. Practice/training remain session-only.
- Soundscape applies shared gain after local master/music/effects settings. Solo/Versus normalize their old local master to one; procedural Asset Studio audition retains its local 35% attenuation. Streamed music composes music × fade × duck lease × shared master once. Video composes cinematic × shared master once.
- Every output binds before playback is available. Late Play/context-resume completion uses current policy. Closing/replacing one preview releases only its own binding; persistent history restoration retains the page's authority without creating autoplay.
- Binary media, saves, scoring, replay formats and release-art identity remain unchanged.

## Historical v0.58.0 acceptance register

| ID       | Implementation/result                                                                                                   | Remaining acceptance                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| P02-A.01 | Shared authority and explicit cross-page persistence implemented; focused tests retained                                | v0.58.0 full gates passed; retain them and qualify the Team-notice correction                                      |
| P02-A.02 | Synth and streamed music share one gate; late-play modeled; real muted MP3 playback and native speaker override checked | v0.58.0 built/public transport verified; audible quality and physical-device qualification stay separately tracked |
| P02-A.03 | All existing output paths integrated; browser checked two simultaneous native MP3 previews                              | v0.58.0 public hosts checked; Team notice correction remains; physical input qualification stays P18               |
| P02-A.04 | Real MP3 paused position preserved across mute; exact 13% survives reload and all four host routes                      | v0.58.0 reload/paused continuity checked; transfer/offline expansion remains P02-B                                 |
| P02-A.05 | Skills, prompt examples and scoped test receipts included                                                               | Publish and verify the v0.58.1 correction before accepting P02-A                                                   |

Focused tests use real game modules with finite media/context/DOM boundaries. They establish sequencing and state, not audible quality, actual decoding, native hit targets or hardware behavior. The historical source preview used unchanged assets from exact v0.57.1. The current composition preview serves an immutable snapshot of the candidate Git index, including all regenerated outputs. Both are separate from an ordinary production build and immutable public verification.

The [reproducible native mixer check](verification/cross-mode/p02-a/output-probe/README.md) adds actual Web Audio signal measurements after the master/compressor: mute and zero volume produce zero measured signal; quarter volume produces a 0.250056547 RMS ratio. This verifies the digital mixer separately from native MP3/video transport observations and future physical listening/device qualification.

The final phase gate requires the existing six source checks, relevant production reproduction/readiness, ordinary build, hunk-reviewed source PR, immutable next unused minor version, publication-selector PR and full deployed-file verification. Preserve prior versions. Never convert preparatory passes into accepted P01/P02-A release claims.

## Research and device boundary

Native media has a broadly supported boolean mute flag; programmable media volume has a more limited browser support matrix. The shared gate applies both and keeps zero-volume silent through mute, but successful JavaScript assignment is not audible attenuation evidence on iPhone. Test actual supported hardware before asserting that platform's volume behavior. [MDN muted](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/muted), [MDN volume](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume).

A media Play promise may resolve late or reject because browser policy denies playback. Keep the master state independent and provide explicit transport retry rather than changing preferences from completion callbacks. [MDN play](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play).

All shared master faders use the same 1% steps. Native range controls can round values to their configured step; a 5% Settings fader would display a different value from a 1% Library fader. Browser review reproduced that mismatch and verified exact 1% and 13% after alignment. [MDN range step](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/range#step).

## Historical frozen P01 composition

The [scoped composition evidence](verification/cross-mode/p02-a/p01-composition/README.md) combines P01's pending audition/Finish visibility, file-picker cancellation, history-picture recovery and replay operation ownership with P02's existing shared master. Audition resets only its local mute, invokes Play in the activation turn, updates visible feedback and Finish, then awaits playback. The legacy enable callback remains disabled when the shared authority is injected; master changes never restore music intent or enable a retired output.

The twelve complete focused files pass 178 checks on each Node runtime; the inherited offline utility suite passes 40 checks. Eight new combinations cover resolve/reject after Finish, Close, hiding or disposal while the master changes through mute, zero and 13% with a separate local fader. These modeled results do not extend earlier native evidence to this composition. The incoming raw evidence remains exact, including historical diff/log whitespace. The subsequent merge at `86e381a` adds only the incoming publication-controller history; all non-controller files and modes remain identical to the reviewed `c1bb897` composition.

The separate twelve-event browser follow-up verifies exact 13% controls, mute preserving transport, Music Library master controls, and shared settings in Solo, Versus and Team. It adds no new MP3, listening, PCM or physical-device claim. P01 public acceptance remains pending; afterwards qualify and freeze the exact final intended P02 source. Neither the earlier focused tests nor this local follow-up replaces those final gates.

## Studio restoration and hidden-page auditions

Studio repaints master controls from the existing audio authority both during `pageshow` and in the following task, after native form restoration. This is view-only: it does not write preferences, move focus, discard drafts or start playback. Failed-save session intent remains authoritative until an explicit successful save. Keep the two labels `Mute sound` and `Unmute sound` derived from that same state.

An authoring audition is a disposable preview. When Studio becomes hidden, retire both current and draft audio previews, cancel pending context/metadata output and release media bindings and object URLs. Returning visibly rebuilds previews without Play. This follows the existing Studio page-exit policy: an interrupted audition restarts through an explicit Play, with fresh preview-local controls. Master preferences and authored assets remain unchanged. Master mute alone still preserves transport and local volumes; it is not this lifecycle operation.

Do not treat ordinary focus loss as a hidden page. A file picker or another focused control must not dispose a visible audition. Non-audio selections keep their own preview lifecycle, and terminal page exit removes the hidden-page listener. Ordinary game music retains its separate continuous session transport and listening-intent rules. See [MDN visibility changes](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event) and [history restoration](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event).

The complete Studio host tests exercise real handlers with modeled form restoration, unsaved intent, active/pending procedural audition and focus/visibility events. Native-media boundary tests cover simultaneous previews, independent faders, pending metadata, disposal and explicit Play after return. These establish sequencing, not native BFCache admission, actual codec decoding, audible quality or physical-device behavior. Qualify those independently on the final release source.

Procedural Studio audition captions observe the same current master state after accepted Play. Mute, Unmute and zero volume repaint only that active preview's caption; they never replace preparing, stopped or error feedback, start another cue, or revive a disposed preview. Saved and draft previews retain independent status ownership. Native uploaded audio keeps native transport controls and separate metadata readiness/error messages; do not substitute a procedural “playing” caption for metadata readiness. Browser review reproduced the stale muted caption before correction; distinguish that UI observation from actual listening.
