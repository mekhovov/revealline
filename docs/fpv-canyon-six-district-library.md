# Six-district Canyon Library choice

Offer the accepted **768 × 768 m** region as a separate Library choice, pinned to
immutable source commit `dbfa4cef92866938ce05815ee9beb4830d935647` from #1331.
It contains six authored districts and six starting points. The existing 384 m
Canyon row, Railway row and Urban row are preserved verbatim, as are saved worlds.
Both Canyon revisions retain their independently approved Canyon appearance.

The new `districts-r1` descriptor is 24,279 bytes, SHA-256
`f69cc4d315c254d5b825e2cfbde21d8509da1c8e3ae2a3e743de95782c5300c8`.
The complete optional download is 3,404,577 bytes. All 147 immutable GitHub responses
passed the production downloader before this row was added. No runtime module,
source geometry, collision threshold, storage schema or resource budget changes.

## Verification

`verify-library-appearance.mjs <six-district-pair> canyon-districts` uses the actual
production session. Performance, Balanced and Quality prepare disarmed at zero
ticks/contacts, with the correct Canyon material; an unknown pin falls back to
plain terrain. Every case retains the same position/normal/index digest and
288,216 initial resident geometry bytes, then releases all owned geometry/textures.
The initial resident area intentionally matches the preserved arrival source;
the complete source pair has separately verified all 36 cells and extended routes.

The unchanged original `canyon` variant also passes all four cases. Its exact pin
remains offered, so installing the larger revision does not make older saved
Canyon scenery lose its trusted material. Regional Library actions address the
exact descriptor hash, even when two revisions share a region ID.

Source #1326 independently verified 24 actual commanded routes, 123,566 ticks,
72 in-flight recentres, 12 authored starts, all 60 terrain seams and all 54 grounded
formations. Native source review accepted the five new district views and resource
release. These are bounded source/flight observations, not sustained device FPS.

## Remaining admission

Native normal-player download, both revisions installed together, safe first Fly,
starting-point selection, deliberate flight/pause and persistence are pending.
Start-point label localization is a separate host UI increment; source IDs remain
unchanged. Exact combined player-package/offline and physical-device qualification
remain separate. The region is a stylized practice preview, not final realism or
an 8 km world.
