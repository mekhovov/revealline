# Phase 6 controller integration

This branch merges corrected P6 source `3d39907498cabd7491cdf643a5a7de64318f990f` (v0.50.0) onto P5 controller integration `c75ad35d7b0eaf522fb87a22a1adb30318c96ff1`. It preserves the accepted main actor/touch controls, explicit body and skin priority, and the Guide → Workshop → title return stack. P6’s categorized Settings retain the single main Steering hand selector and its help/status fields inside Controls; the obsolete duplicate touch-side control stays removed.

The production ledger starts from the verified integration revision 9, which already contains every frozen P5/P6 record and body, and reproduces this tree’s P6 desired inputs into immutable revision 10. Prior selected revisions and source identities are retained. Current source fingerprints reflect the merged actor renderer and P6 surfaces; budgets and slot contracts are unchanged. P7 changes are not part of this branch.

Controller qualification is distinct from frozen release identity. Existing tags, frozen manifests and released bodies remain unchanged. All six gates and production reproduction run against this exact branch commit after push, with local focused results recorded in the handoff.
