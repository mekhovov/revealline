# Private SIM helper capacity — 19 October 2026

This follow-up is based on `52a73b2f0dee91da01ad35f0faffe8be72223fe5`.
It omits six more unreachable function declarations from the generated private
SIM shell. Canonical modules, content, settings behavior and package limits remain
unchanged. The existing explicit pruning guard still rejects new retained
references, imports, roots, re-exports, namespace access, dynamic module access,
`eval`, or a changed declaration shape before writing generated output.

| Canonical module | Private-only functions omitted |
| --- | --- |
| `game/ui/celebration.mjs` | `advanceCelebration`, `skipCelebration` |
| `game/ui/movement-audio.mjs` | `readMovementAudio` |
| `game/text-face.mjs` | `canvasTextFonts` |
| `game/enemy-stats.mjs` | `forkEnemyStatsSession` |
| `game/ui/menu-audio.mjs` | `saveMenuAudio` |

These are whole function declarations with no module-initialization effects.
Used celebration sampling, movement preference keys, menu controls and enemy
statistics behavior remain present. The private module map exposes only the
generator's selected entry functions; none of these six is selected or imported
by the projected consumers. Their original canonical exports remain available to
all other game consumers. No help text, asset, lesson or flight code is removed.

Normal regeneration reduces `flight-fullscreen.mjs` from **293,049 to 291,431
bytes**, saving **1,618 bytes**. The generated section changes from 255,411 to
253,793 bytes. CSS is unchanged. The generator's `--check` reproduces the new
shell byte for byte.

## Exact original-input accounting

The [JSON receipt](fpv-shell-helper-capacity-20261019.json) binds all **243 unique
original inputs** by path, size and SHA-256. It reads the exact base commit and
substitutes only the new generated shell. Its input sets follow the existing
builder: admitted local/shared paths, the worker and launcher templates, and
original EN/UK locale inputs in place of the generated locale module. Generated
icons, worker output and archive metadata are not original inputs. The unchanged
policy is separately hash-bound.

| Package | Before input bytes | After input bytes | Input allowance | Remaining input bytes |
| --- | ---: | ---: | ---: | ---: |
| Civilian Flight | 4,953,593 | 4,951,975 | 8,388,608 | 3,436,633 |
| Academy | 13,303,130 | 13,301,512 | 13,303,808 | **2,296** |
| World | 19,793,384 | 19,791,766 | 20,971,520 | 1,179,754 |

Academy's base margin is **678 bytes**, independently matching the supplied
current-source baseline. These are exact original-input sums, not a new complete
package build or release qualification. Further edits require fresh accounting;
normal exact-source package checks and release checks remain necessary after
integration. No package file slot or allowance changes.

## Validation and remaining capacity

Node 20.19.5 passes **8/8** pruning tests. The new retained-projection regression
fails against the pre-regeneration shell and passes after regeneration. Tests
cover every newly omitted export's future reachability and declaration changes,
compare retained projected declarations and remaining exports to their canonical
ASTs, preserve the earlier edition-context behavior checks, and retain the real
generator's fail-before-write test. Scoped ESLint, Prettier, generator identity
and `git diff --check` pass. The receipt records both the original failing and
final passing local logs and their hashes.

Independent read-only review reproduced all eight tests and verified all 243
before/after input hashes, policy input sets and totals. It found no semantic or
validation blocker; only the six private declarations and export keys change.

A separate read-only audit considered exported `const` declarations whose sole
initializer is an arrow or function expression. Of the **26 embedded modules**,
only `emptyEnemyStats` has that shape; its 97-byte canonical declaration is used
by retained code and cannot be omitted. The other matching declarations are in
already external canonical modules, not private duplicate code. No additional
candidate was found, and the pruning implementation remains restricted to
explicit whole function declarations. No generic optimizer, comment removal,
source compression or capacity increase was introduced.

The remaining margin is small. A larger R11 interface still needs a separate
structural capacity decision and fresh combined-package qualification; this
increment does not establish sufficient space for unspecified future work.
