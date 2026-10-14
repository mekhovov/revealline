# Overflight delivery — 2026-10-14

The existing Survivor/Raid foundation is retained. This delivery completes the remaining implementation tracks: pressure/route variety, a native authored Riy operation, optional character handling, Time Attack, Contract Marathon and review audio capture. All five operations share one Survive home entry; the operation picker lives in its Settings alongside the same Studios and offline controls.

## Completed implementation

| Plan track | Result | Evidence |
|---|---|---|
| Survivor pressure | Earlier, varied late formations; earned relief and passive-pulse counterplay preserved | `../pressure-20261014/`: nine paired routes, 18 seed-42 groups, eight passive losses |
| Raid approaches | Distinct objective routes and paired shield/brace screens within the same specialist budget | `../raid-approaches-20261014/`: 144/144 routes before and after, all baseline/build/set/difficulty combinations retained |
| Riy operation | Two distinct escorts; deliberate keyboard, touch and shared remappable controller Ability command; full sortie, results and retry | `../riy-sorties-20261014/`: 12/12 full sorties; target-focus raises elite/final damage in every pair; four stationary policies lose |
| Riy Creator/content | Versioned project/compiler, exact shared resources, editable formations/ranges/attack roles, native preview, separate drafts and package family | `../riy-authoring-20261014/`: compiler/editor/package tests and local authenticated Community lifecycle |
| Character handling | Opt-in Interceptor (198/350 speed, 80 hull) and Heavy carrier (162/310, 120 hull); other/default frames remain balanced (180/330, 100 hull) | Native Interceptor start displayed 80/80 hull; movement, fixture and record-isolation tests |
| Time Attack | Objective route, damage-adjusted medal time, hundredth-second results and separate records | 36/36 scripted clears; native result `time-attack-result.png` |
| Contract Marathon | Five escalating contracts; bank-or-continue; carry hull, remaining airframes and build; lose all unbanked score on defeat | 33/36 full scripted Marathons banked, three losses retained; native second-contract continuation/bank screenshots |
| Audio review | Shared effects/voice mix can join bounded 20-second canvas clips, without microphone access or changing audible playback | `../review-audio-20261014/`; native `riy-game-audio.webm` has VP9 video and 48 kHz stereo Opus audio |

## Native authoring and gameplay checks

Using the existing Riy Studio on `127.0.0.1:8899`, changed the title to **Riy · Formation review** and focus duration to **4 seconds**. Validate and Preview accepted the project. Exported the package, imported it through the Studio UI on the distinct `localhost:8899` profile, re-exported it byte-for-byte identically, then used **Install and play** and **Start** in the native host. Compiled identity: `7369b2167c8a5877`; package identity: `b6769052f0b016dc`.

The authored native Riy Systems sortie completed in **05:23**, with **2,923 destroyed enemies**, both bosses defeated, ten upgrades, **32 focus commands** and **407 escort attacks**. `riy-result.png` and `riy-result.txt` preserve the visible results. This was an automated gameplay review with concurrent recording/build work, not a performance trial.

The native Time Attack objective review finished at **0:27.22**, no hull damage, Gold. The native Marathon continued from contract one with its upgrade build and 24,150 points at risk, completed contract two, and banked **47,275** points at **00:52** total flight time. These automated native routes use ordinary inputs and earned upgrades. They are explicitly marked review runs and do not write player records.

`riy-game-audio.webm` is an actual 20.01-second native capture. Stream inspection confirms an audio track with nonzero samples, mean -50.1 dB and peak -31.0 dB at the tested settings. It captures enabled shared Web Audio effects/voices; the external HTML soundtrack is not included. The native soundtrack UI showed an active track. The clip does not include DOM HUD/cards; screenshots show the full interface separately. No subjective listening-quality or enjoyment claim is made from stream inspection.

## Correctness and integration

- Combined Overflight/Raid suite: **291/291** passing before the final continuation regression; the final focused host suite is **20/20**, including that added case. Counts overlap.
- Authoring/Community suite: **40/40**; authenticated local service flows: **2/2**, using production HTTP handlers/validators, temporary disk blobs, local test identities and finite persistence adapters.
- Offline dependency and CI registration suite: **21/21**.
- The final host regression executes the production start/continue functions: changing next-sortie settings cannot reset a continued Marathon's hull/build/escrow. Ordinary new launches still apply changed settings.
- The source review also corrected seed retention when changing difficulty, restored keyboard focus after the Riy command button, and gave Riy/variants their own mission and record labels.

## Packaged offline proof

The canonical `main-pages` build at **0b2000fff38f507ede22b1d419adea67dc7dc811** passed preparation and validation: **3,182 files**, 918,293,665 bytes including optional distribution content. `build.json` records the exact source revision. This was prepared in memory to avoid duplicating an expanded distribution on a nearly full disk.

On a fresh `127.0.0.1:8900` origin, the native **Settings → Install & offline play** UI downloaded **Survive · all Overflight operations** and **Snake · Classic** with the required Solo Starter/shared files. The UI verified the selected 104.8 MiB package, showed both experiences **Ready offline**, and reported 0.0 MiB remaining (`offline-install.txt`). No optional recorded soundtrack download was selected.

The dedicated serving process was then stopped; an independent HTTP request returned connection refused. With that server unavailable:

- Riy reloaded and started with both escort roles and Focus available.
- Time Attack, Contract Marathon, standard Raid, Survivor and Snake each launched through their native Start action. Time Attack, Marathon, standard Raid and Snake were first visited on this origin only after the server stopped.
- Survivor's timer advanced; standard Raid reached 00:15, six destroyed enemies, Rush 6/20 and changing hull. This checks simulation, not just a cached title screen.

`offline-*.txt` and the offline screenshots preserve UI observations. This is a downloaded-runtime launch smoke check on the available local browser, not an installed OS icon, target-device performance or full offline sortie qualification. The separate source review server on port 8899 remains available; the disposable package server was stopped intentionally.

## Qualification boundaries

The user explicitly waived unavailable Iris Xe/Windows, M1 Safari, physical controller/phone and five-player trials. They are **skipped, not passed**. Local tests and scripted pilots do not establish target-device performance, human enjoyment or typical completion time. Automated Time Attacks currently all earn Gold; medal thresholds remain initial tuning for player review.

The Community lifecycle check was local. Live production account/publication, PostgreSQL deployment and real-network moderation were not exercised. Publication remains a separate delivery action. No live Community content was created.

Performance results collected while recording, opening diagnostic UI or running concurrent build work are invalid for acceptance. Existing renderer/lifecycle capacity evidence remains separate; this delivery does not infer new target-hardware acceptance from it.

## Final CI follow-up

The foundation PR's broader Company candidate job exposed four pre-existing edition-appearance test failures: tests clicked SIM while the secondary mode menu was collapsed. Parent commit **93d12f993** corrects only the test interaction: open the actual menu, expand More when necessary and assert visibility. All existing appearance, preference, cancellation and failure assertions remain. The corrected real test file passes **4/4** (`edition-appearance-tests.tap`). The correction was merged into the delivery branch. All recorded runtime source hashes still match tested build `0b2000fff`; later changes are tests and evidence only. Final GitHub checks are rerunning, not counted as passed.
