# Journey v0.76 integration review

The composed pre-review integration at `3a6d62c55f42efc42fc0a8dc7ff520cc138b0bdb`
(tree `b4eb86901af3a92c24c46563564ca03a2ee836a6`) contains the current heads of
PRs 175, 186, 187, 190, 192, 196, 197, 198, 200, 201, 202 and 203. The three
manual conflict resolutions retain both the v0.70 navigation/recovery behavior and
the P08 visual-theme, pacing and Studio behavior. History-only merges for rebased
P03/P04 and the independently composed Studio navigation work do not change the
tree. Their source deltas are patch-equivalent or cumulatively superseded and the
combined navigation/Signal cohort passed 205 tests. The full focused integration
audit passed 259 tests.

The two post-P08 Studio corrections are included as exact patch equivalents. A
failed or subsequently changed crop can no longer stage stale prepared pixels, and
changing raster geometry creates a produced candidate with empty review evidence
instead of inheriting the parent's reviewed state. Their six-file cohort passed
46/46 on Node 20.19.5 and Node 22.22.2, with separate native before/after evidence.

## Reviewed production recipe inputs

The UI recipe fingerprint is
`fc427562ffe290787d78cf22cb0760dee8c9898a6bdfab8cd5c66a3a8f0b23c6`.
Independent exact-source review approves this fingerprint for the 24 UI recipe
slots. Shared DOM ownership retains separate layers even for equal values, preserves
the newest live application in either release order, restores the prior live layer
or original baseline, rejects stale stacks after external overrides, and rolls back
partial host application without retiring accepted resources. Manifest hashing,
replacement/cancellation, decoded-resource lifetime, CSS/attribute cleanup and
operation-status generation fences remain bounded. Supporting contracts are in
`docs/theme-adoption-corrections.md`, `docs/presentation-manifest-pins.md` and
`docs/verification/xposed-theme-integration.md`.

The effects recipe fingerprint is
`7f91a47de464c4c54195ad39b5945085954d3293afe59e28c24af2f1d43cdf13`.
Independent exact-source review approves this fingerprint for the 10 trail/effect
recipe slots. The renderer remains cosmetic and does not change simulation, clocks,
collision, replay or authored descriptors. Dashed warning and solid active cues use
two inks and cover the complete inclusive whole-cell trail-contact envelope, clipped
to board interior. The envelope agrees with both immediate contact and travelling
impact predicates across both axes, edge/interior lanes and widths 1, 1.2 and 2.
Functional emitter/carrier silhouettes remain distinct without color; uploaded
bodies stay below the cues and the true contact ring is restored afterward.

Independent review passed 75/75 primary and 65/65 direct tests on Node 20.19.5,
plus 33/33 primary and 43/43 direct tests on Node 22.22.2. The composed coordinator
cohort passed 96/96 on Node 20 and 96/96 on Node 22 before the metadata-only reviewed
successor. `produce-field-kit-theme.mjs --check` reproduced fpv37 with 293 slots,
131 files and zero missing assets before promotion. The successor must preserve
fpv37 and all earlier immutable records and payloads, update the exact Team theme
pins, reproduce byte-for-byte, pass readiness, and receive fresh hosted qualification.

This is functional source approval for these exact two fingerprints only. It is not
complete native-browser coverage, visual or original-art approval, human pacing or
fairness validation, screen-reader or forced-colour acceptance, physical controller
or device acceptance, audio/offline acceptance, Team mission completion, public
Pages acceptance, or deployment readiness. Any recipe source-byte change reopens
the corresponding group.
