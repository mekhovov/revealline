# RevealLine — consolidated soundtrack master plan

Updated 24 September 2026. This is the durable source of truth for all soundtrack
work. It replaces the separate conversational plans without removing completed,
blocked, rejected or deferred requirements. The user approved implementation of
this consolidated plan.

## Plan maintenance and status rules

Each M0–M11 item keeps its ID, status, dependency, next action, effort estimate,
PR/evidence and released version. Update this document after each meaningful
milestone; append decisions and history instead of replacing the plan with the
latest subplan. Archive publication, rights clearance, musical approval, game
admission and public game verification are separate states.

A track is delivered only after admission, an immutable game release and direct
public verification. An MP3 preview or a passing transport test is insufficient.
Keep historical immutable files and failed/partial evidence. Never manufacture
reviewer names, listening approval or device results.

## Completed and current baseline

| Area | Completed | Remaining |
| --- | --- | --- |
| Existing catalogue | 70 hosted recordings / 15 albums; earlier 24-track collection is included | Selective listening and trusted metadata curation |
| Player framework | Simplified chooser, mixed playlists, uploads, creator tools, optional offline albums, recovery and rights enforcement | Targeted released-source verification and demonstrated fixes |
| New archive previews | Seven retro, six metal and one Nakarada recording published | Zero new game admissions from these batches |
| Retro previews | User rejected all seven listed below | Better replacement auditions |
| Metal previews | Existing six preserved as backups | Substantially heavier replacements |
| Nakarada Shchedryk | User explicitly approved musical direction; exact MP3 technically checked | Game admission, opening theme and gameplay/device/cultural evidence |
| UA-FPV | Four private import packs preserve 80 filenames / 77 unique recordings | Recording-specific public permission and game admission |
| Quick controls | Existing transport APIs support music pause and next | B/N and main/pause-menu controls |
| AI originals | Scores, candidates and rejection evidence retained | Paused; 0/36 approved |
| Historical releases | PRs #209, #250, #263 and #268 merged | Preserve delivered behavior, do not redo historical release work |

### Current execution snapshot

- PR [#321](https://github.com/mekhovov/revealline/pull/321) remains draft at
  `e6a766abce745e1993c53a2652d8e03e50e7a5e5`.
- Qualification [35945946346](https://github.com/mekhovov/revealline/actions/runs/35945946346)
  at `539418e41a198b02843c70baf488008716089a9a` finished with all four test shards
  failed. Qualify passed; freeze was skipped. Previous “still running” wording
  is superseded. Preserve the failed logs and diagnose against accepted main.
- Regular head run [35946894022](https://github.com/mekhovov/revealline/actions/runs/35946894022)
  passed preflight/build but skipped test/release_gate; these are not full qualification.
- M1 isolated two inherited failure classes against baseline `d0c73b472` and
  failed source `539418e`: chapter-download fixtures expect untuned speed 10 and
  actor velocities 5.4/3.6 while both commits produce tuned speed 8.84 and
  velocities 9.194155752433174/6.129437168288782; terrain fixtures advertise all
  prepared assets while supplying only the wall, correctly rejected by anchor guards.
  These were reproduced/read from committed modules in memory, without media copies.
- PR #320 owns the corresponding tuning, prepared-artwork and asynchronous Journey
  fixture fixes; its UX owner confirmed reuse after acceptance. The failed run has
  571 failures and one cancellation; 215 failure/cancellation records occur in files
  touched by that PR. This does not prove it fixes every failure. Preserve runtime
  guards, do not mass-change assertions, and rerun the resulting exact soundtrack head.
- v0.97.0 was published as a GitHub release at 03:30:28 UTC on 24 September.
  This supersedes the plan's earlier “draft” snapshot. Public Pages selector and
  feature acceptance remain separate verification owned by **🔥 Releases**.
  Preserve v0.96.0 and all earlier immutable releases.
- Archive51 PR #270 closed without merging. Preserve staging evidence and resolve
  its disposition in reconciliation; do not count that PR as delivered.
- The filesystem now refuses tiny Git writes with ENOSPC. No local media intake,
  builds, full checkouts or guard bypasses. Use hosted work and memory-only remote
  commits for small source/document changes; preserve user files and evidence.

## Remaining delivery ledger

Estimates are hands-on effort, not promised dates. CI queues, listening reviewers,
rights and actual failure diagnosis can extend elapsed time. No soundtrack game
version is allocated without the release owner's confirmation.

| ID | State / priority | Dependency | Next action and completion condition | Effort | PR / evidence | Released version |
| --- | --- | --- | --- | --- | --- | --- |
| M0 | In review; first | None | Commit this complete master plan through a scoped docs PR; retain all histories and update every later item here | 0.5 day | This docs PR; prior source PR #321 | None needed for docs |
| M1 | Diagnosed in part; awaiting accepted shared fixes | Accepted PR #320 corrections; remaining failure audit | Reuse reviewed baseline corrections, classify residual failures, then independently review and pass fresh exact-source qualification | 0.5 day triage; repair re-estimated after diagnosis | PR #321; run35945946346 | Unreleased |
| M2 | Active preparation; first content release | M1; remaining recording acceptance | Admit Nakarada; bundle exact opening theme; publicly prove menu, offline and preference behavior | 1–2 days after gates | Archive PR #3; public Shchedryk preview | Unreleased |
| M3 | Active preparation; independent | Accepted main; source/device tests | B/N and compact main/pause-menu controls across Solo/Versus/Team; separate feature PR | About 1 day plus checks | Feature PR pending | Unreleased |
| M4 | Active research; parallel | Exact published rights and musical/cultural review | Target six additional distinct Ukrainian compositions; publish cleared subsets | 1–2 days per research round; rights/review date unknown | Candidate/hold register below | Unreleased |
| M5 | Active sourcing; parallel | Six complete auditions and exact-file licences | Replace rejected retro with accepted Xposed-style synth batch | 1–2 days preparation + 1–2 days integration after approval | Candidate slate below | Unreleased |
| M6 | Active sourcing; parallel | Six complete auditions and exact-file licences | Add heavier metal; preserve existing six backups outside standard shuffle | 1–2 days preparation + 1–2 days integration after approval | Candidate slate below | Unreleased |
| M7 | Blocked public rights; scope retained | Recording-specific public redistribution and applicable artwork evidence | Include all 77 recordings / 80 filenames; publish cleared entries; maintain private pack route | About 1 day integration after clearance; clearance date unknown | UA-FPV manifests/private packs/guide | Public collection unreleased |
| M8 | Remaining verification | Released source and device access | Audit existing playback/storage/creator contracts; release demonstrated fixes separately | 1–2 days initial audit; fixes separately estimated | Existing regression suites | Per-feature evidence required |
| M9 | Later | Core style releases | Review existing 70 selectively; add trusted ID/hash curation overlay preserving saved pins | 1–2 days per selected batch plus listening | Curation PR pending | Unreleased |
| M10 | Later | Core styles delivered | Broader musical variety in small accepted albums | 1–2 days per batch plus review | Separate future album PRs | Unreleased |
| M11 | Deferred / paused | Better production method and accepted pilots | Retain full 36-original brief; do not resume rejected production method | Unscheduled | Candidate/rejection archives | 0/36 approved |

M4–M6 research proceeds in parallel. M3 does not wait for music rights. A cleared
Ukrainian, synth or metal subset can ship without waiting for the other families.
Full listening review of the existing 70 is not a prerequisite for a new batch.

## M2 — Shchedryk opening theme

- Use **Carol of the Bells (Metal Version) — Alexander Nakarada**. Preserve its
  existing ID, exact 8,641,768-byte MP3 and SHA-256
  `d4147214e221be28f19d6c6c38afc8d3cf0289a0dc6ac579b26574a0c571bc58`.
- Bundle the approximately 8.24 MiB recording with the game as the explicit
  exception to optional-audio-only core delivery. Trusted code maps identity,
  hash and bundled path; imported metadata cannot create a bundled entitlement.
- Fresh profiles and users retaining the default selection open with this song
  on a new visit, followed by admitted Ukrainian music. Preserve saved explicit
  styles/playlists, mute, volume and intentional music pause. Never infer that an
  existing saved Synth choice may be overwritten. This supersedes fresh Synth default.
- Preload without blocking menu rendering. Start when browser policy permits;
  otherwise use the first eligible gesture and a compact Play music retry action.
- Ordinary menu returns, Settings, Pause, results, retries and background recovery
  preserve the current song. Reuse the existing transport owner and cancellation.
- Tag Ukrainian / Metal / Fusion without duplicate mixed-queue entries. Display
  title, artist, source link and accurate Shchedryk-adaptation provenance.
- Registered Content ID means Recording mode excludes this recording and uses an
  eligible fallback. User taste approval does not authorize a false video-safe label.
- Count bundled storage consistently; do not duplicate its installed bytes or
  delete the core theme when removing optional albums. Verify core/package limits.
- User musical approval is complete. Full-track, repeated-session, transition,
  warning, mono/small-speaker and cultural/device evidence remain separate gates.

## M3 — immediate music controls

- **B** plays/pauses music; **N** selects the next song in gameplay and ordinary menus.
- Compact Now Playing, Play/Pause and Next appear in main and pause menus across
  Solo, Versus and Team. Touch uses these controls; controllers reuse menu focus
  and Confirm. Resume game remains initial pause focus, followed by music controls.
- Music pause leaves gameplay and effects running. Next while paused selects the
  next recording without resuming. State labels cover playing, paused, loading and
  browser refusal without focus stealing, dialogs or toast spam.
- Use the existing player/session APIs; Couch uses session play/pause so Resume
  respects intentional music pause. The active practice owner wins over its parent.
- Custom gameplay bindings win conflicts. Ignore typing/editables, composition,
  modifiers, key repeats, hidden/background pages and higher-priority handled input.
  Add a default-on advanced shortcut toggle without a library/IndexedDB migration.
- Exclude explicit transport clicks from remembered-menu autoplay handlers, so a
  Pause/Next click cannot start music first. Include controls in Versus navigation.
- Verify held keys, controller seats, checkpoints and gameplay state are unaffected.

## M4–M6 — music direction, auditions and decisions

### Ukrainian

Use accepted Nakarada as the quality benchmark; seek six **additional distinct**
compositions with recognizable Ukrainian repertoire, coordinated rhythm sections,
strong hooks and developed arrangements. Licensed vocals and instrumentals may
coexist. Keep broader Ukrainian folk, acoustic and electronic directions active.
A generic folk-metal label, nationality or minor scale is not cultural evidence.
Another Shchedryk arrangement is arrangement variety, not another composition.

Use published licence evidence and authorized sources. No purchases, creator
messages or social-account actions are implied by this work. Preserve these holds:

- Kyle Misko: Hutzulka z Kolomyii, Sahaidachny, Haiduk, Viter Vie, Arkan, Nese Halya
  Vodu. Individual CC statements do not resolve the album's sampled-recording provenance.
- CHUR: Spring the Wonderful / Весно красна and The Pussy-Willow Board /
  Вербовая дощечка are musical references with all-rights-reserved recordings.
- Meraki Caravan — Karchata: Ukrainian folk-fusion lead; paid acquisition and
  ShareAlike delivery review remain. Not established as a heavy-metal match.
- GERAINSAN — Oy Na Gori remix: vocal/master provenance and exact licence unresolved.
- Researched Commons vocal, folk and classical performances remain candidates;
  check repertoire/language, exact performance and arrangement rights. Retain
  Lysenko and ceremonial records in the historical register below; no quota padding.
- NC/ND recordings, conflicting custom licences and unverified sample provenance
  remain outside admission. Keep every researched lead and reason in the register.

### 90s Synth

Prioritize Xposed / Xposed Reloaded fullness: moving bass, layered synths and arps,
punchy full drums, early hooks and developed arrangements. Keep `90s Synth` /
`synth90s` stable, with accurate substyle metadata. Do not equate nostalgia with
chiptune/fakebit or energy with BPM. Xposed credit leads do not establish Reloaded
credits; commercial OSTs remain references, never assumed reusable files.

Next six complete auditions (unapproved): DOS-88 **Race to Mars, City Stomper,
Automata v2, Crash Landing**; escp **Synthasia, Twilight City**. Verify exact
creator downloads, composition uniqueness, licences and full-track suitability.

### Metal

Prioritize articulated low/palm-muted riffs, rhythmic rests, bass/kick coordination,
double kick, contrasting riffs and controlled distortion. Reference Valfaris,
Slain, Prodeus and DOOM for articulation and arrangement, not copied melodies.

Next six complete auditions (unapproved): David KBD **The Desolation of a
Civilization, Agony Space-deep, God of Darkness, Suffocation**; Alexander Nakarada
**The Dobermann, Folklore**. Generic folk-metal is not automatically Ukrainian.

Retain the expansion target of **12–20 distinct retro/metal recordings**, normally
6–10 per family, delivered as independently accepted batches.

### Rejected and backup decisions

The following seven retro recordings are rejected for game admission/defaults:

1. Street Punks Fighting to Save the Princess
2. Rock City Ransom
3. Nario Versus Zonik
4. Welcome to Warp Zone
5. Here a Captive Heart Busted
6. The Story So Far (Sega-style FM Synth Remix)
7. Savage Circuitboard

Preserve their public historical previews. Keep the six metal previews as backups,
outside admitted standard shuffle: Vitalezzz's Curse of Moon, Realm of Torment,
Shadows Awaken Within, Unholy Surge; Bogart VGM's German Industrial Metal; and
MintoDog's Heavy Boss Battle 1. Do not label them user-approved replacements.

### Reference library retained

User references: Xpose/Xposed Reloaded, Horizon Chase, Slain/Slain 2, Crimsonland,
Valfaris, Let Them Come, GROOD, Broforce, Prodeus, DOOM and Huntdown. Expanded
references: Streets of Rage 2, Turrican, Unreal/Unreal Tournament, Tyrian, Deus Ex,
DUSK, Amid Evil, Turbo Overkill, Furi, Katana ZERO, Hotline Miami, Time Recoil,
Slipstream and Distance. Ukrainian cultural references include Authentic Ukraine,
Polyphony Project, Go_A, DakhaBrakha and ONUKA. Preserve source links in research
records. These establish musical properties, not redistribution permission.

## M7 — complete UA-FPV collection and private route

- Preserve all **80 source MP3 filenames / 77 unique recordings**, exact uploaded
  bytes and three duplicate aliases. Standard playlist lists each unique song once.
- Dedicated UA-FPV collection is selectable, mixable and repeat-all/shuffle capable,
  with title/original filename and verified source website in Now Playing/details.
- Public admission requires recording-specific redistribution, credits/source and
  applicable artwork permission. YouTube availability and possession are insufficient.
  Keep every unresolved file in the inventory with its blocker; do not silently drop it.
- Publish approved exact MP3s under a new immutable archive batch, preserve all
  alias links and existing archive inventories, then add trusted game catalogue entries.
- Keep streaming by default, optional offline album installation/removal and custom
  playlist references. Roughly 205 MiB unique audio shares the 256 MiB media budget;
  do not force the complete collection offline. Every package stays below 64 MiB.
- Preserve the existing four private volumes and upload guide. Verify the released
  route: Audio/Music library → Backups & album files → Add album file to draft for
  each volume → Save → UA-FPV or My Mix → Play/Unmute. Imports must be additive,
  not replacement. Unpublishable recordings remain usable through that private route.

## M8–M10 — existing contracts to preserve and verify

### Playback and user interface

Automatic / 90s Synth / Metal / Ukrainian / Fusion / My Mix, genre combinations,
custom ordering and All Songs shuffle remain. Repeat-all avoids immediate repetition
when alternatives exist; retain ordered and repeat-one modes. Automatic matches
menu/gameplay scene, authored energy and existing level themes; explicit selection
wins and music never changes gameplay, rewards or earned artwork.

Menu/title/campaign browsing uses appropriate music; Pause, Settings, results and
quick retries preserve gameplay continuity. Honor sound intent, browser unlock,
intentional music-only pause, interruption/background recovery and nested practice.
One owner, at most two decks, default 1.5-second fade and sequential fallback;
prepare only current/next, cancel obsolete requests and release outgoing resources.

Keep simple style/playlist/shuffle controls prominent and advanced tools collapsed.
Display title, artist, source website and original filename. Explain restricted
unavailable actions briefly. Recording mode excludes known Content ID and unverified
video permissions without promising immunity from automated claims.

### Catalogue, creator tools, rights and recovery

- Catalogue v2; library/bundle v3; import v1/v2; shared IndexedDB v5.
- Preserve existing stores/blobs and historical IDs; 123 uploads, 26 custom playlists,
  256 catalogue recordings and 512 assets/references.
- Exact upload bytes, credits, tags, role/energy/themes, custom ordering, audition,
  album assembly, additive import/export and local share packs remain. Preserve
  transactional saves and existing replacement-backup behavior; no new server accounts.
- Atomic metadata conversion only after successful save; concurrent writer checks,
  rollback, frozen-reader messages and unsupported-version/downgrade refusal before
  writes or blob deletion.
- Trusted permissions bind identity AND hash and are enforced by delivery/install/
  export APIs. Renaming bytes or editing credits cannot grant permissions.
- Full backups contain every permitted referenced original exactly. Missing
  unrestricted bytes fail visibly; never silently become URL-only backups.
- Restricted references are explicitly listed before export and after import with
  “Requires online restoration for listed music.” Never label that self-contained.
  Imported references do not authorize network requests or redistribution.
- Retag old catalogue items only through a trusted ID/hash overlay preserving saved
  pins and rights. Full existing-70 curation follows new content, not a prerequisite.

### Distribution and storage

Approved redistributable MP3s belong in the project-owned soundtrack archive with
exact hashes, source/licence evidence, credits and admin download. Keep immutable
existing objects/inventories. In-game-only files remain private until licensed
delivery is approved; no standalone archive/admin download/share audio. Offline
use needs corresponding permission. Hiding URLs, preview hotlinks or external-player
embeds do not resolve licence restrictions.

Retain GameDev Market extraction/delivery holds, Pixabay standalone/context/Content
ID holds, D.E.M.O.N and other conflicting-terms holds; exclude Mixkit music. Do not
relabel ShareAlike/NC/ND material as CC0/BY to satisfy a compiler.

Optional packages <64 MiB; shared installed audio/picture/story budget 256 MiB.
Download for offline, Installed only and removal retain references and uploads.
Keep optional audio out of core precaching except the accepted single Shchedryk
opening theme. Production maximum 650 MiB, scratch 256 MiB and ≥1 GiB free reserve;
use hosted builds/small batches. Never bypass the guard or delete originals/evidence.

## Acceptance and item-by-item delivery

### Music and functional acceptance

Verify authorized exact sources and permissions; fully decode every admitted file.
Permitted derivatives target −16 LUFS integrated ±1 LU and encoded true peaks
≤−1 dBTP. Require honest complete-track and repeated-session listening, transitions,
warning audibility, mono/small speakers and Ukrainian musical/cultural review.
Technical measurements do not establish musical approval.

Reuse meaningful existing regressions: mixed queues, genre/assignment selection,
shuffle/repeat, scenes/retries, missing files, denied unlock, overlapping fades,
mute/background/practice; full-capacity legacy migration, rollback, concurrent
sound/story/picture writers, forged rights/renamed restricted hashes, exact backups,
reference recovery, additive packs, cancellation, budget refusal and removal.
Quick-control tests add keyboard conflicts, controller focus, touch and unchanged
checkpoints/gameplay/SFX. Verify online plus cold offline restart with server
stopped. Physical iPhone/desktop/controller results remain separate from simulation.
Record unavailable or skipped checks honestly.

Repair demonstrated host/parser failures, not speculative assertions. Preserve
pinned-Prettier async generator regression. Run validation, lint, both formatting
checks, production reproducibility and full required production-history tests.
Refresh Field Kit ledger for changed UI/screen/audio fingerprints with scoped review
evidence; preserve historical revisions and unapproved recording status.

### Release sequence for each item

1. Latest accepted main in isolated source; scoped commits/PR and unrelated edits preserved.
2. New audio: archive PR → verified public exact MP3s → game admission PR.
3. Independent review; required preflight + four test shards + build on exact source.
   Skipped/cancelled gates are not passes. Keep all failure and partial evidence.
4. Coordinate version/sequence with **🔥 Releases**. Refresh main before freezing,
   inspect source delta and freshly qualify the actual merged commit.
5. Freeze and independently inspect the original hosted artifact with established
   exact binding, evidence assets and immutable annotated-tag/release protocol.
   Never reuse stale qualification or retag/reupload an accepted immutable release.
6. Separate reviewed Pages selector/controller PR, checks, merge and deployment.
7. Direct public version/root/release/download markers AND actual delivered music/
   controls verification; maintain Journey/Continue, Solo/Versus/Team, Legacy and
   Playground regression behavior from accepted historical releases.
8. Cold offline/device qualification; retain exact reports, limitations and screenshots.
9. Record PR, release, evidence and next action against the stable M-item, then
   continue. Do not hold a ready item for unresolved music families or all 36 originals.

## M11 — deferred original composition brief

**Paused, 0/36 approved.** Preserve candidate scores, native renders, sketches and
rejected Idle Frequency/A/B synchronization feedback. Do not resume the rejected
method merely to satisfy a number. A better method must earn accepted retro,
metal, Ukrainian and fusion pilots before expanded production.

- 36 distinct compositions: 12 Synth +12 Metal +12 Ukrainian. Each family has
  two menu pieces, eight gameplay tracks and two finales.
- Six fusions WITHIN 36: two synth gameplay, two metal gameplay, both Ukrainian finales.
  Alternate arrangements/encodings are not additional compositions.
- Menu 2–3 minutes; gameplay/finales 3–5 minutes; early hook, contrasting section,
  breakdown and developed return with synchronized instruments and original riffs.
- Initial six pilots: Idle Frequency, Glass Highway, Embers at Rest, Furnace Heart,
  First Light, Spring Circuit; then Steel Kolomyika fusion.
- Ukrainian titles retained: First Light; Threads of the Dnipro; Spring Circuit;
  Highland Switchback; Night on the Ridge; Kobzar’s Horizon; Evening Dance;
  City of Light; Reed Current; Harvest Lines; Steel Kolomyika; Pulse over the Dnipro.
- Document regional traditions and modern adaptations. Synthesized bandura/sopilka-
  inspired timbres must be labelled honestly; instrument names alone do not prove authenticity.
- Initial originals remain instrumental-led; language/pronunciation/provenance must
  be verified for vocal textures. Licensed vocal songs are not prohibited by this rule.
- Retain reproducible GPT-authored scores, small procedural patches/DSP, seeds,
  versions, prompts where relevant and source/licence/review evidence. No hosted
  generator, downloaded model or large sample library is an active prerequisite.
  Earlier ACE-Step/BandLab route is superseded and not blocking licensed releases.
- Preserve native-resolution masters, verified lossless FLAC round-trip and 256 kbps
  MP3 derivatives. Never call a lossy-source transcode a native lossless master.
  Archive masters with verified hashes before removing redundant working copies.
- Six volumes of six compositions, each <64 MiB; selective installation under 256 MiB.
- Full completion remains 36 reviewed originals plus working framework/creator/
  licensing/recovery workflows. Licensed additions do not increment original count.

## Historical source and qualification register

The following earlier evidence and research register is retained verbatim. Its
candidate classifications are historical; the explicit current decisions above
(rejected retro, backup metal, approved Nakarada taste) take precedence. No held
licence or technical receipt becomes listening approval.

## Rights and musical holds preserved

- **Oleg Mazur — [Ой у лузі червона калина](https://soundcloud.com/fm_freemusic/oy-u-luz-chervona-kalina-the-red-viburnum-in-the-meadow-ukrainian-patriotic-march-by-oleg-mazur)
  and [Prayer for Ukraine](https://soundcloud.com/fm_freemusic/bozhe-velikiy-diniy-prayer-for-ukraine-spiritual-anthem-of-ukraine-by-oleg-mazur):**
  creator CC-BY leads remain held for an exact authorized original and licence
  version. Hypeddit currently asks for SoundCloud connection, comment, like,
  repost and follow; none are authorized or performed. Prayer is a solemn/menu
  possibility, not presumed action music.
- **[Mark Wilson X — Carol of the Bells](https://freemusicarchive.org/music/mark-wilson-x/single/carol-of-the-bells/):**
  [creator CC BY 4.0 statement](https://soundcloud.com/mark-wilson-x/carol-of-the-bells-royalty-free-cc-by) and approximately 1:21 instrumental metadata remain leads;
  exact acquisition/arrangement review is unresolved after the research reader's
  HTTP 403. Another Shchedryk arrangement does not add a distinct composition.
- **Pixabay [Hutsul Havoc](https://pixabay.com/music/main-title-hutsul-havoc-ethno-action-ukrainian-soundtrack-192015/), [Hutsul Fantasy](https://pixabay.com/music/folk-hutsul-fantasy-132797/) and bandura recordings:** standalone MP3 redistribution is not
  cleared. Hutsul Fantasy is credited to `_Music_for_Creators_`, not Rockot.
  Keep these outside the public archive unless recording-specific permission
  resolves delivery. Do not substitute preview hotlinks for permission.
- **Six Lysenko piano performances:** Couranta, Valse of Farewell, Barcarole,
  Dream op. 12, Song of Love and By a Cradle retain their documented Lviv
  Conservatory / Wikimedia Ukraine recording provenance and **CC BY-SA 3.0**
  status. They are held for a separate share-alike audiovisual delivery decision;
  do not relabel them as CC BY to pass the compiler. The exact file, pianist and duration table remains below. Their composition /
  edition clearance and classical context remain separate from recording rights.
- **UA-FPV:** possession and YouTube availability do not establish public MP3
  redistribution rights. Keep the existing private packs and upload guide; no
  outreach or new public admission is implied.
- **Generic geographic titles:** Holizna's _Ukraine_ and similar labels alone do
  not establish Ukrainian musical motifs. Do not use them to fill a numeric quota.

### Documented Ukrainian classical fallback — held

These six Mykola Lysenko piano recordings have recording-specific CC BY-SA 3.0
permission from the Lviv Conservatory / Wikimedia Ukraine collaboration. Yuriy
Bulka made the recordings. They are not CC0/CC BY and must not be relabelled to
pass the current admission compiler. Share-alike audiovisual adaptation terms
need a separate delivery decision. No media has been downloaded or auditioned.

| Recording                                                                                                                                                                               | Pianist               | Published duration |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------ |
| [Couranta, Ukrainian Suite](https://commons.wikimedia.org/wiki/File:Lysenko-Suite-02-Couranta.ogg)                                                                                      | Lesia Lemekh          | 3:34               |
| [Valse of Farewell](https://commons.wikimedia.org/wiki/File:Lysenko-Valse_of_farewell.ogg)                                                                                              | Zenovija-Anna Danchak | 3:55               |
| [Barcarole](https://commons.wikimedia.org/wiki/File:Lysenko-Barcarole.ogg)                                                                                                              | Olha Bilas            | 3:09               |
| [Dream, op. 12](https://commons.wikimedia.org/wiki/File:Lysenko-Dream_op._12.ogg)                                                                                                       | Iryna Posviatovs'ka   | 4:22               |
| [Song of Love](https://commons.wikimedia.org/wiki/File:Lysenko-Song_of_love.ogg)                                                                                                        | Olena Havjuk-Sheremet | 3:12               |
| [By a Cradle](<https://commons.wikimedia.org/wiki/File:Lysenko-Lullaby_(%C2%AB%D0%9F%D1%96%D1%81%D0%BD%D1%8F_%D0%BF%D1%80%D0%B8_%D0%BA%D0%BE%D0%BB%D0%B8%D1%81%D1%86%D1%96%C2%BB).ogg>) | Zenovija-Anna Danchak | 5:01               |

Dream's source identifies its folk-song basis, «На солодкім меду». The collection
is documented Ukrainian classical piano music, not an energetic folk-electronic
album. Its composition/edition clearance and gameplay context remain separate
from recording permission.

### New optional ceremonial lead — not an admission

[Luke Minovych Horenko — Ще не вмерла Україна](https://commons.wikimedia.org/wiki/File:%D0%9B._%D0%93%D0%BE%D1%80%D0%B5%D0%BD%D0%BA%D0%BE_-_%D0%A9%D0%B5_%D0%BD%D0%B5_%D0%B2%D0%BC%D0%B5%D1%80%D0%BB%D0%B0_%D0%A3%D0%BA%D1%80%D0%B0%D1%97%D0%BD%D0%B0.ogg)
is a creator-published synthesized instrumental recording under **CC0**, dated
27 March 2020, with a directly linked authorized original. Source metadata gives
93.214 seconds and 4,233,544 bytes; these have not been verified against acquired
audio. [Ukrainian government composition history](https://www.kmu.gov.ua/news/247989866)
identifies Verbytsky's music and Chubynsky's text.

Hold it for sound quality, composition/arrangement and cultural-context review.
It is an optional ceremonial/menu possibility, not a substitute for the requested
energetic Ukrainian repertoire. The US Navy rendition is the same composition and
must not be counted again. No audio was downloaded or auditioned during this lead's
research.

## Public verification records

[Reports retained on PR #321 at immutable source e6a766a](https://github.com/mekhovov/revealline/tree/e6a766abce745e1993c53a2652d8e03e50e7a5e5/docs/verification/core-soundtracks-2026-09-24) record
exact public bytes/hashes, deployed commit/run identities and limited desktop
browser observations. Those evidence files are not included in this docs-only PR
and are not yet on main; retain their immutable PR source links until admission merges. The first Ukrainian HTTP probe incorrectly required the
hidden `.nojekyll` Pages control marker to be publicly served and got HTTP 404.
That failed attempt is retained. The corrected probe excludes only that marker
and requires every runtime asset, MP3 and public metadata file to match. It does
not count the control marker as an HTTP pass.

## Historical qualification evidence — retain

- Archive failed intake runs **35943657893**, **35943774127** and **35943850666**:
  three source filenames differed from creator download links.
- Run **35944115394** passed 13 recordings and rejected _Angry Bullfrogs Riding
  Motorbikes_ below the 60-second floor. It was excluded; the gate was not waived.
- Run **35944483804** encountered source HTTP 502. Fresh run **35944843598** at
  `4e9e572848848a314cd48f31a290b83850ee6b65` passed all 13. Artifact **10786113658**
  has ZIP SHA-256
  `0b95238aa7bb27a89b12864f35ac1df850e7a69dae5b7fea3257a764ebf58f5c`.
- Source/derivative archival commit **`9e386c9c489bd193c830cd60ac6f26e7553dc335`**
  preserved all 13 MP3s, native originals and snapshots. Hosted verification
  **35945506601** checked the archive's then-total **83 recordings / 412,480,317
  audio bytes**. This is an archive count, not the game's built-in count.
- Game qualification **35944418013** at
  `913306a736443959b4b8ff913c0976093a2b06bb` failed before source validation because
  two inherited diagnostics fixtures exhausted mocked Git responses in
  `publishing/utility/test_upload_diagnostics.py`. Later gates were skipped, not
  passed. The independently reviewed fixture-only PR #322 was accepted at
  `d0c73b4723798f6490f2680a59fd8d8a59983ac1`; the soundtrack branch was refreshed
  onto that fix. Current exact-head progress is reported above.
- Four local archive-builder tests were blocked by the existing **1 GiB free-disk
  guard**. Do not bypass it or count blocked checks as passes. Use hosted audio
  acquisition, builds and actual-byte verification while local reserve is low.
- Ukrainian technical run **35945483057** passed the prepared Nakarada recording.
  It provides no full listening, instrumental-content or cultural approval.

Physical iPhone/desktop listening and cold offline checks remain distinct from
automated or simulated checks. No reviewer names, approval timestamps or musical
acceptance may be inferred from technical success.
