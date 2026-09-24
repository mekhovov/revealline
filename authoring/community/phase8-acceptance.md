# Phase 8 acceptance record

Status: **bounded first slice implemented; production physical conversion remains open**.

## Automated evidence

The final scoped run passed 83/83 tests across the new editor boundary, poster capture/workshop,
mixed-media intake/review and release-build graph.

- Playback ranges validate positive in-bounds timing and retain the complete original.
- Directional decoded-frame stepping requires browser presented-frame evidence and rejects an estimate-only
  capture before allocating another result.
- The optional physical trim adapter loads lazily and reports a precise unsupported result when it
  is absent.
- Modeled transformed output is withheld unless its bytes differ and a fresh decoder confirms its
  hash, byte count, duration, MIME, width and height.
- Modeled unchanged bytes, duration drift and changed orientation are rejected.
- Workshop tests cover frame-step enablement, estimate-only disablement, playback/trim wording,
  unsupported conversion, verified output URL lifetime and explicit audio provenance.

## Browser inspection

On 2026-09-25 the built-in browser loaded the local Video poster workshop from the production
server path. It exposed separate Local source, Playback range and Optional physical trim sections;
all media-dependent controls began disabled, the physical-trim copy stated that no converter is
bundled, and no module-startup error appeared. Real cross-browser media selection and transformed
playback remain release gates below.

## Open release gates

- Select and maintain a self-hosted browser conversion library or an explicit server converter.
- Qualify exact input codec, output codec and audio behavior in Chromium, Firefox and Safari.
- Verify physical trim start/end bytes with real decoded picture and audio timestamp fixtures.
- Verify orientation metadata, audio synchronization and target-browser playback on transformed
  files.
- Add resizing, compression and broader conversion only after their decoded output checks exist.

The phase must remain incomplete until a real adapter passes these gates. Playback range and poster
capture do not count as physical trimming.
