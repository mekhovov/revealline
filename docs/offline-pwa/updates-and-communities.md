# Installed-app updates and communities

This change adds controls to the game itself. It does not change an already
published or cached version until the release containing it is deployed and
adopted. Installing the icon, preparing offline content, and updating that content
remain separate, optional actions. Online play never requires a download.

## Player instructions

Inside the Home Screen app, connect to the internet and return to the main menu.
Choose **Check for updates**. The same action is available in **Settings → Content**
and on the optional downloads page. The update screen reads the latest published
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

Choose **Communities** on the Solo, Versus or Team main menu to open the directory.
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
new menu still needs explicit physical-iOS qualification before giving a universal
one-time recovery instruction.

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
builds. Its module graph bypasses old game/HTTP caches. When necessary, a small
same-origin bridge leaves the launcher scope so a waiting launcher can activate
without forcing another live game to reload. Ordinary offline icon launch keeps
using the selected game immediately.

Frozen publishers copy the same screen, pointing its base at the exact frozen
candidate. An immutable game worker accepts update messages from this one stable
screen only with the matching origin, protocol, scope and build ID. Neither a
query parameter nor an unrelated page can authorize another candidate.

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
formatting, build and direct browser checks are recorded below when complete.

Physical iPhone/iPad Home Screen evidence is still required for the first old-build
upgrade, worker handoff, app closure/reopen, community navigation and a cold
offline launch. Desktop browser evidence does not certify those devices.
