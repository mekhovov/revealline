# Public Social Drone · Sky Watch

The Studio example is now also a normal public Social Drone campaign. In the game, choose **Social Drone UA → Missions → Sky Watch**. This single-mission campaign does not require importing an `.rlpack` or completing the other Social Drone campaigns.

The supplied 9.450522-second MP4 is retained byte-for-byte (`880e5dd71b9dafc0efd318a7dd12216b35bc18e7cb5f2abd155663fb91aae496`). Its picture is the previously approved Studio poster (`3aa3c35ddb9f16b82d29020859ea5f397074b9cbc767e22d587b00fb5119f91d`). English and Ukrainian visual descriptions and descriptive captions are explicitly not soundtrack transcriptions.

The public campaign has its own mission and completion reward. The previous Social Drone presentation is retained as an exact snapshot, and existing campaigns keep their authored identities. Winning uses the shared completed-board hold and picture celebration, then opens the exact earned video in a full-window native player. The poster remains underneath during decode and the 650 ms video fade. Reduced motion removes the fade; blocked autoplay leaves a Play control. Closing playback returns to the completed picture. Shared mute/volume and foreground audio ownership still apply.

## Verification

- Public runtime provider includes `social-drone-sky-watch` in Social Drone's edition and resolves all six exact media/description originals.
- Actual engine island-channel route wins with three lives; the exported replay verifies and earns the video without previous campaign clears.
- Actual Solo host test opens Missions, selects Sky Watch, completes it, verifies that the completed board remains visible during the initial hold, and observes the earned-video dialog only after celebration. It closes cleanly.
- Native-media adapter tests cover poster continuity, 650 ms fade, reduced-motion/autoplay rejection fallback, audio ownership, language, blur, cancellation, and disposal. Native decoder behavior is mocked in these tests; they do not establish actual browser playback quality.
- The selected Social Drone edition compiles through the production edition compiler, including its media and historical snapshot. Generated content and public-source eligibility checks pass.
- Broader media/Solo/win regression run: 64 passing, one pre-existing failure in `edition pause keeps canonical Skip confirmation and Watch first cut actions reachable`. The identical failure reproduces with the changed runtime files restored to main: its canvas test double lacks `clearRect` in `demo-host.mjs`. No production demo code was changed by this PR.
- ESLint, Prettier, generated-content freshness, public-source eligibility, and localization checks pass.
- Visual browser acceptance is blocked by the local preview's password gate. No gate was bypassed. The existing Studio video example had been browser-qualified in the preceding work; that does not replace acceptance of this new community route.

This is source/PR evidence, not a claim that GitHub Pages has deployed the new campaign. Publication follows `docs/main-repository-publishing.md` through the canonical release owner. The public destination after release is `https://mekhovov.github.io/revealline/game/communities/social-drone-ua/`.
