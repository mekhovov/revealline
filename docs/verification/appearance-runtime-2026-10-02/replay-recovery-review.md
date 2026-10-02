# Replay import recovery review — 2026-10-02

This slice covers the real Replay Theater import controls, error feedback, cancellation focus and English/Ukrainian status continuity. It does not change recorded simulation, authored artwork, saved progress or the underlying replay validator.

## Observed problem and correction

In the root agent's actual desktop browser check, submitting `{}` kept Verify focused and retained the previous recording, but the global error appeared above the viewport. The user saw the input and Verify without visible feedback. The import section now mirrors its operation message immediately after Verify. The copy has `aria-live="off"`; the existing global operation status remains the single live announcement. File, JSON and Verify controls reference the local message with `aria-describedby`. Shared semantic danger styling applies on failure and clears on a successful retry.

A focused Cancel could disappear when a held import settled. The actual handler now restores focus only if that Cancel owned it and the document remains foreground. It uses Play, Restart, then Load example, with Verify as the available fallback for empty edition hosts that intentionally disable bundled examples. Newer editor focus and background documents retain their focus ownership. The import still adopts only a fully verified candidate and otherwise retains the old checkpoint.

Playback phase, Escape guidance and pending import messages now use the existing locale adapters. The six new message keys are present in both English and Ukrainian. Changing locale does not change the recording, input, checkpoint or focused control. Validator detail strings retain their existing contract: the actual Ukrainian browser check still displays the existing English diagnostic “Unsupported replay version, ruleset or document fields.” inside the localized wrapper. Replay has no general validator-error localization adapter; that remaining work is not included in this pass.

## Checks

- `replay-recovery-tests.tap`: 37/37 tests pass across the real Replay app/navigation/display-host/actor-appearance test suites. This run precedes the final single-line semantic error-color attribute. The final name-filtered actual import/recovery test passed afterward: `replay-local-feedback-final.tap` (1 pass, 17 deliberately skipped).
- Actual-handler coverage includes invalid JSON with retained input/checkpoint, valid retry, English-to-Ukrainian updates, delayed success/failure/cancel, preservation of newer focus/background focus, and edition empty-state fallback.
- The edition read-isolation fixture was brought in line with the already installed theme host: it allows the three existing appearance/migration preference reads. Its write allowlist and saved player-data preservation assertions remain intact. Production storage behavior was not changed by this slice.
- Focused ESLint, Prettier, whitespace checks, EN/UK key/placeholder validation and generated-catalog equality passed. Exact final source hashes and logs are recorded in `replay-recovery-checks.json`.
- `.github/workflows/appearance-preview.yml` adds the three Replay suites plus the separately reviewed World texture and texture-snapshot suites. Relevant source/test triggers are included. Root runs the combined final cohort separately.

## Browser sequences and scope

Open Replay Theater, expand **Import your own replay**, paste `{}`, then select **Verify and load JSON**. Root's actual browser follow-up confirmed visible inline error feedback with shared danger paint, retained Verify focus and unchanged `{}` input. Switching to Ukrainian updated the wrapper and phase live; the validator detail limitation is described above. Replace the input with the repository example `game/replay-theater/data/fieldcraft-01.replay.json`, or use **Load example**, to recover. The viewer does not save player progress. Browser observations are separate from the handler tests above.

The root agent also checked Asset Studio's real file input with a truncated `.rltheme`: its visible error retained file-input focus and preserved both workspaces. **Reload saved** then recovered with focus on that control and Undo/Reset disabled. `studio-invalid-theme.png` records that check; no Studio source change was needed.

Other dialogs, all physical input devices and the complete theme/screen/state matrix remain outside this focused claim. This evidence is not whole-game release qualification.
