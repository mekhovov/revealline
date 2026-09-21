# Sentinel Field details wording

The actor description and repeated encounter summary said to capture one relay,
while authored multi-shield encounters require every listed relay. Both summaries
now say “every shield relay”. This remains true for a one-relay encounter. The
existing live instruction, which reports the actual captured/total count, is retained.
Only two display literals change; no state, score, collision, phase or release-cut
rule changes. Source base: `8cffb36b29a38013eb9213845efd675c4864c9d8`.

Source inspection confirmed the historical v1 gate uses its single objective and
the v2 projection computes all remaining IDs. A real engine/model inspection on
Node20.19.5 and22.22.2 covered the retained `sentinel-relay.json` first level and
the existing two-relay `sentinelProjectFixture`, compiled through the real project
compiler. Both produced the corrected summary without changing serialized run
state. The v2 actor description agrees with the live0/2 instruction.
`model-inspection.json` retains the Node20 output; Node22 produced the same rows.
The engine, source projection and fixture came from tracked source
`1d166dd69dc18fb19a06b918f100bd6aefc74e27`; the display model was this candidate.
This is a model inspection, not a browser, full-source-suite or device pass.

Syntax, formatting and whitespace checks pass. The change is isolated for a future
compatible release, without a version, PR or publication claim. Keep the newer
source projection changes when taking these two literal-only hunks into the
Sentinel programme. Existing live v1 instructions remain historically singular,
which is correct for their one-relay rule.
