# Finite final-source audit and browser observation

## Frozen source and owned resources

- Worktree: `/Users/oleksandr.mekhovov/.codex/worktrees/community-admission/go_test`.
- Branch: `codex/demo-acceptance-followup-20261015`; held draft [PR 1356](https://github.com/mekhovov/revealline/pull/1356). Preserve draft, release hold and planning milestone. No merge, release allocation or publication.
- Final production/test source: **`f0136c2b0f2916af142f6e27a86b3ed2141b844a`**. Later evidence/docs commits do not change served code. No source edits or rebases during these checks.
- Sequential final audit batch: exec session **17929**. Read `final-requalification/batch-state.json` and its four reports/logs. It runs base, Journey, DroneAid and Coupa once, sequentially. Nonzero audit exit codes are retained outcomes; they do not cause retry. An interrupted batch is not completion.
- Task-owned local server: `node scripts/game-cli.mjs serve --port 8832`, exec session **89844**. Preserve it until browser evidence is saved. Never change the user's ports 8779/8820, shared checkout or unrelated processes.
- Existing in-app-browser: **browser 2, tab 2**, `http://127.0.0.1:8832/game/test/browser/demo-watch.html`, marked for handoff. Persistent CUA binding when available: `demoReviewTab`.
- **The single timed observation is now running**, started **2026-10-15T22:35:30.499Z**. Read `final-requalification/browser-handoff-state.json` and the exposed DOM status first. Never press Start again. Pressure Lines 5.0.0 remains installed; recorded scenes and both qualified live maps have appeared.
- The observer was refreshed once after the full audit completed, before its one Start action, so the loaded game uses the frozen final source. **Do not reload, navigate or edit served source now.** The existing gate was unlocked with the user's supplied credential; no credential is stored in this record.
- A 1200×900 test viewport is active because the initial browser had no drawable native viewport. It was applied around 194 seconds into the same run. Reset this override during final cleanup, before finishing the finite task; preserve it while the active rendering observation continues. Browser presentation was temporarily shown, then restored to its prior false setting. Early canvas samples were not visible; all first 72 visibility/focus samples are still visible/focused, so no hidden/unfocused execution is established. Do not infer it from browser presentation settings.
- Actual owned UI checks have sampled demo pause with music playing, resumed demo, music pause while demo advances, then explicit music resume. Sound was explicitly enabled, details closed, and no steering/takeover injected. This does not prove physical audibility.

## Completed audit — retain all outcomes

Inspect all four terminal JSON reports: exact source hashes/content, errors, preparation and actual terminal results, independent replay verification, both steering selections and cleanup. Derive usable-map intersections from `verifiedSourceIds`, not registration counts. Preserve all earlier reports, including negative results. The earlier `audit-summary.json` belongs to source e45a0731c, not this final source.

Do not run another availability audit or concurrent heavy check. The only later heavy check is the single post-observation Worker run specified below. The previous live timing failures remain recorded. A better later outcome cannot erase them. These reports measure accelerated Node core/source execution, not browser wall time, rendered characters, physical audio or human viewing.

The batch completed at 2026-10-15T22:31:16.853730Z. Base 46/46, Journey 208/210, DroneAid 84/84 and Coupa 72/72 verify. Staggered Reserve/immediate and Side Door Bays/grid-center hit loading deadlines. All source/content comparisons and cleanup are stable. The full reports, [summary](final-requalification/audit-summary.json) and exact commands are retained. Do not rerun them.

## Original start procedure — already performed; do not repeat

After the batch finishes, use only supported CUA browser APIs for UI actions and DOM reads. Reload the existing observer once, verify the unlocked game, then enter **Settings → Help & Extras → Watch demo** through actual controls. If home idle entry starts the demo first, use that established session. Do not repeatedly start/reload to obtain a preferred result. Verify Pressure Lines remains installed and the demo opens; a genuine unavailable/error result is evidence to report.

Select **Two wall-clock hours**, press **Start observation** once and record its actual start time and source inventory. Save a handoff-state note immediately so an interrupted agent turn cannot accidentally start another run. Read `#observer-status`, `#observation-checkpoint-status` and `#observation-report` through the DOM. Do not substitute an app-internal probe or injected game driver. Do not steer the demo. Starting the observer hashes sources and does not operate the game.

Use actual owned demo/audio controls to sample independent intent: explicit Sound on when testing enabled music, demo Pause while music remains playing, Resume, and music Pause while demo advances. Allow ordinary sampled intervals between actions. Retain actual labels/current track information, and do not infer audible output. Do not let player controls trigger takeover. Keep Music only unless an explicit sounds check is recorded. If normal pause/resume cannot be verified, record that limitation. Test supported background/visibility behavior through documented browser capabilities when available, but only claim hidden/unfocused execution when the report actually records those states. Never synthesize visibility or application lifecycle events.

While healthy and running, preserve the tab/server and stay quiet. Collect an incomplete local checkpoint when practical; do not stop the run to collect it. Decorative source edits, navigation, extra observations and further CPU-heavy checks are prohibited while it is active.

## Exact report collection

Read the exposed textarea in chunks **smaller than 80,000 characters**, without a download-event wait. Before and after an active collection compare textarea length, observer elapsed/status text and checkpoint-save timestamp/status. Accept joined bytes only when markers match; otherwise discard that read and retry at most three times. If stability cannot be obtained, retain the earlier snapshot and leave the observer's automatic IndexedDB checkpoint persistence running. An unstable read is not a game failure.

Supported CUA read-only DOM evaluation can read each textarea slice. Concatenate slices before UTF-8 writing, so a split Unicode pair cannot corrupt output. Save exact text, parse it, and print only bounded metadata. Save a stable running snapshot as `final-requalification/browser-observation-running.json`; save automatic completion as `final-requalification/browser-observation-final.json`. Never overwrite failed or preliminary evidence.

At automatic completion inspect the full finalized report: elapsed wall time separately from advanced simulation; actual recorded/live/improvised scenes and rotation; explicit pauses and music intent; visibility/focus samples and unobserved gaps; rendering samples, diagnostics, source changes, redacted storage hashes and cleanup limitations. All-visible samples do not prove hidden execution. No browser harness proves physical iPhone/audio/device behavior, unfamiliar-viewer quality or release readiness. Those human/device checks remain deferred by the user.

If the tab disappears, confirm inventory first. You may reopen the same local observer only to retrieve its existing recovered checkpoint/final report through the UI. Do not Start, resume, append samples or run a replacement observation. Save exact recovered bytes and report the lost interval/incomplete status. A source change, lost tab or attachment failure is a limitation to preserve.

## One post-observation Worker check

The completed final-source base audit now verifies all 46 sources, including all twelve live cases, with unchanged hashes and zero Worker owners/listeners. This is new-source evidence after actual corrections; it does not erase earlier failures. After a **normally completed** browser observation is saved and inspected, release only the observer tab and verified task-owned port 8832 server so their Workers cannot compete. Then run exactly once on unchanged f0136c2b0 production source:

```sh
node --expose-gc scripts/soak-demo.mjs --simulation-seconds 7200 --report docs/verification/demo-gap-recovery-2026-10-15/final-requalification/worker-final-qualification.json
```

Keep its complete log beside the report. Do not change watchdogs, limits, source or assertions; kill unrelated processes; or retry until green. Preserve pass/failure, actual advanced simulation separately from wall time, source comparison, pause checks, actual Worker-thread peaks and final resource cleanup. This is accelerated Worker evidence, not browser wall time. If the browser run was interrupted or unrecoverable, preserve that limitation and skip this follow-up. Include its one outcome in the finite final report before pausing the heartbeat.

## Finalize and stop

Update only evidence and qualification/plan documentation, with focused formatting/JSON/link checks. Before pushing, inspect the current remote PR head and preserve newer owner work. Use a normal fast-forward continuation only; never force-overwrite a newer branch or pull source changes into an active observation. Push completed evidence when safe, keeping the PR draft/held. No release claim.

Once final evidence is saved, reset the temporary 1200×900 viewport and retain the prior browser presentation setting (false), then release only this observer tab and the verified task-owned port 8832 server. Confirm the exact listener/process before stopping it if the exec session is unavailable. Do not close another tab or kill another server.

Report meaningful completion, a new failure or required user action only. Then **pause this finite heartbeat through automation_update**, preserving its fields. Stop its recurring work after the finite outcome or an unrecoverable limitation. Do not create another observation or retry until green.
