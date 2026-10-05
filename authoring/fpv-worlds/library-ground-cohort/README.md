# Library cohort for supported ground movement

Players with actor `groundMotion: 'support-v1'` and surface-coating support
request `published/ground-motion-v1/index.json`. The readable Library endpoint
and dedicated worker accept the same fixed first-party URL. Their checked
generated projections carry the change; all other request, hash, cancellation,
installation and service-worker behavior remains unchanged from the current
P1 parent.

The new feed copies the complete eligible surface-coating catalogue byte-for-byte.
Its sole row is Mountain Reservoir r16, already published through #1094: immutable
commit `ea57d2e321896ab873c2ca6ca06791a88362a674`, pack SHA-256
`50ffbb0e5da7dec94862a8f2ca85cfeb60542d3fe9f86bd3c4e288dfa0a2e554`,
1,379,988 bytes and eight courses. Both older feeds remain byte-exact. No Harbor
or Festival row is added; their catalogue publication gates remain separate.
Proof archives still require an explicit import, and changing the endpoint does
not update a cached player. See [the catalogue contract](../published/README.md).

The cohort commit was rebased from preserved `a7e2a0127` onto the current P1
ground-motion and Harbor parent `781842147c6a906867cee5dbee86f2b365115edc`,
then onto final Harbor `c958e5e13d0357e46b9a2c489802708adcdc05d8` after
the ground parent's admission evidence was committed. All 105 runtime input
bytes remain exact across that final cascade; `a95bd5207` is retained under
`codex/fpv-ground-cohort-before-final-harbor-a95`.
Readable source differs only by the endpoint and its comments; the worker and
reaction projections were regenerated using the parent's existing tools. The
old feed files, Harbor content, package policy, limits, licenses and dependency
paths are unchanged.

The manual source contract compares current committed parent bytes with the
fresh ground `328f4c537` admission inventory, then checks the candidate's 105
input paths. It exercises the retained historical serialized worker, the current
P1 parent worker and the new worker against their respective fixed endpoints,
immutable pack URLs, digest checks and request limits. These are Node checks with
an in-memory worker scope and stubbed responses, not native Worker, HTTPS, UI,
storage or offline observations. The parent admission does not admit the changed
cohort endpoint. Fresh cohort full validation, all-three/two-build admission and
native qualification remain pending.

The P1 source contract passes 57 checks, and the two existing offline lifecycle
and native-control suites pass all 31 checks. Projection checks, scoped lint,
formatting and diff checks pass. The candidate measures 16,981,607 bytes across
105 inputs, leaving 3,989,913 bytes under the inherited 20 MiB limit. Only the
reaction projection (−18 bytes) and worker projection (−2 bytes) differ from
ground admission `328f4c537`; the policy still yields 112 Worlds members. This is
a source measurement, not admission of the candidate.

The earlier 40-check source receipt in `evidence/source-contract-r3.json` belongs
to the pre-P1 95-input, 16 MiB policy and empty-feed candidate. Its initial JSON
whitespace failure is retained separately. Those historical results do not
qualify this P1 integration, its inherited 105-input/20 MiB policy or the populated
feed.

The native follow-up must use exact admitted old/new players and genuine workers
to prove endpoint isolation, immutable downloads, cancellation/retry and retained
packs, drafts, recordings and recovery during P1 runtime removal/reinstallation.
The selected pursuit guide belongs to its current host. The stopped-origin check
then uses the unmodified admitted entry and explicitly saved edits; an unsaved
in-memory draft is not a promise of reload persistence. Root owns the browser
and origin stop/restart. Actual public availability of the new feed remains a
separate publication observation; no device-wide outage or performance claim is
planned.
