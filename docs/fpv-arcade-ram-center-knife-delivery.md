# Arcade ramming and centered knife

## Changes

New live combat definitions carry `contactModel: arcade-ram-v1`. With the Arcade ammunition preset, enemy-impact self-damage and enemy contact attacks cannot reduce the player's hull. Damage inflicted on enemies is unchanged. Enemy gunfire, deliberate explosive drone detonation and environmental aircraft failures retain their existing behavior. Balanced and Tactical retain their contact damage.

The contact policy is part of the immutable definition identity. Existing definitions without it keep their historical rules during Watch and recovery. Starting a new attempt from a companion selects the new policy. Studio validates the policy and preserves it through stable-ID reimport; applying new Studio rules selects the current policy. Arcade settings explain safe ramming in English and Ukrainian.

The cosmetic foreground knife is mounted on the nose centerline, pointing forward with no lateral angle. Its blade is now 235 mm long and 44 mm wide, up from 95 mm and 18 mm, with a raised faceted spine, larger guard/grip and two mounting saddles. It retains the existing independent visibility toggle. It adds no new damage, hitbox, camera or control behavior.

## Evidence and limits

- Syntax and diff-whitespace checks passed.
- Shared reaction runtime was regenerated from canonical sources and confirmed byte-identical by its projection check: 42 modules, 24 recordings, 1,357,398 bytes.
- Both local packages construct under unchanged policies. Academy: 145 runtime / 147 source files, 88,094 input bytes remaining. Worlds: 208 / 210, 513,173 input bytes remaining.
- Manual browser inspection uses production foreground geometry in a simple scene: landscape at FOV 82 and portrait at FOV 60, both at camera tilt 0. The larger blade remains below the central aiming corridor in those captures.
- [Landscape preview](evidence/fpv-combat/arcade-ram-knife-landscape.png), [portrait preview](evidence/fpv-combat/arcade-ram-knife-portrait.png), [package measurement](evidence/fpv-combat/arcade-ram-knife-package-measurement.json), [source identities](evidence/fpv-combat/arcade-ram-knife-delivery.json).

No automated suite or gameplay damage regression was run for this change. Physical-radio ramming, exhaustive camera/foreground combinations and full-game performance/HUD qualification remain pending. Package identities are local placeholders, not release evidence.

## Integration

Focused child of frozen #1801 (`d605f4e74e4ae9cb952d792704284decf78401a8`), above #1800 and #1799. Parent heads remain unchanged. Coordinate merge with Releases and its semantic reconciliation of the core SIM stack. Refresh the local SIM and start a new Arcade attempt to use the new rule; continued historical attempts retain their saved rules.
