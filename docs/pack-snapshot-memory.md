# Large campaign snapshot comparisons

When an ordinary pack is installed, the external-chapter host verifies that its stored pack pointer, descriptor index, recovery journals and backup lock have not changed. Serialized pack pointers include embedded originals. Encoding a whole snapshot again solely for equality produces additional large strings and can exhaust memory during multi-pack installation.

Compare each fixed snapshot field. Pack and index strings remain byte-exact: equivalent JSON with different whitespace is still a changed serialized pointer. Legacy object pointers retain canonical comparison, allowing key reordering but rejecting changed contents. Keep ownership copies, validation budgets, descriptor authentication, journal checks and single-use mutation reviews unchanged. No stored formats, simulation, saves or artwork identities change.

Verification must cover serialized and legacy object pointers, changed indexes and locks, journal recovery, cancellation, corrupt originals, atomic failure and caller mutation. Exercise ordinary Download & play with an existing large installed pack, preserving the current flight until readiness. Distinguish browser play from a modeled storage/image test.

The focused diagnostic previously exhausted a 512 MiB heap; with this correction its R5-to-Route-Choices installation completes under the same limit. A heap snapshot traced the longer optional-chapter file’s retained simulated pages to a separate download-fixture cleanup ownership bug. Its corrected full-file rerun remains pending. This optimization does not certify that entire low-memory suite, browser memory usage or the complete catalogue phase.
