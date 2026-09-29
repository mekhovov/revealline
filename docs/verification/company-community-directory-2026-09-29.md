# Company directory and isolation — scoped main port, 2026-09-29

## Source and scope

Base: `afb19ebd06db336d32dfe4660c43aa0f6711dca5` (accepted main, including the
v0.142.3 Confirm trace-order correction). This report covers the independent community
port. Earlier shared-workspace tests and screenshots are not qualification for this source.

The shared workspace was concurrently preserved by another owner in
`5b0f830b3d8f5481cf85567c297861bc914bacc6`. This candidate ports only community-directory
and company-isolation hunks onto accepted main. Demo, analog, native menus, branding,
mission-selector changes and later public-alias work are excluded. The ordinary host's
existing Home campaign-picker placement and Confirm coordinator remain unchanged.

The directory uses canonical `droneaid-nl-community` and `coupa-all`, both supported by main.
It does not need pending branding assets. The original marketplace is preserved as
`game/community/store.html`, copied from main's original index (7,679 bytes, SHA-256
`9a412be6fe7d3fa8dbd0943e0aa75e412d5e60d10b2048512920b17fc0ab1b03`).

## Behavior

GitHub Pages serves static files, not `/v1/catalog` or `/api/auth/get-session`. The old index
loaded those creator-marketplace clients and rejected HTML error responses as unreadable
JSON. The new index is static company discovery with local English/Ukrainian localization.
It has no account form, backend request, upload client or creator-store initialization.
The service-enabled marketplace remains a separate `store.html` entry.

The repository guide and public website link to the directory. The ordinary game has no
company/community discovery entry. Company campaign choices stay within the selected
brand. Both requested and final departures reject another brand before saving or navigating.
Asset lookup is limited to the selected edition's declared asset closure. Progress,
saved-flight keys, retained-picture receipts and same-company campaign navigation remain
under their existing identities. This is public-edition isolation, not private access control.

## Exact-source verification

Because disk reserve could not fit another full checkout, the candidate was assembled with
a separate Git staging index. Tests used an export of the fixed main source with only the
prepared candidate files overlaid. Large unchanged files were copy-on-write clones after
matching their Git blob IDs; other bytes came from fixed-main Git objects. The export uses
the existing pinned node_modules, without installing dependencies or changing the shared
checkout, its index or branch. Main's locale catalogs received only 14 new keys per language;
the runtime bundle was regenerated from those complete main catalogs.

| Cohort | Result | Raw evidence |
| --- | --- | --- |
| Directory, localization pages, current-entry aliases | 20 passed | [directory](company-community-directory-scoped-2026-09-29/directory-complete.tap) |
| Provider, edition identity and departure contract | 27 passed | [contracts](company-community-directory-scoped-2026-09-29/contracts.tap) |
| Same-company switching, forged selection, ordinary-menu isolation | 7 passed | [focused host](company-community-directory-scoped-2026-09-29/focused.tap) |
| Every declared edition, retained progress, locale and installed-creator exclusion | 22 passed | [edition hosts](company-community-directory-scoped-2026-09-29/host.tap) |

Cohorts overlap and are not a unique-test total. Initial export runs lacked authoring
HTML/animation/preset fixtures; these were restored from the same fixed main and affected
cohorts passed on rerun. No implementation repair was needed. Initial missing-fixture TAP
logs remain in the local `.cache/community-directory-pr-20260929/evidence/` preparation.

Reproduction from the candidate source:

```sh
node --test game/test/community-directory.test.mjs scripts/test-localization-pages.mjs scripts/test-pages-current-entry.mjs
node --test game/test/runtime-content-provider.test.mjs game/test/edition-context.test.mjs game/test/edition-departure-destination.test.mjs
node --test --test-name-pattern='edition switch|forged cross-company|ordinary main game' game/test/edition-solo-host.test.mjs
node --test --test-name-pattern='every declared edition|same-origin installed creator|edition chrome and retained-artwork|edition Continue preserves' game/test/edition-solo-host.test.mjs
```

Independent scoped review found and resolved creator/moderation return links after the
index/store split. Both tools now return to `store.html`, with a route regression. No
remaining actionable findings were reported. Scoped syntax, ESLint and Prettier passed. Catalog message validation passed. Full production
build, hosted release qualification and publication are not claimed. Main's package version
and immutable-release selectors are unchanged; the PR remains draft/hold pending scheduling.

## Browser checks

The candidate export was served at `http://127.0.0.1:8817/`. The static directory opens
without account/catalog errors. The canonical DroneAid link reaches `DroneAid Netherlands`
and lists only its seven editions. Coupa reaches `Coupa Village` and lists only its six
editions. Neither includes the other company. No flight was started or reward earned.
Browser evidence is in [the scoped evidence folder](company-community-directory-scoped-2026-09-29/).

## Publication

This PR does not edit the frozen v0.142.2 snapshot or deploy a new release. After a new reviewed
release is promoted, the stable `/game/community/` alias will expose the static index. The
historical URL continues to represent its archived version. Release scheduling belongs to
**🔥 Releases**; do not allocate or publish a second competing release from this feature lane.
