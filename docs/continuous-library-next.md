# Continuous mission playback — v0.90.0

## Requested change

The user explicitly replaces the former owner-bounded Next policy. A campaign,
pack, edition or collection boundary must not insert a picker or summary step.
The existing deliberate post-result Next activation starts the next mission in
the current mode. This is not a timed auto-start, a mode switch or an award.

## Decision

Keep each runtime's authored successor inside its current sequence. At its end,
resolve the next exact row from the unfiltered unified mission library, ordered
Journey, Classic, Custom and original catalogue order within each collection.
Search, filters, completion history and names never define this sequence. Do not
wrap the final Custom mission to the beginning or automatically change mode.

Alternatives rejected: another pack chooser adds the interruption reported by
the user; merging runtime catalogues would discard ownership and replay rules.
Instead, reuse validated owner-aware library preparation and direct launch.

## Runtime contract

- Match the current mission by exact edition/owner and runtime identity, never
  display name. Ambiguous or missing current identity is a recoverable failure,
  not permission to start an arbitrary mission.
- Preserve original authored order inside a campaign and the existing Journey
  main route; boundary resolution includes retained Classic and Custom content.
- A download is prepared on the results surface. Same-document transitions keep
  the result and picture until adoption; expose status, cancellation and retry
  without opening a picker.
- Preserve mode, party, controllers, difficulty and preferences. A validated
  cross-owner handoff opens the exact target directly in its existing host.
- Failed or cancelled preparation does not record a clear/skip for the target.
- Truly reaching the end of the mode's library reports completion and leaves
  replay and the optional chooser available. No involuntary loop or mode switch.
- Tutorials, practice demos and custom test scenarios retain their separate
  instructional controls; normal released missions get continuous playback.

### Cross-document boundary

Journey and Classic retain separate validated runtime hosts. Before a deliberate
same-mode handoff, prepare the exact destination picture while the source result
remains available; failed/cancelled preflight must not navigate. After successful
preflight, the existing opaque-identity handoff opens the target directly.
This is not an atomic transaction across browser documents: an independent
network/storage/decoder/device failure after navigation still uses the receiving
host's existing recovery, which may include its chooser. Restoring the previous
live result across a failed document navigation remains a limitation, not a
verified guarantee. No test here claims browser rollback or offline coverage.

## Delivery and verification

Source is isolated atop frozen PR285, which is unchanged. v0.90.0 is reserved by
the sole publisher; no promotion before v0.89.0 public acceptance and handoff.
The isolated source branch was fast-forwarded to accepted main
`9374f7fab315a2b9145d699cb4548fb7807b1380` after PR285 merged; the intervening
changes were publication/archive metadata, with no runtime drift.
Focused checks cover same-sequence order, cross-campaign/collection boundaries,
same-name distinct editions, modes, final-library end, missing identity,
download/failure/cancellation and result continuity. Full suites are waived,
not passed. Mandatory lint/format/validation, hosted build/provenance and public
verification remain. This document records design, not completed evidence.

## Completed source work and evidence

- Shared exact-owner, mode-qualified continuation resolver.
- Solo campaign/pack boundaries and Journey-to-Classic direct handoff.
- Versus Next independent of Rematch/series; finite validated settings transport
  and connected-controller seat restoration, including non-sorted seats.
- Team Journey-to-Classic-to-Custom continuation through its existing staged
  picture/adoption transaction. Explicit Team test/practice routes remain bounded.
- Source-side target picture preflight before same-mode cross-host navigation.
- Missing/unavailable/ambiguous identities fail visibly; no implicit skip, clear,
  wrap, mode switch, content removal or persistence migration.
- Version declarations aligned to 0.90.0.
- Independent design and source reviews approved. Review identified and fixed
  a Solo cancellation-ownership gap during asynchronous adapter admission and
  missing preflight before cross-host departure.

One coherent focused cohort passed **52/52, zero failed/skipped**, 63.4 seconds:

```sh
node --test game/test/continuous-next.test.mjs \
  game/test/solo-continuation-admission.test.mjs \
  game/test/solo-continuous-library-next-host.test.mjs \
  game/test/team-continuous-library-next.test.mjs \
  game/test/couch-input.test.mjs \
  game/test/versus-continuous-next-host.test.mjs
```

The affected existing Solo late-Custom-clear case also passed separately;
16 unrelated name-filter cases were skipped, not passed. Scoped ESLint,
Prettier and diff checks passed. Hosted complete validation and production
build remain release gates, not inferred from these local checks.

Evidence limits: Solo Custom/boundary fixtures use real inputs for their clears.
Solo final-Journey and Versus navigation fixtures inject a completed-result
boundary; they do not prove a human clear or issue authentic completion evidence.
Team's nine checks execute unchanged production navigation/adoption functions
with a controlled completed-result and picture-lease boundary. They are not
native-browser or physical-controller evidence. Historical Team route fixtures
failed to reach a win under current gp3 dynamics before Next assertions; this
preexisting route drift remains open rather than being relabelled as a pass.
Initial missing sparse-checkout dependencies and new fixture-shape failures were
corrected before the coherent passing run. No full suite or all-level balance
qualification is claimed.

## Remaining delivery gates

1. Exact committed-source review and mandatory hosted preflight/build.
2. v0.89.0 public acceptance and sole-publisher promotion handoff.
3. Merge-source qualification, immutable v0.90.0 release and Pages selector.
4. Bounded native/public continuation checks on that frozen build; record actual
   tested paths and any remaining evidence limits.

Risk is medium: navigation/async ownership in three hosts changes, but runtime
capture rules, original mission IDs, progression receipts, imported content and
historical editions are retained. No Jira/Jenkins work applies in this repository.
Long suites remain explicitly waived under the user's temporary delivery policy;
mandatory identity, build/provenance, archive/hash and public availability checks
are not waived. A merged PR is not a deployed or publicly accepted release.
