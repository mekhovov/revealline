# Temporary focused-suite waiver

On 2026-09-30 the repository owner explicitly requested: "bypass tests as they'll be fixed later".

The protected source gate now applies the existing `publishing/test-policy.json`
waiver to unambiguous test-only commands as well as the full test suite.
Skipped commands are reported as `WAIVED_SKIPPED_NOT_PASSED`, never passed.

- Keep source identity, admission metadata, strict protected main and required
  `release-ready` unchanged.
- Keep validation, localization validation, generated-source/media validation,
  runtime dependency fixes and deployment capacity/build checks.
- Mixed npm scripts, lifecycle hooks and unknown syntax are not automatically waived.
- A separate follow-up task owns deferred failures and a dedicated repair PR.
- Restore `publishing/test-policy.json` mode to `required` to restore suite execution.
  Calls without the explicit policy argument still run all selected commands.

This deliberately increases regression risk on main/Pages while repairs proceed.
It does not approve unresolved conflicts, data loss, failed builds or startup defects.
