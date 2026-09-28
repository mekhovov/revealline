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
| [UNESCO: Ornek decision](https://ich.unesco.org/en/decisions/16.COM/8.B.45)                              | Future Crimean Tatar campaign research and source-specific interpretation                                           | Contextual facts only at this stage; the listing does not license all linked photographs                                                                                                                                                     |
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
