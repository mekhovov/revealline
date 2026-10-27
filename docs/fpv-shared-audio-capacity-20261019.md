# Shared SIM audio capacity — 19 October 2026

This change is based on `ca6b308af394d55c0c0ef1d8e3a29d688e0aa5cf`, after
the six-helper shell projection change. It removes a second copy of the compact
audio sample bank from the generated Academy audio closure in
`sim-presentation.mjs`. The exact canonical bank is already an admitted source
input for Civilian Flight, Academy and World. No sound, help text, setting,
physics code, package path, file allowance or byte allowance is removed or changed.

## Source identity and initialization

`game/audio/human-reactions/portable.mjs` exports only `HUMAN_REACTION_BANK`.
Its 52,575-byte source has SHA-256
`2f2654e7c6d2bb83d9f1b9e4c139ba348f205a70350328816eb0b3f8161fa696`.
It has no imports and initializes one frozen bank of eight literal records, each
containing `mime`, `base64` and `duration`. Individual clip records are not frozen.

The source consumer, `world-audio.mjs`, reads `clip.base64` and allocates fresh
bytes for decoding. Decoded buffers, audio contexts, voices and scheduling state
remain owned by each audio factory instance. World’s existing generated reaction
runtime also reads the canonical bank in the same way. No current consumer
mutates the bank or its records. Sharing the data does not merge audio instances,
change samples, alter decoding or introduce a dependency cycle.

The Academy generator now imports this canonical module as an explicit external
dependency. The remaining **12 private module bodies** and their factory-local
state retain their canonical declarations, import bindings and exports. The
generator checks admission of both its external modules in all three host
policies. A source-shape guard rejects additional statements, executable clip
values, mutable bank declarations or changed exports before output is written.
Changes to the current eight-record format require a reviewed guard update.

## Exact original-input accounting

The [JSON receipt](fpv-shared-audio-capacity-20261019.json) binds **243 unique
original input paths** by before/after size and SHA-256. Only
`sim-presentation.mjs` changes within those package input sets. It changes from
**650,712 to 597,930 bytes**, saving **52,782 bytes**. The generated audio section
is 69,763 bytes after regeneration. Its prior 52,711-byte duplicate bank IIFE
and embedded source-hash entry are replaced by the admitted external binding.

| Package         | Input count | Before input bytes | After input bytes | Input allowance | Remaining input bytes |
| --------------- | ----------: | -----------------: | ----------------: | --------------: | --------------------: |
| Civilian Flight |          89 |          4,951,975 |         4,899,193 |       8,388,608 |             3,489,415 |
| Academy         |         142 |         13,301,512 |        13,248,730 |      13,303,808 |            **55,078** |
| World           |         202 |         19,791,766 |        19,738,984 |      20,971,520 |             1,232,536 |

These are exact original-input sums at this source, not a new complete package
build or a qualification of the separately developed R11 interface. Input sets
follow the existing package builder, including original EN/UK locale files and
worker/launcher templates. The policy is unchanged and separately hash-bound.
The release integration must repeat package qualification on its combined source.

## Validation

Node 20.19.5 passes **14/14** focused tests: six new audio projection checks and
the existing eight shell pruning checks. The new checks verify:

- Existing canonical admission in all three packages and absence of duplicated
  sample payloads in the generated module.
- Exact canonical ASTs, source hashes, import bindings and exports for all 12
  retained private audio modules.
- Real generator reproduction, including preservation of surrounding native code.
- Failure before writing when any host loses canonical admission, the sample
  module becomes executable/stateful or changes shape, an unadmitted dependency
  appears, or generated markers are malformed.

The generator’s `--check`, scoped ESLint, Prettier and `git diff --check` pass.
The receipt records the local test log and its hash. No native/browser flight,
audible listening or performance gate is newly claimed by this source projection
change. All canonical samples and audio source implementations remain unchanged.

Independent read-only review reproduced all six projection tests, verified all
243 input hashes and exact package sums, and confirmed that native source outside
the generated audio section is byte-identical. It found no blocking issue.
