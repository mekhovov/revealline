# Named result destinations (v0.139 candidate)

This local candidate starts at `99ee4f5f05adb0b13e0f26b2b04fad347b2eec4c` and carries no package, lockfile, build-configuration, tag, release, or remote-PR change.

## Result contract

- Solo and Versus Journey wins say `Next: <mission>` while the exact owned successor remains in the current campaign.
- A known campaign boundary says `Next campaign: <campaign>`.
- The last installed Journey mission offers the existing mission browser. An unresolved catalogue-backed successor keeps the generic Next label until the host resolves it.
- Team keeps its established exact `Next: <mission>` and `Browse Team arenas` labels.
- English and Ukrainian interpolate the localized mission or campaign name. Missing names never expose an empty placeholder.
- The change computes copy only. Existing keyboard, controller, and touch activation still enter the shared preparation/start path, so the pending v0.138 countdown/start-cue work can rebase without a second launch implementation.
- Preparation failure or cancellation leaves the earned result available. Existing receipt guards remain authoritative, so a late or repeated continuation cannot award the old result twice or adopt a stale successor.

## Evidence

The focused checks cover the label helper and real English/Ukrainian catalogues; Solo, Versus, and Team host continuations; campaign crossings and endings; artwork failure/cancellation; retained result images and checkpoints; duplicate-award guards; stale successor cancellation; and keyboard/controller/touch activation. Static checks cover localization generation, syntax, formatting, lint, and whitespace.

These are deterministic DOM, Canvas, storage, artwork, and finite-input models. They do not qualify physical controllers, touch hardware, rendering performance, or human play quality.

## Stack dependency

Before release, replay this commit onto the corrected v0.138 parent. The current `99ee4f5f…` base still exposes inherited fresh-activation and stale fixture failures in broader Team/controller/Solo suites; those corrections belong to the earlier stack boundary and are deliberately excluded here. Re-run the broad input and continuation suites after that single rebase.
