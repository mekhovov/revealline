# UX5 — player tool return focus

Status: prepared, unversioned release input. It must be reconciled after the
player-first v0.133–v0.139 train and qualified again before publication.

## Player behavior

- Opening Settings or Help from a running Solo flight first installs Pause,
  then records the matching visible Pause command as the dialog return target.
- Closing either dialog returns focus to Pause and keeps the exact attempt and
  checkpoint paused. Resuming remains an explicit action.
- Help now has explicit live-flight coverage for both modeled controller Back
  and the native Escape/cancel lifecycle; each returns to Pause's Help command.
- Collection disclosure tests use the shared browser boundary as the single
  native `<summary>` activation owner. Keyboard and touch activation open and
  close once without changing the paused attempt or storage.

The change does not alter simulation, saves, controller bindings, progression,
audio preferences, mission content, or presentation assets.

## Focused evidence on the prepared stack

- The complete changed modal-navigation, Pause-menu host and Steam Deck menu
  files pass sequentially: 72/72 tests, with no skipped tests.
- The Soundtrack Studio fixture waits for its ready controls and opens the
  advanced Library through its already-bound handler after the opening
  controller gesture. It retains the player-facing contract: controller Back
  and native Escape cancel an active editor before the dialog can close, while
  Confirm applies the existing handler once.
- Existing controller practice and Settings-assist checks pass. Steam Deck
  delayed/native click-tail coverage retains its neutral-input interval.
- Scoped ESLint, Prettier, and `git diff --check` pass.

These are modeled browser/input checks. Physical touch hardware, Steam Deck,
and controller qualification remain separate evidence.

## Ordered release dependency

Rebase this source after the accepted v0.139 release, synchronize the next
unused version, rerun exact-head focused and release gates, then publish it as
its own immutable feature release.
