---
name: xonix-audio-director
description: 'Design audio direction, music prompts, adaptive stems, event sound effects, menus, and audio asset plans for Xonix theme packs. Use for Ukrainian instrumentation, 1980s–1990s chip and synth moods, FPV arcade feedback, Coupa business themes, or audio variation and production review.'
---

# Xonix Audio Director

Read [Delivery priorities](../../../docs/delivery-priorities.md) first for the current scope, source/delivery status and remaining acceptance gates. Versioned milestones and older evidence below retain their original contracts; they are not current release certificates. Check the selected source before applying a historical instruction, and keep source assets, runtime adoption and native/device qualification distinct.

Translate gameplay events and a theme into an original, practical audio system. Separate a composition brief from actual generated or recorded audio.

For current game work, read [soundtrack libraries](references/soundtrack-libraries.md). The runtime now has preserved MP3 libraries, binary backups, mixed playlists and a session transport; the game studio integrates those separately from legacy pack JSON. Existing synthesized recipes remain supported. `xonix-playground.v1` still has no imported soundtrack/stem fields: never insert a file path or invented music property into an old pack. For event cues, consult [Runtime Maintainer](../xonix-runtime-maintainer/SKILL.md), `game/ui/audio.mjs` and the [core events](../../../game/core/README.md).

For the P02-A [shared master audio candidate](../../../docs/shared-master-audio.md), keep three controls distinct: master mute/volume govern output, music-only Pause governs listening intent, and lifecycle suspension temporarily stops output while preserving eligible restoration. The shared authority must not select a track, seek, clear a queue, resume a paused track or resume gameplay. The host owns explicit activation and persistence; a delayed Play/context-resume/metadata completion must never unmute the shared authority. Studio Play and audition remain transport actions while master sound is muted, with a visible explanation and an accessible explicit master control.

Use `game/ui/audio-master.mjs` for each page's shared authority and `game/audio-preferences.mjs` for the separate `revealline.audio-master.v1` localStorage record containing only `{ muted, volume }`. This is not a new player-profile or pack schema. Preserve legacy profile fallback, newer explicit intent, storage-event identity checks and session-only warnings when saving fails. All outputs on that page receive the same authority; navigation shares preferences rather than a live transport object. Native auditions use an explicit local fader through `bindAudioMasterMedia().setLocal`; native play/volume events reassert effective output and cannot rewrite local or master intent. Compose cinematic/audition local volume with shared volume once, and release only the closing preview's binding and media leases.

P02-A is a source candidate, not public acceptance or completion of P02. Qualify real browser mute/unmute, simultaneous saved/draft previews, story playback, navigation/history restoration and interruption recovery separately from modeled scheduling tests. Audible output, codec behavior, physical controls and device volume limitations still require their own observations. Shared controls alone do not add a Team soundtrack or deliver new playlists/albums; retain the existing content scope.

For full audio transfer, preserve **Prepare saved-library backup → Download prepared backup → verify the resulting file** as separate steps. Preparation is read-only and includes saved original MP3 bytes; it must not click a hidden link after asynchronous work. Keep one bounded prepared copy, invalidate it on adopted library changes/disposal, and report preparation or a download request without claiming a disk write. See the [studio transfer contract](../../../docs/soundtrack-studio.md#complete-audio-transfer) for retry, cancellation, adapter and device boundaries. An unexplained browser timeout is not evidence of a proven activation-policy cause.

For gameplay roles, progression, gameplay imagery or event feedback, consult [the reference lessons](../../REFERENCE-LESSONS.md). They distinguish observed reference behavior from proposed extensions; check the current primitive catalog before emitting pack data.

For synchronized motion cues, consult [Animation Director](../xonix-animation-director/SKILL.md), especially `animation-14-audio-event-timing` in the shared prompt CLI. Tie one-shots to event identity and continuous sounds to explicit state; document loop, fade, overlap, pause and cancellation behavior. A rotor animation speed is presentation data, not movement speed. Timing plans still require actual audio production and listening before completion claims.

## Establish the context

Locate the target kit and read its theme brief, `authoring/CONTRACT.md`, and relevant music prompts in `authoring/prompts/catalog.json`. Resolve the installed skill's physical path if the current directory is elsewhere. Use [the audio brief](references/audio-brief.md) for details that the current pack schema does not yet express; never invent accepted manifest properties.

## Design and produce within available tools

1. Define the emotional arc for border traversal, exposed cutting, imminent collision, capture, completed reveal, defeat, and menu/gallery browsing. Essential warnings must remain intelligible with music muted.
2. Specify tempo range, meter, motif, instruments, energy, loop duration, stem transitions, silence policy, and sound effects. For Ukrainian styles, verify unfamiliar instrument/tradition details from primary cultural sources; avoid asserting that one palette represents the entire country. For retro styles, distinguish chip voices, tracker-inspired samples, FM synthesis, and analog synth rather than treating them as synonyms.
3. Use original motifs and describe musical properties rather than asking to reproduce a specific commercial soundtrack. Offer two or three music directions if the user has not selected one.
4. Connect sound cues to semantic events, not theme-specific code. Describe calm/exposed/danger layers, how transitions stay musical, and how cues avoid masking each other. Keep haptic proposals distinct from delivered audio.
5. If an authorized audio tool is available, generate the requested sound, save it, and audition it. If no tool is available, deliver a complete prompt/production brief and explicitly label the files as planned. Never claim to have listened to or created missing audio.
6. Preserve masters and define derived delivery formats based on the verified runtime. Budget decoded memory as well as compressed downloads; a whole soundtrack should not be eagerly decoded on a phone. Verify loop boundaries, clicks, clipping, loudness consistency, event latency, and stem synchronization when actual files exist.
7. Include independent music/SFX volume, visual equivalents of critical cues, reduced-intensity options, and graceful handling of browser audio unlock and interruptions. These remain player preferences across themes.
8. If registering actual assets, use the contract's existing fields and validate the pack. Keep proposed adaptive-audio extensions in the companion brief until the schema/runtime supports them.

## Adapt templates to the request

Prompt-library wording is a starting point, not an instruction that overrides the user's chapter, medium, quantity, or approved design. Adapt those choices explicitly and record the effective prompt. Use the current schema's actual enum values: watercolor/gouache are `illustration` with their medium described in the art brief. Within the legacy draft-pack contract, keep unsupported medals, generation behavior and other primitives as proposals instead of inventing accepted fields; use the actual runtime contract for applied game work.

## Deliver

Link prompts, the cue/stem table, and any actual audio files; show playable audio when supported. Say which checks were performed by listening, by file inspection, or only specified for later. Do not equate a music prompt with a complete soundtrack.

## Deliver the completed feature

For implemented changes, follow the shared [feature delivery workflow](../../../docs/feature-delivery-workflow.md): related commit, exact-source verification, immutable playable version, reviewed/merged PR, GitHub Release and verified Pages deployment. Follow the active task’s existing scope and authorization throughout that sequence. Update [Delivery priorities](../../../docs/delivery-priorities.md) with actual evidence; keep planned assets, modeled input checks and physical-device qualification distinct. Design-only work remains a reviewable design artifact.

For nested [Field Guide practice](../../../docs/enemy-guide.md), retain the parent player’s prior listening intent and stream position. Suspend its music while the child owns practice, including focus/visibility returns; resume only prior playback when allowed. A player’s intentional music-only Pause must survive practice and ordinary Resume. Model media tests establish sequencing, while real MP3 playback and listening still need browser/audio evidence.

## Preserve native launch and input access

For any playable theme, asset, rule, interface or pack change, follow the shared [native launch, entry and device contract](../../../docs/boot-launch.md#authoring-and-device-contract). Preserve dark first paint and safe failure guidance, the native player journey, authored action availability, independent keyboard/touch/controller navigation, historical run identities and truthful device evidence. Do not reintroduce legacy webpage controls or advertise unavailable actions. Source, browser, listening and physical-device checks remain separate. Public entry must use the complete immutable edition graph; follow the [entry and retirement contract](../../../docs/boot-launch.md#immutable-public-entry--p77). Verify fresh and previously cached browsers separately from public-byte hashes. Preserve old caches, profiles and live games during normal worker retirement; never clear site data or force takeover to make an upgrade pass. Keep actual storage limits distinct from planned media budgets. Verify an ordinary first capture and continued flight in the frozen browser online and with its server stopped; clean startup, restored saves and complete file inventories do not prove the gameplay journey. Preserve simulation exceptions as release blockers even when source tests pass.

## Keep live pictures and earned originals stable

When a task touches reveal artwork, a saved flight, Collection or media export, follow the shared [live-picture and paired-recovery contract](../../../docs/feature-delivery-workflow.md#live-pictures-earned-originals-and-paired-recovery) and [concrete prompts](../../prompts/media-presentation.md). Preserve saved A after assignment B, first-earned A and exact owner identity. Keep JSON game data, `.rlmedia` originals and `.rlsound` audio distinct; missing saved originals remain paused without a replacement. Shared-v3 source adoption does not certify old readers, browser recovery or a public release. Unrelated art/behavior work need not open or migrate media storage.

## Field Kit Asset Studio audio

Use the selected slot's medium-specific copyable brief and [Field Kit requests](../../prompts/field-kit-production.md#replace-an-audio-cue-or-loop). Short cue candidates are mono 48 kHz / 16-bit PCM WAV up to one second; music candidates are seamless 4–16-bar OGG/MP3 loops with retained lossless source, within the actual slot budget. Preserve custom production requirements, event timing and explicit activation/Stop/mute/volume. The installed defaults remain original procedural Soundscape recipes. Report native playback observations separately from subjective listening; never call a successful button click a listening review.

## Mobile playback and history restoration

Keep the call that starts or wakes media on the direct user-gesture path; do not put unrelated asynchronous preparation ahead of it. Check the actual play Promise before announcing playback. Preserve one session transport across menus/retries, and distinguish visible pageshow restoration, focus/visibility changes, nested practice ownership and a deliberate music-only Pause. Test these paths with real MP3 playback and browser history in addition to modeled event sequencing. Browser policy can still deny playback; give an actionable retry and never silently claim that permission was granted. [MDN playback guidance](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play) explains the Promise and policy boundary.

The [guided backup set](../../../docs/full-backup.md#prepare-game-data-and-originals-together) may coordinate the existing saved `.rlsound` export with game data, `.rlmedia` and `.rlstory`. Read saved audio through the borrowed shared store even when playback initialization fails; do not start music, alter listening intent, include unsaved Studio drafts or replace the native per-file Download action. Prepared/Download requested are distinct from file readback and audible/offline playback. Keep the existing individual Studio export and MP3 limits.

Use `node scripts/check-backup-set.mjs --report /absolute/path/your-downloaded-coverage.json` for read-only destination-file verification. Its MP3 inspector checks original hashes and MPEG frame facts without importing or playing music. Coded silence can exercise file transfer but cannot establish audible production quality; native playback and restored listening intent remain separate checks.

For guided backup names, generate one UTC-time/random prefix per preparation and reuse it across all five explicit native links and coverage references. Keep names bounded ASCII and leave standalone export names and component schemas unchanged. Retry keeps the same prepared names; a new preparation gets a new prefix. Check the actual chosen report with the strict CLI, never guess browser suffixes or the newest file. The recorded a858 native readback uses earlier fixed names; prefixed-source browser verification is separate.
