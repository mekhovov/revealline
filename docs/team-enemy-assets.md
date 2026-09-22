# Team enemy state artwork

Five optional 32×32 transparent body slots extend the shared presentation framework:

| Slot                         | Actual core state | Inspection scene |
| ---------------------------- | ----------------- | ---------------- |
| `team.enemy.drifter`         | Active drifter    | Initial field    |
| `team.enemy.hunter.patrol`   | Hunter patrol     | Initial field    |
| `team.enemy.hunter.warning`  | Hunter warning    | Hunter warning   |
| `team.enemy.hunter.charge`   | Hunter commit     | Hunter charge    |
| `team.enemy.hunter.recovery` | Hunter recovery   | Hunter recovery  |

Both starter arenas support these scenes. Recovery is command-earned at tick432 in First Connection and502 in Relay Yard: continue the established charge trace with released commands, allowing the real threat clock to finish. Never write a phase into a specimen or infer behavior from artwork. A scene may contain multiple states simultaneously; the Studio reports how many actors actually use the selected image, inheritance, inactive states or victory concealment.

`team.enemy.v1` explicitly inherits `enemy.bouncer` for drifters and `enemy.border-patrol` for hunters. This is image reuse, not a behavior/type conversion. Historical absence preserves the existing shared body. A declared custom image must be prepared, decoded and valid before painter adoption. Exact32×32 frames, bounded pivot and optional rotor geometry remain cosmetic; all contact centers, warning lines, CHARGE/RECOVER labels, Support slowdown cues, target selection, collision and phase timing remain game-owned.

The shared release host prepares all40 currently registered Team image slots. The allowlist is explicit; an arbitrary `team.*` name does not authorize loading. Studio upgrades append immutable asset/theme revisions and can be undone. Native previews of inheritance show the actual shared raster. Team-only bodies reject a misleading Solo/Versus field preview and offer Team or Native size instead.

## Authoring and qualification

1. Add missing Team presentation slots to the local collection.
2. Select one role/state and upload an original transparent32×32 PNG. Record creator, rights and effective prompt. Inspect native size, enlarged pixels, pivot, optional rotors and readability at playing scale.
3. Select Couch Team, each arena and the matching scene. Compare saved/draft; verify warning/phase/Support cues above the image in normal and reduced effects. Use Play preview to inspect real transitions, with no added mechanics.
4. Save/reload and verify byte-preserving export/import and history. A download-request status is not evidence of a file reaching the device; verify actual transferred bytes.
5. Compile and load through the release host; verify exact decoded revisions and painter selection. Missing required custom imagery must retain the accepted presentation while showing recovery.

Recipe coverage and geometric QA candidates do not constitute reviewed production artwork. Ordinary game routes, complete source gates, frozen/public bytes, input/device checks and offline acceptance remain release requirements. No campaign identity, save, score or simulation schema changes are introduced.
