# Explicit production slot additions

The production history writer normally requires identical slot contracts. A new
asset family must use the explicit `appendSlots` option with the complete,
code-owned specification list:

```js
retainProductionHistory(desired, prior, {
  appendSlots: [...teamAnchorSlotSpecs(), ...teamEffectSlotSpecs()],
});
```

The caller prepares `desired` first, including valid selected bindings for every
declared slot. The history writer permits only optional revision-1 contracts,
appended after the unchanged prior slot array. It rejects undeclared additions, duplicate or mismatched declarations, and
changed, removed or reordered historical contracts. The same exact declarations
remain valid on reproduction after those slots have already been appended.

New assets and theme bindings join the existing immutable ledger in one successor.
Unchanged reproduction returns the prior document without allocating a revision.
Old slots, asset/theme/collection records and exact selections remain available.
The final transition is validated against the original prior document, not just
an intermediate document containing the new slots. Input documents are not mutated.

This option does not approve artwork, change required coverage, relax file or
geometry checks, add runtime assets, or authorize a new theme to reuse a picture
binding. A production adopter must still qualify complete role families, exact
asset bytes, provenance, theme/picture compatibility, retained import receipts,
decoded runtime bindings and offline dependencies. Keep produced and reviewed
stages distinct. Do not replace pinned artwork or widen revision checks to “latest”.

The generic history helper does not infer family membership. The production
adopter must supply the complete code-owned family list and run its family and
readiness checks. For the first Team adoption, carry both relay anchor states and
all four feedback roles together. Retain the already produced source PNGs and their provenance;
do not invent a `.default` asset parent when the actual retained source is
`.procedural` or has no parent. Studio preparation, runtime publication and public
acceptance remain separate steps.

Suggested maintenance prompt:

> Add the complete specified optional asset family through explicit appendSlots.
> Preserve every historical record and exact selected artwork. Demonstrate strict
> rejection of incomplete or conflicting migration declarations, unchanged old
> selection resolution, one successor, idempotent reproduction and byte-identical
> bundle export/import. Then separately qualify production images, exact theme
> compatibility, runtime decoding and offline dependency coverage before release.

Run `node --test game/test/presentation-production-slots.test.mjs` alongside the
affected slot-family tests and production history/reproduction gates. A passing
schema or migration test does not certify native visual quality or a public release.
