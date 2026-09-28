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
Visibility includes viewport bounds and ancestor overflow clipping; controls must
also have their complete hit box and an unobstructed center. If needed, the driver
uses its public `scrollintoview` operation before checking again. The observer
itself remains passive. A DOM rectangle alone is insufficient visibility evidence.
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

After disk recovery, a fresh attempt retained an explicit failure at the first
Explore action. The 1280 × 633 browser showed its button at y=687–731, below the
viewport and clipped by the 163-pixel result reading pane. No Explore pointer or
click event was observed. This identifies a result-layout defect and a permissive
visibility diagnostic in that resumed attempt; it does not retrospectively prove
the cause of the older attempt with missing diagnostics. The earned reward now
places its compact summary and Explore controls outside the prose scroll pane;
long discovery details remain within the existing untimed reading surface. Ready
teasers keep their original placement, and Next has no new wait or earning gate.
Regression fixtures cover the structural placement and offscreen, partial-clip,
opacity and occlusion rejection. The browser rerun and qualification conclusions
must still be recorded separately.

The first visible-action correction exposed another composition issue: secondary
music controls, utility actions and a large save notice left the picture and win
headline with only a narrow strip. Earned results now reuse the same controls
inside a native More disclosure, keeping Next, Retry, View picture and recovery
directly available. The picture uses contained sizing, longer prose stays in the
existing reader, and the overlay can scroll at extreme sizes. Ready and Pause
restore the original control positions. Pending saves show neutral saving
feedback; session-only backup guidance is reserved for settled nondurable saves.
These are layout and feedback changes, with no new completion or input authority.

At that checkpoint, twenty successful result/viewer cycles, first-reveal timing, exact baseline/current comparison,
the 5% p95 target, isolated reward tasks, and retained-resource stability remained **unverified**. A later actual viewing rerun is recorded below; the wider performance claims remain open.
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

## Resumed earned-viewing check

A fresh isolated HeadlessChrome 154 session on the same local desktop exposed the clipped
Explore control at 1280×633, DPR 1. The [failure receipt](verification/evidence/discovery-result-clipping-failure-2026-09-28.json)
retains the missing viewer transition and narrow public-control diagnostics. Direct DOM inspection
located Explore at y687–731 inside a reading viewport ending at y266; no trusted Explore click
was recorded. This establishes the resumed failure's clipping cause, not the older missing diagnostics.

After the first shared layout repair, a fresh normal keyboard win of The Frame reached 79.6%
with 18,690 points and two lives. The [twenty-view receipt](verification/evidence/discovery-result-viewing-repair-2026-09-28.json)
records 20 Results→Explore→Close→Picture cycles and successfully decoded exact reward pictures.
At every closed checkpoint there were 2,732 connected nodes, one image, one audio element, no
video or connected blob media, and one each of the result, reward dialog and shelf. None of
those connected counts grew.

This was an intermediate working-tree UI check served statically, with a diagnostic catalogue
fingerprint rather than a complete immutable loaded-byte binding. It therefore remains
`qualified:false` and cannot establish a historical frame-time comparison. The test repeated
viewing one accepted reward; it did not create 20 wins. Detached heap objects, outstanding URLs
and decoder allocations remain outside these connected counts. Later compact result composition
and neutral pending-save feedback require their own final layout check.

## Matched compiled artifacts on 28 September

The [bounded comparison record](verification/evidence/discovery-2026-09-28-comparison-record.json) binds baseline `a0eefe578` and candidate `de4cec8ba` to their exact distribution hashes and unchanged Frame gameplay identity. Separate fresh profiles used the same Mac, HeadlessChrome 154, 1280×633/DPR 1, Standard/Immediate/Scout, full effects and muted sound. Both distributions were independently admitted; the current local bundle reproduced twice. The same frozen passive observer measured ordinary controls without creating progress.

| First accepted 20-second case | Baseline p95 | Candidate p95 | Change |
| ----------------------------- | -----------: | ------------: | -----: |
| Stationary active play        |      16.7 ms |       16.8 ms | +0.60% |
| Normal first-win result entry |      16.7 ms |       16.8 ms | +0.60% |

Both scoped comparisons are within the five-percent engineering target. All earlier rejected attempts remain in the linked raw reports, including three current attempts that did not finish the objective within the bounded window. Current maximum frame intervals were 350.0/366.7 ms; page-wide long tasks numbered 3/6 with a maximum 375 ms. These stalls are not hidden by the p95 summary and are not attributed specifically to reward rendering.

There is only one accepted sample per scenario. The normal routes and scores differed; displayed play time includes command latency and is not pacing evidence. The reports remain `qualified: false`. Reward-only 50 ms attribution, detached owners/decoder retention, installed-app behavior and deferred human/device review remain separate. A later workflow/evidence-only commit does not change the measured player code; the measured artifact identity remains `de4cec8ba`, not an unnamed latest build.

## Exact compiled result-viewing cycles

A fresh isolated profile earned The Frame normally on the exact `de4cec8ba` distribution, then completed **20 Results → Explore → Back → Picture cycles**. The [unchanged raw report](verification/evidence/discovery-2026-09-28-current-viewing-cycles.json) binds distribution SHA-256 `16ba0548d23f9390982ee95dbad73882a0d9eb21d3bf2ea4c6a98f2121ebb018`. All 677 archive members, the four frozen observer/runner files and served instrumentation were verified before and after observation. Controls had to be visible and unoccluded, and pictures had to decode; no visibility workaround was needed.

All twenty closed checkpoints had 2,754 connected nodes, one image, one audio element, zero video/blob media and one each of the reward dialog, shelf and result. Approximate browser heap ranged from 44.48 to 110.78 MB, ending at 68.72 MB versus 67.55 MB at the first closed checkpoint. This establishes repeatable connected counts only. Garbage collection, detached owners, outstanding object URLs and native decoders require separate retained-resource evidence. The report remains `qualified: false`; this is repeated viewing of one accepted win, not twenty wins or a physical-device test.

## Reward task diagnostic and shared catalogue reuse

A clean pointer-only Motion Makers viewer trace on `de4cec8ba` recorded a **56.280 ms** renderer task containing the Explore callback and its microtasks. [The diagnostic summary](verification/evidence/discovery-2026-09-28-reward-task-diagnostic.json) binds the exact artifact and module hashes to preserved trace bytes. This trace contains zero keyboard events. A separate 163.803 ms profiler-start operation is excluded. Sampled stacks show repeated catalogue validation/copying during image and media acquisition, alongside native dialog layout/focus. This does not identify media decoding as the cause or establish exact exclusive function costs.

The shared model now reuses only catalogue objects that it fully validated and deeply froze itself. A private weak identity set admits those results; asset closures are weakly owned and remain separate per catalogue and edition. Mutable imports, caller-frozen copies, changed revisions and omitted audiences still undergo full validation. Every media download still receives its ordinary byte-size and SHA-256 verification. The change retains no images, media decoders, DOM nodes or source bytes.

Focused admission, mutation, revision, audience, media and disposal checks pass. The earlier frame-interval comparison and twenty-cycle receipt describe `de4cec8ba`; they do not qualify this later implementation.

The FPV distribution from `61a315090` reproduced across two builds: 32,414,728 bytes, SHA-256 `efb0dd74f216ac46ea68f8b205e5608075883e530dbb84885bb167909b64dbc1`. Runtime/source admission and all 673 offline pins passed. The new package keeps Frame gameplay identity `7feffc97157784af` and the same edition content revision.

The [pointer-only Motion comparison](verification/evidence/discovery-2026-09-28-reward-task-comparison.json) repeats the same first viewer opening in a new browser process with genuinely earned progress, the same device/settings and zero keyboard events. The enclosing reward task measured **56.280 → 8.558 ms**; the callback measured 33.203 → 7.360 ms and its microtask checkpoint 22.282 → 0.490 ms. Neither capture invoked video Play. Profiler startup was excluded in both captures; the new trace had no other renderer task over 50 ms.

This is one matched diagnostic pair with potentially warm disk caches. It supports the targeted catalogue-copying fix for Motion viewer opening. It is not a cold-network test, repeated timing distribution, first-win result measurement, all-reward 50 ms pass or a new p95 frame-time qualification. Both exact raw traces and analysis remain hash-bound in the local evidence archive; the public summary remains `qualified: false`.

The [optimized artifact's twenty-cycle report](verification/evidence/discovery-2026-09-28-optimized-viewing-cycles.json) separately repeats normal Frame play and Results → Explore → Back → Picture viewing on `61a315090`. All twenty visible/decoded-image cycles and closed checkpoints passed, with the same constant connected counts as the earlier artifact. Approximate browser heap ended at 55.12 MB versus 55.39 MB initially, with a 95.22 MB peak; this is not detached-object or decoder evidence. All 677 archive members and four exact observer/runner files were unchanged afterward. The earned save was durable; the owned test browser and server were closed. This receipt remains unqualified and does not turn connected counts into a retained-memory guarantee.

## Optimized artifact frame-time follow-up

The exact `61a315090` distribution was compared with the unchanged `a0eefe578` baseline using the same frozen observer, Mac, browser, viewport and visible settings. The [method record](verification/evidence/discovery-2026-09-28-optimized-p95-method.json), [active-play report](verification/evidence/discovery-2026-09-28-optimized-p95-active-play.json) and [result-entry report](verification/evidence/discovery-2026-09-28-optimized-p95-result-entry.json) preserve the source bindings and all three rejected result attempts. A new isolated profile won The Frame through normal controls; no progress was manufactured. The browser was closed after collection.

Both first accepted twenty-second samples again measured **16.8 ms p95 versus 16.7 ms (+0.60%)**, within the scoped five-percent target. The active sample contained 1,179 intervals and the result sample 1,124. Maximum frame intervals were 383.3 and 416.7 ms; page-wide long tasks numbered three and six, with maxima of 386 and 417 ms. These stalls remain visible in the reports and are not identified as reward-only work.

The accepted result was an actual first win at 92.1%, 21,540 points and three lives. Its displayed 2:33 includes command delays and is not a pacing finding. There is one accepted sample per case, with differing normal routes across builds; this is not identical-replay timing or a repeated-trial confidence interval. The later language-focus and caption-recovery repairs have separate regression checks and are not included in these `61a315090` measurements.

The documented browser profiler provides timeline and CPU traces, but no retained-heap ownership or decoder-accounting command. The earlier twenty-cycle connected counts, approximate heap readings and bounded disposal fixtures remain useful but do not close detached-resource or native-decoder qualification. All reports remain `qualified: false`; human and physical-device review is still deferred.

## Exact earned-image failure and restoration

A retained genuinely earned Frame profile on `61a315090` also passed a bounded desktop recovery check. The [public-safe receipt](verification/evidence/discovery-2026-09-28-exact-artwork-recovery.json) identifies the compiled artifact and the exact 193,494-byte image pin. Documented browser request blocking denied both viewer fetches; a separate read-only request failed with `TypeError`. No service worker controlled the page, and the unavailable-media state was visibly exercised despite warm caches.

The viewer kept its explanation and selectable comparison list, displayed the exact-media recovery message, and offered no replacement image or image download. Removing only the request block and reopening normally restored both original 960×640 image views. Discovery exports before, during and after the failure were byte-identical: 385,716 bytes, SHA-256 `b25e1181602a0632d3dccbb1da1795b578bc0b55716c36c81236e45122f0ed8e`, with one earned receipt. The exact compiled reward model validated the original backup. Backups and browser state remain in ignored local evidence; only hashes/counts enter this report.

This is one English image-recovery case on the same immutable artifact. It does not exercise video/caption failures, failed saves, offline installation, different-version rollback, cross-edition isolation or physical devices. The owned browser was closed and no progress was edited. Qualification remains open for those separate cases and the later viewer fixes.

## First-win and catalogue processing follow-up

A real first win on the `76ea5b31b` candidate exposed repeated reward validation and
mission-catalogue work. The shared runtime now reuses only its own deeply immutable,
validated results while external and imported data keep boundary validation. The
[phase ledger](discovery-rewards-phase-status.md#packaged-browser-follow-up-at-1106ec0ac)
and [1106ec0ac receipt](verification/evidence/discovery-2026-09-28-first-win-1106ec0ac.json)
record the resulting measurements: one 53.708 ms task under CPU sampling, a separate
timeline-only first win with a 45.793 ms maximum, and twenty result/viewer cycles
with an 11.629 ms renderer maximum. The original oversized cycle trace remains
preserved alongside an explicit renderer-only derivative. These scoped observations
retain the negative result and do not close matched p95, all-reward or retained-resource
qualification.
