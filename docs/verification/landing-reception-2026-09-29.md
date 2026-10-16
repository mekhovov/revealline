# Visible landing motion and receiver dropouts — 29 September 2026

The reported landing really was bypassing the entrance: the actual open home had `motion=on`, `running=true`, `renderer=webgl`, but computed artwork-plane animation was `none`. This was not a disabled player preference. The arrival selector applied only to CSS fallback. Additionally, complementary cloud samples largely canceled translation on smooth sky gradients.

## Change

- A single six-second CSS entrance scales the shared image/canvas plane from 1 to 1.035, then holds. WebGL success and failure receive the same arrival; there is no alternating zoom or GPU camera animation.
- Clouds use a feathered single source sample with slow nonsynchronized drift, bounded by their authored region. FPV sky anchors exclude sun, horizon and tower silhouettes. Foliage and local source lighting have modestly stronger motion. No-region artwork renders once.
- New `menu-signal-loss.mjs` samples only the landing picture, applies grayscale receiver noise and one to three horizontal displaced bands, then fades fully away. First burst: 8–12 active seconds; subsequent quiet intervals: 18–32 seconds. Bursts last 550–850 ms with a smooth opacity envelope capped at 0.4. Processing is at most 256 pixels on the longest edge and 12 fps during the burst. There is no idle rendering or sound.
- All effects share off/reduced/visibility gates. A separate observer handles sibling open dialogs, so Settings covering home immediately pauses the picture and cancels interference without losing the body preference observer.

## Browser observations

Verified in a separate in-app browser tab using the real `/game/` landing, with existing Ukrainian settings. The user's pre-existing tab and preferences were not reloaded or changed.

- Production WebGL home computed `menu-art-settle`, initially scale 1 and subsequently scale 1.035. The `#shell-play` bounds remained x64, y367.734375, width510, height56 during settled watching and a naturally scheduled burst.
- Captured a full natural receiver burst: observed opacity 0 → 0.196 → 0.337 → 0.400 → 0.342 → 0.062 → 0, with the receiver hidden after recovery. [Peak frame](landing-reception-2026-09-29/dropout-3.jpg) and [clear frame after recovery](landing-reception-2026-09-29/dropout-6.jpg) show unaffected controls and actual picture disruption.
- Opening the real Settings dialog changed landing `running` to false, CSS animation-play-state to paused, and the receiver to hidden. Returning restarted the quiet interval and produced the captured burst.
- The isolated manual preview's Static picture fallback used `renderer=css`; scale progressed from 1.00596 to 1.035 with the same six-second arrival and stayed there. Still image switched motion off, transform to none, and receiver display to none. These test controls write no shared preference. [Recorded DOM values](landing-reception-2026-09-29/fallback-and-controls.json).
- A portrait browser check loaded `fpv-portrait.webp` on the real home and showed the entrance at scale1.02315, with controls legible and unobstructed. [Portrait screenshot](landing-reception-2026-09-29/portrait.jpg). This is a browser layout check, not physical-phone qualification. Temporary viewport override was reset.
- The portrait check produced no warning/error console entries.

## Automated verification

- **60/60 passed:** `node --test game/test/menu-scenes.test.mjs game/test/menu-scene-motion.test.mjs game/test/menu-signal-loss.test.mjs game/test/menu-retune.test.mjs game/test/menu-retune-host.test.mjs`.
- **6/6 passed:** edition runtime, boot build/native staging, native menu inventory and offline core closure cohort. Assertions include exact new module bytes/hash after public offline selection and desktop/iOS staging.
- Scoped ESLint, Prettier and whitespace checks passed.

Tests cover one clock per owner, no-region idle, failure fallback, source changes, late callbacks, visibility and settings interruption, reduced flags and menu preference, bounded source sampling, no content/input replacement and cleanup. These changes animate a flattened picture; they do not introduce a rigged drone, generated video or new artwork assets.
