# Live restoration of exact saved visuals

Solo can prepare a v5 saved flight's full presentation independently of the page presentation. It verifies the authored campaign context before difficulty transforms, the shipped catalogue declaration and exact manifest hash, then loads the retained images/fonts and selected audio bytes. The existing flight-picture owner separately verifies its retained original. Only after both preparations succeed does the host adopt the restored run and visual resources.

## Released coverage

`game/presentation/visual-themes.json` declares FPV Field Kit revision 54 for the twelve First Signal missions. Its manifest SHA is `91a3d66966e1b1a3c2e9b5c68aebcc4be284edff4e7b9b272731a769a4f66ace`, identical in the already published v0.80.0 source and the integration baseline. Required Solo slots have reviewed production records. This declaration does not approve further editions or infer coverage from level names. Original picture pins remain independently authoritative.

Catalogue records are immutable. Later releases must retain their exact manifests and asset bytes through the retained-output writer; the catalogue test rejects an orphaned revision. Extend coverage only after its actual assets/content are reviewed. Do not replace an old catalogue entry with a newer hash.

The page's known manifest hash selects the current or hash-named retained location. If page preparation has not completed, restore verifies current bytes itself; only a manifest-hash mismatch tries the retained location. Both paths require the exact same saved hash. A slow page load cannot hold restore hostage or overwrite a subsequently adopted retained presentation.

## Ownership and recovery

- Continue and ordinary Load keep their existing start/explicit-Resume behavior.
- Retry retains the accepted visual lease and picture choices, including saving the v5 reference again. A confirmed Restart also preserves its visual/picture choices.
- An explicit fresh mission retires the retained lease and uses the current release presentation.
- A retained flight's world selector cannot silently change its content theme. It directs the player to select a fresh mission.
- Failed/cancelled theme preparation leaves the old run, picture and saved bytes unchanged. A picture failure disposes the newly prepared visual lease.
- Page exit saves the v5 reference before releasing its decoded resources. Cached-page suspension retains the owner.
- The published-audio adapter follows the accepted presentation, ignores late page readiness and invalidates old readers; it preserves mute, explicit playlist choice and user-activation authority. Audio decoding/playback still belongs to the existing transport.

The document root exposes the effective presentation revision and manifest hash for verification. This is diagnostic metadata, not a player control.

## Qualification scope

Whole-host tests use real Solo/core, catalogue, compiler, retained-output writer, manifest/asset readers, lease, storage envelope and picture owner. Browser decoding, DOM, input and storage are modeled. They cover restored checkpoint identity, older/current manifest separation, save/Retry, fresh mission retirement, cancelled and corrupt downloads, missing original pictures, pagehide order and a held late page load. Separate tests check catalogue scope, bounded streams, cancellation and audio source replacement.

This does not enable a global fixed-theme selector or make ordinary fresh flights produce v5. Those require staged fresh-attempt ownership and the two-collection benchmark. Couch restoration, complete offline presentation recovery, native/physical checks and exact-source public release gates remain outstanding.
