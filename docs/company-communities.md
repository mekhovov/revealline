# Company communities

The [public directory](https://mekhovov.github.io/revealline/game/community/) is a discovery
page outside the game. Its source is [`game/community/index.html`](../game/community/index.html).
The repository guide and public website link to it. The ordinary game and company game menus
do not expose cross-company discovery or a company switcher.

## Entry points

| Community | Stable public entry | Stored edition identity | Brand boundary |
| --- | --- | --- | --- |
| DroneAid Netherlands | [Play DroneAid](https://mekhovov.github.io/revealline/game/company.html?edition=droneaid) | `droneaid-nl-community` | `droneaid-nl` |
| Coupa | [Play Coupa](https://mekhovov.github.io/revealline/game/company.html?edition=coupa-all) | `coupa-all` | `coupa` |

The directory uses `../company.html?edition=…`, not origin-root paths or standalone
`/editions/` links. These links stay inside the same deployment when served locally, under
the GitHub project prefix, or within a frozen release. The company entry forwards to the
ordinary game host with the exact company selected. `droneaid` is a public alias; it does
not rename saved progress or immutable content identities.

## Isolation contract

- A company's campaign selector contains only editions with its current `brandId`.
- Both the UI request and final departure validation reject an edition belonging to
  another brand. Rejection happens before a departure can mutate a saved flight or navigate.
- The runtime provider resolves asset IDs only within the selected edition's declared
  asset closure, including any explicitly shared assets. A foreign catalog asset does
  not become loadable merely because its metadata appears in the shared catalog.
- Company libraries continue to exclude ordinary installed creator campaigns and imported
  packs. Compiled company builds continue to reject query overrides to another edition.
- Saved attempts, progression, collection receipts and persistence ownership retain their
  existing edition identities. Same-company campaign navigation remains available, with
  the existing save/replace and writer-ownership safeguards.
- Global preferences such as language, audio and controls remain shared preferences.

This is a navigation, content and saved-progress boundary for public editions. It is not
authentication: someone with another public company URL can open it directly. A private
company deployment needs its own access control. The public creator service has creator
ownership and public collections; it does not implement company tenant access control.

## Directory versus creator marketplace

`game/community/index.html` is static HTML plus packaged localization. It has no catalog
fetch, account form, upload client or dependency on IndexedDB. Its company links work
without JavaScript. Both English and Ukrainian are provided.

`game/community/store.html` retains the creator marketplace and its existing `page.mjs`
controller. That page needs the [community Node service](../services/community/README.md)
and its account routes behind a same-origin HTTPS proxy. GitHub Pages returns HTML errors
for `/v1/catalog` and `/api/auth/get-session`; it cannot supply this backend. Pointing the
account client at an arbitrary remote URL is not a supported substitute for same-origin
cookie authentication. The marketplace and moderator console remain separate service
tools; the static company directory does not link players into them.

## Adding a community

1. Add and validate its brand and public aggregate edition through the existing company
   content pipeline. Set a distinct `brandId`; do not reuse another company's brand to
   gain campaign visibility.
2. Add one explicit entry to the static directory, with its public edition slug and both
   English/Ukrainian labels. Keep the link relative to `../company.html`.
3. Add its direct URL to the repository guide and table above. Do not add discovery links
   to `game/index.html` or the game's menus.
4. Check directory routing, same-company navigation, cross-company rejection, asset
   closure and retained progress before publishing a new immutable release.

## Publication status

The reported `releases/v0.142.2/site/game/community/index.html` belongs to an immutable
snapshot. On 2026-09-29 it still served the old marketplace and attempted unavailable API
requests. This fix updates source; it does not edit that frozen snapshot or promote a
release. After the next reviewed release is promoted, the stable `/game/community/` alias
will lead to its static directory. Bookmarks into `v0.142.2` retain that archived version.

The current-entry generator discovers both `index.html` and `store.html`. The full static
build includes `game/`, so the directory, stylesheet and local translations travel together.
Standalone company builds retain their selected-content packaging boundary; the directory
does not introduce new edition routes or a dependency on standalone `/editions/` publishing.

See the [verification report](verification/company-community-directory-2026-09-29.md).
