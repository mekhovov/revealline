# Team timed slow cue — 29 September 2026

Parent: `29f899e23ac556dd623a02df401adbea151fc087` (PR757).
Status: implemented source correction; production review and release deferred.

## Player-visible correction

A collected enemy-slow pickup already halves actual enemy movement and appears
in the paused details reader. The board checked only Support's stored velocity/
expiry fields, so it omitted the Slowed ring and caption for that same state.

The painter now reads the existing `coopBonusActive(run, 'enemy-slow')` once
per paint. One predicate combines its authoritative `[from, until)` tick interval
with the unchanged Support interval. Both ordinary captions/rings and compact
Hunter LOCK/CHARGE/RECOVER cues use that predicate. Overlap still draws one cue;
freeze alone is not mislabeled as slow. No simulation, body/rig, contact radius,
asset, locale, input or historical schema changes are introduced.

## Source verification

```sh
node --test game/test/coop-bonus-slow-cue.test.mjs game/test/coop-actor-presentation.test.mjs game/test/coop-support-presentation.test.mjs game/test/coop-cue-group-layout.test.mjs game/test/coop-cue-overflow.test.mjs game/test/coop-timed-bonuses.test.mjs
```

The six complete-file cohort passes **70/70**, zero failures/skips/cancellations,
1318.428042 ms, Node 22.22.2. Counts overlap earlier renderer cohorts and are not additive. Eight new cases cover:

- Public pickup collection with unchanged Support fields; actual movement factor,
  corresponding details output and both 212/1152-width painter command traces.
- Large/Plain and reduced-effects settings, unchanged complete checkpoints,
  paused tick/paint stability and exact activation/expiry.
- Public Support overlap with either Support or pickup expiring first, one
  ring/caption throughout; this is not both activation orders.
- A real freeze pickup with active slow, and a freeze-only case without a false
  Slowed cue.
- A validated v6 Hunter reached through actual input in warning, charge and
  recovery, retaining its danger caption plus slowdown marker.
- Removed-actor exclusion, separately marked as an arranged rendering boundary
  after real collection; it is not an elimination-mechanic witness.
- Exact pre-change Legacy/no-bonus painter command hashes.

`baseline-red.tap.gz` byte-preserves the valid pre-fix run: two pass and three
fail because the pickup cue is missing. The earlier scratch run with invalid
fixture anchors/pending Legacy hashes is fixture calibration, not product proof.
Use `gzip -dc` to read the preserved log. The decoded hash is in the manifest.

Scoped ESLint, Prettier, syntax and whitespace pass. Independent read-only source
review found no blocker. The new direct helper dependency already belongs to the
Team core, but the optional static edition collector could not run in this sparse
checkout: its own `publishing/edition-admission.mjs` import is not materialized.
That collection is not reported as passed. Final integrated closure/build,
production successor review and publication remain separate publisher gates.

Finite Canvas traces prove cue selection, lifetime and read-only behavior; they
do not establish browser pixels, physical control, moving-frame performance,
complete map readability or public/offline acceptance. Existing production
approvals and frozen image bytes remain untouched. The user-deferred production
review is not resumed by this fix.
