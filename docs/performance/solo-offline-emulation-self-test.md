# Bounded native offline-emulation attribution

The fourth installed-Starter comparison stopped before Start because `navigator.onLine` was true. Unlock, remembered access, service-worker control, hash/CSP-checked offline documents and public boot all passed. This narrows the failed admission to the browser automation state; it does not prove a game defect or excuse the unchanged offline assertion.

The exact observer creates a second CDP session, enables `ServiceWorker`, and later reads storage quota. It never calls `Network.enable`. Pinned Playwright 1.62.1 internally enables the network domain and uses `Network.emulateNetworkConditions` to implement offline contexts. A second session's effect on native navigator state remains a hypothesis. [Pinned implementation](https://github.com/microsoft/playwright/blob/v1.62.1/packages/playwright-core/src/server/chromium/crNetworkManager.ts). The protocol separates request-condition emulation from explicit navigator state in its newer methods; that does not establish which command caused the retained failure. [Native protocol](https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-overrideNetworkState).

The first workflow was declared for the reviewed push after `1ccf8368a3dcd099e1608c8a9433e6f0c0518e8f`. It ran pinned Playwright 1.62.1 / Chromium 151.0.7922.34 on Linux with a headed display. It downloaded no game package and started no HTTP server. Each of three branches had a fresh owned persistent profile:

1. Record native `navigator.onLine` immediately after `offline: true` launch, auxiliary CDP attachment, the existing `ServiceWorker.enable`, data-document navigation and auxiliary-session detachment.
2. Repeat in an independent profile, adding `Network.enable` only after retaining all three original stages. This is a counterfactual control, not a claim that the game observer sends that command.
3. Repeat independently with explicit `Network.overrideNetworkState(offline: true)` after the original stages, then inspect navigation and detachment. No JavaScript property override is used.

True and false values are retained as observations. Completion requires every stage and clean process closure; it grants no offline gameplay, performance or first-eight qualification. Failures retain completed stages and have no automatic retry. The common process owner enforces a 120-second command deadline, 2 GiB aggregate RSS and 4 MiB output limit; each ordinary operation has 5 seconds and each launch 15 seconds. Profile scratch is capped at 256 MiB / 5,000 members with a 512 MiB free-space reserve. Evidence is bounded to 1 MiB per JSON report. Fresh profiles are not reopened and remain on their exact hosted owner until job teardown. Source and executable version are recorded; the workflow edge is single-use.

This experiment isolates the automation commands before considering another installed-game comparison. The existing game admission, selected Starter recipe, server-off negative probe, cache checks, ownership, timeouts and profile-preservation requirements stay unchanged.

## First native result

[Run 38998342776](https://github.com/mekhovov/revealline/actions/runs/38998342776) completed at source `c9e637ad81fadf49caec884155d1bd0c2496c59c`. All three branches closed their native contexts and the process owner closed with exit zero, no forced cleanup, ambiguity or survivors. The actual browser and Playwright versions matched their exact declarations.

| Fresh-context branch   | Initial launch | Auxiliary attached | Worker enabled | Optional control | After navigation | After detach |
| ---------------------- | -------------- | ------------------ | -------------- | ---------------- | ---------------- | ------------ |
| Existing observer      | false          | false              | false          | —                | true             | true         |
| Network.enable control | false          | false              | false          | false            | true             | true         |
| Explicit state control | false          | false              | false          | false            | true             | true         |

Each value is the unmodified native `navigator.onLine`. The change first appears after navigation in this sequence. Attachment does not immediately change it, and the tested pre-navigation state override does not prevent it. All three branches included an auxiliary session, so this experiment does not yet distinguish general navigation behavior from auxiliary ownership across navigation. It establishes neither a game defect nor a working harness correction.

A primary-source audit found a matching Chromium defect: commit `944ae0fbc7b6d3e384725c7744042fa948464bec` adds persistence and restoration of network state across cross-process or cross-document navigation, with native same-origin and cross-origin regression tests. [Upstream fix](https://github.com/chromium/chromium/commit/944ae0fbc7b6d3e384725c7744042fa948464bec). The exact `151.0.7922.34` tagged renderer source applies the state directly to the notifier without storing those fields, and its `Restore()` does not restore them. [Exact tested-version source](https://github.com/chromium/chromium/blob/151.0.7922.34/third_party/blink/renderer/core/inspector/inspector_network_agent.cc). This supports a browser-emulation cause for the observed state transition. It does not establish that a particular workaround works, that transport is offline, or that the game passes. The V2 native observations remain required, and the browser version stays pinned throughout the declared comparison.

Artifact `12088525085` is 6,027 bytes, SHA256 `4a14f68bee855572118bee50e6543c513a798fbbc5a7c0ffa8bc2251d1d8dc3b`. All five members (36,037 bytes) passed CRC, hash and local readback checks. The admission's two tool hashes match their exact committed source. Raw reports, closure, admission and inventory are retained under `.cache/solo-followup/remote-offline-emulation-38998342776/diagnostic-retained/`; the independent analysis is 3,285 bytes, SHA256 `a16bd6ab88bded6e8b9250b76e546c22094af32ec472608a6269cd5bd01e0874`. V1 remains supported and its retained report still passes the unchanged diagnostic-completion contract.

## Declared navigation successor

A separate one-shot workflow is declared after `c9e637ad81fadf49caec884155d1bd0c2496c59c`, using explicit `--navigation-controls` and `SoloOfflineNavigationEmulationSelfTestV2`. It has three new, independently owned native profiles:

1. No auxiliary CDP session: sample initial launch and two distinct data-document navigations.
2. Combined pre-navigation control: sample attachment, worker observation, `Network.enable` and a real state override on the same session; sample both navigations and detachment.
3. Post-navigation ownership control: keep the original observer session, sample the first navigation before overriding native network state on that session, sample again, repeat for the second navigation, then sample detachment. No fresh hidden session is created to make the observation pass.

The original source/browser identity, 120-second command, 5-second ordinary operations, 15-second launches, memory, scratch, evidence and closure limits remain unchanged. Every native boolean, document URL and ordered stage is retained; a completed true-state observation is a valid diagnostic result, not an offline acceptance. The artifact has the distinct `solo-offline-navigation-emulation-` prefix. There is no automatic rerun or game cohort.

The V2 workflow has a 17-minute overall job limit: its unchanged individual step bounds total 15 minutes, with two minutes reserved for job initialization and post-job closure. This prevents the overall timer from consuming the existing evidence-upload and cleanup opportunity when earlier steps approach their bounds. The native command and every operation/admission threshold remain unchanged.

The native protocol separates request emulation from navigator-state control. A successful post-navigation `overrideNetworkState` would establish only that native state observation. It would not establish offline transport. Any later game comparison must retain Playwright's offline transport setting, the stopped-server negative probe, exact service-worker responses, cache/hash/CSP witnesses and the unchanged public-gameplay admission. [Protocol distinction](https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-emulateNetworkConditionsByRule).
