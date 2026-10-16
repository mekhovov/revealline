# Player-first Download & play continuation

## Problem and scope

The v0.141.7 public release exposes the current 91-mission Versus Journey and
12-mission Team Journey, but a fresh profile can reach either lobby with Start
disabled because the selected mission's verified artwork package is absent.
The recovery control says Retry picture and leaves the player to discover the
separate offline-content screen. That breaks the player-first contract that a
downloadable mission has one **Download & play** action.

This bounded feature changes only that missing-package state in the Versus and
Team lobbies. Solo already keeps the selected launch intent through its package
preparation flow. Generic decode, presentation, actor, installed-content and
preview failures remain explicit Retry actions.

## Implemented contract

- Passive preparation raises the stable code `offline-package-required` without
  opening a consent surface. Hosts test this code rather than parsing localized
  English error text.
- Versus and Team label the matching recovery action **Download & play** using
  the existing English/Ukrainian interface message.
- One deliberate activation opens the existing embedded package chooser. Play
  continues only after that exact package reports readiness and the official
  cache verifies its declared bytes.
- Closing the package chooser keeps the untouched lobby and preserves the
  Download & play recovery state.
- The operation retains its exact mission, generation, focus, foreground and
  controller authority. A later selection, focus choice, cancellation, page
  backgrounding or disposal prevents a stale launch.
- Repeated Confirm while preparation is owned cannot create another package
  request or a second start.
- Team still passes the verified dependency-retention gate before play. Versus
  still confirms the accepted picture and actor presentation before play.
- Existing preparation Cancel controls and all generic failure recovery remain
  available; no package is downloaded without the player activating Download &
  play.

## Verification

Focused automated evidence on the rebased feature source:

- offline download access and exact typed state: 14/14 passing;
- real Team and Versus host, embedded package panel, cache verification,
  cancellation, repeated Confirm, stale-focus refusal and one-action launch: 3/3
  passing;
- Team presentation retry and dependency retention cohort: 6/6 passing;
- Versus installed/static picture and action-focus regression cohort: 63/63
  passing;
- lint, game/native formatting, localization/content validation, Motion Lab
  syntax and diff checks passing.

The repository's committed temporary release policy still waives the long full
suite; this evidence does not claim that suite passed. Public release checks,
offline cold relaunch, physical touch/controller/Steam Deck checks and network
interruption on installed browsers remain release/UX6 evidence.

## Delivery position

This is an unversioned next-batch feature input. The release coordinator owns
version allocation, merge, immutable freeze, tag, archive admission and Pages
deployment after the current frozen batch completes. It must be reconciled onto
the then-accepted main and its focused gates rerun before publication.
