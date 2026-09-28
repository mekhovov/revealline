# Discovery desktop observations

The discovery observer extends the existing company review surface/interval helpers. It is a
passive measurement tool, not a release gate, gameplay driver or progress fixture. Every report
remains `qualified: false`. Mocked DOM tests verify its logic only; they are never device evidence.

## Repeatable method

1. Serve the exact baseline and candidate player artifacts on one loopback origin. Preserve the
   artifact descriptors and the observer source revision separately. Use the same machine,
   browser, viewport, DPR, mission gameplay identity, difficulty, steering, sound, effects and
   input protocol. Record sample order. A worktree fingerprint is useful diagnostic context but
   cannot establish which bytes a previously loaded or cached page executed.
2. Use normal player controls to start a mission and earn a result. Do not import constructed
   progress or invoke engine methods to produce a win. Attach `observeDiscovery` from
   `docs/verification/discovery-observer.mjs` through the approved browser test harness and
   provide an explicit binding. No production player code needs instrumentation.
3. Collect at least 20 seconds per actual surface: `active-play`, `result-reveal`, `reward-viewer`
   or `collection`. Arm before a transition when measuring its entry; a result already visible
   when armed measures the settled result instead. `surfaceVisibleWhenArmed` distinguishes these
   cases in new observations. Comparisons reject historical observations that omit that field,
   even when both reports omit it. The observer rejects hidden, already unfocused, blurred or
   changed-scenario samples.
4. Export the raw report, including discarded samples. Capture the exact loaded artifact
   descriptors and a contextual screenshot separately. Use a new output name rather than
   overwriting a valid slow sample.
5. Compare compatible reports with:

   ```sh
   node scripts/compare-discovery-observations.mjs baseline.json candidate.json
   ```

   A baseline/current comparison requires different compiled-artifact SHA-256 identities and
   matching declared device, browser, viewport, gameplay, input and settings. Worktrees are
   rejected. `same-build-effects` is a separate comparison requiring identical source identities
   and explicit full/reduced effects; it does not establish a historical baseline. These checks
   cannot authenticate a supplied descriptor or replace review of the loaded bytes.

The binding fields are `label`, `deviceLabel`, `editionId`, `gameplayId`, `inputProtocol`,
`settingsIdentity`, `sourceKind` (`worktree` or `compiled-artifact`) and `sourceIdentity` (SHA-256).
The observer records the actual user agent, viewport and DPR independently of those labels.

## Repeated public UI cycles

The optional CLI harness uses an existing, explicitly named isolated `agent-browser` session.
That CLI must already be installed; it is not a player or core-offline dependency. It operates
normal public UI controls and never changes engine state, imports wins or writes a player profile.
Use the browser automation allowed in the current environment; the passive observer API is also
available to another approved test harness.

After earning a mission with an image discovery and leaving its win results visible:

```sh
node scripts/observe-discovery-cycles.mjs review-session binding.json new-results.json
```

The runner observes 20 transitions through Results → Explore → Close → Picture, starting with
one genuinely earned result. This is repeated viewing, not 20 wins, learning outcomes or pacing
evidence. It checks actual result/viewer transition counts and waits for a visible image with
successfully decoded pixels; a broken image is a failure. The viewer remains open for two observed
frames even when the image is cached, so a quick transition cannot disappear between observer
frames. Results must expose a visible, enabled Explore control before the runner clicks it.
Failures produce `new-results.json.failed.json` with the failing step and available partial
observations. Diagnostics include bounded public control names/events, pointer-release target
matches, modal state, control visibility and image decode state. They do not collect arbitrary
page text, URLs, player records or user input values. A missing transition cannot count as a
successful requested cycle. Browser commands have a 45-second timeout; phase polling is bounded
to 20 seconds and the two-frame wait has its own two-second deadline.

The lifecycle summary reports observed viewer/result exit pairs and first/last/min/max connected
DOM/media counts at closed-result checkpoints. These counts can expose growth requiring further
investigation. They do not prove stable detached objects, outstanding object URLs or native
decoder allocations, so `retainedResourceStabilityVerified` remains false.

For edition navigation, supply an array of two to eight `{url, binding}` targets:

```sh
node scripts/observe-discovery-cycles.mjs review-session targets.json new-navigation.json edition-navigation
```

It observes 21 ready documents for 20 alternating edition transitions and checks the actual
activated edition each time. URLs must be supported same-origin player targets. Navigation
destroys the previous document, so this is not an in-place ownership or installation-isolation
test. Command wall times include test-driver overhead and must not be reported as page load time.

## Observed on 28 September 2026

The retained [timing log](verification/evidence/discovery-desktop-result-2026-09-28.json) and
[edition navigation log](verification/evidence/discovery-desktop-navigation-2026-09-28.json)
come from a real isolated HeadlessChrome 154 renderer on the local desktop, at 1280 × 633, DPR 1.
They are not viewport mocks, human review or physical-device tests. The source was an actively
edited worktree served at `127.0.0.1:8791`; the declared fingerprint was sampled after the first
page loaded and reused during later navigation. It does **not** pin all executed bytes, and these
records are not eligible for a baseline regression comparison or frozen-artifact qualification.

| Observation                                                                               | Actual result                                                                        | Limit                                                              |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| FPV Learning, The Frame, standard/immediate/scout, stationary opening with enemies active | 1,200 frame intervals over 20 seconds; p95 16.80 ms; maximum 16.80 ms                | Does not characterize movement or advanced encounters              |
| Same mission after a normal keyboard win, settled result                                  | 1,200 intervals over 20 seconds; p95 16.70 ms; maximum 16.80 ms                      | Armed after the win; does not measure the initial reveal animation |
| Long tasks during those two samples                                                       | No observed page-wide long tasks                                                     | No isolated reward-rendering attribution                           |
| 20 FPV Learning/Coupa All URL transitions                                                 | 21 ready documents; exactly one reward dialog, shelf and result per document         | Navigation destroys the previous document                          |
| Connected DOM across those navigations                                                    | FPV: 2,723–2,726 nodes; Coupa: 2,725–2,728                                           | Connected nodes only, not detached retained owners                 |
| Connected media across those navigations                                                  | FPV: one image; Coupa: three images; each one audio, no video, no connected blob URL | Does not count decoder allocations or unreferenced object URLs     |

The result was earned through normal arrow-key controls, with 85.1% captured, 19,940 points and
three lives remaining. No completion fixture was imported. The UI reported tab-only discovery
persistence. The first result-cycle attempt failed waiting for the viewer; its older wait command
was terminated after 45 seconds. It did not produce a completed-cycle receipt. Saved code review
confirms the selectors target the result Explore button and modal, but the available evidence
does not establish whether the failure was in automation or the live UI. Later runner changes add
bounded polling and partial diagnostics; they have unit coverage and were not rerun in a browser.
The isolated browser was closed when the shared disk exhausted free space.

A subsequent read-only audit reproduced a separate runner race in its mocked public-control
fixture: a cached image could appear and the viewer could close before the next observer frame,
so an actual open/close interaction was missing from the sampled cycle count. Waiting for frames
while the viewer is open fixes that harness race. The same audit found the earlier image check
accepted an undecoded or broken image. Neither finding establishes the cause of the historical
modal-open timeout, which occurred earlier. Its post-click surface and input-event diagnostics
were not retained. New logic has 13 focused tests, including 20 simulated viewing cycles, lost
pointer targets, failed decode, cleanup and comparison rejection. Those are test fixtures, not
new desktop measurements; no actual result-cycle rerun is claimed.

Twenty successful result/viewer cycles, first-reveal timing, exact baseline/current comparison,
the 5% p95 target, isolated reward tasks, and retained-resource stability remain **unverified**.
Human review, physical devices and installed-app update/isolation evidence remain deferred.

## Interpretation limits

`requestAnimationFrame` intervals include scheduling and observer overhead; they are not isolated
render-function duration. [MDN explains the callback timing](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).
Long-task entries concern the page/browsing context, and a single task can include scripts,
layout and other work; they do not identify a reward render function. See the
[Long Tasks specification](https://www.w3.org/TR/longtasks-1/).
Browser `performance.memory` is approximate, nonstandard and may include shared heaps or exclude
workers. The observer reports it as available context, never a leak verdict.
[MDN documents those limitations](https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory).

The source audit also found `docs/verification/journey-performance.mjs` and its HTML tracked with
Git's skip-worktree flag in this checkout. Their absence from a sparse working directory must not
be interpreted as a missing historical tool or baseline result.

The comparator requires a bounded observed mission and explicit full/reduced effects on both samples. Older reports remain readable, but equally missing metadata cannot qualify a comparison. The observer discards viewport or pixel-ratio changes before or during sampling. Fifteen focused observer checks pass; these fixture checks do not supply the outstanding actual desktop measurements.
