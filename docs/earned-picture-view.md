# First-earned picture view resolver

`ui/earned-picture.mjs` is an additive view adapter for Collection integration. It does not open a database, install content, award progress or modify a profile. `resolveEarnedPicture({item,receipt,metadata,entries})` validates an explicit receipt against the exact execution-to-authored owner. A managed original uses its retained owner, historical presentation revision and first-earned seed. Later assignment and better-score gallery metadata cannot replace that choice.

An installed exact campaign allows normal replay and celebration. With a removed pack, a verified managed original still has its retained map geometry and can be displayed; replay and theme celebration are unavailable until the actual pack is reinstalled. Retained owner data is validation context, not an installed campaign. Missing or changed original/history fails explicitly at acquisition and never selects today's assignment.

No-receipt rows preserve existing authored-pack behavior. Explicit legacy receipts validate their installed owner and retain their first seed; their original embedded pack art is unavailable if that pack is removed. A legacy receipt is not a copy of the original file.

`acquireEarnedPicture` adds verified byte/decode acquisition and returns an owned backdrop/release handle. The caller owns cancellation and visible-canvas staging and must release on replacement/close. Ordinary Collection is not wired to this adapter yet.

Four focused tests run real captures to produce receipts, then test removed-pack Gentle acquisition, changed assignment/better seed, foreign ownership and legacy behavior. The image decoder and IndexedDB boundary are modeled. An initial raw-versus-normalized geometry comparison incorrectly rejected an installed Standard map; the corrected adapter compares effective normalized levels. Independent review also found the explicit legacy branch needed owner validation and first-seed preservation; both have regressions. Browser raster and the complete Collection journey remain integration checks.
