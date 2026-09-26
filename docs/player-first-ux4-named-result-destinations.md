# Named result destinations (planned v0.141.7)

This local candidate is the feature delta from corrected v0.141.6 parent
`49fcf3dbc7c37a190774da4b1f20e0efc214514f` through
`1df8284826b4e2b0e9a5d0db2129d8ced8338ccc`. It carries no package,
lockfile, build-configuration, tag, release, or remote-PR change.

## Result contract

- Solo and Versus Journey wins say `Next: <mission>` while the exact owned successor remains in the current campaign.
- A known campaign boundary says `Next campaign: <campaign>`.
- The last installed Journey mission offers the existing mission browser. An unresolved catalogue-backed successor keeps the generic Next label until the host resolves it.
- Team keeps its established exact `Next: <mission>` and `Browse Team arenas` labels.
- English and Ukrainian interpolate the localized mission or campaign name. Missing names never expose an empty placeholder.
- The change computes copy only. Existing keyboard, controller, and touch activation still enter the shared preparation/start path delivered by the v0.141.6 start-cue parent; there is no second launch implementation.
- Preparation failure or cancellation leaves the earned result available. Existing receipt guards remain authoritative, so a late or repeated continuation cannot award the old result twice or adopt a stale successor.

## Evidence

The complete Solo candidate host file passed alone: 17/17, zero failures,
skips, cancellations, or todos. It exercised both full core routes, both optional
endings, same-campaign and cross-campaign labels, exact retained results,
artwork failure/retry, durable receipts, unique run IDs, Retry, and no Legacy
awards. The run took 214.149 seconds.

The complete Versus candidate host, Team Journey continuation host, and label
helper files then passed together: 43/43, zero failures, skips, cancellations,
or todos. They exercised same-campaign and cross-campaign labels, both complete
routes, all twelve Team missions, failed/cancelled preparation, exact retained
results, stale-adoption guards, controller/touch models, and campaign endings.
The run took 255.855 seconds.

Earlier broad concurrent runs had settlement timeouts. They did not reproduce
when the full Solo host file owned the process, or in the later combined
Versus/Team run. No runtime correction was justified. The only correction
commit, `1df8284826b4e2b0e9a5d0db2129d8ced8338ccc`, aligns three pre-existing
Solo fixture expectations with the current accepted output (`Standard` /
`Expert`, `Standard` / `Gentle`, and explicit null presentation pins); it does
not weaken continuation assertions or change product code.

Localization generation passed with 9,538 messages and 6,695 references.
Syntax, scoped ESLint, scoped Prettier, and diff whitespace checks passed.

These are deterministic DOM, Canvas, storage, artwork, and finite-input models. They do not qualify physical controllers, touch hardware, rendering performance, or human play quality.

## Stack dependency

Replay commits `99ad0bacc6e1f52b2fced41a8d93c6854c0e715f` and
`1df8284826b4e2b0e9a5d0db2129d8ced8338ccc` onto the finally accepted
v0.141.6 source. If its rewritten parent is not tree-equivalent to
`49fcf3dbc7c37a190774da4b1f20e0efc214514f`, re-run the complete Solo,
Versus, Team Journey, and label-helper files before opening the release PR.
