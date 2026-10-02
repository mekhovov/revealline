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
- `game/test/company-studio-ui.test.mjs`: pending handoff, explicit assignment,
  exported source and input focus.
- `scripts/test-optional-fpv-package.mjs`: reproducible Academy runtime and source
  closure inside the unchanged 62/64 file totals and package byte caps.

The [verification receipt](verification/appearance-quality-2026-10-02/curated-workflow/README.md)
records focused checks and explicitly separates programmatic harness evidence
from Cua UI proof. Password-gated browser and offline-browser qualification are
not established by this receipt.
