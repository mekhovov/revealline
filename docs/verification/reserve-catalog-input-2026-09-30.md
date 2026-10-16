# Reserve illustrations catalog input — September 30, 2026

## Source and corrected behavior

Runtime commit: `fa31dcc6996f5383989017f98f7ea51739924a06`, based on main `7d4779d3fefe3673e2270546b4f1c41848b8c2fa`. Bounded-viewer CSS correction: `1402897341fc31e478ea2c0c04f7753ddf7aa40c`.

The source catalog at `/authoring/library/reserve-illustrations-catalog/index.html` retains its **40 selected originals**, four themes and ten waves. Its historical manifest remains pinned to source revision `091936e27c3b9f1c061081ca93827014a927d963`. This is a read-only source-art catalog, not earned pictures, released missions or an installation surface. It has no project Save, import, draft, award, approval or runtime-adoption action. Download preserves a selected original PNG; reopening means selecting the immutable source again.

The sparse preview server previously omitted the controller router's current `game/couch/controller-profiles.mjs` dependency. Its explicit allowlist now includes that dependency and the bounded viewer/loader dependencies, plus the two new local modules. The server still serves only reviewed UI routes and pinned Git source routes; it does not fall back to the repository filesystem. The route test now discovers actual HTML launcher/module/style roots instead of relying on a stale manually listed entry point.

The extracted presentation owner verifies the exact manifest bytes and SHA-256 before publishing chooser options or dynamic source descriptors. It verifies and fully decodes only the selected original before installing that image. Retry reloads metadata while preserving the selected ID. Pending or failed retries of the **same selection** retain its completed image; explicitly selecting a different illustration immediately removes and disposes the old image, so a new title never describes the preceding artwork. Pending work disables the original download and inspection action.

Cancel, a 30-second timeout, supersession, modal ownership, loss of foreground, hidden pages and page lifecycle changes fence late work. Acquired stale image results dispose themselves instead of replacing the current selection. A Retry begun from focused Retry moves focus to Cancel; automatic completion restores Retry only if that captured operation still owns Cancel. Explicit Cancel returns to Retry only while Cancel is the current foreground owner. Newer controls or modals retain focus.

The pinned README and manifest can be opened even while initial metadata is pending or has failed. Successful metadata loading expands the same owned source-viewing facility to every selected original and its prompt, optional cleanup prompt, provenance and notes. Text is rendered literally. The shared image viewer provides Fit, Actual Size and bounded two-axis reading; closing restores the exact source link. Opening a source modal cancels pending catalog work without allowing its late response to replace the modal.

Three stable Sections targets reach the chooser, original inspector and source-identity disclosure. Review caught the initial use of `data-controller-target`, which the shared Sections implementation does not consume; committed markup uses `data-authoring-target`. An initial native traversal also exposed focus falling to the body when Next became disabled at the final illustration. The committed presentation moves focus to the available neighboring Previous/Next action at either endpoint while preserving unrelated control and modal ownership.

The first full virtual-controller attempt exposed a further real integration defect: the reused viewer had no bounded source-viewer styles in this catalog. Its **1774 × 887** original rendered inside a **1172 × 893** region, so there was no vertical Actual Size overflow. CSS-only `140289734` supplies the existing viewer geometry and appearance locally, including bounded scrolling, Fit/Actual Size and focus styles. The fixture and ownership guards were not relaxed. The fresh full journey on that correction passes within the separately recorded scope below.

Artwork, manifest, source documents and historical qualifications remain unchanged. There is no shared router, Confirm-lifecycle, gameplay or saved-content change. The source catalog remains outside the default package collector.

## Automated evidence

The initial committed runtime cohort passes **88/88**, with zero failures, cancellations or skips:

- 37 Reserve catalog tests.
- Three direct-tool loading cases, with only the Reserve case adapted for the extracted owner.
- 31 shared source-viewer cases.
- Four authoring-reference cases.
- Two native-menu inventory cases.
- 11 production source-loader cases.

These counts overlap the narrower **39/39** Reserve/direct-tool run and the earlier **87/87** run before the endpoint regression was added. They must not be summed. The final cohort covers exact historical metadata, invalid source descriptors, bounded manifest integrity checks, delayed loading, canceled and superseded generations, timeouts, stale-image disposal, retained-image behavior, lifecycle transitions, current modal/control focus, endpoint navigation, literal source reading, exact Back, actual Sections targets and live English/Ukrainian labels. Both edited test files pass ESLint and Prettier.

The integration fixture uses the real catalog, reference host and shared viewer. It adapts only the module's served HTTP origin and provides finite DOM, image and input boundaries. Literal README, manifest and one generation prompt are validated through the real byte/hash reader. Its modal-open notification represents an actual `open`-attribute change; neutral polling does not fabricate modal mutations. Image loading in these owner tests is modeled, so the test count is not browser pixel-decoding or physical-controller evidence.

The first static-document fixture used a fixed number of event-loop ticks and asserted before asynchronous WebCrypto completed. It was corrected to await bounded viewer settlement. No production ownership guard was changed to satisfy that fixture. Earlier runs against incomplete markup/locales were development feedback, not source regressions or final acceptance.

Receipt `/tmp/reserve-catalog-focused-final-20260930.txt` (**20,073 bytes**), SHA-256 `3d0181f5615be5b774ca8cda2e41b8745798c38a824a3209408d65a5bf53d346`, records the final 88-case cohort.

The CSS-corrected runtime receives a separate **77/77** repeat: 37 Reserve, three direct-tool, 31 shared-viewer, four reference and two inventory cases, with zero failures, cancellations or skips. Its log contains no production-panel cases; the 11 production-panel results remain attributed to the earlier 88-case cohort. `/tmp/reserve-catalog-scoped-layout-20260930.txt` (**17,232 bytes**), SHA-256 `0767e5b39d483074fbae69b3c5dfd696e776889883dec6091d9b6e4d4f47e3a6`, records this overlapping repeat. These counts are not additive.

The separate sparse-server Python suite passes **2/2**. It verifies the actual runtime dependency closure and allowed response bytes/MIME types, and rejects unrelated game, authoring, Git and traversal paths. This is server-route evidence, not installed-offline or full browser boot evidence. Localization passes **11,978 messages / 8,847 references**, recorded in `/tmp/reserve-localization-20260930.txt` (**121 bytes**), SHA-256 `87be83023759cfd7c9923b4730cd33e7d74d5ba426972b7291e7de751e2f804b`.

## Virtual-controller browser journey

The first full virtual-controller attempt at `fa31dcc6996f5383989017f98f7ea51739924a06` reached **2/4 stages**, then failed the Actual Size bounded-region assertion because of the real missing CSS described above. Its first two stages inspected all 40 selected Blobs against exact hashes and browser image decoding, plus four theme filters and three Sections. That partial attempt is not a passing complete journey. `/tmp/reserve-catalog-controller-first-20260930.json` (**17,931 bytes**), SHA-256 `89fab0d1de109251e8ebc6dceb6b96d5e136fca71d8e3db9d4f0d14db9accece`, preserves the failure separately.

A fresh full journey on CSS-corrected `1402897341fc31e478ea2c0c04f7753ddf7aa40c` passes **4/4 stages**. The real shared controller editor selects all **40 originals**. Each displayed Blob matches its recorded byte count and SHA-256, and the browser decoder produces **1774 × 887** pixels. The 40 originals total **92,797,189 bytes**. The runner retains Blob observations separately from the product's single-image surface; this is not a memory-consumption or resource-residency measurement.

All four ten-work theme filters, canceled theme and illustration drafts, Previous/Next, successful Retry and all three Sections preserve exact selected identity and owned focus. Opening the retained original in the shared viewer reaches Actual Size **X 736/736 and Y 561/561**, then Start returns both axes to zero. Fit displays the same image at approximately **652.39 × 326.20 CSS pixels**. The receipt's `image.width=1038` and `height=326` are the scroll-region geometry; they are not the original image dimensions, which are verified separately. Reader Back and modal Back return to their exact owners.

Six source types match their original literal UTF-8 bytes and SHA-256. The selected Wave 2 work exposes both its generation and cleanup prompts:

| Source            |  Bytes | Lines | Observed End Y / maximum |
| ----------------- | -----: | ----: | -----------------------: |
| Generation prompt |  2,163 |     9 |                338 / 338 |
| Cleanup prompt    |    659 |     2 |                    0 / 0 |
| Provenance JSON   |  5,642 |   184 |            4,561 / 4,561 |
| Wave notes        |  5,239 |    69 |          1,745.5 / 1,746 |
| Catalog manifest  | 71,251 | 1,612 |          41,979 / 41,979 |
| Catalog README    |  4,533 |    31 |          1,361.5 / 1,362 |

All six have zero horizontal overflow and Start returns to zero. The cleanup prompt fits without vertical overflow, so its unchanged zero position is not scrolling evidence. The journey exercises bounded readers, exact two-step Back and viewer Retry. These six documents qualify their source types and the selected paths; they do not imply that every prompt/provenance/note in all 40 entries was opened in the browser.

Live Ukrainian/English page, inspector and reader names follow locale changes without altering source identity; canceled language selection retains its value. Source documents retain their original language. The journey restores the first illustration, All themes and English, explicitly activates Download for the exact prepared **2,943,263-byte** `fpv-sunflower-signal.png` Blob, and uses the real reference Return to reach Asset Studio at `http://127.0.0.1:9004/authoring/asset-studio/`. No editor operation follows that arrival. Download activation alone is not an OS-file receipt; the later disk validation below supplies separate artifact evidence. Studio startup remains outside catalog storage acceptance.

Visible result `/tmp/reserve-catalog-controller-20260930.json` (**22,243 bytes**), SHA-256 `4b536af5e771708ce35eff8963a115cffa50f78bf6feee2eae0b243e411df40f`, records the four stages. This run injects no network faults or timed loading cancellation. It is virtual-controller browser evidence, not a physical-pad, sparse-server return, installed-offline or performance result.

## Native keyboard and actual download evidence

The first native traversal reached all 40 selected images before the final Sections attribute and endpoint-focus corrections. At the final Next action, the now-disabled button lost focus to the body; this prompted the source correction and focused regression above. That earlier traversal is not counted as a completed current-source keyboard journey.

A fresh committed-source repeat on `1402897341fc31e478ea2c0c04f7753ddf7aa40c` uses unindexed native keys at observed **390 × 844**, without a pointer focus reset before the separate download capture. It reaches all **40 selected originals**, each Ready with one displayed **1774 × 887** image. Next retains focus until the final selection, where focus correctly moves to Previous. The page has zero horizontal overflow. Exact per-Blob hashes for the full forty-image matrix belong to the separately attributed virtual-browser receipt, not this native observation transcription.

Native Actual Size reading reaches **X 1,452/1,452 and Y 382.5/383**; Fit restores **322 × 161 CSS pixels**, both scroll positions zero and no overflow. The same six source documents retain exact bytes/SHA-256. Their native End positions are **1,541.5/1,542** for the generation prompt, **134/134** for cleanup, **6,890.5/6,891** for provenance, **4,792/4,792** for wave notes, **89,507/89,508** for the manifest and **4,152/4,152** for the catalog README. Every document has zero horizontal overflow, Home returns to zero, reader Back restores Read and modal Back restores the exact original link. Unlike the desktop virtual view, the portrait cleanup document overflows and its native scrolling is qualified.

The Source identity Section reaches `identity-toggle` and opens its disclosure. The sparse preview's reference Return remains on the catalog URL and returns to page-top scroll zero; the recorded target ID is empty, so this does not establish an exact named focus target or Asset Studio arrival. The separate full-server virtual journey supplies its actual Studio return evidence. Native Ukrainian page title, inspector accessible name, Ready status and Return text update; successful Retry restores Retry focus. This is selected live-label coverage, not every shared Ukrainian hint or a complete Ukrainian source-document translation.

Compact observations `/tmp/reserve-catalog-native-20260930.json` (**12,518 bytes**), SHA-256 `273838ad60fa5a6c4ac73a2656c11dc30a809033db76ddab324801c23574acf7`, are a transcription, not a raw interaction archive. Their download section records **two native Return attempts whose supported download observer timed out**. That earlier transcription describes the observer limitation, not a failed application download. The later independent disk inspection below found and validated the files from both attempts. The original transcription remains unchanged.

All **four actual OS files** are present in Downloads. Their bytes and SHA-256 match the pinned originals, production `inspectImageDataUrl` accepts them, and independent bounded RGB8 PNG decoding verifies CRCs and every scanline at **1774 × 887**, producing **4,720,614 decoded pixel bytes** per file.

| Download attribution           | Filename                                |     Bytes |
| ------------------------------ | --------------------------------------- | --------: |
| Virtual controller             | `fpv-sunflower-signal.png`              | 2,943,263 |
| Native keyboard, first attempt | `spend-storybook-rail-depot.png`        | 1,803,179 |
| Native keyboard, repeat        | `spend-storybook-rail-depot (1).png`    | 1,803,179 |
| Separate pointer check         | `retro-midnight-disk-station-clean.png` | 2,136,452 |

The two native files are byte-identical and pixel-identical to one another and their selected original. Attribution to input methods uses the exact filenames, modification timestamps and ordered UI activations; the download-event observer still timed out for the two native attempts and the later pointer check. The successful files do not retroactively turn those observer waits into passes. The separate pointer activation follows the keyboard workflow and is not used as keyboard navigation evidence.

`/tmp/reserve-catalog-downloads-20260930.json` (**3,591 bytes**), SHA-256 `af7b8f2cb29ac08d0b93f40da7c9f03dbc73be4f62b09558078bcacd74cf4885`, pins the four files and selected validator inputs. It does not claim a complete source-graph capture for that separate validator. No downloaded art is installed or adopted into gameplay.

The final portrait screenshot `/tmp/reserve-catalog-native-portrait-20260930.png` (**52,842 bytes**), SHA-256 `2db8edb59a2017a67ed21802e0814bdeab0b533cd3b62cafe990b98be9753068`, was visually reviewed. It is a browser screenshot, not physical-phone or native-build qualification.

## Controlled native loading and recovery

A separate current-source native journey uses unindexed keys without a pointer reset on the ordinary full server at **1280 × 720**. An initial HTTP **503** leaves the catalog hidden, no image displayed and an actionable error. The independently pinned **4,533-byte README** still opens, matches its exact SHA-256, reaches **Y 1,257.5/1,258**, and returns to its exact footer opener while the catalog remains in error. Clearing the fault and using native Retry reaches Ready with Retry focused.

An actual **12-second manifest delay** then leaves the completed image Blob visible and places focus on Cancel. Explicit native Cancel returns focus to Retry. After the delayed response arrives, the state remains canceled and the same completed Blob remains displayed. Clearing the delay and retrying restores Ready and the first selected illustration. The actual Escape/Return path reaches Asset Studio with `#save-workspace` visible; no editor action or save follows. This full-server return is separate from the sparse preview's same-page return behavior.

`/tmp/reserve-catalog-native-faults-20260930.json` (**1,769 bytes**), SHA-256 `d2bdb2210101940762f4171961e2b3647d20cf4537fc0bed1b06db483506cc0a`, is a compact observation transcription, not a raw trace. It qualifies the observed initial-error/static-document/recovery/delayed-cancel sequence. It is not the complete network-failure, 30-second timeout, reconnect, lifecycle or malicious-body matrix; those additional owner and integrity cases retain their automated-test attribution. Physical controllers, native builds and public route acceptance remain separate.

## Protected sources and packaging boundary

The prechange capture pins **103 selected references** totaling **93,001,638 bytes**: 40 original PNGs, 42 prompt files, ten provenance files, ten wave-note documents and one selection inventory. The selected originals total **92,797,189 bytes** and retain their recorded **1774 × 887** dimensions. The local **71,251-byte manifest** and **4,533-byte README** are separately protected. Two unselected early Wave 2 originals totaling **4,984,701 bytes** remain preserved outside the chooser. They were neither removed nor added to the 40-work list.

All 103 references, both local documents and both excluded originals match their protected baseline pins. Original byte/hash/Git-blob/IHDR checks establish source identity, not browser decoding, visual quality, authoring approval or runtime adoption.

The initial committed bounded source capture at `fa31dcc6996f5383989017f98f7ea51739924a06` resolves **149 resources / 32 modules / 71 edges**, including 55 module edges. All **156 captured paths** match committed Git blobs and current disk with zero drift. The direct launcher's computed `import(moduleURL)` is explicitly resolved from the actual HTML `data-module`; it is not treated as an unknown dependency success. Navigation destination graphs, linked prose documents and dormant shared chooser resources remain outside this closure.

The default collector remains **2,494 paths**, with the same path-list SHA-256 as baseline, zero fixtures and **zero Reserve catalog/source-art paths**. Build configuration is unchanged. Python/server/test support pins in the evidence capture are not runtime package admission. No materialized package or complete default-package byte capture is claimed. The separate final capture at `1402897341fc31e478ea2c0c04f7753ddf7aa40c` repeats those **149-resource / 32-module / 71-edge / 156-pin** bounds with zero Git/disk drift and the same collector path list. It captures the CSS correction while preserving the earlier `fa31dcc6996f5383989017f98f7ea51739924a06` receipt.

| Receipt                                                         |  Bytes | SHA-256                                                            |
| --------------------------------------------------------------- | -----: | ------------------------------------------------------------------ |
| `/tmp/reserve-catalog-prechange-pins-20260930.json`             | 41,155 | `fcd294480dff0962205466bf2fc0e78c97435ec8bc6c608b83970dab81962f1f` |
| `/tmp/reserve-catalog-package-boundary-prechange-20260930.json` | 16,696 | `5b4ee10060d49f6cb048ba319bab96f15abff36c61a80f1f71905b9e3855ef14` |
| `/tmp/reserve-catalog-source-package-final-20260930.json`       | 65,741 | `dd1fec7939fb0cf79351dd513650338551e29226410a36b5401f29a8c127351e` |

## Edition compilation and remaining acceptance

Fresh sequential in-memory production compilation passes **18/18 editions** at actual source revision `fa31dcc6996f5383989017f98f7ea51739924a06`. The capture pins **1,251 unique inputs**, including a **132-module / 466-edge** static compiler closure. Its 706 engine and 523 selected input categories overlap and must not be summed. Largest DroneAid output has **801 files / 66,921,020 bytes**, leaving **187,844 bytes** headroom.

The CSS-only correction changes none of those 1,251 compilation inputs, so no redundant compile was run. Final combined attribution verifies **1,375 unique paths** against Git `1402897341fc31e478ea2c0c04f7753ddf7aa40c` and disk, including the two excluded originals, with zero drift. An initial attribution attempt detected CSS changing during capture and rejected that attempt without writing a receipt; the fresh final capture passes. Actual generated `fa31dcc6996f5383989017f98f7ea51739924a06` source metadata and all earlier receipts remain intact.

| Receipt                                                     |   Bytes | SHA-256                                                            |
| ----------------------------------------------------------- | ------: | ------------------------------------------------------------------ |
| `/tmp/reserve-catalog-source-package-bounded-20260930.json` |  65,741 | `d014f7f4938b163775a22b213ebc0e5e43b607c71ec07ffc1b0572c1d183d001` |
| `/tmp/reserve-catalog-edition-package-20260930-full.json`   | 457,759 | `3bb813d6ef773f372d3cd6af2a0c36c154fc7bc7379d234fc673cca6e6f40de0` |
| `/tmp/reserve-catalog-final-attribution-20260930.json`      | 339,056 | `d5440f3baed7e0b5c8c50648acb9ef402dbade8dfb35ff430c1fcab619b36aec` |

These are single production-API compiles and bounded source captures, not reproducibility double-builds, provider parity, materialized releases, installed-offline results or published acceptance. The four newer editions have compiler coverage only; no new layout/device claim follows from the 18-edition count. The source-only Reserve catalog remains excluded from those game packages.

Browser/OS downloads and permission surfaces remain platform-owned. Downloading a retained source does not install it into the game. Physical controllers, native builds, installed offline, active forced colors, true 200% zoom, representative mobile memory/performance/comfort and canonical publication remain separate gates. The broader native-menu plan remains incomplete, and Releases retains integration and publication ownership.

All owned browser tabs (**21, 22 and 23**) were closed, the temporary viewport override reset and the controlled fault file cleared to `{}`. Owned servers (**PIDs 42642 and 46414**) were stopped. Other origins and saved content were left untouched. Actual downloads and verification receipts remain available; the cleanup does not erase the observer limitations or expand the evidence scope.
