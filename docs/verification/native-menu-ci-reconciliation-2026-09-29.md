# Hosted navigation-test reconciliation

The hosted `focused` job for earlier PR #782 head
`c0a8757501ed84d85e8f8054d3d351a6fd557f01` completed with ten failures across
three test files. Its [GitHub run](https://github.com/mekhovov/revealline/actions/runs/36510167295)
remains failed. The release-ready check failed with it; skipped test/build/release
jobs are not passes.

The failures were reproduced locally. They exposed test routes and activation
expectations left behind by the approved menu and Confirm-lifecycle changes.
This batch changes tests only; no runtime behavior, package assets, saves, or
release policy changed.

- **Versus:** seven cases attempted to edit hidden setup controls or used old
  settings categories. Tests now open Settings → Gameplay → Advanced setup,
  return through Settings, find reactions after Ornaments in Display, and use
  Accessibility for Reduced effects. Shared test helpers require rendered,
  enabled controls inside the active panel. Existing cancellation, exact board
  state, native focus, neutral-input, touch-pad and storage-retry assertions
  remain. Two previously passing Sentinel setup preludes also stop clicking a
  now-hidden setup trigger.
- **Team:** current mode is intentionally a focusable button, and modes form a
  horizontal navigation group. Tests use Right/Left within that group and
  confirm that activating the current Team mode neither resumes nor navigates.
  Native Tab reachability, paused-state snapshots, exact Back restoration and
  separate discard confirmation remain covered.
- **Pictures & Stories backup:** the accepted controller lifecycle commits on
  Confirm release. The test now uses one clock for the router and compatibility
  guard, asserts no activation on press/hold, exactly one download on release,
  native echo suppression and a later genuine keyboard download. A real deferred
  image review changes the target while Confirm is held; neither that hold nor
  its release can apply Restore. Fresh Restore also waits for release.

## Local results

- Versus: all seven reproduced failure cases passed after correction; the full
  navigation/settings cohort passed **30/30**, including both Sentinel turn-policy
  routes, exact paused-state retention and input-boundary checks.
- Team: targeted **3/3** and full actual-host **77/77** passed.
- Pictures & Stories: focused case passed and full bundle/host **36/36** passed
  on Node 22.22.2.
- Scoped ESLint, Prettier and whitespace checks passed.

These are local automated results. A new pushed head requires fresh hosted
checks; this report does not relabel the earlier failed job or claim physical
controller or published-build qualification. The standalone package receipt at
`7341e3cdf` remains applicable to runtime/compiler bytes because this follow-up
modifies only tests and documentation.
