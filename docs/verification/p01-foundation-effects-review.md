# P01 foundation projection — superseded effects experiment

**Not adopted for publication.** The following scoped review records an initial
experiment, not the current production ledger. Regression review found that
advancing FPV theme 32 to 34 would break exact Team/imported-picture identities.
The final implementation instead uses `game/ui/foundation-view.mjs`: an explicit
read-only adapter delegates the new runtime's unchanged visual fields to the old
bounded projection. Core.v5 and earlier still call the original projection directly.
The real core.v6 identity and buffers are never modified. Legacy effects renderer,
producer declarations, Team bindings/policy/receipts and production revision 32 are
byte-identical to P00. No compatibility wildcard or imported receipt rewrite.

Before restoring the four generator-owned outputs, the complete unpublished
experiment was archived under `.cache/journey-handoff/p01-unpublished-theme-experiment/`.
The retained bundle SHA256 is
`a9c0b908f2997f82b433baaf67306f0ab6d7e28181da604d541a879b6d46b1a6`;
the restored accepted bundle SHA256 is
`adcc24a3d610f8847c10829badc182b0a004381d621b2ca3bbcfe1973201d45f`.
The local receipt pins all four originals and restored bodies. No published history
was removed; provisional 33/34 were never committed, tagged or released.

## Retained experiment description (superseded)

Candidate base: P00 `34e3f742`. The only effects-input change is the Classic
projection guard: accept explicit core.v6 alongside core.v5 using the shared
version selector. The 72×36, bounded/getter-free projection checks, rendering
functions, artwork, contact markers, timing and feedback functions are unchanged.

Ordered inputs `game/ui/classic-view.mjs; game/ui/event-feedback.mjs` fingerprint:
`0dbfd48ba5ecb3c86986ac17649a5065ba14bb4c9f501f1e30d4a718ff6d90e1`.
Classic view: 21640 bytes, SHA256
`c485e96c81c70c6e65cf3f7d9a6cb18189be1adb6905ecd9af4f3bc9ba0175c7`.
Event feedback unchanged: 5824 bytes, SHA256
`c558dbe6fbdc91e6e9aae51cf355e557cdebf6f9319cb5ab6d886c75b5760307`.

The new selector is true only for core.v5/core.v6; historical core.v2–v4 continue
to receive no Classic projection. Malformed input remains rejected. This review
does not broaden the set of actual effects or modify simulation state.

The unchanged producer first retained source-stage `field-kit@33`/`fpv@33`.
All 4,007,816 bytes of original asset payload remain unchanged. The subsequent
scoped declaration retains that source stage and creates reviewed successor 34,
without rewriting any earlier approval. Advancing the current theme does not
authorize changing frozen historical-import picture policy v1 or old editions.

42 tests passed across classic-presentation, presentation-renderer,
renderer-readability and foundation-transport, without skips. They cover malformed
projections, actual drawing paths, existing role/terrain/bonus cues, reduced motion,
freeze clocks, authority preservation and the new foundation runtime projection.
The separate 105-test framework cohort and native Studio → actual-engine island
closure are recorded in `xposed-journey-p01.md`.

This is a functional selector review, not new artwork, whole-theme visual approval,
all-mode usability, physical-device testing, enjoyment, release or public acceptance.
Final integrated exact-source qualification and new campaign assets remain pending.
