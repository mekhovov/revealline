# Spatial sound implementation record

## Phases

1. Baseline: isolated managed checkout of current main `321408a3cfd75ae230d760f39fb692503652601a`; preserve the original working directory. Inspected runtime actors, capture and terrain events, replay ownership, multiplayer hosts and existing audio transport. Acquired three official CC0 packs and preserved used originals/licenses.
2. Infrastructure: presentation-only `FeedbackDirector`, local PCM bank, bounded voices, asynchronous preload with no delayed event replay, per-source gains/stereo, independent menu bus and preferences. Existing published-asset aliases remain supported; music catalogue and save/replay schemas remain unchanged.
3. Integration: Solo, Versus, Team, company player and Replay Theater call the shared director. Gameplay-event identities are per run, tick/time/index. Versus has two decorative slots per board; shared Team sources use nearest active listener once. Existing simulation commands are unchanged.
4. Presentation: three capture sizes, material contact variations, body movement families, separate result/terrain-state signatures, independent menu toggle/volume, cell-clipped reveal gestures and gate release pulses. Existing win/loss presentation durations are unchanged.
5. Qualification: focused tests and native observations recorded below. Complete release qualification remains required before immutable publication.

## Coverage matrix

| Authority | Feedback |
|---|---|
| Moving player body | Rotor/motor, wing/cloth, grain/paper, wheel textures; body override remains independent of ability |
| Moving field, border, contour enemies | Distance gain, screen-position pan, source retirement; no decorative idle or blink sounds |
| Ground rover | Dormant quiet; warning, activation, cancellation, moving layer |
| Eroder | Preparation warning, actual erosion, blocked erosion; changed terrain reactivation |
| Lane/relay encounter | Warning/opening/phase/stage events; final run result supersedes capture ending |
| Combat patrol | Lock, fire, impact, cancellation, elimination, projectile removal |
| Team threats | Warning, committed attack, launched/intercepted/cleared impact, recovery, down/revive, rescue, shared support |
| Walls/foundations | Blocked held-direction transition or authoritative capture stop; no repeating collision while held |
| Slow terrain | Entry/release, active texture; safe captured cells no longer emit |
| Signal zone | Entry/exit and authoritative suppression/recovery; one positioned texture per zone |
| Directional field | Movement-dependent flow/resistance rate |
| Relay gate | Release cue and short safe-cell pulse; passability remains immediate |
| Pickup/hangar | Successful supply, class switch, rejected action, deployment, shield/scan/pulse |
| Picture capture | Claimable-area tiers; closure + reveal + material gesture; terrain neutralization |
| Results | Start/retry, damage, respawn, loss and victory |
| Menus | Keyboard navigation, confirm/back; independent persisted enable + 35% default volume |
| Replay/practice | Existing controlled subject; replay pause/restart/inactive cleanup; historical events never replay after decoding |

All twelve Journey material entries select a material profile from their registered source theme, with legacy FPV/Atlas/Retro/Spend Network and custom-family fallback. Source assets are shared to keep memory bounded. This is not a claim of individually recorded vocalizations for every skin.

## Verification evidence

- Focused sound/mixer/render/offline suite: 115 tests passed (audio lifecycle, published aliases, attenuation, capture sizes, per-board deduplication/fairness, freeze/frame stability, storage defaults and binary provenance).
- Content and presentation validation passed, including English/Ukrainian localization.
- Native Chromium 154 / macOS: final 42-asset bank decoded 42/42 in the production audition page.
- Native shared-master probe at 48 kHz, 2026-09-29T08:06:23Z: all six checks passed; initial/mid-play mute and zero volume measured zero; quarter-volume RMS ratio 0.24965009; restored ratio 0.99944865; owned context closed.
- Local production build passed (1818 files); all 42 WAV files plus the bank module are now in the core offline cache, and their built bytes match source. See `build.json`; this is packaging evidence, not an immutable release certificate.
- Native Solo keyboard run completed the first mission: 34.3% coverage, 8160 score, three lives retained, no console errors. Master was muted, so this verifies gameplay/presentation only.
- Native Solo booted and showed Audio → Menu sounds enabled, Menu volume 35. Disabled/20% settings survived reload; enabled/35% was then restored.
- Full repository run exposed unrelated stale expectations/imports as well as an initial new fake-DOM compatibility failure. The new widget was corrected to use normal span elements. The broad run was stopped after failures and a pending Couch fixture; its output is not a green release gate. Replay/offline integration subsequently passed 19 tests, and the two Team reveal tests plus paused-music effects regression passed independently.
- Baseline evidence: main's combat adapter test imports missing `game/ui/player-locator.mjs`; continuous-host asserts historical session v4 while current runtime emits v6; boot build fixture omits `authoring/motion-lab/animation.mjs`. These require separate qualification/triage.
- Offline audit caught WAV references missing from the core cache. The scanner now follows WAV literals in the bank; a dedicated closure regression preserves essential effects while excluding source originals and optional music.
- A temporary full baseline extraction exhausted disk space. Only this task's incomplete `.cache/main-baseline` extraction was removed; user projects and existing worktrees were preserved. Subsequent checks use bounded fixtures.

## Release gate

Do not mark the sound design fully qualified from modeled or native digital checks alone. Remaining acceptance includes matched-level subjective audition, speaker/headphone and native device playback, sustained listening, and a fully green exact-source release gate. The intended attenuation and budgets are implemented policy, not subjective approval. Keep a draft review available while those gates remain open; do not publish a production release certificate claiming they passed.
