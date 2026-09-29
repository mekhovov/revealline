# Company communities

The [public directory](https://mekhovov.github.io/revealline/game/communities/) is a discovery
page outside the game. Its source is [`game/communities/index.html`](../game/communities/index.html).
The repository guide and public website link to it. The ordinary game and company game menus
do not expose cross-company discovery or a company switcher.

## Entry points

| Community                                     | Shareable path (relative to the distribution) | Stored edition identity | Brand boundary |
| --------------------------------------------- | --------------------------------------------- | ----------------------- | -------------- |
| FPV / LINE — main game                        | `game/`                                       | Default game profile    | Default game   |
| DroneAid Netherlands                          | `game/communities/droneaid/`                  | `droneaid-nl-community` | `droneaid-nl`  |
| Coupa                                         | `game/communities/coupa/`                     | `coupa-all`             | `coupa`        |
| DroneAid Community Relay — Portugal / Germany | `game/communities/droneaid-community/`        | `droneaid-community`    | `droneaid`     |

The directory groups the three public brand records into two communities, DroneAid and
Coupa, alongside the main game. The single DroneAid card contains both entry points above:
six Netherlands campaigns (36 missions) and Community Relay (3 missions). Coupa contains
five campaigns (30 missions). The 14 public edition selectors cover these 12 distinct
campaigns; aggregate selectors do not represent additional communities. No other public
company community is currently bundled. Main-game worlds and creator examples are content,
not separate community entries; live creator-service publications are a separate inventory.

This grouping is for directory discovery. Both DroneAid collections retain their own
gameplay selectors, saved identities, progress and artwork receipts. All existing links stay
valid, with no migration or cross-brand switcher added inside the game.

Friendly entry pages keep the clean URL visible. They load the same packaged `game/index.html`
host, rebasing its resources to that host without an iframe or a `<base>` exception to CSP.
There is no copied game UI to drift out of date. The route selects the aggregate edition;
a same-company `edition` query can select a narrower edition, while foreign overrides fail
before startup. `campaign`, retained `presentation`, language and other supported query/hash
values survive loading. Provider navigation keeps friendly addresses for these brands.

Relative links work on localhost, beneath a GitHub project prefix and in frozen releases.
Use a trailing slash in shared links; HTTP serves the slashless spelling as a directory too.
The old `/game/community/` index forwards to `/game/communities/`. Old `company.html?edition=…`
and `index.html?edition=…` bookmarks continue working. Public slugs never rename stored keys,
content pins or installed app identities. Compiled standalone editions keep their existing
entry and selected-content boundary.

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

`game/communities/index.html` is static HTML plus packaged localization. It has no catalog
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
2. Add its route and allowed editions to `game/community-routes.mjs`, a small entry page
   under `game/communities/<slug>/`, and a relative link in the directory with English and
   Ukrainian labels. The route inventory test must match every public catalog brand/edition.
3. Add its direct URL to the repository guide and table above. Do not add discovery links
   to `game/index.html` or the game's menus.
4. Check directory routing, same-company navigation, cross-company rejection, asset
   closure and retained progress before publishing a new immutable release.

## Publication status

The reported `releases/v0.142.2/site/game/community/index.html` belongs to an immutable
snapshot. On 2026-09-29 it still served the old marketplace and attempted unavailable API
requests. This fix updates source; it does not edit that frozen snapshot or promote a
release. After the next reviewed release is promoted, the stable `/game/communities/` alias
will lead to its static directory; `/game/community/` remains a compatibility entry. Bookmarks into `v0.142.2` retain that archived version.

The current-entry generator discovers the directory, nested company entry pages, old
compatibility entry and `store.html`. The full static/native build includes `game/`. Offline
Solo preparation includes the directory and entry resources; company artwork remains in
its existing optional package. No standalone `/editions/` publication is required.

See the [verification report](verification/company-community-directory-2026-09-29.md).
