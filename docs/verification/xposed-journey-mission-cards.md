# Optional Journey chooser: map cards

P01 source candidate, not a deployed or human-validated phase.

Both authored Solo and Versus now expose the same card model from their exact
owned catalog manifests. The engine supplies initial cells, terrain, spawn,
actor and objective positions. Immutable models are cached per manifest; the
288-pixel diagram does not simulate cuts, predict moving-enemy capture outcomes,
load full reveal pictures or mutate gameplay. The optional canvas can fail while
text and one-action mission selection remain available.

Cards show campaign, completion/skip state, authored challenge band, next-attempt
preset, route decision and optional challenge. Optional challenge text is a
practice goal, not an awarded or recorded mastery result. All missions stay
selectable. Existing search, campaign filters and progress backup remain flat.
Cross-tab preset changes refresh open cards while preserving focused mission
identity and the current flight. Historical Journey without authored card data
keeps its existing text cards.

The frontend-design skill guided the compact field-guide treatment: shared
functional colors, map silhouettes, legible metadata and no new interstitial.
Existing typography and accessibility preferences are retained. No final artwork
derivatives or new generated assets were created.

## Verification

- Mission-card model/render tests: 3/3 passed. All ten distinct starting problems,
  all three presets, exact engine state, Solo/Versus equality, cache identity,
  foreign mission refusal and no manifest mutation.
- Complete actual Solo/Versus and existing Journey-host cohort plus card tests:
  34/34 passed (130.8 s). Includes nine real Solo and nine real paired-board
  mission continuations, durable receipts and the existing ten-Next fixture.
- Focused cross-tab/open-card controller tests: 2/2 passed; focused chooser/Skip
  regressions: 8/8 passed, with unrelated tests explicitly skipped.
- Final status-correction candidate/Legacy couch-host cohort: 46/46 passed
  (74.1 s), including retained action/focus, cancellation and reentrant ownership.
- Lint, formatting, 714-file content validation and whitespace checks passed.

## Native desktop observations

Owned in-app tab8 on mutable localhost8778. Inspected ordinary 1280×720,
390×844 portrait and 844×390 short-landscape viewport overrides. This is browser
layout evidence, not phone or touch-hardware qualification.

Native inspection caught the inherited 560-pixel dialog cap and fixed-height
buttons clipping the diagrams. Corrected chooser width and content-height cards.
Search results retain bounded card widths; short landscape uses horizontal cards
with full map previews, challenge bands and accessible fixed footer actions.
Search for Courtyard isolated one mission. One card activation started that real
paired race at zero coverage and three lives on both boards; it was then paused.
The temporary viewport override was reset.

Native inspection also exposed a stale checking-picture message after successful
race adoption. The status lease now recognizes its exact adopted race, without
weakening the preparation or fresh-input guards. A successful-Next assertion and
existing couch ownership/focus regressions cover this correction separately.
Native Island outpost chooser launch followed by Pause confirmed that the stale
message is absent. Both boards were left paused; existing unrelated tabs remain.

Still open: screen-reader hardware, physical controller/touch checks, larger
content-library navigation, native Solo styling, final-source hosted gates,
public deployment, and human comprehension/enjoyment. The chooser is optional;
the ordinary Continue/Next route never requires opening it.
