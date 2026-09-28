# Discovery experience: research and delivery decisions

Reviewed 28 September 2026. These are design hypotheses and source records, not
claims that playtesting has established enjoyment, learning or native-device performance.

## Experience decisions

The [Nintendo Wonder developer interview](https://www.nintendo.com/us/whatsnew/ask-the-developer-vol-11-super-mario-bros-wonder-part-1/)
describes pursuing a surprising or delightful idea for each course. Our practical
translation is one authored spatial decision and one discovery per mission, with
different maps rather than replacement labels. The shared engine remains authoritative.

[PWA app-design guidance](https://web.dev/learn/pwa/app-design) distinguishes
standalone windows from browser display and emphasizes flexible window sizes.
We retain the installed edition launchers and responsive shared shell, reduce
mission-selector form clutter, keep native focus and button behavior, and use
the public home scene behind the expedition. Fullscreen stays an explicit action.

The expedition is an alternate presentation of existing mission cards. It does
not introduce another launch or completion system. The equivalent list, search,
filters, controller navigation and disabled states remain available. Finding the
next unfinished mission focuses it and does not start a run automatically.

First-win feedback is short and skippable; Next is never gated by animation.
Progress persists through breaks. Discoveries, clear goals, voluntary mastery
and lasting exhibits provide reasons to return. No compulsory streak, randomized
reward currency or escalating grind is added.

## Real objects and image eligibility

| Reference                                                                                                | Use                                                                                                                 | Publication decision                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Ivan Honchar Museum, НДФ-6482](https://honchar.org.ua/collections/detail/4181)                          | An individual garment with dated place, material and technique records; unknown maker remains unknown               | Facts and explicit source link. The licence link resolves to **CC BY-NC 4.0**, despite its shorter visible label; photos are not imported into these broadly redistributable editions                                                        |
| [Ivan Honchar Museum, НДФ-7132](https://honchar.org.ua/collections/detail/4182)                          | A separately attributed garment by Anastasiia Kravchuk, illustrating variation rather than a universal costume rule | Facts and source link; same image-rights distinction                                                                                                                                                                                         |
| [The Met, Dancer in Ukrainian Dress, 29.100.556](https://www.metmuseum.org/art/collection/search/436157) | A source-comparison reward: an artist's interpretation differs from an object catalogue                             | The exact downloaded image is marked Public Domain. [The Met Open Access policy](https://www.metmuseum.org/hubs/open-access) makes its public-domain images available under CC0. Credit, object number, original bytes and hash are recorded |
| [UNESCO: Ornek decision](https://ich.unesco.org/en/decisions/16.COM/8.B.45)                              | Crimean Tatar campaign research and source-specific interpretation                                                  | Contextual facts and attributed source links; the listing does not license all linked photographs                                                                                                                                            |
| [Social Drone UA](https://www.socialdrone.com.ua/) and [Victory Drones](https://victory-drones.com/)     | Organisation context, public learning and community references                                                      | Independent game scenes are not evidence of attendance, endorsement or a real workshop; technical practice is civilian                                                                                                                       |

Four original home environments have been generated and inspected: a community
workshop, learning observatory, textile gallery and component museum. The exact
selected derivatives and generation-master hashes are in the asset ledger.
They are explicitly fictional. Individual mission compositions remain a separate
production gate; sharing a home scene does not count as six distinct artworks.

## Reuse and production constraints

Keep the 64 MiB/2,000-file core offline limit and 32 MiB edition-asset limit.
Real-source images, generated artwork, localized sidecars and reward payloads
must all be admitted through the selected dependency closure. Locked rewards
show authored public teasers, not the final payload or a fetched final image.

The four-controls lab uses an untimed conceptual fixture with explicit Mode 2
labels and source links. Centering a control is not described as a universal
hover command. The later optional practice package has a separate model and
distribution identity, and cannot grant arcade Journey wins.

## Batch and release policy

Continue compatible code, content and art batches on `codex/discovery-rewards`
and draft PR #758. Run focused checks during parallel work, then the full relevant
suite at a stable batch checkpoint. Preserve old gameplay identities and earned
reward promises; presentation changes receive pack revisions when frozen.

The existing release coordinator owns version allocation and admission. A queue
hold is not a reason to stop implementation, create a competing release or split
one compatible integration into many waiting PRs. Public promotion still requires
frozen artifacts and their qualification receipts. Human and physical-device
evidence remains deferred, and is never substituted with automated route counts.

## Detailed presentation and shareable discoveries

The [Nintendo Wonder animation discussion](https://www.nintendo.com/us/whatsnew/ask-the-developer-vol-11-super-mario-bros-wonder-part-2/)
describes expressive character/enemy presentation while preserving recognizable behaviour, plus close sound/animation coordination. Here campaign key images and reward media remain presentation: canonical rules, collision, pressure and deterministic replay still decide the game. Campaign keys are public navigation art; locked final rewards never supply their payload images to the selector.

The native reward adapter uses explicit Play, a single foreground audio owner,
existing mute/volume preferences and soundtrack gain leases. Text transcripts
and video posters remain useful when media cannot load. Exact asset revisions
also feed static printable HTML; no external video embeds or autoplay are needed.
The six-card aircraft atlas and three-object textile atlas invite comparisons
and untimed predictions. These interactions explain consequences without claiming
verified mastery or changing arcade completion.

## Licensed real-life reference photographs

The following selected derivatives are registered with byte hashes, pinned source
records, creator attribution, licence links and changes. They illustrate real
objects; none is presented as the game's universal component specification or a
verified example of correct workmanship.

| Reference                                                                                                                                      | Rights                                                | Context                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Ardrone-img5-front.jpg](https://commons.wikimedia.org/wiki/File:Ardrone-img5-front.jpg)                                                       | CC BY 3.0 — Nicolas Halftermeyer                      | Historical product reference only; not a current recommendation or flight-permission example. No identifiable people.                                                                                                               |
| [Pinecil USB C soldering iron.jpg](https://commons.wikimedia.org/wiki/File:Pinecil_USB_C_soldering_iron.jpg)                                   | CC BY 4.0 — 4300streetcar                             | Must retain contextual caption: powered iron lies on a surface without a stand; not an example of safe setup. No procedural temperature advice. Modified Torx screw explicitly recorded by author.                                  |
| [Pixhawk.png](https://commons.wikimedia.org/wiki/File:Pixhawk.png)                                                                             | CC BY 4.0 — Pixhawk project authors                   | 380x276 original; do not upscale into a main wallpaper or treat legible connector labels as configuration instructions. Manufacturer marks are documentary only.                                                                    |
| [Quadshot drone brushless motors (8107827099).jpg](<https://commons.wikimedia.org/wiki/File:Quadshot_drone_brushless_motors_(8107827099).jpg>) | CC BY 2.0 — Ed Schipul                                | Flickr CC BY 2.0 reviewed by Commons FlickreviewR 2 on 2020-12-09; creator page currently unavailable to web fetch, rights statement independently captured through Commons. Depicts one historical motor, not a recommended build. |
| [Solder on spool.jpeg](https://commons.wikimedia.org/wiki/File:Solder_on_spool.jpeg)                                                           | CC0 — Wikideas1 (original upload credited as Kcida10) | Negative/comparison example only. The visible acid-core label rules out presenting this as the campaign’s recommended practice solder. Source metadata only said lead-free; visual review adds this essential distinction.          |
| [Solderedjoint.jpg](https://commons.wikimedia.org/wiki/File:Solderedjoint.jpg)                                                                 | CC BY 3.0 — MJN123; source crop by Soerfm             | Inspection example only, never labelled ideal/good/certified; no implied repair procedure.                                                                                                                                          |

Original generated scenes take their subjects from these and the campaign's
primary references, but are labelled fictional illustrations. A generated
picture's plausible appearance does not establish historic authenticity or
technical correctness. The image-admission tool verifies exact selected bytes,
retains prompts and corrective-generation provenance, and refuses replacement
of an already registered revision. Human artwork review remains deferred.

## Local shareable resource rewards

[Project Nayuki’s primary documentation](https://www.nayuki.io/page/qr-code-generator-library) describes its dependency-free MIT QR encoder. The edition implementation pins the upstream 1.8.0 JavaScript release and keeps code generation offline. Resource teasers promise a useful source; the earned QR only offers another way to reach the same visible HTTPS address. The player chooses whether to display or open it. No scanning, tracking, remote image service or secret entitlement is implied.
