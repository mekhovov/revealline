# Native menus: decisions for the next release

Reviewed **1 October 2026, Europe/Berlin**, against main `955c539a757c08c534c9038500785b20e64abb36` and current owner reports. This is a decision guide for the user, not approval to remove requirements or start new implementation. The [current roadmap](native-menu-roadmap.md), [September 30 baseline](native-menu-roadmap-2026-09-30.md) and [evidence ledger](native-menu-plan-status.md) retain scope and recorded evidence.

**Recommendation: finish reliable player entry and save safety, bring one visible background improvement forward, and defer exhaustive creator/reference coverage.** This better serves the original landing-page request than spending the next batches on historical galleries.

## Understand the status before choosing priorities

**Implemented** means code/art exists. **Browser-checked** means a named workflow worked on a recorded build. A simulated controller is not a real pad, and a phone-sized desktop window is not an iPhone. **Device-checked** requires the real device/runtime. **Delivered** means the intended build reached its destination; deployment success still needs relevant behavioral checks. A missing check means uncertainty, not proof that a feature is broken.

The existing [delivery instruction](delivery-priorities.md#current-instruction--29-september-2026) defers extended production/device review and puts the formal human study last. The [current policy](../publishing/test-policy.json) waives automated suites. This review recommends future priorities without lifting those decisions. Independent source work continues; deferred checks remain **not passed**. Restoring suites or changing the approved audience/review policy requires a separate reviewed decision. Build, identity, provenance and publication safeguards remain applicable.

## Progress since the previous report

| Area             | Completed implementation or bounded evidence                                                                                                                                 | What that does not prove                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Landing/Settings | Shared compact menus, supported mode names/icons, Start/Continue, mission selection, Sound, Fullscreen and eight Settings categories. The landing correction #854 is merged. | Current public behavior on every supported route, especially after later changes.                                                          |
| Branding/type    | FPV / LINE, DroneAid / LINE and canonical public slug, common pixel icons, Departure Mono with Ukrainian glyphs, Plain/Large preferences.                                    | Every installed-app icon/name or every Ukrainian screen is accepted.                                                                       |
| Navigation       | Directional groups, focus restoration, modal ownership, field editors and many meaningful local keyboard/virtual-pad journeys.                                               | Physical controller, reconnect, native wrapper and every embedded-preview path.                                                            |
| Community        | **New:** the directory now uses shared launcher navigation, preserves return destinations and is linked inside Settings in all three modes.                                  | The prior missing-owner source gap is closed; real-pad/failure and installed-app evidence remain separate.                                 |
| Updates/offline  | **New:** Check for updates exists in Settings. Desktop packaged-browser updates preserved an actual flight and reopened it after the game server stopped.                    | First upgrade of an existing iPhone Home Screen app, every outbound host disconnected, process restart or cross-version migration.         |
| Backgrounds      | 18 scene profiles and ambient motion/static fallbacks; all four base worlds have distinct Versus/Team compositions in both orientations.                                     | Fully layered actors, most independent Solo portraits, four newer edition scenes or representative phone performance.                      |
| Tools            | Many core editing, cancellation, validation, save/reopen/export paths have actual browser/artifact evidence. Ten references have bounded local/donor input evidence.         | All advanced media paths, full Ukrainian, every physical controller workflow or a persistent Save contract in read-only/memory-only tools. |
| Integration      | #846, #854, #857, #870 and previous plan #875 are merged. Prepared Reveal #863 also merged during this review as `4b2bdff33` (1 October, 22:32 CEST).                        | Formal v0.150.0 publication or blanket acceptance of current main.                                                                         |

Scope remains three main modes plus Custom Solo, **18 Solo-only editions**, EN/UK and two palettes; **16 tool routes, 16 reference routes and 17 listed support routes**, with category overlap. The **18 scene identities** are four base worlds plus 14 original edition identities. They are not 18 unique edition backgrounds. Four newer editions use FPV fallback art.

The [October 1 updater report](offline-pwa/updates-and-communities.md) provides the new browser evidence. `game/communities/directory.mjs` now imports the shared launcher navigation. A separate new password screen in `game/access-gate.mjs` appears before game boot: its source has English copy and no shared controller owner. This adds an entry-flow integration task; it does not authorize removing or bypassing access control.

## Recommended priorities

**P0:** delivery correctness or a confirmed release blocker. **P1:** high direct player value. **P2:** broader capability/confidence, promoted when that audience matters now. **P3:** defer from the next player-focused batch. Lower priority does not cancel original scope. Device/publication dependencies must not stop independent source work.

| ID  | Player-facing outcome                             | Recommendation                                  | Kind of remaining work                                       |
| --- | ------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| M1  | Players actually receive the corrected menu       | P0 for delivery claims                          | Bounded deployed-page checks                                 |
| M2  | No mouse needed, including first entry            | P1                                              | Entry-screen source gap plus real input/device qualification |
| M3  | Progress and creations survive failures           | P1                                              | Targeted restoration and lifecycle checks/fixes              |
| M4  | Existing installed apps update safely             | P1 for current iPhone/PWA users                 | First-upgrade device journey; broaden desktop evidence       |
| M5  | Important screens are readable and understandable | P1 core menus; P2 exhaustive tools              | Accessibility/localization checks and fixes                  |
| M6  | Animation stays smooth and comfortable            | P1 representative baseline                      | Actual phone/desktop measurement                             |
| M7  | Backgrounds feel noticeably alive                 | P1 one-scene proposal; P2 rollout               | Creative implementation and review                           |
| M8  | Newer editions have their own identity            | P2, or P1 if showcased next                     | Four focused art/UI batches                                  |
| M9  | Creators finish the workflows they need           | P2 generally; safety/immediate partner needs P1 | Tool-specific completion                                     |
| M10 | Idle Demo does not stall or confuse entry         | P1 while automatic Demo is enabled              | Existing owner's anomaly investigation                       |
| M11 | Sound is comfortable and behaves correctly        | P2 generally; current complaint P1              | Deferred listening/device review                             |
| M12 | Advanced reference pages work without a mouse     | P3 references; broken player support P1         | Reading/return qualification                                 |
| M13 | Newcomers understand the menu without coaching    | P2 when human review resumes                    | Small observation; formal study remains last                 |
| M14 | Releases fit limits and preserve correct content  | Continuous publisher requirement                | Capacity, integrity and delivery coordination                |

## Each remaining item explained

### M1 — Players actually receive the corrected menu

**What:** check the actual default and DroneAid pages after authorized access on the deployed build. Confirm the approved landing list, relocated Audio/Collection/Help/practice actions, Continue from a save and nested Back. Cover affected mode/edition differences rather than blindly repeating unchanged historical screenshots.

**Why / benefit:** merged code can differ from what a cached browser or installed app is running. This closes the gap between “we fixed it” and “players see it.”

**If deferred:** the source improvement remains, but public delivery cannot be claimed. The September 30 public failure is historical, not proof that today's page still fails. October 1 clean-home packaged-browser evidence is useful but is not the same as checking the public destination.

**Priority / finish:** P0 for delivery claims; a bounded verification task after deployment/access is ready. Record build identity and the relevant workflows. Preserve saves, caches and workers; do not force success by clearing them or bypassing the password screen. Other source work may continue while publication is pending.

### M2 — Navigate without reaching for a mouse

**What:** integrate localized labels and application-owned controller text entry/Confirm/error handling into the new password screen, and verify keyboard focus. Exercise Home, Settings, mission search, sliders and dialogs with a real pad; reconnect/remap it; enter/leave previews. Multiplayer seats must remain unchanged and moving focus must never start play.

**Why / benefit:** this is the original “native game” requirement. A couch/handheld player should not get stranded at a password field or a search box even if the main menu works perfectly.

**If deferred:** ordinary mouse/keyboard use may work, but controller-only support remains incomplete or uncertain. First-entry problems can block the entire game. Simulated button pulses do not reproduce every real device's held buttons, reconnects or mappings.

**Priority / finish:** P1. Keep the existing router and ownership protections. The Community missing-owner repair is already implemented; verify its real failure/return paths instead of rebuilding it. First qualify a representative controller on the chosen supported platform, then other advertised targets. Native desktop/iOS wrappers, installed names/icons and interruption behavior remain separate checks. Deferring a platform check is not silently removing that platform from scope.

### M3 — Keep progress and creations safe

**What:** restore a real nonempty backup into an isolated test profile/store, then use/save/reopen its pictures, audio and progress. Exercise a failed import, canceled replacement, full/denied storage and returning to an editor the browser kept in memory. Check that late operations cannot overwrite newer work. Complete the later Company/Discovery lifecycle checks and coordinate legacy Team import repair with its owner.

**Why / benefit:** successful export is only half of a backup promise. A player must get their progress back, and a creator must retain unfinished work across supported navigation.

**If deferred:** there is uncertainty in specific failure paths, not evidence that all saves fail. The potential harm is high because lost work may be unrecoverable. Empty-audio backup validation does not demonstrate restoration of actual tracks.

**Priority / finish:** P1 for data integrity, before cosmetic expansion. Use exact before/after records without touching user saves. Keep contracts truthful: Company drafts are tab-memory-only; accepted Studio edits autosave but un-applied JSON does not; some exports omit editing history/original media. Existing waived regressions remain unexecuted until the test policy changes. [Company](verification/company-studio-lifecycle-recovery-20260930.md) and [Discovery](verification/discovery-lifecycle-recovery-20260930.md) reports retain those limits.

### M4 — Update an installed game without losing it

**What remains:** qualify the first upgrade of an existing iPhone Home Screen installation to the new Settings updater, then close/reopen and launch offline. Check interrupted preparation, preserved download choices/content and advertised modes/standalone editions. Workshop previews can require extra game-runtime packages.

**Already done:** desktop browser evidence shows same-URL updates preserving an actual saved flight, safe rejection of an old worker response, and reopening with the game server stopped. This is no longer a task to build an updater from scratch.

**Why / benefit:** players get fixes without deleting/reinstalling an app and risking progress. Installed apps can retain old code after an ordinary refresh.

**If deferred:** online/desktop use may be fine, but existing iPhone users may stay on old menus or face an unqualified transition. Deleting their app or storage is not an acceptable workaround. The rolling updater also does not promise fully transactional rollback between two separately addressable cores.

**Priority / finish:** P1 when existing installed-phone users are an immediate audience. It requires an actual old installation, not a phone-sized desktop window. Confirm the flight and settings survive, reopen works and intended offline gameplay remains usable. Preserve the difference between a stopped local server and all network access disabled.

### M5 — Make important screens readable

**What:** check EN/UK, Plain/Large, genuine browser 200% zoom, OS high-contrast/forced-color modes, slow/missing fonts, portrait and short landscape. Fix clipping, split words, invisible focus, unclear icons and misleading input hints. Include the new English-only password-screen source.

**Why / benefit:** small-screen users, Ukrainian readers and people with low vision can find the same actions. Large text is not the same as zoom, and custom colors can change under OS contrast settings.

**If deferred:** a button may exist but be practically unreadable or unreachable. This directly risks repeating the original clutter/wrapping complaint. Missing translation in a historical source document has lower impact than missing Ukrainian game controls.

**Priority / finish:** P1 for entry, Home, missions, Settings and recovery; P2 for exhaustive secondary tools. Share fixes across hosts, preserve the new font/icon family and allow scrolling at large sizes. Original-language reference prose is distinct from UI translation; do not silently expand translation scope to every historical document.

### M6 — Keep animation smooth and comfortable

**What:** measure a representative actual phone and desktop while the menu animates, changes mode, opens Settings and resumes from inactivity. Record frame delays and memory, check reduced motion, and verify inactive scenes stop unnecessary work. Observe comfort through a sustained session.

**Why / benefit:** scenery can feel alive without making controls sluggish, heating a phone or consuming excessive battery. Smoothness is part of the experience.

**If deferred:** bounded browser checks still demonstrate motion, but phone cost remains unknown. This is not a measured current mobile failure. Download bytes and estimated raw image size are not measured browser memory.

**Priority / finish:** P1 representative baseline before broad animation expansion, then repeat affected cases. Keep it small; do not turn it into an open-ended benchmark programme. Device availability is a dependency, not a reason to halt independent implementation.

### M7 — Make backgrounds noticeably more alive

**Unfinished:** current ambient motion moves regions of a flattened painting. It does not fully deliver separate moving actors/layers/sprite sequences. FPV Solo has a separate portrait original; most other Solo profiles use landscape focal crops. All four base-world multiplayer portraits already have independent compositions.

**Proposed work:** one visible demonstration with subtle atmospheric layers and a purposeful activity outside the text area, a proper portrait composition, and static/reduced-motion fallback. Review its style, readability and phone cost before rolling that approach out. Preserve accepted artwork rather than regenerating everything.

**Why / benefit:** this directly serves the user's request for a welcoming, living landing. It should have its own priority rather than being grouped with internal galleries.

**If deferred:** existing atmospheric motion remains usable, but the original visual ambition stays incomplete. This is mainly a visual/engagement gap, not a save or navigation defect. Canceling it would reduce approved scope; no cancellation is assumed.

**Priority / finish:** recommend **P1 for a single demonstration after urgent safety/entry fixes, P2 for the remaining rollout**. Creative work is less predictable than a navigation check. Deliver remaining layered/sprite and separate Solo portrait scope unless the user explicitly approves another target. Retain provenance and the 2 MiB active added-scene budget, and validate rather than assume engagement benefit.

### M8 — Give the four newer editions their own identity

**What:** intentional scenery and portrait framing for Social Drone UA, Victory Drones, Ukraine: Living Culture and FPV Learning; correct identity/capabilities on both launch routes. Reuse the shared menu/motion system and keep Solo-only modes truthful.

**Why / benefit:** each edition feels authored and recognizable, rather than like the same FPV scene with another title.

**If deferred:** current fallbacks work and dated compilation covers all 18 editions, but those four remain visually less complete. This is usually not an ordinary-gameplay blocker.

**Priority / finish:** P2, promoted to P1 for whichever edition is being presented next. One edition per reviewable batch; check title/logo, EN/UK, palettes, input, static fallback and package size. Shared logic should be checked once plus edition-specific differences; avoid repeating identical work blindly. Compile success is not browser/device acceptance.

### M9 — Finish the creator workflows people need

This affects making content, not ordinary Start/Continue. Choose the next tool by actual use. Most core paths exist; do not rebuild all editors. The broader controller-only authoring promise stays open even if these items move after the next player release.

| Tool / remaining work                         | Benefit                                                                                                                                      | Consequence of deferring and recommendation                                                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Asset Studio advanced/device breadth          | Confidence that less-used edits and saved bundles work on supported installations. Core raster edit/save/reload/export already has evidence. | Common checked workflow remains usable; wider branches uncertain. P2.                                                                                  |
| Playground and Enemy native preview           | Enter a running preview and return entirely with keyboard/controller. Earlier native checks needed a testing-browser focus reset.            | A clean native-only claim remains unproved; virtual journeys/exports pass. P2; reproduce on a supported browser/device before changing guards.         |
| Motion Lab language/device breadth            | Complete configuration, simulated collection save and Workshop return in supported locales/devices.                                          | No portable design export exists or is promised by this check. P2 qualification, not a new export feature.                                             |
| Pictures & Stories / audio restore            | Recover actual picture/story/audio content into another store and play it.                                                                   | Richer backup safety remains unproved. P1 integrity; P2 broad media-format coverage.                                                                   |
| Video Poster codecs/cancellation              | Reliable frame capture from supported video types and cancellation during decoding.                                                          | Checked PNG capture remains useful; other paths uncertain. P2. Reopen means source reselection; no saved editing project exists.                       |
| Content Studio advanced editing               | Specialized editors, tracing/media imports, candidate libraries, Team exports, Ukrainian and native preview.                                 | Core project editing remains checked, advanced creators may hit gaps. P2, draft safety P1. Export does not preserve every historical edit or original. |
| Picture Creator standalone export/batch/video | Retrieve the actual campaign output without a mouse across advertised creation types.                                                        | Single-image virtual install/export is checked; wider/native paths remain incomplete. P2; OS picker handoffs stay platform-owned.                      |
| Team Creator victory video/full Ukrainian     | Richer completed campaigns and a full localized creation journey.                                                                            | Picture-only native/virtual workflows remain available. P2. Installed reopening is not recovery of every private editing source.                       |
| Company Studio aggregate/compiled packet      | Finish the whole controller flow and verify the generated game packet can be reviewed/imported, not just exported as source.                 | Partner-authoring completion remains uncertain; drafts are memory-only. P1 if a partner needs it next, otherwise P2.                                   |
| Company practice / Production / Viewport      | Complete translated paths, actual return chains and preview/offline prerequisites.                                                           | Some edge/device paths remain unverified. P2; stuck/data-loss paths P1. Read-only tools need no invented Save function.                                |
| Design Atlas clipboard / Guide installation   | Copy exact brief text; install the sample through the actual browser flow.                                                                   | Text downloads work; Copy certainty and onboarding remain incomplete. P2. Validated JSON is not proof of browser installation.                         |
| Demo recording tool                           | Own pending Run/Verify/Export, expose Cancel, localize and validate current recordings.                                                      | This authoring UI remains incompletely qualified; it is separate from runtime Demo playback. P2 unless recordings are needed immediately.              |
| Moderation / Replay / support                 | Reliable local dialogs, replay error/end/return and support navigation.                                                                      | Uncommon paths may remain awkward. P2; broken advertised recovery P1. No permission for remote publication/moderation is implied.                      |

**Finish:** one meaningful current keyboard-only and controller-only workflow per selected tool, including invalid input, Cancel and exact return; real save/reopen/export where the product has it; actual artifact/state validation. Physical devices remain distinct. Do not repeat finished workflows without changed dependencies or a concrete concern.

### M10 — Prevent idle Demo stalls and confusing handoffs

**What:** coordinate with the Demo owner on the retained **158-second visible/unfocused stall**, then check viewing-to-play return without disturbing the normal flight. After a confirmed fix, repeat the relevant sustained observation and device handoffs. M9's recording tool is separate.

**Why / benefit:** automatic idle Demo is part of the landing experience. A stale board looks frozen; unclear takeover can surprise someone navigating menus.

**If deferred:** this is a recorded anomaly, not only a missing checklist. It does not prove every player sees it, but deserves attention while automatic Demo is enabled. Adding recordings or bot variety will not fix it.

**Priority / finish:** P1, through the existing [Demo plan](demo-plan-status-2026-09-30.md) and [October 1 owner review #915](https://github.com/mekhovov/revealline/pull/915). That review closes the former capacity timeout; do not preserve it as an active blocker. A smaller internal beta or disabling automatic entry is a user decision, not a silent scope change. Existing endurance/device/human-review deferrals remain explicit.

### M11 — Check real sound comfort and interruption behavior

**What:** when listening review resumes, hear common actions with music; mute, pause, switch away and return; check warnings, menu cues and multiplayer listener behavior on selected speakers/headphones/devices.

**Why / benefit:** correct routing does not prove repeated clicks feel pleasant or that music leaves danger cues audible. This improves clarity without creating another sound library.

**If deferred:** audio can be implemented and usable while real listening comfort/mobile interruption remains unverified. Extra recordings are optional unless a real review finds a gap.

**Priority / finish:** P2 generally, P1 for a current sound complaint or target-device failure. Follow the [Audio plan](spatial-audio-plan.md) and [owner review #914](https://github.com/mekhovov/revealline/pull/914). Preserve approved sounds and the existing extended-listening deferral; this menu review does not override another owner's scope.

### M12 — Finish historical galleries and uncommon references

**What:** bounded reading, image pan/zoom, Retry, language and exact Back for runtime sprite comparison, original soundtrack audition, Journey actor review, Combat review, Field Kit sprites and Field Kit icons. Prepared Reveal #863 is now integrated; qualified galleries need no repeat absent a relevant change. Public/device acceptance is still separate.

**Why / benefit:** maintainers/advanced creators inspect studies without a mouse. This fulfills the original all-tools scope.

**If deferred:** ordinary players can still start, select missions and change settings. Some internal/reference pages remain less convenient. This is why they should not dominate a player-focused release; a real player recovery screen has higher impact.

**Priority / finish:** P3 for historical references. Preserve source-only distribution and originals; do not add large art folders to the game to close a checklist. Most studies are read-only with no save/import/export/adoption contract.

### M13 — Check whether newcomers understand the menu

**What:** when human review resumes, observe a few unfamiliar people find Start, change mode, select a mission, mute sound and return from Settings without coaching. Record actual confusion. Keep the formal wider study last under the existing instruction.

**Why / benefit:** the original complaint was feeling overwhelmed. Automated tests can prove reachability, not understanding.

**If deferred:** a technically consistent menu can still confuse people. This is uncertainty, not proof it is bad. A short observation is more useful than speculative extra controls.

**Priority / finish:** P2 and proposed for review, not an unsolicited study. Fix observed stumbling points. Do not invent a large research programme or claim engagement from deterministic tests.

### M14 — Keep releases within limits and evidence truthful

**What:** current-build capacity, file integrity, production/licensing provenance and deployment checks through Releases; compatible small batches; honest waived/deferred-test status. Preserve required content and private-source exclusions.

**Why / benefit:** fixes reach players together without omitted files, version mismatches or a rejected package. Small batches expose the source of regressions.

**If deferred:** a specific candidate may not publish safely, or delivery may be overstated. This is a release dependency, not a new visible feature or a permanent reason to halt source work. Old timeout/headroom failures are historical after an exact-head result resolves them.

**Priority / finish:** mandatory publisher responsibility. No independent version allocation, donor-history rewrite or broad recovery snapshot. Suite restoration follows the reviewed policy process; waived checks are not passes. This documentation review ran no product tests or materialized build.

## Proposed batches and tradeoffs

1. **Reliable entry:** current public landing/access checks, password-screen input/language, existing Demo-stall investigation and reachable Settings. Source fixes need not wait on publication or unavailable devices.
2. **Preserve and read:** save/restore integrity and core EN/UK/zoom/contrast; first installed-iPhone upgrade if that is an immediate audience. Combine useful observations on one real device instead of repeating separate campaigns.
3. **Visible improvement:** one layered background and portrait demonstration, with a representative performance check. Review it before broad rollout.
4. **Audience-selected expansion:** the named new edition, creator workflow or target platform the user needs next. Finish that supported route matrix before claiming acceptance.
5. **Broader completion:** remaining creative rollout, advanced media/tool/locale breadth and references. No unselected original item is marked canceled or complete.

This proposal deliberately brings a visible background improvement ahead of exhaustive reference/authoring work, while keeping unusable entry or data-loss issues ahead of cosmetics.

## Decisions for the user

**Recommended default: balanced player release.** Reliable entry/save safety, then one strong visual improvement; advanced creators and historical references later.

- **A — Player-ready:** ordinary controls, safe saves, installed-phone update and readable menus, followed by one visual demonstration. Best if people will play soon.
- **B — Visual showcase:** after critical entry/save fixes, backgrounds, portrait composition and a selected edition take precedence over broad tool/device qualification. Better first impression; support limitations must remain explicit.
- **C — Creator/partner-ready:** after critical player fixes, prioritize Company/Content/Picture/Team workflows and verified imports/exports for a named edition. Stronger content production, less immediate landing improvement for ordinary players.

The most useful choices are **who needs the next version** and **which real target matters first**: desktop/browser/controller, an existing iPhone installation, or another named device. These are emphasis options, not permanent product-scope cuts. No selection is assumed. Full original controller/tool/native/art requirements remain open until delivered or explicitly revised.

## Delivery cutoff and review limits

At this review, main is `955c539a7`, including the password gate, landing repair, Community navigation and updater. Releases reports Pages at that main; this review adds no fresh public-browser acceptance. Latest formal GitHub release remains [v0.142.3](https://github.com/mekhovov/revealline/releases/tag/v0.142.3). [Milestone 57, v0.150.0](https://github.com/mekhovov/revealline/milestone/57), is scheduling, not publication or a promised date. #863 subsequently merged as `4b2bdff33`; that integration is not fresh public/browser acceptance. #914/#915 are separate owners' proposed reviews.

The original plan closes only when supported routes, input/device expectations, meaningful tool workflows, locale/accessibility, state safety, intended art/motion and public delivery are demonstrated within their actual contracts. A smaller next release can be useful without pretending the whole programme is complete. No percentage hides the difference between implemented features and unverified behavior.
