# P15 Journey backup Restore focus

22 September 2026. Isolated source follow-up from accepted main
`75e3c0279ff4f7b5f110a6240c0df258c4b085c1`; no version or publication.
Independent of the Solo/couch warning candidates in PR253 and PR255.

## Observed failure and narrow correction

An actual native backup export/import succeeded, but activating Restore disabled
the focused button and moved native accessibility focus to the WebArea. The
dialog then required finding a new control despite reporting a successful save.

The explicit Restore handler now hands focus to its enabled Back action before
disabling Apply, only if the open dialog still owns focus on Apply. It does not
move focus after the asynchronous save, close the dialog, launch a mission or
change storage/backup rules. A later choice or reopened dialog retains focus.

## Verification

- New regression failed against the unchanged source: the active fixture node
  remained the now-disabled Apply instead of enabled Back (8 passed, 1 failed).
  The separately observed native failure placed focus on WebArea.
- Final combined Node20.19.5 cohort: **23 passed**, zero failed/skipped/cancelled,
  89ms. Files: journey-backup, journey-profile-editions and platform tests.
  Covers delayed success, later focus, closed/reopened dialog, storage refusal,
  thrown restore, actual merge rules and edition isolation.
- Scoped ESLint, Prettier and git diff checks passed. Initial npx invocations
  could not run because the shell's mise shim had no configured npx version;
  explicit installed tool entry points under Node20.19.5 succeeded. No dependency
  or environment configuration was changed.
- Native candidate on isolated localhost8951 serves accepted main plus only
  `game/ui/journey-backup.mjs`, SHA256
  `159812937e0a5eb796ffddf60c9d706ca56378ef01af676c854b3834690c46f3`.
  Storage is the unchanged real browser IndexedDB backend, with no fault adapter
  or state injection. The actual492-byte exported JSON (SHA256
  `2a9e19f8307c67de3a446be93e36ece4d6bb23ec76add9b76d68f270f58a1dc8`)
  was selected through the native file chooser. Inspection reported one missing
  Versus clear. Tab reached Apply; Enter restored it, reported saved locally and
  left focus on Back to missions. The focused Back action was visibly in bounds
  at320×568 and600×400. Enter returned to the chooser and restored focus to
  Progress backup, without starting a race. Browser warning/error log was empty.
- Temporary tab closed, viewport override reset and source server stopped.

## Remaining gates

Independent review, full exact-source CI, release-owner scheduling/version,
immutable release, Pages and exact public verification remain. Native web checks
do not certify screen readers, physical controllers, native wrappers, actual
disk-exhaustion recovery, cross-release compatibility or human enjoyment.
