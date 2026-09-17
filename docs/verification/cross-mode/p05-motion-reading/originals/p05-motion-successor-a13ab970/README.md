# Motion Lab: reviewed startup and reading candidate

17 September 2026. **Scoped modeled candidate, not a released or natively accepted feature.** Based on exact `a13ab970222498d7c5fa7f62f9fc04fe436979d5`, tree `cf744b1ced9680b2fb4e0c304ddfc4b9f44b3e86`. Package/build version stays 0.60.3. The release owner allocated only this isolated Motion lane; Recovery, browser, source worktree, index, remote, versioning and active release remain separate.

The [preceding source audit](../p05-motion-audit-a13ab970/README.md) and [held Motion/Recovery packet](../p05-motion-recovery-170508f1/README.md) are preserved. This successor adopts only Motion changes and reconciles current copy/build/skill files instead of applying the combined packet.

## Implemented behavior

- One independent display authority and explicit shared size writer reach DOM and canvas labels. Local effects intent remains separate from shared/system reduction. Preference changes preserve real loaded art, local background, selected study values and running/paused intent in the composed host cases.
- The study fieldset begins disabled and the canvas inert/outside Tab order. Only validated successful setup releases the parent lock. Existing Clear, locked Equip and disabled ability state remain under their original owners. Independent Text size and return navigation stay available during startup/error.
- Real launcher Reload retirement transfers only its still-owned foreground focus to Text size. Earlier/newer navigation ownership, hidden/unfocused pages and terminal departure prevent the transfer; no deferred autofocus runs on return.
- A single owned animation request resets its clock on interruption. Cached departure stays paused until explicit Play; terminal departure fences initialization, handlers, observers and pending images/background ownership. Source algorithms, recipes and original art remain exact committed inputs.
- Immediate and cancellable next-task history repair reads the current preference snapshot. Browser-restored selector values cannot save preferences or erase unsaved intent/warnings. Generation, away and disposal checks reject stale callbacks.
- Updated the Motion guide, Animation Director skill and runtime-maintainer skill with contracts, copyable prompts and acceptance limits. Added only Motion copy keys and three required helper build entries, preserving newer shipped keys, helpers and version.

## Evidence and corrections

| Check | Result | Evidence |
| --- | --- | --- |
| Complete scoped cohort, Node 20.19.5 | 145/145, 13 complete files, concurrency 1, 1024 MiB, no timeout | [receipt](runs/node20-final/receipt.json), [log](runs/node20-final/output.log), [inputs](runs/node20-final/inputs.json) |
| Same cohort, Node 22.22.2 | 145/145, same 81 pinned inputs, no timeout | [receipt](runs/node22-final/receipt.json), [log](runs/node22-final/output.log), [inputs](runs/node22-final/inputs.json) |
| Scoped source checks | Explicit 16-path formatting, changed game-module lint and changed JavaScript syntax pass | [commands and outputs](runs/scoped-source-checks.json) |
| Patch applicability | All 16 exact preimages checked; patch applies and reproduces all candidate bytes in a temporary directory | [candidate pins](candidate-pins.json), [patch](candidate.patch) |
| Dependency integrity | 65 unchanged inputs match exact a13 Git; 81 total inputs, 1,719,559 bytes, including one exact 644,588-byte body PNG | [final input pins](runs/node22-final/inputs.json) |

The 13-file cohort includes all six existing Motion algorithm/steering files, the complete direct-tool launcher/loading and shared-preference files, 22 composed Motion host cases, seven history-owner cases, two frame-loop and two renderer cases. Ten host cases exercise the actual classic launcher and real application through modeled module delivery. Slow module transport, module failure, preset wait and preset failure are distinct cases. No name filtering or substituted product bodies is used.

Preserved iterations:

1. Initial formatting invocation from the repository root was ignored by the cache path rules; the empty [log](runs/root-format.log) is retained. Explicit relative paths, pinned configuration and an empty ignore path actually formatted the candidate; the final explicit check passes.
2. First Node22 run passed 144/145; unchanged `test-motion.mjs` asserted existence of a body PNG omitted from the finite text closure. [Original log](runs/node22-first/output.log), [input pins](runs/node22-first/inputs.json) and [correction](runs/node22-first/correction.json) remain. The one exact committed 644,588-byte PNG was added, with no placeholder or assertion edit; the [corrected precursor](runs/node22-corrected/receipt.json) passed 145/145.
3. Review found that keeping `aria-busy=true` on a permanently locked failed study was misleading. Removed this redundant attribute and setter; the disabled/inert gate and existing live operation status remain authoritative. Both final runs include this correction.

The source-check record is scoped, not a substitute for all six repository release gates. The complete build-coupled `field-kit-surfaces.test.mjs` requires the full asset/build tree and remains release-owner work; this lane deliberately did not copy broad build assets. The optional generated `native/bridge.mjs` referenced elsewhere in the finite dependency graph is not present in exact Git and is not exercised by this cohort.

## Blocking acceptance still open

- Integrate on the latest reviewed source, reconcile any new shared preimages, select related hunks, synchronize the next unused release version, commit, and run the full six source gates plus ordinary build, production/readiness and artifact checks.
- Real browser: actual delayed/failed module and preset delivery; native focus and next-Tab after Reload; foreground/inactive completion; cold/live reading; real history form restoration separately from BFCache admission; explicit Play, held input, static background replacement and terminal cleanup.
- Layout/reading: actual shipped EN/UA fonts, Theme/Plain, Standard/Large, 200% zoom, portrait/short landscape, 44px controls, canvas label clearance and focus rings. The new tests model disabled/inert/focus boundaries; they do not measure native geometry or font rasterization.
- Inherited canvas long-label clipping remains: horizontal shifting does not fit text wider than the 48-unit stage. Renderer tests establish font minima, finite coordinates, unchanged label content and stage commands, not complete bounds/overlap/contrast.
- Imported GIF/WebP/APNG backgrounds need an explicit animated-input/reduced-effects policy and native fixture. Preserving an image source does not prove it is static.
- Browser, physical input, performance, public/offline journeys and immutable release/public byte verification remain separate. No full P01/P05/P16 or full-game acceptance follows from this candidate.

No broad artwork, content, gameplay or release changes are included. Original supplied references and unrelated workspace changes remain untouched.

## Research informing the contract

[MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) describes one-shot scheduling and typical hidden-tab suspension; the app still needs owned cancellation and clock reset, but this source alone does not establish hidden-tab CPU usage. [MDN pagehide](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event) distinguishes lifecycle/cache considerations; a modeled persisted event is not actual cache admission. [W3C logical focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) supports an operable startup handoff without mandating this particular destination.
