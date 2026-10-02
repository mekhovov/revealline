# Installed-app updates and communities

This change adds controls to the game itself. It does not change an already
published or cached version until the release containing it is deployed and
adopted. Installing the icon, preparing offline content, and updating that content
remain separate, optional actions. Online play never requires a download.

## Player instructions

Inside the Home Screen app, connect to the internet and return to the main menu.
Open **Settings → Content & Offline → Check for updates**. The same action is
available on the optional downloads page. The home screen keeps its existing
play, mission-selection and settings controls. The update screen reads the latest published
build, shows its version/build identity, restores your download choices, and shows
the download size. Confirm **Update game**, wait for verification, then choose
**Play updated game**. Preparation, verification and selection are one action;
there is no separate manual Verify/Use this edition requirement.

If **All shipped gameplay** was selected previously, newly published chapters are
included in that choice. A selected-chapter installation keeps its chapter choices.
Soundtracks remain optional and do not hold up an update. Downloaded recordings and
imported content are not replaced by this action. Published community routes are
part of the current game; separately published branded apps have their own updater
and preparation choices.

In Solo, Versus or Team, open **Settings → Content & Offline → Communities** to
open the directory.
Choose a community there. **Back to game** returns to the mode/community you came
from; controller Back also works. Main-game community routes stay within the main
app's manifest scope. A separate branded installation offers **Communities
(online)** to the public main directory, which can open outside that app's narrower
scope.

An older downloaded build may not contain these menu controls. Its update checker
was on the stable launcher's management page, `/revealline/app/?manage`, which was
hard to reach after the launcher automatically entered the game. Opening that URL
in Safari is not evidence that the separately installed Home Screen app was
updated. Do not delete the app or clear its storage to force an update: that can
lose its local progress. The first transition from an old installed build to this
new settings controls still need explicit physical-iOS qualification before giving a universal
one-time recovery instruction.

The affected player confirmed **v0.142.4 installed from the main site**. Live
metadata inspected on 2026-10-01 reports build
`bea94554e6dd583d913d574547933bafb632c049bf83e813e33640ea276e196a`.
The root manifest starts at `./game/`; the separate launcher manifest starts at
`./` within `/app/`. Do not assume that this existing icon opens the launcher or
give it instructions requiring a versioned-release URL. Its first transition
needs the rolling main-site route qualified inside the existing installed app.

## Why an ordinary refresh was insufficient

The old game worker can serve its cached game modules and download catalogue even
when the page asks for fresh data. The old launcher also compared edition URLs;
rolling publications can change their content without changing that URL or their
semantic version. A refresh therefore does not prove the new game was installed.
Service worker activation can also wait while an older client remains open; see
[the service worker lifecycle](https://web.dev/articles/service-worker-lifecycle)
and [PWA update guidance](https://web.dev/learn/pwa/update).

The new explicit update screen is `/app/update.html`, under the small launcher
worker. It is fetched online and identifies the exact current game and launcher
builds. Its module graph bypasses old game/HTTP caches. A small shell uses external,
hash-versioned scripts, then fetches the candidate download screen and checks its
build identity before mounting it. There are no inline scripts or base elements;
the existing Content Security Policy remains unchanged. When necessary, a small
same-origin bridge leaves the launcher scope so a waiting launcher can activate
without forcing another live game to reload. Ordinary offline icon launch keeps
using the selected game immediately.

Frozen publishers copy the shell and scripts, pointing their candidate metadata
at the exact frozen edition. An immutable game worker accepts update messages from this one stable
screen only with the matching origin, protocol, scope and build ID. Neither a
query parameter nor an unrelated page can authorize another candidate.

Preparation explicitly awaits `ServiceWorkerRegistration.update()` before choosing
the candidate worker. Registering the same worker URL alone can return the old
registration; the real A-to-B preview reproduced that failure and rejected the old
worker's report. The explicit check runs after download consent, inside the profile
locks. It does not force activation over another live game. See the
[browser update API](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update).
The updater then waits for the verified worker to be the registration's active
worker in the `activated` state. A transient `installed` or `activating` state
cannot claim success. Another live client can defer activation; the bounded wait
reports that condition without forcing the client to reload.

## Progress and limitations

Completed official files are stored and verified before core replacement. Save
journal, profile migration and writer-lock checks run before the replacement core
is prepared; the locks remain held through preparation and active-edition write.
A busy profile, an unresolved journal or an unreviewed migration defers activation.
A same-version build can update at the same URL. A version/profile-channel change
with existing progress still uses the existing reviewed progress-transfer flow;
this patch does not make incompatible suspended flights automatically migratable.

Immutable previous editions retain their separate URLs. Rolling same-URL updates
do not provide two independently addressable old/new game cores, so this change
must not be advertised as full rollback for rolling deployments. User saves and
verified optional asset bytes are preserved, but service-worker replacement itself
is not a transactional browser API.

## Qualification and release

Base: `8b7c23f837fba54c353a625ae569e994a9592952` from freshly fetched `main`.
Rebased onto `b89a46520` after the separate Demo qualification merged.
The isolated worktree preserves the original checkout. This is an owner-scoped
product slice for the existing **v0.150.0 — Unified native experience** queue; it
does not allocate a version or publish a frozen release independently.

Regression sources cover exact build identities, selection intent, safe return
routes, immutable-worker authorization/cancellation, and activation preparation
under preservation locks. Automated suites remain **WAIVED_SKIPPED_NOT_PASSED**
under `publishing/test-policy.json`; see the
[focused-suite waiver](../focused-test-waiver-20260930.md). Validation, lint,
formatting, build and direct browser checks are recorded below.

Physical iPhone/iPad Home Screen evidence is still required for the first old-build
upgrade, worker handoff, app closure/reopen, community navigation and a cold
offline launch. Desktop browser evidence does not certify those devices.

### Verification recorded on 2026-10-01

- `npm run validate` and `npm run lint`: passed on the rebased source. Later
  generator and worker-discovery changes passed both commands again. Generated
  EN/UK catalogues are current.
- Changed-file formatting and `git diff --check`: passed. Full `format:check`
  reports only the unchanged `game/editions/runtime-assets.json` baseline issue.
- Community navigation in the Codex in-app browser opens DroneAid and retains
  the DroneAid/Versus return destinations. Final placement was checked in all
  three modes: both new links are inside **Settings → Content & Offline**, and
  all three home screens retain their original actions. At 390 × 844, Solo's
  content submenu scrolls normally to both links and Communities opens the
  directory with a working Back to game action.
- Strict-CSP packaged preview: caught and corrected blocked inline-script/base
  usage. With the corrected external bootstrap, the updater offered an 84.6 MiB
  starter download, completed verification and activation, and reported **Solo
  starter ready offline** with **0 of 77 soundtracks** downloaded.
- The local game server on port 8892 was stopped (a direct HTTP connection failed).
  Opening the stable `/app/` launcher still reached the game. Continue resumed
  First return with three lives; it was paused again at 0:33 before the next update.
  This is desktop game-origin failure evidence, not physical iOS qualification or
  a claim that every outbound host was disabled.
- The initial same-URL update discovered build `ac27de40` but correctly rejected a
  response from the previous worker. With the server stopped, the old game still
  resumed its saved flight with three lives; it was paused at 0:47. This led to the
  explicit awaited registration-update fix and a stale/newer-build regression
  source. The rejected attempt did not erase progress or activate the candidate.
- The corrected build from runtime commit `ca3c5eecb` (`b06cba7d`) successfully
  replaced downloaded build `abc5ad01` at the same URL and semantic version.
  The starter selection remained intact; the screen reported **Play updated
  game**, **Solo starter ready offline**, **0.0 MiB remaining** and **0 of 77
  soundtracks**. Continue resumed the old flight with three lives and time beyond
  0:47. After stopping the server again, opening `/app/` and Continue resumed it
  offline; it was paused at 0:56. This covers same-channel preservation, not a
  cross-version migration or a browser-process restart.
- The subsequent `93931afec` build (`8bcdae80`) also completed a real update from
  `b06cba7d`, exercising the confirmed-activation wait and corrected success copy.

Screenshots are retained in [the evidence directory](./evidence/app-updates-20261001/):
[clean phone-sized home](./evidence/app-updates-20261001/menu-phone.jpg),
[phone content settings](./evidence/app-updates-20261001/settings-phone.jpg),
[Versus settings](./evidence/app-updates-20261001/settings-versus.jpg),
[Team settings](./evidence/app-updates-20261001/settings-team.jpg),
[successful update](./evidence/app-updates-20261001/update-selected.jpg),
[saved flight after rejection](./evidence/app-updates-20261001/flight-after-rejected-update.jpg),
[saved flight after update](./evidence/app-updates-20261001/flight-after-update.jpg), and
[updated flight with server stopped](./evidence/app-updates-20261001/updated-flight-server-stopped.jpg).

The build also compacts HTML offline markers to the artwork summary actually used
by the browser (name, availability, count and bytes). Original files, central
per-file hashes, worker metadata and build-time integrity checks remain intact.
This removes repeated metadata to protect the existing hosting budget without
removing gameplay or artwork.

Final packaged verification used runtime commit `ecdad00869fd5c4f58c204f9e57623221fd360e0`
and build `9266cde6b154cd91ffa3e563cfdedcaf9e2fe363b0f07645ef231c0ce6136e2d`.
The build contains 2,669 manifest entries and 949,085,521 payload bytes before the
manifest itself. [The byte/hash inventory](./evidence/app-updates-20261001/build-inventory.json)
records the final updater files and frozen-launcher publication check. This is
not a whole-site hosting-capacity approval; aggregate release checks remain required.

The final update was reached through **Settings → Content & Offline** from the
previous downloaded build. After activation, both new actions appeared only in
Settings and the clean home screen retained Continue, Select Mission, Settings,
fullscreen and sound. The saved flight resumed at 0:58 with three lives. With the
server stopped again, the stable launcher reopened the game and Continue resumed
the same flight; it was paused at 1:00. See the
[final offline flight](./evidence/app-updates-20261001/final-flight-server-stopped.jpg).
