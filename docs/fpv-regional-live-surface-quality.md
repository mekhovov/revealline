# Regional surface quality follows flight settings

This follow-up to the pinned Railway Library preview makes the existing Canyon,
Urban and Railway ground material variants follow the active renderer's quality
setting. No restart is needed for already loaded surfaces. Plain terrain remains
plain. Geometry, collision, source identity, uniforms, texture allocations and
resource ownership are unchanged.

The renderer updates each distinct live surface material once. A repeated selection
does not invalidate its shader. A changed tier updates the existing program key and
marks that same material for recompilation; it does not replace or dispose the
material. The three existing variants bound the possible shader choices.

Detached incoming geometry receives the current tier before shader preparation.
The renderer's existing presentation-generation check rejects a candidate if the
player changes quality during preparation. The previously committed world remains
owned and visible, with its new selected quality. A retry prepares the candidate
against the new settings before adoption. No frame, origin, simulation or arming
authority was changed.

## Functional evidence

`verify-live-surface-quality.mjs` passes fifteen transitions across all three
profiles, comparing complete shader text and program keys with freshly created
materials of the target tier. It also checks shared/array materials, unchanged
geometry and uniform identities, invalid values, repeated selections, explicit
disposal and the untouched plain fallback. No texture is added.

`verify-library-appearance.mjs` still passes the exact Railway source pair across
all three initial tiers and unknown-pin fallback with identical geometry digest.
`verify-railway-ground.mjs` passes eight cases and 192 collision queries with
456,408 terrain geometry bytes and source/collision unchanged.

## Native verification fixture

`renderer-preparation.html` now allows a surface and quality choice. Its dedicated
“Stage + change quality” action starts the actual renderer preparation, then changes
quality before its awaited completion. This exercises the real cancellation and
retained-owner path. The receipt includes active material names and reserved/live
resource counts. A subsequent ordinary stage must succeed at the new quality;
release must leave no owned geometry.

The exact-source native renderer fixture passed on `1e85a8c48`: initial preparation
owned 46 objects / six batches / 845,688 geometry bytes; the observed compile was
404 ms and total preparation 451 ms in that browser. Changing quality during
staging cancelled sequence 2 before uploads while retaining the visible owner.
Retry completed with the same geometry; 40 visible frames were observed during
that 494.5 ms operation. Quality material names updated, and Release reported
zero owned and reserved geometry. These are fixture observations, not device FPS.

CI exposed an Academy dependency leak from importing a regional factory into the
shared renderer. The follow-up keeps the callback dispatcher in the existing
shared renderer instead, without adding a module or raising a package budget.
The exact remote repair `71ef72fa97` passes optional-practice verification.

The initial Library Fly cancellation observed during the original fixture review
was repaired separately in #1306/#1314. Main `63f74dd38a4b51cb0df8fa5ddb0fd5cb5e11317d`
now includes that disarmed-preparation guard and Railway Library integration.
It was merged into this change at `02273ea7039a22396700d607867e3460831b240c`.
On that combined tree, all 15 material transitions / three profiles, all five
production preparation-clock tests, and the exact Railway Library preparation
at Low/Balanced/High plus unknown-pin fallback pass. Every Library case retains
geometry digest `3f9571a30dab78cd4a8ab9d016aea7f589e6835a8fa61dfa3d433e9ad6954e4b`,
845,688 geometry bytes and 2,446,676 texture bytes. These are current combined-source
checks, not a claim that refreshed CI or final package qualification has passed.
The former 9026 server had a stale shared-game fallback and is not evidence for
this production-renderer change. The coherent 9027 snapshot is the fixture source.
Packaged/offline and device qualification remain separate.
