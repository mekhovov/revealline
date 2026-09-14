# Phase 7 integration and frozen-source identity

The separately qualified v0.51.0 source is `5d4bd98718955fa471fe71d798715864af166d18`, tree `37331db1a89526aedffd25ae979b7378a1a707fc`. Its six release gates passed with 3,691 tests across four complete, disjoint test-file partitions, reproducible production and the committed reviewed-slot declaration gate. Hosted qualification is distinct from immutable packaging, public-byte verification and browser qualification.

This ordered integration retains that source as an ancestor and incorporates the earlier reviewed phase integrations and their historical correction evidence. All game and Studio runtime, production ledger, compiled assets, originals, theme bindings and version fields remain exactly those of the qualified v0.51 source. The earlier optional R5/Couch recovery is already included. The final Studio owner/geometry behavior and mandatory reviewed-slot gate take precedence over the historical compatibility branches.

The only added test exercises the actual board-preview entrypoint with an incomplete explicit owner. It requires rejection before any fetch or canvas creation, complementing the existing fixture-loader checks. The older `sourcePicture` alias remains supported by the qualified runtime. Historical source-qualification documents describe their original observation point; they do not change the final release authority or claim public delivery.

Full checks on the final integration commit remain required before main merge. Public deployment uses separately selected immutable release files; this integration must not regenerate or replace their source, tags or bytes. Physical-device checks remain distinct from the recorded browser and modeled-input evidence.

All five focused Studio offline/owner checks passed locally, including the retained entrypoint regression; no cases were skipped. Scoped lint, formatting and diff checks passed. Independent Git-object comparison confirmed that the final runtime subsumes the earlier compatibility changes. These checks qualify the bounded merge resolution and do not substitute for full PR gates or public browser execution.
