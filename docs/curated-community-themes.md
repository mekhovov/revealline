# Curated community themes

Custom interface themes can be created in Asset Studio and assigned to a community
or campaign through Company Studio's ordinary draft, compile, review and publication
workflow. Opening the handoff does not change a community. **Set as community
default** or **Set as campaign default** explicitly registers and assigns the candidate
in the local draft. Export/reopen preserves its own name and exact revision.

## Supported scope

A candidate contains validated interface tokens and inherits its installed base's
component recipes, material style, fonts, Arcade collection and SIM collection.
Those dependencies are exact revision references, including retained Industrial
revisions. Source images, sounds, font files, textures and models are not silently
replaced: the Asset Studio assignment action rejects changed selected asset slots
and explains that they require the separate asset publication workflow.

This is curated content admission, not player file installation or executable
plugins. Arbitrary replacement collections and new model/font payloads remain a
future extension requiring explicit bounded dependency and revision contracts.

## Saved workspace basis

New workspaces and explicit basis changes use `revealline-theme-bundle.v2` with
`appearanceBasis: {familyId, familyRevision, interfaceId, interfaceRevision}`.
Save, reopen, duplicate, native export/import and runtime export preserve these
exact pins, including retained Industrial r1. Existing v1 bundles stay byte-compatible;
opening or exporting them alone does not migrate the document. Choosing a basis is
an ordinary staged edit and requires Save before community assignment.

An imported unavailable basis remains editable and can still be exported intact.
The workbench shows its exact reference and blocks candidate preview, runtime
export and community assignment until the author explicitly chooses an installed
basis and saves it. It never silently substitutes the latest Industrial revision.

## Immutable data and admission

`revealline-edition-catalog.v3` adds `appearanceThemes`, a maximum of 64 validated
`ThemeCandidate.v2` records. Existing v1/v2 catalogues remain readable and retain
their historical serialized shapes. A candidate has a content-derived identity;
changing its source, basis or interface creates another identity. A registered
identity cannot be replaced with different content. Community/campaign defaults
continue to use `{familyId, revision}` independently of legacy content `themeId`.

One shared pure validator serves Studio, runtime and sparse publication admission.
It rejects unsupported fields, executable/accessor/prototype data, mismatched
identities, missing exact installed dependencies and oversized inventory. Curated
registration and selected publication additionally require the shared normal and
high-contrast component coverage checks. Incomplete drafts remain saveable and
previewable. This contract check is necessary, but does not replace rendered-screen
review or production artwork approval.

Compilation includes only custom records referenced by the admitted community and
campaign closure. Missing inventory, including an omitted inventory property,
cannot bypass selected publication checks. Unrelated communities' custom records
are omitted. The existing offline engine closure supplies the pinned code, fonts
and procedural resources; the compiled catalogue carries candidate data. The first
paint hint carries only bounded variables and a fixed SVG path grammar, then the
normal runtime host admits and applies the full candidate.

## Runtime and historical behavior

A personal global choice wins. Otherwise the current campaign default wins over
the community default and application default. Custom choices appear under their
own name and revision. Campaign adoption prepares resources before committing the
interface and Arcade selection together. Failed or canceled loads retain the
accepted presentation. Catalogue snapshots retain selected candidate bytes without
changing gameplay proof identity or the existing authored-picture receipt algorithm.

After successful acceptance, one bounded session cache carries the candidate and
its exact first-paint seed to auxiliary pages such as Downloads. A compiled page's
own context and explicit personal choice take precedence. Failed, canceled or
preview-only changes cannot update this cache; accepting a builtin clears it.
The paired data and seed expire together after 30 minutes. This is same-origin
session continuity, not a permanent global installation.

SIM follows the custom interface and the candidate's exact installed world
collection. Existing independent SIM overrides and first-arm attempt freezing are
preserved. Same-tab launches use bounded session context. Isolated `noopener` launches
use one replacing origin-local envelope with a 30-minute lifetime, consumed into the
destination tab; it is not a preference or permanent theme installation. Rendering
launcher links does not write this handoff. A missing, expired, denied or invalid
context keeps the requested identity visible in diagnostics and uses authored SIM
world appearance. An explicit world override still wins.

## Verification entrypoints

- `game/test/curated-community-theme.test.mjs`: two unrelated communities, exact
  offline/publication data, retained snapshots, custom host/Arcade/SIM bindings,
  contrast admission, bounded first paint and separate-tab transfer/fallback.
- `game/test/edition-appearance-host.test.mjs`: atomic real mission adoption,
  cancellation, failed resource preparation and personal overrides.
- `game/test/studio-appearance-basis.test.mjs`: saved, duplicated, native and runtime
  round trips, retained and unavailable revisions, and the visible workbench state.
- `game/test/company-studio-preview.test.mjs`: a self-consistent compiled report
  cannot omit or add curated definitions behind otherwise matching default pins.
- `scripts/test-curated-appearance-package.mjs`: two real compiler packages, emitted
  entry/provider/host modules, HTTP loading, exact cached bytes, cache-only reload,
  community isolation and personal override precedence.
- `game/test/company-studio-ui.test.mjs`: pending handoff, explicit assignment,
  exported source and input focus.
- `scripts/test-optional-fpv-package.mjs`: reproducible Academy runtime and source
  closure inside the unchanged 72-file / 8-MiB Academy caps; World uses its separate
  104-file / 16-MiB caps. File totals are measured from the current source closure.

The [verification receipt](verification/appearance-quality-2026-10-02/curated-workflow/README.md)
records focused checks and explicitly separates programmatic harness evidence
from Cua UI proof. Password-gated browser and offline-browser qualification are
not established by this receipt.

## Reproduce the compiled acceptance journey

Run `node --test game/test/studio-appearance-basis.test.mjs game/test/company-studio-preview.test.mjs scripts/test-curated-appearance-package.mjs`.
The last check compiles two neutral communities in memory and writes only a temporary
closure of emitted modules for Node execution. It deletes that small directory after
the run and produces no duplicate site builds or archives.

For browser review, run
`node scripts/check-curated-appearance-package.mjs --serve 8876 --receipt /tmp/appearance-package.json`.
Open `http://127.0.0.1:8876/north/game/company.html`, then the corresponding
`/south/game/company.html`. Both should show the edited **River acceptance** theme
and redirect to the ordinary Solo entry. Choose Tryzub in the first community,
open the second, and verify that the personal choice wins; choose Follow community
and reload to restore the exact custom candidate. Ordinary access gates remain in
place. Stop the server with Ctrl-C when finished.

The JSON receipt pins actual compiler inputs, entry/catalogue bytes, package size,
and emitted module count. Node uses a DOM adapter for host assertions and a verified
cache-only fetcher for reload. This is reproducible runtime and packaging evidence;
physical offline installation, rendered contrast and user interaction still need
separate browser/device evidence.
