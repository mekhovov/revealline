# Historical Snake seed recovery

The required-test continuation found that `restoreClassicSnakeLegacyMatch` accepted only seed 17 and rebuilt every historical match with that seed. Valid historical v1 Solo, Versus and Team attempts recorded with another seed could not continue faithfully.

The adapter now takes the seed from the first fully verified board, requires every paired board to use that same seed, and reconstructs using it. Existing level, input-journal, elapsed-time and terminal-state checks remain intact. It does not rewrite recipes or grant imported progression.

Five new regression cases cover all three modes at seeds 0, 71 and the maximum uint32 value, fractional clocks, exported journals, Retry populations, mixed-seed rejection and changed input/level ownership. The broader gameplay/editor slice passed 89 tests on Node 22.22.2. Browser-realm wrappers, a refusal-message expectation, and Studio refresh/version fixtures were corrected to follow the current native contracts; no production rules were changed for those fixtures.

Physical-device restore and historical browser-engine differences remain separate qualification. The new phase manifest repeats this regression on subsequent clean feature-stack revisions.
