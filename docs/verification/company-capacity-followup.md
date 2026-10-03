# Company capacity and optional voice follow-up

This follows merged [PR #984](https://github.com/mekhovov/revealline/pull/984).
The runtime and publisher checks below bind commit `bae630ebc2df89f80db82963e2a4020552f165ec`,
tree `12178cd61269c36a90b0fdbdc88e67e7d351c264`. Later evidence/documentation commits do not relabel these builds.
The source includes the expansion merged as `f10f10d5b`. A later merge
`31557b5be` incorporates main `3d04f9ab0` (PR #994's release-boundary guard).
That merge changes two publishing boundary files and no game/Company runtime
inputs; its source is not relabeled as the build commit above.

## Changes

- The complete Company application now has one fixed **80 MiB / 2,000-file**
  policy across compilation, generated offline worker admission, browser receipts
  and independent archive admission. This replaces the product's 64 MiB limit,
  which the previous 67,659,546-byte candidate exceeded by 550,682 bytes.
- Ordinary game core, Company artwork-only and optional flight limits remain
  unchanged. No integrity checks, immutable edition identities or cache ownership
  protections are relaxed. See [the capacity policy](../company-package-capacity.md).
- Company Capture and Snake share 48 optional EN/UK actor recordings through
  existing reaction/audio and verified-download services. The packs total 868,186
  bytes and stay outside mandatory offline preparation. Settings supports repair,
  cancellation and ownership-aware removal. Status rechecks across tabs and on
  Settings re-entry without interrupting active downloads. See
  [voice delivery](../company-actor-voices.md).
- The bounded source-entry allowlist now accepts the two Snake HTML entries
  already produced by the Company compiler. It still rejects arbitrary projected
  HTML; each accepted projection retains original and compiled source hashes.
- Exhausted Academy/Worlds recordings expose Results/Retry, including incomplete
  recordings, without a nonfunctional Continue/Arm action. Academy tolerates
  focus changes before initial flight construction. Native outcomes are retained.

## Mandatory verification

Full configured ESLint, scoped publisher ESLint, changed-file formatting and
whitespace checks pass. EN/UK localization, distribution references, presentation
metadata and all shared flight projections pass. The seven existing links to
release-generated destinations remain warnings. `company:check` verifies 189
generated files and public eligibility for 426 declared assets.

[Raw tracked contents/modes and immutable Git blobs](company-capacity-followup-source.json)
verify **25,032 files / 2,357,758,024 original bytes**.
The immutable source-manifest digest is `cc05f49f9e108cce6f76c75e24adf1b12a297cc4c5f8b86a565ff5c2f65a2e58`.

The [complete production game ZIP](company-capacity-followup-build.json) passes
from clean committed source: **2,983 files / 999,968,494 ZIP bytes**,
SHA-256 `c47d6d6e41ccc60eafba602b86898f2d9ee0156281d22db850e98913a1dbfad7`. Core is **1,350 files /
66,912,603 bytes**, leaving **196,261 bytes** under
its unchanged 64 MiB limit. This supersedes the historical local-disk limitation.
The completed game output was removed after preserving these receipts to make
room for all Company archives. A first final Company write hit local ENOSPC;
rerunning after that task-generated artifact cleanup completed the on-disk
archive and independent read-back verification.

All **18 Company editions** pass [two byte-identical builds, provider parity and
independent original ZIP-member admission](company-capacity-followup-editions.json).
The largest is `droneaid-nl-community`: **992 files /
68,591,935 bytes**, leaving **15,294,145 bytes**
below the new 80 MiB policy. No edition is marked publicly qualified.
The Company candidates retain repository version `v0.142.4`; the explicit full-game
build above uses the planned `v0.150.0` version. Neither changes a published version.

All three [optional flight packages](company-capacity-followup-packages.json) pass
production construction and independent archive admission within their existing
limits. Worlds still uses 102 runtime / 104 complete-source files; no package
slots or limits were added.

## Manual review and limits

[Manual browser observations](company-capacity-followup-browser.json) cover
English voice download → verified → removal with master mute unchanged,
unfinished Academy recording → Menu → Results, and retained Worlds demonstration
results. Voice status additionally follows removal in a second preview tab.
These are local-browser observations, not physical-device or offline qualification.

Automated suites remain **explicitly waived and unrun**. Relevant regression
sources cover boundary admission, source projections, voice ownership/lifecycle,
cross-tab status and flight replay menus. No passing-test claim is made.

All 84 Living Routes layouts retain their preview qualification status. Human
completion routes, physical devices/controllers, listening, real offline
installation, Studio/account round-trips and real-network qualification remain
pending. Hosted/public matchmaking, asynchronous challenges and networked SIM
remain later roadmap stages. Public promotion and merge are separate actions.
