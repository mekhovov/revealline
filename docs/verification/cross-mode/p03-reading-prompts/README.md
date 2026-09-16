# P03 reading prompt source checkpoint

Exact base `1f3b9995af43879d54fb7b0053846f0723e2e069`; narrow three-production-file successor documented in [reading input prompts](../../../reading-input-prompts.md). Source peers closed. This is model-only qualification, pending a separate native observation; it does not complete P03 or any release.

| Record                            | Result and meaning                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Initial one-case diagnostic       | 0/1: minimal DOM omitted native Enter button activation, so no reading prompt was reached. Fixture-only failure retained. |
| Corrected one-case baseline       | 0/1: actual reading entered; keyboard prompt still said South/East. Unchanged base production and all inputs verified.    |
| Final Node22 three complete files | 78/78, no failures, skips or cancellations.                                                                               |
| Final Node20 same complete files  | 78/78, no failures, skips or cancellations.                                                                               |

The final files are `controller-navigation.test.mjs`, `controller-reading.test.mjs` and `reading-prompts-host.test.mjs`. All230 inputs/7,404,401B and the semantic index were identical before and after both runs. The seven new actual-Solo-host cases preserve the simulation checkpoint and profile writes while checking keyboard exits, first-event modality switching, mapped controller Back and touch Done. Default adapter behavior remains covered by the complete inherited files. The two additional adapter cases check optional provider scrollability and refresh without focus/transitions or stale publication.

[The map](evidence.json) pins every exact decoded member of [the lossless ZIP](evidence.zip). Source-hold/diff, actual runtime binaries/runner, three input inventories, raw TAP logs, both baseline histories and source-peer scope are retained. Three guidance files were appended after tests; their tested original bodies are the explicit `tested-guidance/` members. Runtime and tests did not change after qualification.

Root's keyboard finding is the motivation, not native evidence for this successor. There are no screenshots or claims for pointer/touch hardware, physical controllers, viewport geometry, zoom, full-suite success, current P01/P02 integration or public acceptance here. Native button defaults are modeled explicitly; the production action handlers, reader lifetime and focus authority remain unchanged.
