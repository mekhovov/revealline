# Company landing source verification — 2026-09-29

Real Chrome browser pass against `http://127.0.0.1:8768/game/?edition=<id>`. Each row was loaded independently, waited for the open landing, and inspected through the rendered DOM. This covers all fourteen current catalog editions in the main source package; it is not a standalone-package, hardware-controller or visual-approval claim.

Every row exposed exactly the Solo mode control and four landing actions: Start, Select Mission, Settings, Sound off. No language, music transport, collection, install, More or authoring controls were visible within the landing. Every scene poster loaded with nonzero decoded width. No console errors were captured in the complete route pass. The shared icon family was checked on Shared Horizon through `data-menu-icon` and computed CSS SVG masks: solo/play/missions/settings/mute. Its footer contained the song name/artist and Version DEV.

| Edition ID                       | Observed title       | Observed final scene ID                | Modes | Essential controls / poster |
| -------------------------------- | -------------------- | -------------------------------------- | ----- | --------------------------- |
| `coupa-all`                      | Coupa Village        | `coupa-village`                        | Solo  | Pass                        |
| `coupa-adventure`                | Spend in Motion      | `coupa-spend-in-motion-theme`          | Solo  | Pass                        |
| `coupa-culture`                  | Inside the Village   | `coupa-inside-village-theme`           | Solo  | Pass                        |
| `coupa-foundations`              | From Need to Value   | `coupa-source-to-pay-theme`            | Solo  | Pass                        |
| `coupa-operations`               | A Day in Coupa       | `coupa-product-operations-theme`       | Solo  | Pass                        |
| `coupa-developers`               | Connect the Network  | `coupa-developer-integration-theme`    | Solo  | Pass                        |
| `droneaid-community`             | Community Relay      | `droneaid-community`                   | Solo  | Pass                        |
| `droneaid-nl-community`          | DroneAid Netherlands | `droneaid-nl-community`                | Solo  | Pass                        |
| `droneaid-nl-workshop-lights`    | Workshop Lights      | `droneaid-nl-workshop-lights-theme`    | Solo  | Pass                        |
| `droneaid-nl-parts-in-motion`    | Parts in Motion      | `droneaid-nl-parts-in-motion-theme`    | Solo  | Pass                        |
| `droneaid-nl-makers-together`    | Makers Together      | `droneaid-nl-makers-together-theme`    | Solo  | Pass                        |
| `droneaid-nl-careful-handoff`    | The Careful Handoff  | `droneaid-nl-careful-handoff-theme`    | Solo  | Pass                        |
| `droneaid-nl-signals-of-support` | Signals of Support   | `droneaid-nl-signals-of-support-theme` | Solo  | Pass                        |
| `droneaid-nl-shared-horizon`     | Shared Horizon       | `droneaid-nl-shared-horizon-theme`     | Solo  | Pass                        |

The initial pass found the two aggregate editions inheriting their entry-mission scene. Their owner corrected the catalog mapping; both aggregate routes were subsequently reloaded and their dedicated scene IDs/poster decode were confirmed. A Shared Horizon screenshot also exposed company layout overriding the landing content inset. After the owner repaired the legacy company selector, Shared Horizon was visually rechecked at 1593×1123 (72 px inset) and 390×844 (20 px horizontal inset). All essential actions and the footer fit.

No Versus or Team links were exposed in these editions, consistent with their catalog capability. Historical retained releases were not altered or claimed as covered by this pass.

## Ukrainian portrait matrix

All fourteen IDs in the table were then independently loaded with the source UI locale set to Ukrainian at **390×844 CSS px**, standard text size. Every route passed:

- Exactly `solo-current-mode`, `shell-featured`, `shell-play`, `shell-options`, and `shell-sound` were visible; no Versus or Team control appeared.
- Localized controls read `Соло`, `Старт`, `Вибрати місію`, `Налаштування`, and `Звук: вимкнено`.
- Landing `scrollWidth` did not exceed `clientWidth`; no control's text exceeded its client width.
- Title and every control remained within the viewport. Brand titles wrapped into two lines without clipping; source catalog brand names stay unchanged.
- Actions occupied x=20…370; the last action ended at y≈652.4; the footer ended at y=828. No action/footer overlap occurred.
- Padding was `24px 20px 64px`. Browser viewport and the test origin's English locale were restored after the pass.

These are source-package, standard-size portrait checks. They do not certify every physical browser/device, enlarged type setting, or retained historical release.

## Compiled standalone launcher handoffs

Each of the **14 edition IDs above** also passed a separate real Chrome launcher journey on the final versioned staging origin `http://127.0.0.1:8790`: open `/editions/<id>/app/`, activate **Check available edition** with Enter, then activate **Open game to prepare offline** with Enter. Every validated link led through `/editions/<id>/releases/v0.142.1/site/game/company.html` to the scoped `game/index.html?edition=<id>` landing.

All 14 compiled landings displayed the matching title and expected scene ID in the table, exactly Solo plus Start / Select Mission / Settings / Sound, a decoded scene poster, and **Version v0.142.1**. No additional landing actions appeared. No unsupported Versus or Team entry appeared. This checks actual launcher-to-player handoff, rather than opening a source route that happens to share its shell. The offline preparation action itself was not invoked in this browser pass; compilation/closure validation is recorded separately in `menu-scenes/edition-compilation.json`.

The footer song metadata updates asynchronously. Thirteen final routes displayed `Carol of the Bells (Metal Version) · Alexander Nakarada` after readiness; Coupa Village's final run had no selected track and showed the then-current fallback `Selected soundtrack`. Its owner subsequently changed that fallback to the truthful localized `No track selected`, without starting audio. This report does not claim a selected song in that empty state.

The two aggregate scene image assets were subsequently replaced with their own overview artwork. After the final refresh, both `/editions/coupa-all/app/` and `/editions/droneaid-nl-community/app/` were followed through Check → Prepare on `http://127.0.0.1:8974/`. Their actual compiled poster images both decoded at **1536×1024**, with the respective `coupa-village` and `droneaid-nl-community` scene IDs. This closes the image decode check for the replacement aggregate artwork.

The final generated Coupa launcher also passed a **virtual standard-pad** journey using `game/test/manual/edition-launcher-controller.html`: Confirm's release activated Check and revealed the validated Prepare link; Back focused Prepare; a subsequent Confirm release followed that exact versioned company entry. The fixture supplied device button states to the actual compiled launcher and did not call its click/domain handlers directly. It was served temporarily outside all edition package directories, then removed from staging. This is browser/controller integration evidence, not a physical-device claim.

## Actual Chrome 200% zoom

The final compiled **Coupa Village** landing on origin `8974` was checked at real browser zoom in both English and Ukrainian. Native Chrome shortcuts changed zoom, and Chrome's accessibility UI explicitly reported **Zoom: 200%**. Device pixel ratio changed from 2 to 4; the effective CSS viewport changed from 1593×1123 to **796×561**. No CSS transform, page zoom style or viewport-emulation setting was used.

At 200%, both locales had document width **796 px**, matching the viewport without horizontal page overflow. All five essential controls stayed horizontally in bounds (x≈39.8…549.8). The landing's decorative container rounded to 797 px internally, but did not create document-level overflow. **Settings** was opened by Enter and its **Back / Назад** button activated by Enter in both languages; it closed and restored focus to `shell-options`. The UI locale was restored to English.

Native Chrome zoom was restored to **100%**, confirmed in Chrome's accessibility UI and by DPR=2 / viewport1593×1123. This is a real 200% check for this compiled company landing and its Settings return path; it does not claim all game hosts or all physical browsers were audited at that zoom.

## Actual prepared offline reload

The **English Coupa Village** edition was prepared through its real **Settings → Content & Offline → Prepare this edition for offline play** action on `http://127.0.0.1:8974/editions/coupa-all/releases/v0.142.1/site/game/index.html?edition=coupa-all`. Its UI reported **This edition is verified for offline play.**

Chrome DevTools was opened through the native browser UI. The Network throttling picker was explicitly changed from **No throttling** to **Offline**, and the native accessibility tree confirmed **Presets: Offline** before the page was reloaded. The reload reached the complete landing with its five essential controls, song attribution and Version v0.142.1. The `coupa-village` overview decoded at **1536×1024**; the menu used `Reveal Line Pixel` and `document.fonts.check` reported that pixel face loaded. The native Network table showed resources **Served from ServiceWorker**, including the overview image and a packaged font. This was a real Offline-profile reload, not an online cache-only reload.

Afterward, the same native picker was restored to **No throttling**, confirmed in Chrome's accessibility tree, and DevTools was closed. Zoom remained 100% (DPR=2, viewport width1593). This checks the prepared company landing on local Chrome, not a physical offline device, native iOS runtime, offline gameplay completion or every edition. The later r2 markup/field-editor-style packaging fixes are outside the resources exercised by this landing check.
