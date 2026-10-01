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

| Input | SHA-256 |
| --- | --- |
| `world-content.mjs` | `a37ed0ad59dedfc99cd702c15af5c6cc535564a4ca022249d3093617db1333fb` |
| `world-app.mjs` | `c9e0ae0868d71fd5953309a5fa8df691a6d901d0dcbfc3fc0c3650af21920f20` |
| `/tmp/fpv-reimport-functional.mjs` | `9d2d3c4bf7ea36645ea1a83300ef7bed1ffd063545067cc205c3c9302b242119` |
| `/tmp/fpv-reimport-local.zip` | `1abcbdadaa4c3e391fc9552ed39a178b79552a49d3a75d4907e312d1c21c7ff4` |

JavaScript syntax and `git diff --check` passed. Scoped ESLint passes the content
module; the app reports only three existing undeclared `lastRadioDiscovery`
references in parent `e4c9c5db3`. The coordinating UI increment owns that fix.
Actual browser cancel/apply/focus, package admission and final integrated lint
remain separate acceptance checks. No new unit-test suite was added or claimed;
additional coverage stays in the final qualification phase.
