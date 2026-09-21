# Asset handoff

Record: asset ID, family, semantic role, medium, prompt ID, substitutions, full prompt, generation/edit tool route, references and source, output paths, original dimensions, intended export dimensions, alpha, filter, focal point, crop policy, variants, review notes, status.

For animations also record: frame grid, count, padding, pivot, order/tags, milliseconds per frame, looping, played/rendered inspection evidence.

For reveal art inspect three states: small initial window, partial reveal with trail overlay, complete gallery view. A generated collage cannot establish exact masking behavior; test those states in the runtime when available.

For edits record requested changes and preserved properties. Never substitute the reference image's claimed provenance for verified provenance of the generated result.

## Studio revision and navigation checks

Use the [Asset Studio contract](../../../../docs/asset-studio.md) when preparing a
replacement. Keep authored bytes, immutable binding history and the inventory view
separate: returning to a selected asset must not create a revision or change a
player save. Theme selection is a workspace change, not an inventory-only filter.

Copyable maintenance prompt:

> Stage one reversible change and activate the last Undo using the keyboard. Check
> that enabled Redo receives focus; redo it and verify the enabled Undo successor.
> Reset, stage a prepared replacement, discard a prepared file, and bind an older
> compatible revision. When an initiating control is disabled or rebuilt, verify
> focus moves to the current visible asset or inventory Search. Move focus elsewhere
> during a pending operation and confirm its eventual completion does not take it
> back. Compare original bytes and retained history before and after these actions.
> Search and select a specific slot, return to the game, then use browser Back.
> Verify the same selected slot and filters on a cold return; a retained page must
> keep its existing drafts and pixel edits. A valid selection outside its filter
> still belongs to the author. Invalid or removed references need a safe fallback,
> never a fabricated asset. Keep unrelated browser-history state, workspace saves,
> presentation pins and gameplay progress unchanged. Record native keyboard and
> responsive checks separately from modeled lifecycle tests and public acceptance.

An authoring check does not establish production readiness, cross-mode playability
or publication. Keep each asset's exact source, derivative, revision and evidence
requirements in its own handoff.
