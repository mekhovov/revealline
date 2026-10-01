# FPV creator: reviewed world reimport

The creator prepares a complete candidate before replacing a draft. Every
reimport opens an EN/UK review showing added, changed and removed source IDs,
conflicts, retained deletions and missing bindings. **Keep current draft** and
Escape cancel without replacing project data or model bytes. Apply accepts only
the validated candidate; a concurrent draft change rejects a stale import.

Source colliders and actors are reconciled by stable ID. Local objects and local
deletions survive, unchanged fields follow source updates, and competing edits
keep the local value with a diagnostic. Gate size, direction, orientation and
actor settings use the same conversion as first import. A changed source shape
with local edits is retained as a reported conflict rather than producing a
hybrid criterion. Removed source objects/objectives remain authored content for
review; they can be edited or removed explicitly in the creator.

`spawnBindings` records the selected source spawn ID per course. Older projects
derive this from their **previous** source before reimport, so node reordering
does not select another spawn. Existing objective bindings and route order are
retained. Added route markers are reported without silently changing the route.
Exporter node indices are excluded from semantic change comparison.

The existing `mergeReimport` API additionally returns `changes` (stable ID,
kind, added/changed/removed action). `previewReimport` uses the FPV adapter's
normal course/collider converters and validator to construct a candidate without
mutating its input. It does not install content or grant replay trust. Model and
compiled-project identities still derive from their actual bytes; an identical
reimport preserves the runtime course identity. No runtime files or package
allowances were added.

## Functional evidence — 1 October 2026

Node 20.19.5 executed a real glTF → importer → candidate reimport → compiled pack
and editable ZIP round trip. All thirteen scenarios passed: identical source
with a local obstacle; reordered source and legacy spawn selection; gate
dimensions/direction in both modes; actor position/settings and collider size;
local semantic conflicts; removed spawn/gate/actor/collider; local deletions;
new source colliders; explicit positional overrides; stable spawn movement;
compiled-pack reopen; editable ZIP reopen/reimport; invalid candidate immutability.
Prepared pack: 8,442 bytes. Editable ZIP: 8,502 bytes.

Verification inputs at this checkpoint:

| Input                                   | SHA-256                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| `world-content.mjs`                     | `a37ed0ad59dedfc99cd702c15af5c6cc535564a4ca022249d3093617db1333fb` |
| `world-app.mjs`                         | `af0d182266377bff89b6944715c03f3304c1c9375d02fb0b8c7cb743ac58e6f9` |
| `/tmp/fpv-reimport-main-functional.mjs` | `e5979caa47fc0e7762f6d3c8a6b37b848e0aa32fa13dba5d8d4364588b05d084` |
| `/tmp/fpv-reimport-local.zip`           | `1abcbdadaa4c3e391fc9552ed39a178b79552a49d3a75d4907e312d1c21c7ff4` |

The standalone branch is based on main
`4b2bdff335a61104bcdfcf2bde4c9a427e21e928`. Reimport was cherry-picked as
`7379f02d6`; separate commit `c3f5030b2` repairs the existing startup
`ReferenceError` by declaring `lastRadioDiscovery` in the timer state list.
All thirteen functional scenarios passed again on this main-based branch.
JavaScript syntax, scoped ESLint for both changed modules and `git diff --check`
passed. No new unit-test suite was added or claimed; additional coverage stays
in the final qualification phase.

Frozen World Studio qualification on
`c3f5030b201d6b610b12d32167164803cf281a84` / tree
`d86318ea66978dd757928da5c5757da45bc1e3f6` passed committed-input checks, two
byte-identical builds, package admission and ZIP-member verification. The package
has 94 runtime / 96 source files and 12,106,736 admitted runtime bytes, within the
unchanged 96-file / 16-MiB policy. Its receipt is
`/tmp/fpv-reimport-worlds-admission-c3f5030b2/optional-candidate-verification.json`.
The unbound browser playtest has 87 files / 11,972,265 bytes; ZIP SHA-256 is
`ef17da8be4d24d38a029bb157f5371006e47079d5e3b242ff0a4bfc6a104eae0`.

The first all-package attempt identified an existing Academy source-count
overflow. The separately reviewed package correction, cherry-picked as
`b79c04f18`, removes an unused presentation export and scopes the image wordmark
to World Studio, which actually displays it. No file/byte allowance or required
license was changed. Final all-package qualification at
`b79c04f18486e29317e46a8ed0c6392d1cd4ab25` / tree
`63bcb9a93266030e829078f2127fd76b3a123da9` passes two byte-identical builds,
committed-input verification, admission and ZIP-member verification for all three:

| Package         | Runtime / source files | Runtime bytes |
| --------------- | ---------------------: | ------------: |
| Civilian Flight |                29 / 31 |       404,021 |
| FPV Academy     |                62 / 64 |     3,299,552 |
| World Studio    |                94 / 96 |    12,106,613 |

Final frozen receipt:
`/tmp/fpv-reimport-all-admission-b79c04f18/optional-candidate-verification.json`.

## Actual browser and exported-data verification

The coordinating task used its actual in-app browser against localhost port 8792. The repaired main entry starts normally. Importing the local editable ZIP
opens the authored project; identical reimport shows its review; Cancel retains
the draft and the same source file can be chosen again. A changed source previews
the three changed semantic IDs; Apply visibly updates the actor to health 80 and
position x = −6 m. The browser exported a real editable ZIP despite its automation
download-event timeout.

Independent archive inspection reopened that browser-written 8,589-byte file at
`/Users/oleksandr.mekhovov/Downloads/reimport-yard.zip`. Its SHA-256 is
`9792a349506266cb7d8756f3170ef85711fafa1a67561b1012e81d8568d41f0e`.
The original local wall is byte-for-byte intact; spawn stays (0, 0, 12 m); both
flight modes have the updated 6 m gate width and −1 direction; actor health is
80 and position is (−6, 3, 0 m). The complete runtime course matches the expected
reimport candidate, identity `2e1a143094a18f30`.

The Ukrainian removed-source preview lists spawn-a, gate-a, actor-a and wall-a
with explicit retained-content diagnostics. Focus starts on **Залишити поточну
чернетку**; Escape dismisses the review with the current draft retained. The
browser reported no console errors. A generic pre-existing importer warning
still appears in English in that Ukrainian view; this is recorded separately
from the localized reimport controls and preservation diagnostics.

These are local functional/browser and package checks. Public deployment,
physical-controller performance, novice acceptance and additional unit coverage
are not claimed by this receipt.
