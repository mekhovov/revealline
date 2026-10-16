# Jamming that changes tracking decisions

## Finding and selected treatment

The original receiver effect duplicated current actors and cable in both image branches. Its nominal 65% noise blend still retained about 74% of distant actor contrast at maximum strength and 94% at the local-radius boundary. More grain alone was unlikely to create the requested tracking challenge.

The selected treatment samples the current terrain before drawing actors and cable, then uses that terrain for a coarse, desaturated receiver branch with analog snow and horizontal bands. Distant moving detail survives only in the remaining clean feed. The head's two-cell neighborhood, source cells, and native danger outlines stay clear. The next collision remains readable while planning a distant interception or keeping track of a long tail requires more attention.

This is an information-loss mechanic: the player can prepare a route before the warning ends, approach through clear ground, leave local range, use Pulse, or catch the visible source. Steering, target movement, collision geometry, randomized burst timing, accepted recordings, and grading rules are unchanged. No false target positions or stale camera frames are introduced.

## Compared prototypes

Paired synthetic target/no-target images, identical terrain and noise seeds, 12 frames per sample. Percentages measure retained actor contrast, not player difficulty or success rate.

| Treatment                   | Local edge | Mid-range | Full broadcast |
| --------------------------- | ---------: | --------: | -------------: |
| Original reference          |      93.5% |     83.9% |          74.1% |
| Stronger snow alone         |      74.8% |     72.2% |          69.6% |
| **Selected reception loss** |  **46.3%** | **40.6%** |      **35.0%** |

The selected treatment retains at least 35% of the undistorted native-resolution feed. Nearby protected detail retains 100%. Reduced effects uses equivalent static degradation, rather than removing the challenge. Canvas readback failure falls back to bounded procedural interference, so a community skin cannot silently disable the effect.

## Browser comparison

The fixture's receiver selector compares all three treatments at the same simulation boundary. Take controls offers keyboard and on-screen steering; it never writes player saves or awards. Reset returns to the verified journal.

- Quiet Channel, Solo normal, hazard seed 17, move 56: an ordinary runner is four cells from the head; five of eight body cells lie outside the protected area. The runner moves at 59, comes into clear local view, and the accepted route catches it at 62 before reception returns at 63.
- Quiet Channel, Team slow, move 28: both protected player neighborhoods remain readable at 320px; the board is 290px wide with no horizontal document overflow. Reduced-effects playback continues updating positions.
- Field Links, Solo slow, move 34: local interference affects distant cable detail. At move 37 the live view returns immediately, without a stale processed frame.
- Manual steering was exercised through an active broadcast burst. No browser warnings or errors were recorded.

All 12 fixture combinations (two scenarios × three player modes × local/broadcast) replay to their accepted outcome. Introductory local missions mostly contain only the protected jammer; those deliberately simple encounters are not representative of distant-prey tracking pressure.

Screenshots: [original](jamming-original.jpg), [snow trial](jamming-snow-trial.jpg), [selected](jamming-contrast-loss.jpg), [320px Team](jamming-mobile-team.jpg). Human difficulty calibration remains open; contrast measurements alone do not establish an optimal difficulty.

## Research and alternatives

- [Riot's Omen description](https://playvalorant.com/en-us/agents/omen/) uses temporary reduced vision range. The design inference here is to preserve local action while disrupting distant information.
- [Ubisoft's original Mute design](https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/4en01O0QVsEiwZyR66P8Zt/operator-spotlight-3-mute-british-unit) ties interference to a limited area and a removable source. This is a historical design example, not a claim about current balance.
- [Xbox motion-settings guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117) supports an equivalent stationary treatment instead of escalating camera motion.

An obstacle-blocked acquisition beam and reception islands could create additional route choices, but would change the accepted transmission rules and require new authored profiles and recordings. Input lag, inverted steering, and live-looking old images would undermine trustworthy collision decisions. This iteration selects stronger information loss with the existing range/source/Pulse counterplay.
