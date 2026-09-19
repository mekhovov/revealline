# Publisher preparation originals

The original sparse-check attempt passed 42 of 43 tests on each Node version and all four Python tests. Its sole Node failure was a missing exact-base `game/presentation/page-entry.mjs` fixture, retained in the original output. Hydrating that 2,745-byte tracked entry changed no implementation or test; the complete 43-test cohort then passed on both Node 20 and Node 22, with all four Python tests passing.

All 90 metadata chains use the production validator. The current source and changed Archive26 admission pass local filesystem validation. The 959 prior metadata/evidence bodies were rehashed from the exact base Git objects, without duplicate hydration. Full original-payload assembly remains the hosted preview gate. [Original ZIP](originals.zip) and [member pins](originals-index.json) retain both attempts and the bounded checks.
