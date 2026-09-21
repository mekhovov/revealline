# Scoped Team loading recipe review

This is a functional source review of the candidate based on290aeb7e. It does not accept a compiled theme or a public release.

Inspected the complete presentation host diff from the device baseline. Team images qualify only through five code-owned slot registries. They follow the existing bounded manifest validation, hash verification, decode/crop lifecycle and owner cleanup. The new retained manifest helper accepts only null or exact lowercase64-character SHA-256, constructs its own relative filename, and requires the matching caller pin. No arbitrary URL, latest-revision match or fallback to current artwork was introduced. Existing component CSS, operation status and DOM ownership bodies remain unchanged.

The original UI fingerprint omitted newly imported helpers. Added the retained-manifest helper and all five Team slot registries to the recipe inputs. Each now independently invalidates the UI review after changes; unrelated recipe groups retain identity. The expanded exact UI fingerprint is b31e970f9ca0b27a5229af8de276938bfc9c08f6954de1a6f4ac29b39a1d8b41.

Presentation-host, presentation-dependencies and visual-theme-lease suites pass39/39 each on Node20.19.5 and22.22.2. Coverage includes verified lazy dependency inventories, cancelled preparation, altered/missing retained manifests, no current-release fallback and preserved accepted owners after failed replacements. The real producer cohort passes9/9 each, adding all six helper-change fingerprint regressions to exact art/family/source checks. Early attempts failed because a sparse checkout lacked a tracked MP3 fixture and two modules; restored exact HEAD bytes and reran. No product code was relaxed to pass.

Raw/compressed receipts and source hashes are adjacent. Existing reviewed recipe records remain immutable. Actual ledger/compiled adoption, selected Team picture pins, full gates, original-byte/offline journeys, native rendered contexts, real devices, human playability and public deployment still require their own evidence.
