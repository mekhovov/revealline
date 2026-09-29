# Company directory and isolation — 2026-09-29

## Finding and resolution

The reported GitHub Pages URL served a creator-marketplace client configured with
`data-community-api="/"`. That client requests `/v1/catalog` and `/api/auth/get-session`.
Pages supplies HTML errors at those endpoints, which the JSON readers correctly reject as
unreadable data. The screenshot therefore showed a missing backend, not a missing HTML page.

The company index is now static at `game/community/index.html`, with explicit DroneAid and
Coupa entry links and English/Ukrainian copy. It loads only packaged localization scripts;
there is no account, catalog, upload or creator-storage initialization. Relative links keep
the selected frozen/local distribution. The original service UI is preserved byte-for-byte
as `game/community/store.html` (SHA-256
`81cd62ef62a5829b5fb6c9b9b9e110c6b97cff6c742bce1303829954003654ae`).

The repository README and public website point to the directory. The ordinary game has no
company/community discovery entry. Company campaign choices are filtered by the current
brand, and both requested and final departures reject a foreign brand. Artwork lookup is
limited to the selected edition's declared asset closure. Existing storage identities,
retained-artwork receipts, direct public company URLs and same-company campaign switching
remain intact.

The [routing contract](../company-communities.md) distinguishes public company isolation
from private hosting and the separately operated creator marketplace.

## Automated verification

| Cohort | Result | Evidence |
| --- | --- | --- |
| Static directory, localization page routing, Pages aliases | 20 passed | `game/test/community-directory.test.mjs`, `scripts/test-localization-pages.mjs`, `scripts/test-pages-current-entry.mjs` |
| Provider, edition identity, departure boundary, native menu inventory | 32 passed | `.cache/company-isolation-contracts-final.tap` |
| Forged departures, save/replace/cancel flows, selected artwork | 18 passed | `.cache/company-isolation-focused.tap` |
| Every declared edition, retained progress, locale, logo and creator-source exclusion | 25 passed | `.cache/company-isolation-host-regression.tap` |
| Preserved creator-store and account/upload clients | 17 passed | `.cache/company-directory-store-regression.tap` |
| Localization catalogs | Passed | `node scripts/localization.mjs check`: 10,968 messages, 8,607 references |

Cohorts overlap; these counts are not a combined unique-test total. Scoped ESLint, Prettier
and `git diff --check` passed. No full production build or release deployment was run.

Commands for reproduction:

```sh
node --test game/test/community-directory.test.mjs scripts/test-localization-pages.mjs scripts/test-pages-current-entry.mjs
node --test game/test/runtime-content-provider.test.mjs game/test/edition-context.test.mjs game/test/edition-public-identity.test.mjs game/test/edition-departure-destination.test.mjs game/test/native-menu-inventory.test.mjs
node --test --test-name-pattern='edition switch|forged cross-company|ordinary main game|artwork URLs|authenticated|declared edition in another company|actual host boundary|retained presentation can|foreign, credentialed|ambiguous mixed' game/test/edition-solo-host.test.mjs game/test/runtime-content-provider.test.mjs game/test/edition-departure-destination.test.mjs
node --test --test-name-pattern='every declared edition|same-origin installed creator|official DroneAid wordmark|edition chrome and retained-artwork|edition Continue preserves' game/test/edition-solo-host.test.mjs
node --test game/test/community-store.test.mjs game/test/community-account-upload.test.mjs
node scripts/localization.mjs check
```

A broader exploratory tools cohort passed 38/41. Its three failures concern pre-existing
Workshop behavior: a whitespace-sensitive video-poster hint assertion and replay/controller
return focus after their openers moved into Settings. Those files/flows were not changed for
this directory fix; the failures remain recorded in `.cache/company-isolation-provider-tools.tap`.

## Browser verification

Using the local server at `http://127.0.0.1:8779`:

- The directory renders both languages without catalog/account errors or login forms.
- At 390 × 844, the cards use one 351px column and document width remains 390px, with no
  horizontal overflow. At desktop width, the cards sit side by side.
- The DroneAid link reaches `game/index.html?edition=droneaid`, title `DroneAid / LINE`.
  Its content settings list seven DroneAid editions and no Coupa entries.
- The Coupa link reaches `game/index.html?edition=coupa-all`, title `Coupa Village / LINE`.
  Its content settings list six Coupa editions and no DroneAid entries.
- Restored Ukrainian locale and the normal viewport after inspection. No flight was started.

Evidence: [directory screenshot](company-community-directory-2026-09-29/directory-desktop-uk.png),
[DroneAid options](company-community-directory-2026-09-29/droneaid-campaigns.txt),
[Coupa options](company-community-directory-2026-09-29/coupa-campaigns.txt).

## Publication boundary

This is a source fix. The historical `v0.142.2` URL and currently promoted public directory
have not been modified. Publish a new reviewed release and promote its current-entry aliases
to put the static directory at the stable `/game/community/` URL. Preserve the old immutable
snapshot. The directory uses existing company-entry URLs, so it does not depend on the
currently empty standalone edition-promotion index.

Disk pressure briefly prevented writes. Only unused generated menu-edition copies under
`/private/tmp/revealline-menu-editions-20260929-{v2,v3,final}` were reclaimed; retained
verification metadata, active previews, repository files and worktrees were preserved.
