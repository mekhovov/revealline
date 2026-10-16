# Installed region names and revisions

The connected Harbour and previous Coastal Districts intentionally retain the same
terrain manifest title. Native review at the exact 68d5 package initially made
both flights appear to be the old world. A read-only production Library selector
confirmed that each card loaded its own exact descriptor SHA and distinct source
assets. The ambiguity was presentation, not source selection.

The normal installed Library callback now supplies the verified descriptor to the
regional presentation adapter. Pause shows its localized name, and the collection
line includes the installed revision. The source manifest, physics, exact cache
lookup, recording identities, start and arming behavior are unchanged. Review-only
entries and older adapter callers retain their manifest-based presentation.

`node authoring/fpv-worlds/regions/verify-installed-region-title.mjs` checks the actual
old/new paired manifests, EN/UK names, exact identity retention, source immutability,
invalid presentation metadata rejection and initially disarmed production sessions.
The saved-location production regression and scoped ESLint also pass. No new
native browser verification of the corrected label is claimed here.
