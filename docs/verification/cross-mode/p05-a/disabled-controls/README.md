# P05: distinguish unavailable Couch actions

The Couch surface rule previously overrode the shared disabled palette, leaving
Start yellow during required picture loading. This CSS-only correction restores
muted text, the panel background and a dashed border after page-specific primary
and hover styles. Native disabled semantics, layout, focus and game behavior stay
under their existing owners. Primary-action hierarchy remains later P05 work.

The real desktop browser served exact P08 candidate `1da77ee` with only the held
surface CSS overlaid. A labelled HTTP fixture delayed the exact Orchard PNG by
eight seconds; it changed neither picture bytes nor game state. The three retained
observations show disabled Start, enabled Start after readiness, and explicit
Start followed by Pause. Both appearances measured 48.5 CSS pixels high.

The predecessor observation is preserved in P08's native-intent evidence. This
check does not certify every device, zoom, controller or P05. The [verification](verification.json)
records exact source and original screenshot hashes; [events](events.json) retain
separate accessibility and DOM observations. [Disabled](disabled.jpg) and
[ready](ready.jpg) are original browser screenshots.

CSS formatting and whitespace checks pass. No implementation-mirroring tests were
added for this reversible styling change. Independent source review checked the complete loaded style cascade. Related
text hunks and exact binary screenshot hashes were reviewed before staging. Integrated source qualification,
versioning and public verification are still required before release acceptance.
