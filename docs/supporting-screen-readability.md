# Studio and Replay readability

This named P05 delivery extends the existing shared display settings to Asset Studio and Replay Theater. **v0.60.0 is accepted within this scoped source/public gate; full P05 remains incomplete.** Frozen source `170508f11dd41204b7e24917a823f21701c15961` passed complete qualification and was delivered through source [PR #78](https://github.com/mekhovov/revealline/pull/78) and publication [PR #79](https://github.com/mekhovov/revealline/pull/79). Pages run `35196541650` serves the [immutable playable release](https://mekhovov.github.io/revealline/releases/v0.60.0/site/game/). The [current progress and remaining phases](../publishing/pages-controller/delivery/evidence/cross-mode-p05/public-v0600/planning/progress-and-next.md) separate this accepted slice from future Team and supporting-screen corrections.

## Player and creator behavior

- **Interface → Text style:** Theme uses the game's readable themed fonts; Plain uses its plain-text option.
- **Text size:** Standard and Large update instructions and controls without resizing the arena or altering collision geometry.
- **Reduced effects:** the saved choice and the system request combine. The checkbox shows the saved choice; nearby text explains an active system override.
- Settings are shared with the game. A read or system change does not save anything. A failed save keeps the local choice usable and displays an explanation.

Studio's host controls stay readable independently of the asset being inspected. A selected font specimen still uses that exact file, appropriate role weights and English/Ukrainian examples. Compatible uses share one registration keyed by original font bytes, including weight-range expansion and failed-load retry. Inspecting a font does not grant production approval.

Changing Interface preserves selection, prepared original bytes, dirty pixels, Undo/Redo history and audio ownership. Effective motion changes affect only owned preview frames. Clearing the cap resumes a locally Playing preview with a fresh clock; locally Paused or Reduced previews remain still. Keyboard selection retains focus on the replaced selected inventory row on wide layouts; narrow layouts keep the existing Inspector handoff. Rejected selections preserve the current work.

Replay's Interface remains usable before content finishes loading and after a startup error. Jump to playback preserves browser fragment navigation and then focuses a usable transport action, unless newer input, focus or backgrounding supersedes it. Completion hands focused Play/Step to Restart; unrelated editor focus stays in place. Display changes preserve recording identity, playback position, verification and play/pause intent. They cannot earn rewards or write progress. A terminal exit prevents late startup from rebuilding the closed page.

## Disabled transport actions

Primary action colors apply only while the control is usable. Guard both shared primary-ID styles and legacy Replay styles against native `disabled` and `aria-disabled="true"`, including hover. Keep the shared muted/panel/line disabled treatment, browser disabled semantics and the existing completion handoff to Restart. Review computed colors in empty, loading, ready and completed playback; a CSS source assertion alone cannot establish the cascade. This correction remains a candidate until its exact-source and public gates pass. The [scoped v0.60.7 candidate record](verification/cross-mode/replay-disabled-actions/README.md) retains the original tests, before/after browser observations and their limits.

## Return and lifetime

A persisted return rereads shared storage and current system reduction. An unsaved local choice remains authoritative until explicitly saved; a foreign record cannot silently replace it. Repeated delivery of the same storage value does not create another preference revision. Page return does not imply explicit Resume.

These rules apply to the existing shared authority used by Solo, Versus and Team. Tests must include those hosts and the composed Studio/Replay routes. Modeled page events establish handler behavior; they do not establish actual browser cache admission, physical controllers or touch hardware.

## Verification and boundaries

The initial committed candidate `02127f1` failed a hosted Replay startup test that counted event-loop turns before cold module loading completed. The [startup correction](verification/cross-mode/p05-supporting-readability/startup-correction/README.md) retains the original failed shard and replaces that wait with the actual held-fetch boundary, preserving every preference assertion. Production was unchanged by that test correction. Corrected source `170508f1` subsequently passed both complete hosted families at 5,399 tests each; the failed initial shard remains historical evidence, not a passing result.

The implementation combines 13 Studio source/test paths, eight disjoint Replay source/test paths and a five-path Replay successor (three overlap with that Replay candidate). Separate candidate totals overlap and must not be summed. Their original patches, failures, logs and native observations remain bound to their source snapshots. The corrected combined source completed its own source/production/build and public gates. The [delivery record](../publishing/pages-controller/delivery/evidence/cross-mode-p05/public-v0600/README.md) binds all 2,649 verified public files / 638,838,205 bytes, the retained failed HTTP attempt and successful retry, the after-audit authority check, and actual affected Studio/Replay keyboard and current/predecessor route observations. Modeled error/lifecycle checks and actual browser journeys remain separate from physical-device and human-playtest evidence.

This delivery does not complete P05, change replay/save formats, alter gameplay or adopt new art. P04's cold Back filter/selection behavior and focus after a successful mutation disables its trigger remain separate. Other supporting routes, disabled transport styling and physical qualification remain in the execution register. Team already uses the shared display authority; its focused-action reflow and live-control clearance correction is a future candidate with scoped native observations, not part of the accepted v0.60.0 source. It still requires final composition, exact-source qualification and its own public release.

## Research used in review

- [MDN: pageshow](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event), inspected 17 September 2026: persisted returns can restore frozen pages; the event alone does not prove foreground visibility. The game keeps explicit Resume independent.
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion): system motion preference informs the effective cap while preserving authored/user intent.
- [W3C: Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html): inspect reflow and usable controls at enlarged text/zoom rather than relying on a font-size assertion. This record is not a compliance certification.

## Replay export JSON reading-size correction

The remaining Replay JSON sizing item concerns Solo’s **Workshop → Export replay** dialog (`#replay-json`), not the standalone Theater’s import editor (`#replay-text`). The retained Large/Plain observations found the export field at 11px while its dialog was 22px; the owning ID rule still used a fixed 11px size in source `3e47f60b9f9b4c5088410536d649ff595b2667eb`. Plain already selected the intended platform monospace family.

The proposed correction uses the shared control-size token in that same export rule: 16px Standard and 20px Large, with a 16px fallback. Keep its monospace family, 1.5 line-height, readonly/spellcheck behavior, resize and scrolling, original JSON bytes, download ownership and modal return unchanged. Standalone Theater already uses its separate secondary-size token for technical input; this correction does not alter that route or replay verification.

Existing complete Main menu/Collection and practice Retry host files cover normal scoped keyboard/controller export, exact verified replay/checkpoint bytes, pending download ownership, sticky-rail focus clearance, manual scroll and return to the opener. Those modeled checks cannot establish CSS computed sizes or painted clipping. Before acceptance, inspect the actual export field under Standard/Large and Theme/Plain at portrait and short landscape, including focused outline, sticky rail, internal scroll, selection/copy, resize and rotation. Browser zoom remains a separate check; Large is not a claim of 200% resize conformance or physical-device qualification. See [W3C Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) and [Xbox text guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/101).

This is a scoped P05 candidate requiring final integration, source gates and public verification. Historical observations and the standalone Theater acceptance keep their original scopes.
