# SIM Setup Workbench

Current progress, priorities and remaining acceptance: [SIM completion plan](fpv-current-completion-plan.md). The release records below retain their original source scope.

The workbench uses one complete setup draft across Academy, World and Regional. It preserves aircraft/physics identities, existing `FpvTuningLibrary.v1` data and immutable attempt configurations. Baseline: `a3db2c95b4ce446f2232b829f9551b73e0f51514` (main, refreshed before implementation).

## Delivery

1. Visual workbench: six sections, Basic/Expert disclosure, bilingual search, exact numeric controls, saved/draft rates and throttle curves, commanded rotation, camera framing, current-draft aircraft preview, input diagnostics, complete raw-text undo and atomic save. Publish this interface before activating automated comparisons.
2. Reusable controller tunes and controlled comparisons: separate tune library, explicit copies, isolated worker jobs, subjective manual A/B and scripted simulation bench.
3. SIM tuning assistant: bounded one-gain candidates, separate validation scenarios and explicit application to the draft.

## Ownership and compatibility

- Built-in aircraft are immutable references. Browsing does not apply them; Use in draft creates an editable setup.
- Shared rate edits default to saving a copy. Updating a shared profile is explicit and lists affected setups.
- Saving the complete setup and its intended rate edit is one atomic setup-library operation. Invalid numeric text and stale revisions block saving without overwriting newer data. Unchanged saves add no revision.
- `setup-draft.mjs` retains raw editor values, algorithm drafts, source revision, bounded undo and generation tokens. Calibration and unscored testing return to the retained draft and section.
- A separate `FpvControllerTuneLibrary.v1` stores at most 32 reusable snapshots, bounded history and 512 KiB. Its revision checks and Web Lock are independent of setup storage. Loading copies values; renaming/deleting a tune cannot alter applied setups. Backup/restore is separately labeled. No operation pretends writes to both libraries are atomic.
- Controller family and format must match. Aircraft changes show an untested-response notice, without gain rescaling or Betaflight PID conversion.
- Expert is disclosure of the same configuration. Search reveals expert controls without changing the user's saved view preference. Customized values remain visible in Basic.

## Visual and input behavior

The Field Kit typefaces, surfaces and controls are reused. Desktop places previews beside controls; narrow layouts stack them. Exact values are available without dragging. PID gains use scale-appropriate fine adjustments. Camera FOV is explicitly vertical, with a 16:9 framing demonstration.

Only commanded rotation animates. It stops outside its section, when backgrounded and for reduced-motion preferences. Live input capture is explicit and excludes menu navigation; typing remains inside the editor. Returning does not arm or resume a flight. Diagnostics distinguish live input from the last committed flight sample and unavailable measurements.

## Simulation comparisons

The isolated bench runs the current physical aircraft backend at its fixed 500 Hz. It measures every accepted physics step, retaining bounded display traces at 50 Hz. Diagnostic capture is excluded from physical state, replay hashes and trajectories. Each request owns an immutable configuration and dedicated worker; replacement, close and invalidation cancel the job and ignore late replies.

PID comparisons hold everything except the controller constant. Complete-setup comparisons identify changed groups. Manual practice freezes comparison configurations and conditions, but does not claim identical human inputs.

The assistant changes one nonzero P/I/D/feedforward gain by ±10%, holding aircraft, rates, filters and zero gains constant. Selection uses step/release cases; separate validation includes opposite directions, ramps, throttle levels, orthogonal-axis steps and deterministic noise seeds. Candidates must improve tracking and pass all regression gates. Zero/unreached metrics are handled explicitly. Results show exact values and measured tradeoffs; inconclusive searches return No clear improvement. Suggestions never save or apply automatically. This qualifies behavior of the SIM model, not a real aircraft.

## Research basis

Interaction patterns were reviewed against [WebFPV input help](https://webfpv.org/notes/), [acroFPV's control-chain explanation](https://acrofpv.com/docs/flight-feel/), [FPVSIM comparisons](https://app.fpvsim.com/how-tos/simulator/tuning/actual-quick-kiss-rates), [Betaflight Basic/Expert behavior](https://betaflight.com/docs/wiki/tuning/4-3-Tuning-Notes), [Liftoff reusable rates](https://www.liftoff-game.com/news/update-157-released), and [WCAG 2.2 focus guidance](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/). These inform the interface, not physical constants or competitor fidelity claims.

## Validation record

Targeted draft/library, controller-library, workbench, host, worker, bench and assistant tests cover atomic writes, invalid text, undo, stale edits, copying, compatibility, diagnostics, cancellation, holdout rejection and no-op saves. The complete practice suite passed **1,060/1,060** checks after updating the paused-controller test to verify live preview ownership. Targeted post-review UI checks additionally cover calibration return, retired catalog references, raw-text undo, geometry updates and independent input capture. Browser checks confirmed Academy/World access, an unscored draft round trip, calibration return, English/Ukrainian labels and a 320-pixel layout. Full lint and source/content validation also run before publication.

Optional/native packaging explicitly includes all workbench and worker dependencies. Academy's measured source/installed envelope increases by 256 KiB; World remains inside its existing 20 MiB envelope. The numerical backend frequency is unchanged.

## Comparison release qualification

The follow-up connects the separately persisted controller-tune library, manual A/B practice, and the isolated simulation bench/assistant. Input review is bound to the selected mapping and device; course identity and Regional launch configuration are frozen into manual comparison conditions. Only explicit controller selection changes the draft. Closing cancels workers and invalidates unfinished tune imports.

Local browser verification exercised the real World comparison worker in Ukrainian: saved and unchanged draft produced identical metrics, and the Meteor75 assistant returned **No clear improvement** without modifying the setup. A reusable controller snapshot saved independently with the setup still showing zero changes. Focused host integration and panel/client tests passed 55/55, broader Academy/World host tests passed 136/136, and updated offline/native packaging tests passed 17/17.

The comparison release's full practice suite passed **1,081/1,081** checks, with full lint and content/source validation also passing. Further focused review covers comparison invalidation after saving a new baseline, manual A/B return to the same section, Airmode-only customization disclosure, preserving focus while restoring defaults, and both operating-system and SIM reduced-motion preferences. Browser checks cover the 320-pixel layout and a 640 × 360 CSS viewport representing a 1280 × 720 window at 200% zoom. The short-height dialog uses one scroll surface; numeric fields and all lower actions remain reachable without an overlay. Actual browser zoom, physical radio and pilot qualification remain unverified.

Import review presents the source version, operation and selected baseline, changed values, inferred defaults, normalization, unsupported fields and warnings. Static curves compare the captured pre-import draft or verified firmware defaults with the imported result; the raw report remains available in collapsed technical details. An accepted preview updates Draft status and is one undoable edit. Browser review confirmed the rate change and explicitly unapplied Betaflight PID field.
