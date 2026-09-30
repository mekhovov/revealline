# External soundtrack follow-up — 2026-09-29

The current Raspberry Jam endpoint passes the production direct-response guard. The historical browser error could not be reproduced by a metadata-only recording request. The original failing request and status were not captured, so its root cause remains unconfirmed.

## Observed evidence

- Raspberry Jam (`builtin.catalog.congusbongus.raspberry-jam`, congusbongus) belongs to `licensed-preview-01`. Its [declared MP3](https://mekhovov.github.io/revealline-soundtracks/objects/7b1a78a001d69aa47d75b2f55d647836ea445355065a3df3b0cebd2e978863fa.mp3) is pinned to **5,586,442 bytes**, SHA-256 `7b1a78a001d69aa47d75b2f55d647836ea445355065a3df3b0cebd2e978863fa`.
- The recording HEAD observation at **03:04:17 UTC** returned HTTP/2 **200**, `audio/mp3`, the expected content length, CORS `*`, byte ranges, and `Last-Modified: Tue, 29 Sep 2026 02:55:09 GMT`.
- A Node GET using `redirect: error`, `credentials: omit`, `mode: cors`, and `cache: no-store` returned **200**, `redirected: false`, and exactly the declared URL. Content length matched; CORS was `*`; Last-Modified was **02:55:08 UTC**. Its body was immediately cancelled without reading, saving, hashing, or decoding MP3 content. Transport buffering before cancellation was not measured.
- The [inventory](https://mekhovov.github.io/revealline-soundtracks/inventory.json) returned **200**, 15,081 bytes, CORS `*`, and Last-Modified **02:55:08 UTC**. This small JSON body **was downloaded**: SHA-256 `2706445dafe995f6c4dc044ad5e92031cae60627699f6a72985e67a972064ccd` exactly matches the shipped pin, and its Raspberry Jam path, bytes, and hash match the catalogue.

Full captured values, request descriptions, and source locations are in [external-audio-followup.json](external-audio-followup.json). Requests were not repeated to write these files.

## Failure path and timing

Demo displays the ordinary soundtrack player's notice (`game/ui/demo-audio.mjs:150`). The request flows through `soundtrack-source.mjs:80`, `soundtrack-archive.mjs:89`, and `soundtrack-album-download.mjs:90`. The last module's guard at lines 126–128 requires HTTP 200, no redirect, and exact declared response URL. Both the inventory and recording use it. The generic message **“Album download needs direct HTTP 200 at its declared URL.”** therefore does not identify the failed request or imply an `.rlsound` album failure. `soundtrack-error-copy.mjs:17` supplies the album-oriented localized wording.

The [preliminary browser observation](browser-observation-audio-preliminary.json) contains 15 error samples, approximately **02:26:37–02:27:48 UTC**. This overlaps the successful [publication run 36512479050](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36512479050), created **02:24:54 UTC** and updated **02:28:24 UTC**, head `535a6318cce53e9df0e7d28da5e50f608285d898`. A later successful [run 36514554418](https://github.com/mekhovov/revealline-soundtracks/actions/runs/36514554418), **02:51:44–02:55:12 UTC**, head `8b2e4aeb929f8590dc77bc5e9db55b6eb8f78bc0`, aligns with the current resource modification times.

**Inference:** publication/CDN transience is plausible. **Proof is limited:** the historical response status and request URL are missing, and deployment overlap does not establish causation. The current probe does not certify full MP3 integrity, decoding, actual browser CORS enforcement, or successful playback.

## Narrow follow-up

Preserve all direct-200, exact-URL, redirect, size, inventory-pin, and hash checks. A separate browser retry can establish whether playback has recovered. Add diagnostic phase, requested/final URL, status, and redirect context to future failures; distinguish recording-unavailable copy from album errors.

Focused regression candidates are inventory 404 → explicit valid retry on the same resolver, recording 404 → retry without a cached partial blob, and continued rejection of redirects or identity mismatches. Explicit user retry already clears failed track IDs; failed inventory validation is not cached.

No runtime or test files changed during this investigation. No browser actions, large media download, or qualification test run was performed.
