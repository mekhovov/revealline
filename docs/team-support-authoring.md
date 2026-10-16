# Editable Team Support presentation

`team.support.pulse` accepts a centered transparent 64×64 decoration; `team.enemy.slowed` accepts 24×24. Both also accept the shared `team.support.v1` recipe. These are cosmetic Team effects. Radius, cooldown, duration, slowdown, rescue priority, geometry and collision remain simulation-owned.

## Workflow

1. Open Studio and choose **Add Team presentation slots** on an older workspace. Missing anchor, core and Support contracts are added in one undoable revision. Existing selected artwork and historical records remain unchanged.
2. Search the exact slot ID. Inspect **Field context → Couch Team → Support pulse** in First Connection and Relay Yard. Initial field must report zero active pulses/slowed enemies. Paused and Reduced effects hold the real command-earned state; Play preview advances actual timers.
3. Upload a sparse, transparent image at the slot's exact size. Keep the pivot centered, omit text/backgrounds and enter true creator/source/rights. Validate, stage and inspect Native size, transparency and context. The pixel editor remains available.
4. Save, export the actual `.rltheme` file and re-import it. Verify original bytes and history before release adoption. Undo reverses a draft import; browser upload alone does not change public assets.

Pulse decoration is clipped inside the existing six-cell radius, underneath actors and functional labels, at opacity 0.28 or 0.18 with reduced effects. The game retains the range ring and adds four stationary ticks for registered treatment; it does not introduce a scanning sweep. Slowed decoration is bounded to the existing 1.76-cell ring and opacity 0.5; the ring and SLOWED label remain visible above it. Inactive effects are not drawn. Historical themes without bindings keep their original treatment. Invalid advertised frames are rejected before adopting a new painter snapshot.

## Evidence boundary

Nine complete test files pass 105/105 on each Node 20/22. Coverage includes actual support traces in both arenas, active/expired states, immutable upgrades, historical absence, malformed images/recipes, failed-adoption retention and original-byte bundle round trips. Initial roundtrip assertions compared Buffer and Uint8Array prototypes despite identical bytes; normalizing both arrays fixed the test without changing production validation.

Native verification uses original geometric QA PNGs, real uploads and saved workspace history. Such fixtures are not approved art. Production Support artwork, rescue/recovery/emitter roles, full P04/P08 acceptance, physical input qualification, release gates and public deployment remain separate requirements.
