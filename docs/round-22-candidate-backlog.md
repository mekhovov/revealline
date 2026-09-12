# Round 22 — small player-facing candidates after Sentinel

Reviewed 12 September 2026 against the current v0.11.0 source candidate. **Proposal only:** no next-iteration gameplay, input, preference or artwork changes are implemented here. Freeze and verify v0.11.0 before beginning a selected item. This review used source and public primary-source text; it did not watch footage, inspect new screenshots, audition audio or test physical devices.

**Recommend controller reading mode as the first bounded increment.** It closes a specific gap between navigating a menu and actually reading its long content. Preserve the current encounter and picture rewards; a new boss, currency or forced replay loop is unnecessary for this release-readiness work.

## Current implementation and documentation review

The [Sentinel guide](sentinel-relay.md) agrees with [the core](../game/core/encounter.mjs) and [the authored pack](../game/content/packs/sentinel-relay.json): relay capture, one complete stage-2 attack before an opening, eight distinct current FIELD trail cells for timed release, repeated openings, and the separate safe isolation finish. The seven equipment descriptions correctly distinguish stripe suppression from sentinel body/trail contact. The guide identifies its 20 input traces and ten restored prefixes as reachability evidence, not physical-device or enjoyment evidence.

The [Round 21 plan](round-21-boss-encounter-plan.md) retained three stale distinctions. Its original core-v2/replay-v3-only table is now explicitly a historical baseline; the bounded new descriptor is implemented/importable in its proper envelope; and the proposed pre-isolation `12 cells left / 8` display is explicitly unimplemented. Actual [phase guidance](../game/ui/encounter-view.mjs) shows phase/time and current cut count, then isolation wording once the threshold is reached. Those documentation corrections do not change rules or release expectations.

Already present: independent couch phase cues; keyboard-native mission-text reading; remappable solo keys/controller buttons and axes; controller menu/select/range navigation; touch hold/tap steering and Boost; repeated encounter openings; loss/recovery instructions; gallery/picture viewing; four themed finales. [Celebrations](../game/ui/celebration.mjs) already last at most 3.8 seconds, support skipping, and complete immediately under reduced effects. Do not pitch these again as absent features.

## Primary references and limited inferences

All three pages were opened on 12 September 2026. Their written examples were read; embedded videos and screenshots were not separately inspected.

| Primary text                                                                                                                                                                     | Observed guidance or developer-described feature                                                                                                                                                         | Application proposed here                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Microsoft XAG 112 — UI navigation](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112)                                                      | Navigation should follow the visible layout, provide a way back, and avoid requiring two-dimensional scrolling merely to read scaled text.                                                               | Deliberately enter a single-axis reading mode; retain a visible, consistently mapped exit. This supports a design direction, not a claim that the present game meets the guideline.                                                                                |
| [Microsoft XAG 107 — Input](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107)                                                              | Remapping alone does not remove sustained-hold barriers. The guidance discusses toggles, alternative inputs, adjustable touch layouts and controls that remain usable across orientations.               | Add an optional controller Boost toggle separately from remapping. Consider two finite touch layouts before any freeform editor. Existing 44 CSS-pixel controls are an implementation baseline, not proof of the guideline's physical target-size recommendations. |
| [Insomniac — Spider-Man 2 accessibility options](https://support.insomniac.games/hc/en-us/articles/46730041467027-What-Accessibility-options-does-Marvel-s-Spider-Man-2-feature) | The developer's launch-options list includes per-action hold/toggle choices, explicit puzzle hints, and an option to disable UI parallax. The page separately labels historical planned-update features. | Make our options specific and their feedback stable: “Boost: Hold / Toggle,” an optional explanatory retry hint, and a stationary picture/readout. This does not establish current platform parity or justify copying game assets or mechanics.                    |

These sources do not prove retention, first-attempt difficulty or accessibility for any particular player.

## Ranked candidates

### 1. Read mission and result details with the controller

**Gap:** [controller-navigation.mjs](../game/ui/controller-navigation.mjs) enumerates action/form controls, not `data-game-reading` regions. [input.mjs](../game/ui/input.mjs) protects keyboard reading, but there is no equivalent controller enter/scroll/exit interaction.

**Small change:** expose a “Read details” action only when a relevant mission/result region has content. Confirm enters a clearly labeled reading state. Up/Down scroll that region with bounded repeat; Back exits to the originating control without closing another dialog or resuming flight. Keep Confirm from starting a run while reading. Do not add a second gamepad sampler or a virtual mouse. Touch and keyboard continue their native scrolling.

**Acceptance:** reach the last line of an overflowing Sentinel or authored mission at 320-pixel portrait, 844×390 and 1280×720; no horizontal text scrolling; leave using the remapped Back action; then explicitly Resume. Entry, exit, scope changes, blur, hidden state and disconnect must clear queued flight actions. Removing/replacing the region cancels reading safely. Short regions must not create a focus trap. Test real DOM overflow in addition to the navigation unit tests. A virtual controller proves this software path, not physical hardware compatibility.

### 2. Optional controller Boost toggle

**Gap:** [controller-router.mjs](../game/ui/controller-router.mjs) currently forwards a held Boost button. Touch tap mode already latches its own Boost source; controller remapping does not change the hold requirement.

**Small change:** add an explicit default-Hold controller preference. Toggle mode switches only on a fresh press and shows a persistent “Boost on” cue. Stop, pause, hangar/menu transitions, recovery, disconnect and lifecycle interruption clear it. Clearing must never relatch a still-held button. Keep the canonical recorded `boost` boolean and both steering policies unchanged; place the option in input/preferences, not class stats, artwork or the encounter descriptor.

**Acceptance:** hold one physical press across many samples and get one toggle; combine keyboard/touch/controller without one source cancelling another improperly; clear and require neutral before reuse; export/import valid preferences and default old profiles to Hold. Replaying the same resulting canonical command stream must produce the same existing checkpoints. This feature does not eliminate the separate hold required for controller directional movement, so do not call it a complete no-hold control scheme.

### 3. One useful retry explanation, preserving the picture reward

**Gap:** the final failure copy in [app.mjs](../game/app.mjs) distinguishes deadlines but otherwise uses general danger advice. It can be more specific about a lane, trail or self-contact failure. The current encounter HUD already explains the goal; avoid expanding the ready overlay into another long manual.

**Small change:** derive one short failure reason from authoritative existing cause/event data, with an optional detail accessible through item 1. Example: “The active stripe hit your live line. Close before it activates, or wait for the next opening.” Ordinary recovery may say that captured territory remains; a terminal Restart must not imply the previous relay will survive. After a short or out-of-window successful cut, an optional concise explanation can distinguish ordinary territory captured from core release, using the actual closure phase and pre-capture trail count. Do not guess that count from the now-cleared trail.

**Acceptance:** a failure/closure race reports the actual winning event; a restored terminal run still has an accurate generic fallback when transient detail is unavailable; messages never cover the board or delay Retry. On success retain the existing skippable, reduced-effects, clean-picture finale. Confirm that skipping the flourish cannot also start another run and that viewing/replaying a picture never awards it twice. No extra reward wait, streak or compulsory replay.

### 4. Two touch layouts with stable reading space

**Gap:** responsive controls and tap steering exist, but players cannot choose a mirrored reach layout. Very short phone couch layouts may still need vertical scrolling; shrinking the boards and text indefinitely is not a solution.

**Small change:** start with Standard and Mirrored solo layouts using the existing semantic controls. Preserve the displayed 4:3 board, safe-area padding, visible Stop/Pause and warning text. Keep control order and keyboard/controller focus consistent with their visual position. Leave a freeform drag/resize editor and multiplayer touch customization for separate work.

**Acceptance:** switch layouts only after clearing held inputs; multi-touch direction/Boost remain independent; pointer cancellation releases; portrait/landscape changes retain all actions. Check actual target dimensions and spacing on a phone, not only desktop CSS emulation. If the full board, readable warning and usable actions cannot fit simultaneously, preserve normal scrolling and state the device limitation rather than clipping controls.

## Preservation boundary

The first three candidates can keep level/core/replay/pack identities unchanged: they affect input projection or presentation, not simulation rules. Strict preference changes still need deliberate validation/defaulting and backup/Undo tests. Do not insert mutable UI reading state, toggle latches or retry prose into checkpointed encounter state. Existing frozen route expectations remain independent oracles. Installed-pack replacement, practice isolation and gallery ownership must retain their current semantics.

Ship one bounded player improvement with its relevant verification; do not turn this backlog into another validation-only release or bundle all four into an unreviewable control redesign. Native execution, actual controller models, touch reach and assistive-technology claims require their own observed evidence.
