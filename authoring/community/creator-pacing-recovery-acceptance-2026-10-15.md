# Balanced campaign pacing and recovery — 15 October 2026

## Source and correction

Continued from main `691351e1d757276eea7e94cc08fca07f6a16021f` on
`codex/creator-cancel-recovery-20261015`. Preserved the shared development checkout.

The preceding twelve-image browser sample used only three of six families with Balanced variety.
The image creator added the item index to the generation seed, then added that index again when
selecting a family. Advancing by two through a six-family registry skipped half the registry.

Balanced selection now uses the existing seeded registry selector once. A shared batch-pacing
helper keeps Gentle start, Steady difficulty and Surprise me behavior explicit. Generation still
uses bounded authored variants, exact route verification and explicit gameplay source. Existing
installed editions are unchanged. Regenerating a draft produces a fresh review and approval.

Regression checks generate twelve projects for each of four root seeds and require each six-item
block to cover all six families, with actual enemies and walls. Existing tests replay all twelve
variants across supported Solo presets and steering policies.

## Ordinary browser evidence

Used the built-in desktop browser, normal access session, local no-store origin on port 8794 and
owned synthetic image fixtures. The temporary viewport is 1280×900. These checks do not qualify
named browser versions, physical audio or mobile hardware.

### Cancel, reload and resume

Selected twelve image files in `Cancellation recovery acceptance`, draft
`creation-5838a113-2d4f-4e96-831c-9e2b64dd77ff`. Started Generate, then activated Cancel preparation
with Enter. Preparation stopped during item 1; that card reported “Cancelled. This item remains
in the draft.” All twelve files remained included, approval was unavailable and eleven later
items remained queued. Reload restored checkpoint 2 with the same files and cancelled state.
Deliberately starting Generate again prepared all twelve and saved checkpoint 4.

After loading the corrected pacing implementation, the rebuilt review contained:
First crossing, Island chain, Twin corridors, Open terraces, Soft current and Ember garden,
then the alternate variants of those six families. Every card retained an enemy, walls and route
evidence. This closes a keyboard cancellation/recovery case; the earlier unconfirmed pointer
cancellation attempt remains a separate observation.

Approved and downloaded the corrected twelve-mission campaign: **1,752,551 bytes**, SHA-256
`96d3f1738e87b87f46606aa4f80adfb9dc91c3237587a4a824bff04ae4a7a5dd`, edition
`a58b8598adde5396c0425366fca5c66b419f07e006cf260e1e76c36b4ba19986`. Its explicit provenance
contains all twelve family/variant pairs observed in the review.

### Duplicate filenames and corrupt input

Selected two different owned files both named `same.png`, a portrait PNG, and a deliberately
corrupt `broken.png`. The corrupt item remained visible with its decoder error and blocked
approval. The other three prepared successfully. Explicitly unchecking only the broken item's
Include in campaign enabled approval.

Downloaded the actual three-mission pack: **372,431 bytes**, SHA-256
`0d7b87d763152cae30ed7cd6b5a1f44febfc63b27ea16733d076f0e4f9575989`.
Its manifest retains portrait plus both separately identified `same` missions, three distinct
runtime picture hashes and exactly three required payloads. The excluded damaged item is absent.
This is an actual browser export, not merely a modeled manifest.

### Fifty-mission transfer

Selected the previously downloaded 7,491,379-byte fifty-mission pack in the ordinary importer on
port 8793. This origin had separate existing storage containing three unrelated installed editions.
The importer verified the pack, required a new visual approval and installed the same immutable
edition `98046ef91681ab4627d0650322160b5906a1f039e08dd2e952f5ea4d3e7f645c`, reporting fifty
missions while retaining the three existing entries. This is independent-origin transfer, not a
fresh physical profile or a named-browser qualification.

Started the transferred campaign through its ordinary player and completed picture01 on Standard:
50%, three lives, 10,080 points, with its exact poster. Reload selected `picture-2` in the same
immutable edition. Original-creation storage and receiving-player progress remain independent.

### Actual package-capacity splitting

Selected 24 bounded owned 1280×640 noise PNGs (about 53 MiB of source files) to exceed the
24 MiB portable-package limit without exhausting browser or disk storage. All 24 prepared.
The review estimated 58.56 MiB, disabled bulk approval and offered explicit splitting. Split
produced 9/9/6 missions; each part required its own Review action before its download.

| Part | Actual bytes | Missions        | SHA-256                                                            |
| ---- | -----------: | --------------- | ------------------------------------------------------------------ |
| 1    |   23,005,444 | noise01–noise09 | `6bb264b005de92621b3c4eb6a0b885dc0c3c0d226ce97a5b612cad4eba31f049` |
| 2    |   23,020,048 | noise10–noise18 | `8bc3ed7163f6b5dac7809845dcb1b9c9dfb5bc9fab5349c86d38177d946c9ea9` |
| 3    |   15,339,423 | noise19–noise24 | `eff020b4b36af5be43dc4e54433a0d78b0832d8e505fcb4cb1ee24ed77e0579d` |

All three actual downloaded files are below 24 MiB. Their manifest union contains exactly the
24 selected missions in original order, without duplicates or omissions; each has only its
required picture payloads. This closes a real package-capacity split/export check, not browser
quota exhaustion, peak-memory measurement or installation of every split part. The final six-mission
part also installed successfully as edition
`35cdb6b02436012d770d33e188e5a638e858d466249c4a7beaaa9fb57ce62a7a`.

### Team follow-up

The installed Team mission restored its paused saved territory, picture and two remaining
reserves. Confirmed Restart returned to the same arena with three reserves. Another ordinary
keyboard route attempt ended in reserve loss. This does not establish unsolvability, enjoyment,
a legal Team win, earned reward or Next. Team victory/continuation remains the highest gameplay
acceptance gap; no rules were weakened to manufacture a pass.

## Validation and remaining work

Template, batch UI and checkpoint cohort: **18 passed**, zero failures/skips. Installation, bundle
and operation recovery cohort: **30 passed**, including interrupted writes, consumed stale reviews,
exact export/retry and immutable reward ownership. These injected storage failures are separate
from real browser quota exhaustion. Full `npm run validate`, changed JavaScript lint and formatting
passed on the tested baseline with the pacing correction.

Remaining: Team win/reward/Next, fresh-profile large-batch transfer, browser quota-failure recovery
and peak-memory measurements, named desktop-browser and
physical-audio checks, broader gameplay review, public-site creator acceptance, and live backend/
mail/operator/restore setup for community publishing. GitHub Pages is the static host.

At session start, the public deployment identity was still
`d040b6b632a802c0ddcf348244d1475a5602a65f`. PR #1498 is merged, but its Pages run was superseded by
newer main builds. Pending or superseded jobs do not establish public acceptance.
