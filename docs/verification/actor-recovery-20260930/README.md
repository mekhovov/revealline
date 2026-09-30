# Bounded actor and Team recovery verification — 30 September 2026

This successor was implemented on `e39b4197a75441d74c35299c8545d8bdfd0a7c61`.
The final GitHub candidate head and subsequent rebase/build records belong to its
PR. It introduces no new artwork, simulation rules, level identity or version.

## Reviewed changes

- Ordinary Sentry projectile loss uses the existing EN/UK projectile cause.
  The legal-route regression retains its original lives, events, checkpoint and
  replay assertions and adds the visible cause assertion.
- Current actor coverage and disposition metadata are refreshed for FPV104:
  91 Solo, 91 Versus and 12 Team owners. No required binding is missing;
  visual approval remains false and review/repair dispositions remain open.
- Exact fpv38/50 imported Team themes use an independently owned, authenticated
  historical host. Candidate failure/cancellation retains the accepted attempt.
  Painter and published audio follow the accepted snapshot; returning to the
  lobby or rolling back restores the matching reader, and disposal invalidates
  readers before retiring hosts. Independent review found and corrected this
  audio handoff issue.
- The two original manifest bodies total 1,946,423 bytes. They are optional in
  `archive:team-import-themes`; all 124 existing exact PNG/font dependencies
  remain in the core/shared/Team closure. Independent review found and corrected
  the missing EN/UK download-title registration. No core budget was raised.

## Browser interaction

Codex in-app Chromium, local source server on port8823, 1280×720 CSS viewport,
normal browser zoom. These are native page/file-picker interactions, not a
physical-device or automated-suite claim.

Reconstructed `.rlteam` fixtures use the unchanged starter pack and original
published picture bytes. They are not recovered user exports:

| Fixture | Bytes | SHA-256                                                            |
| ------- | ----: | ------------------------------------------------------------------ |
| fpv38   | 94020 | `2428642d2af8b8be8a4149cab913b1fa79be905865202f1c68988f4e91442cfe` |
| fpv50   | 94020 | `63c1f2240b3914212cbedd3f7f508a7c4cf783ff3f22d6c0d7b783eeceb836b3` |

Observed: Settings → Gameplay → Created Team packs → file picker immediately
showed preparation, then accepted Local artwork. fpv38 First Connection entered
play with territory objective; Pause → Retry → explicit discard confirmation
returned to a fresh 0:00 attempt. Change setup returned to the lobby. fpv50
accepted its original artwork; choosing Relay Yard entered play with the shield
anchor objective, then Pause. No browser error-level console entries appeared.
After the audio correction, reloading and repeating fpv50 import → Start → Pause
→ Change setup returned focus to Start with no error-level console entries.
This does not claim an actual listening check. The screenshot records the restored stronghold and pause state; the older
presentation fallback is intentional, not new Team-art approval.

![Restored historical Relay Yard](fpv50-relay-yard.jpg)

## Validation and limitations

Passed during source preparation: syntax, scoped ESLint and formatting, source
validation, localization validation, generated metadata validation, current
coverage/disposition regeneration checks, exact retained manifest/dependency
inspection, and compilation from the unchanged authenticated production ledger.
That compiler produced148 outputs and left every unrelated output byte-identical.
Final committed-source build/capacity results are recorded separately below.

**Not passed:** `produce-field-kit-theme.mjs --check` reports “Stale production
revision ledger.” No historical ledger was rewritten and no new quality
approval was invented. Current source-fingerprint reconciliation and production
reproduction remain required before public acceptance.

**WAIVED_SKIPPED_NOT_PASSED:** full and focused automated suites under the
committed 30 September policy. The new regression sources were authored and
reviewed but not executed. No complete playthrough, offline relaunch, listening,
physical controller/touch, human pilot or cultural/production-art approval is
claimed. Publication, deployed bytes and public play remain with the single
publisher.

## Committed-source build and capacity

At source `deb4a4e97e1d395eacb39c1ddd07dd99086010dc` (rebased onto
`4174ec00a2bf79714c1023754b90e053ac70ce67`), the normal in-memory default
build preparation and immutable source checks completed. This is not a ZIP,
expanded site, release artifact or public qualification.

| Result                             | Evidence                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Default payload including manifest | **951,900,757 bytes** — exceeds the 950,000,000-byte Pages ceiling by **1,900,757**, before publication metadata. **Release blocked.** |
| Default report                     | `default-build-deb4a4e9.json`, SHA-256 `6d6fc4dddb543badd70440b553594590c816fce604e2bca8e61b0fd903e3ae6d`                              |
| Default manifest                   | 398,449 bytes, SHA-256 `4b30e609d834ecea37e3b92c0dd97777026ef610f0f9bcc2a0272fa2a3f958c8`                                              |
| DroneAid Community                 | 731 files / 27,373,914 bytes; normal in-memory compilation completed                                                                   |
| DroneAid NL Community              | 809 files / 66,983,770 bytes; below 64 MiB by 125,094 bytes                                                                            |

The optional archive group protects core cache size, not full Pages payload.
Capacity correction must preserve originals and be reviewed with the publisher;
do not raise the budget or call successful composition a publication pass.

The first final localization/build attempt found the newly added labels missing
from generated `game/i18n/catalogs.mjs`. That bundle was regenerated and committed;
the successful default build above includes the corrected localization check.
Full repository lint passed. Full repository/native formatting reported two
unchanged base files: `game/editions/runtime-assets.json` (Git blob
`3eb5be0e4d921481593479bb361fb0b1dded2a9f`) and `scripts/edition-offline.mjs`
(`a7d38e8d878ae255d8da32015029f3908a35bd0c`). Neither is changed by this PR.
Scoped changed-source formatting passed. The full formatting result is **not**
reported as passed; aggregate correction remains required.

The production ledger drift also predates this input. Compiled FPV104 audio
provenance carries `b3ab688c9818ac2d35aff830a0700b0869c8065c08ebd49c0316cefe3faa7e2d`;
base4174's actual audio closure is
`591056be5952d7fb15f6fe5db2ae17beae43b57dd1e24d6d266d5e756734fc95`.
This candidate's one Sentry text branch advances it to
`84612914dd064df5acf2d3738b75ed2027f672c474a0daf71e216497b858e25c`.
All other declared recipe-source groups are byte-identical to that base.
The exact stale-ledger failure remains an aggregate reproduction gate; this
comparison grants no new review or source approval.

[PR868](https://github.com/mekhovov/revealline/pull/868) holds the complete source
and is scheduled as a draft input to milestone57, with release-train-hold.
Subsequent documentation-only commits do not turn this earlier exact-source
report into evidence for a different final publishing revision.
