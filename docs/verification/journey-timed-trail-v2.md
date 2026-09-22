# Timed bonuses: live-trail-aware successor

2026-09-21. Candidate successor to `daaef1facfe573cf13a7da2132ea8fd57aded898`.
Not a version bump, public release, Team qualification or human balance claim.

## Defect and compatibility decision

Solo trails contain `{x,y,index}` records. The original timed-bonus eligibility
check made a set of these records but queried it with numeric cell indices. It
could therefore announce/materialize a pickup on a live trail or use that trail
as a traversable path when estimating reachability. The earlier unit arrangement
used numeric entries and did not exercise the real public-steering shape.

`timed-bonuses.v2` now compares actual indices for both anchor exclusion and
four-direction path search. No timing, speed, effect, collection cap or capture
rule changes. The original `timed-bonuses.v1` algorithm is retained explicitly for
historical replay reconstruction. Descriptor version participates in runtime
identity; the unchanged state layout remains `timed-bonus-state.v1`.

Studio Apply upgrades **all timed schedules in that mission's new revision** to
v2, never a running attempt or previous published edition. Studio's timed study
uses v2. The historical candidate factory still defaults to v1; callers opt into
the successor. Independent review deep-compared both historical artwork settings
and found exact output equality. Unknown versions fail closed. Team remains
explicitly unsupported pending its own shared-state contract and qualification.

## Evidence

- Six public-input historical reproductions, both steering policies: appearance
  on a newly laid trail, announcement on an existing trail, and a reachability
  budget that is only met by illegally crossing a trail. V1 hashes are pinned;
  v2 cancels these opportunities without a grant. No fabricated trail state.
- V2 mid-announcement snapshot restore continues exactly; a v1 campaign cannot
  reinterpret that saved attempt.
- 112 existing collection routes retain their observable outcomes under the new
  descriptor: 54 ordinary routes per difficulty-policy edition plus four extra
  anchor/relocation samples. All collect, clear without loss, replay exactly and
  preserve equal independent Versus boards. New runtime identities/checkpoints
  are pinned separately; historical route inputs are reused, not duplicated.
- The descriptor's v1/v2 is **not** the difficulty policy's v1/v2. Both difficulty
  policies were exercised with the new trail-aware descriptor.
- Five bonus cohorts: **401/401 on Node 20.19.5 and 22.22.2**, zero skips.
- Actual Solo host plus classic core/presentation/transport and foundation
  transport: **65/65 on both runtimes**, zero skips. The host test pauses a live
  countdown, resumes the same attempt, and observes expiry without a collection.
  Sparse content JSON was supplied read-only from exact commit `daaef1fa`; no
  source replacement or fabricated fixture data. Initial sparse-fixture failures
  occurred before assertions and were rerun with this bounded adapter.
- Native Studio at port 8844: inspected/applied the v2 study and launched Behind
  the patrol. At elapsed 0:14, paused Field details reported the slow pickup with
  1.8 seconds remaining and contact-only rules. The display remained 1.8 seconds
  on the subsequent paused observation. This is a live presentation check, not
  full-clear, physical-controller or human enjoyment evidence.

## Reproduction

```sh
node --test game/test/timed-taking-routes.test.mjs game/test/timed-border-routes.test.mjs game/test/timed-bonuses.test.mjs game/test/content-timed-bonuses.test.mjs game/test/trail-aware-taking.test.mjs
node --test game/test/timed-bonus-host.test.mjs game/test/classic-core.test.mjs game/test/classic-presentation.test.mjs game/test/classic-transport.test.mjs game/test/foundation-transport.test.mjs
```

Use a full checkout for the second command, or an exact-revision read-only sparse
fixture adapter. Evidence is technical feasibility, not proof that waiting for a
pickup is enjoyable. Team semantics, wider opportunity sampling, device testing,
human tuning, integrated review and publication remain open.
