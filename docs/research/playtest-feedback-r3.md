# Playtest feedback R3: readable decisions and recoverable line damage

Reviewed 2026-09-13 against the supplied v0.25 screenshots, the saved Reloaded manual frame at 00:50, prior source inventory, and the official material below.

## Evidence and implementation decisions

- **Observed:** the supplied results panel duplicates reading controls and buries important actions; live play devotes a large strip to static field explanation. **Reproduced in the real host:** non-dialog results did not receive arrow navigation, and controller focus could escape behind the panel. The shared menu scope now includes briefing, pause, results, picture and celebration. Main-menu access must also be inside that scope, not stranded in a top bar.
- **Observed:** the Reloaded manual uses markedly different shapes for field, contour, exposed-ground and eroding enemies. Our new catalog maps role to silhouette and an independent badge across all four themes. Changing palette alone cannot communicate a different danger.
- **Documented:** the [official Reloaded listing](https://store.playstation.com/en-us/product/UP2538-CUSA28099_00-XPOSEDRELOADED01) centers area capture, unique picture rewards and unlockable packs. It does not document collision timing. The requested two-sided travelling line impact is implemented as an explicit new edition contract, not asserted as a measured reproduction of its timing.
- **Readability:** [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/use-an-easily-readable-default-font-size/) recommends readable defaults and an adjustable size where possible. Pixelify Sans provides wider counters and less crowded letterforms than the previous Tiny5 UI. The unmodified [Google Fonts source](https://github.com/google/fonts/tree/main/ofl/pixelifysans), OFL and hashes are bundled. Direct cmap inspection found its missing Ukrainian capital І; the existing local Tiny5 supplies only that glyph. Browser layout and visual checks remain necessary despite valid font files.
- **Control consistency:** [Steam Input guidance](https://partner.steamgames.com/doc/features/steam_controller/getting_started_for_devs) supports distinct menu/gameplay actions and matching prompts. We retain neutral gates, draft select/slider edits, native pointer focus and explicit Resume. Touch controls remain available on compact/coarse-pointer devices; unused desktop directional buttons are removed from flight.
- **Delivery:** [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) cap the published site at 1 GB. All previous site copies total roughly 1.33 GiB with redundant ZIPs. Keeping exact playable files on Pages and ZIPs as GitHub Release assets preserves comparison access within a 950 MB gate. [Custom workflow guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) separates verification from deployment; PR checks do not deploy.

## Next improvements to evaluate after this correction

1. A short practice challenge that teaches the impact race: expose a long trail, see the two fronts, and choose an early safe closure. Score the ordinary real run; never fake a win for the demonstration.
2. Enemy introductions with a silhouette, one sentence of risk and an animated safe preview. Keep extensive statistics in the catalog, not in active flight.
3. Optional larger interface text with reflow tests, especially on handheld screens and distant TV viewing. Pixel styling must not determine difficulty.
4. Authored pickup combinations and threat mixes that create route decisions rather than merely increasing speed. Compare completion time, hit causes and retry choices in consenting human playtests.
5. Finish the video-poster/reward pipeline before producing the large story collection. A readable image reveal and clean next-mission action remain the fallback.

These are proposed follow-ups, not completed features or evidence of player retention. Physical controller and phone qualification, actual reference audio listening, and a new human assessment of the chapter remain open.
