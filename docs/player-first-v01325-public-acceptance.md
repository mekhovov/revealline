# v0.132.5 public acceptance

Observed on 26 September 2026 against the immutable public release and exact
Pages selector below.

## Provenance

- Release: [v0.132.5](https://github.com/mekhovov/revealline/releases/tag/v0.132.5)
- Product source: `a8881ac17e44f38fb1e9dc15428899992727cc78`
- Pages selector merge: `8f7ea5540d6851fb2d6d77a42c899e071e65e52a`
- Pages workflow: [run 36243552142](https://github.com/mekhovov/revealline/actions/runs/36243552142)
- Public-byte artifact: `10906853205`
- Public-byte artifact digest: `sha256:c3d71242dea7cc04daeaea49358745c0f993f62479d0f5ac2a7f2354ac52667d`
- Distribution digest: `sha256:0445f74af9237838c7f88c08de289d0ed98a4aece4dd103e08104082b9495244`

The hosted public-byte audit read 1,866 files and 629,829,862 bytes in 1,866
requests with zero retries and zero failures. The public `release.json` and
release selector both reported v0.132.5 and the exact product source. Immutable
v0.132.4 remained available through Archive93.

## Browser interaction

The public release selector identified v0.132.5 as Current and linked to the
canonical frozen route. A visible in-app-browser session then exercised these
ordinary player entries:

1. Solo loaded the 91-mission New Journey home with Start/Continue, Missions,
   Collection, Settings, More and Sound.
2. Versus loaded the 91-mission New Journey lobby with Start race as the primary
   action and the shared Solo/Versus/Team switcher.
3. Team loaded the 12-mission Team Journey lobby with Start together as the
   primary action, then entered active Twin landings play. The shared arena used
   the prepared mission picture binding and exposed the two numbered player
   identities, territory objective, Support state, Pause and Skip mission.
4. Team changed language in place from English to Ukrainian. The document title,
   mode switcher, arena, objective, primary action, music controls, optional
   settings, help and sound labels refreshed to Ukrainian.
5. The Team mode switcher opened Versus with Ukrainian retained. The 91-mission
   journey, player identities, primary action, match options, Settings, sound and
   help were Ukrainian.
6. The Versus mode switcher opened Solo with Ukrainian retained. The Journey
   count, mode switcher, Continue destination, Missions, Collection, Settings,
   More, Sound and difficulty/appearance disclosure were Ukrainian.
7. Solo changed language in place from Ukrainian back to English. Its Journey
   count, mode switcher, Continue destination and full main menu refreshed to
   English.
8. The Solo mode switcher opened Versus with English retained, including the
   journey summary, players, primary action, options, Settings, sound and help.
9. The Versus mode switcher opened Team with English retained, including the
   arena, objective, primary action, optional settings, help and sound.

This closes the bounded live English-to-Ukrainian and Ukrainian-to-English
refresh and ordinary-entry gap for the accepted predecessor. It does not claim
physical touch, physical controller, Steam Deck, complete mission journeys,
comprehensive offline behavior, human balance, screen-reader output or
performance qualification.
