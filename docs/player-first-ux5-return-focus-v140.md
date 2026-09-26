# UX5 — player tool return focus

Status: prepared, unversioned release input. It must be reconciled after the
player-first v0.133–v0.139 train and qualified again before publication.

## Player behavior

- Opening Settings or Help from a running Solo flight first installs Pause,
  then records the matching visible Pause command as the dialog return target.
- Closing either dialog returns focus to Pause and keeps the exact attempt and
  checkpoint paused. Resuming remains an explicit action.
- Collection disclosure tests use the shared browser boundary as the single
  native `<summary>` activation owner. Keyboard and touch activation open and
  close once without changing the paused attempt or storage.

The change does not alter simulation, saves, controller bindings, progression,
audio preferences, mission content, or presentation assets.

## Focused evidence on the prepared stack

- Pause menu host: 4/4 pass, including Settings and Help opened from the
  persistent shell and explicit Resume afterward.
- Full modal navigation: 55/56 pass. All player-facing Help, Collection,
  Settings, Pause, keyboard, touch, and modeled-controller cases pass. The one
  remaining failure is an inherited Soundtrack Studio editor fixture outside
  the player-first scope; it remains visible and is not relabelled as a pass.
- Existing controller practice and Settings-assist checks pass. The two
  previously failing Steam Deck controller-echo cases pass after their fixture
  observes the required neutral input interval.
- Scoped ESLint, Prettier, and `git diff --check` pass.

These are modeled browser/input checks. Physical touch hardware, Steam Deck,
and controller qualification remain separate evidence.

## Ordered release dependency

Rebase this source after the accepted v0.139 release, synchronize the next
unused version, rerun exact-head focused and release gates, then publish it as
its own immutable feature release.
