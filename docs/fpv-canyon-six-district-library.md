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

## Native source review

On 15 October 2026, the actual browser at local port 9062 reviewed frozen source
`f3f404abd9d016ecd4beb6c0db5005493a9a0eb6`. Downloading `districts-r1` and the
preserved `rounded-r1` left both Library rows saved. The first new-region Fly
reached Ready at 9 m with zero controls and no retry. The menu offered all six
authored starts. Selecting Shelf and restarting reached Ready at 114.5 m with
zero controls; explicit Arm, keyboard flight and Pause produced a paused flight
at 113.9 m, +3.2 m/s vertical speed, 0.7 m/s drift and 64% throttle.

Reload retained both saved revisions. New-region Fly again reached Ready at 9 m
with zero controls and no retry. No browser errors or warnings were observed.
The native screenshot is retained externally as
`fpv-temp/canyon-districts-library-shelf-flight-20261015.png`.

The published branch rebased onto preserved parent #1320 at
`a8ba0ad4e981d7a8617301862121ca64463e03fa`; Library and host UI were unchanged
by that parent update. Both new and original production-session appearance
suites were rerun and passed on rebased source `232b9b0107459ac996396fbb54ff29476edce30f`.
The native receipt remains attributed to its exact earlier source composition.

## Remaining qualification

Start-point label localization is a separate host UI increment; source IDs remain
unchanged. Exact combined player-package/offline and physical-device qualification
remain separate. The region is a stylized practice preview, not final realism or
an 8 km world.
