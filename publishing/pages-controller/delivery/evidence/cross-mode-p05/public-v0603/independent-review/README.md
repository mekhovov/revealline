# Independent v0.60.3 public-audit preparation review

**PASS for preparation; no actionable kernel regression found.** All nine helper before/after pins and source/catalog/retention inputs were rehashed. Five kernels are unchanged; four differ only in the documented source, tree, version, catalog and fixture-count literals. Existing failure retention, retry limits and explicit reviewed-input guards remain intact. This review made no requests and ran no tests.

`intake-request.pending.json` is a cache-only, unreviewed template. It now pins the actual published release original: release 390725431, v0.60.3, published 2026-09-17 13:22:17 UTC, with all nine reviewed asset descriptors matched. Publisher/run/deployment/status/artifact/observation fields intentionally remain null. Do not execute it or promote it before actual originals are reviewed.

## Required inputs after the publisher is known

1. Retain actual main publisher commit and tree; separately verify the merged source tree remains `cf744b1ced9680b2fb4e0c304ddfc4b9f44b3e86` for frozen source `a13ab970222498d7c5fa7f62f9fc04fe436979d5`.
2. Use the existing failure-retaining observer once the sole actual Pages run is known. Retain its successful original run, jobs, artifacts, main/commit, deployment and latest status. Do not guess IDs, reuse predecessor IDs or dispatch another deployment.
3. Fill `controllerCommit`, `controllerTree`, `runId`, `deploymentId`, `latestSuccessStatusId`, and a unique `outputLabel` from those originals. Set `receiptArtifact` to exactly `{id, bytes, sha256}` from that run's nonexpired `frozen-pages-receipts` artifact; preserve the below-10-MiB limit. Pin the observation as `{path,bytes,sha256}` relative to the audit directory.
4. Root reviews the complete request and writes its separate `reviewed:true` successor plus exact SHA. Only then run the existing intake helper. Its output is still an **unreviewed** binding.
5. Review all nine intake originals, every previous 73 catalog row and the sole new v0.60.3 row. Compare the Archive03 admission exactly with `retention-expected/publication.json`, allocation SHA `26c1006f…a89414`, all 17 unchanged other admissions, and the six retained Archive03 pins plus ten appended pins. The kernel's broad catalog check is not a substitute for this single-new-row/retention review.
6. Root separately authorizes the resulting binding SHA. Use actual receipt inventory counts/bytes in the optional orchestration template; keep its sentinels until then. Run the check, full streamed audit, row reconciliation, post-audit observer and separately reviewed authority refresh in the existing order.

No Production/Viewport public URL is inferred: these two authoring tools are absent from this release's build inclusion list. Their source/local native evidence remains separate.

## Minimal genuine public browser smoke

These are proposed checks, not observed results or whole-phase acceptance.

- **Delivery and title:** enter the actual deployed main game and canonical `releases/v0.60.3/site/game/` route. Record visible version/title and route. Confirm keyboard focus reaches Start/Continue, Missions, Settings and Release explorer without a mouse-only boundary.
- **Solo continuation:** use Start or a genuinely existing Continue, make a short cut by ordinary direction input, and check capture-stop. Pause → Settings/Back → explicit Resume must preserve the run and not resume on focus return. If a saved session is part of the check, create it through actual UI and retain its observed state; do not inject progress.
- **Public supporting route:** open the advertised Playground or Controller practice route, then return with the offered Back action/browser history. Confirm the player destination and shared readable display preference persist. This is a small unchanged-route regression check, not public evidence for local Production or Viewport.
- **Couch entry/return:** from the title enter Couch Team, verify its actual setup and return to Solo through the visible action. If a current Solo run prompts Stay/Leave, exercise Stay first to confirm ownership, then make an explicit departure. A real Team win is outside this minimal delivery smoke and must not be manufactured to close the pending terminal gate.
- **Retention navigation:** follow Release explorer to v0.60.2, confirm its archived title, then use its Release explorer to the main catalog and browser Back to the original archived title. Preserve that cross-origin route and version evidence; historical gameplay evidence is not relabeled as current.

Keep actual touch/controller hardware, zoom, audio listening, browser offline recovery and full P03/P05 acceptance open unless separately exercised. The complete HTTP audit verifies byte delivery; this small browser journey verifies usable entry, navigation and a short real flight only.
