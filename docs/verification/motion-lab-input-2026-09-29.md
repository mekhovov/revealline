# Motion Lab current input qualification

This receipt covers the bounded Phase 6 Motion Lab input batch initially committed
as `e77284e7809a40eb255f77f4790306d22cfcb996`, with the subsequent focused Clear
handoff fix committed as `97433cc62c72584440064610d981e65009f491fb`. The final
current virtual-controller browser journey passed **4/4** rows against those
bytes. Native keyboard, actual saved-profile reopening and physical controller
qualification have separate boundaries below.

## Scope and runtime changes

Source review found that the visible direction buttons handled pointer/key
events but not the semantic click used by the shared controller Confirm owner.
The native movement/ability listener also needed to yield consumed events and
commands outside the foreground arena. The bounded fix adds each direction's
semantic pulse and scopes the arena's native commands without changing the
existing button/held-control behavior or adding a second input poller.

An actual native-keyboard check subsequently found that Clear disabled its own
focused button and left focus on BODY. The follow-up hands focus to the usable
background input before disabling Clear, only when Clear still owns foreground
focus. Hidden/unfocused documents and another active control keep their existing
owner. The current fixture checks the immediate focus result, so later fallback
navigation cannot conceal the regression.

Seven primary destinations now appear in the shared Sections menu: Preview,
Ability, Collection, Palette, Progression, Response and Comfort. Existing visual
labels and translations are retained as real headings; Preview names its arena
target. The nested stage legend is a subordinate heading. A focused test mounts
the real shared page host over the actual HTML and checks section destinations
with production router/Confirm lifecycle pulses, including the hidden nested
legend case and absence of incidental field mutations.

The lab is a local motion/ability study, not a campaign editor. Its supported
persistence is the simulated lab collection in
`xonix.motion-lab.collection.v1`. Motion settings and background images do not
have a portable export or persistent source-document API. No such feature or
qualification is claimed here.

## Automated evidence

The initial focused runtime cohort passed **77/77**, with no failures or skips.
After the Clear correction the same cohort passed **82/82**. The initial
actual-host file contained 56 cases, including three new cases for native event
ownership, foreground arena/held controls, and shared controller navigation plus
Confirm guard direction/hold behavior; five additional cases cover native and
guarded-controller Clear handoff plus preservation of other/hidden/unfocused
owners. Output was retained in the task tool
result rather than a new log file while disk space was constrained:

```sh
node --test --test-reporter=spec game/test/motion-lab-display-host.test.mjs game/test/motion-lab-preview-loop.test.mjs game/test/motion-lab-display-restoration.test.mjs game/test/motion-lab-png-preview.test.mjs
```

The independent semantic Sections cohort passed **2/2**:

```sh
node --test game/test/motion-lab-menu-sections.test.mjs
```

The current fixture and registration passed ESLint; the four manual/evidence
files passed Prettier and `git diff --check`. A Node 22 module import checked
that `motionCurrent` resolves to the real `/authoring/motion-lab/` route.

Independent source review found no blocking issue. These finite DOM, loop and
domain checks do not prove actual browser layout, operating-system input,
physical controller behavior or browser image decoding in the current journey.

The final source-closure receipt
`/private/tmp/motion-lab-source-closure-20260929.json` matched **75 captured
inputs** against `97433cc62` Git blobs with zero mismatch or disk
drift: **46 modules / 72 relative edges**, three presets, 24 runtime images
totalling **11,770,819 bytes**, and the host HTML/CSS. Inventory SHA-256:
`eeb8c583025a38242e7d001c15005563f32de7f4a06952519f127cfd5c04b4d5`.
The refreshed receipt preserves the earlier `e77284e78` commitment/inventory hash
`9bcdb554ea52eed94d11b75d5f318d71be5ff4cf77d7cf3a8d26e517b324db0c`
and exact app before/after hashes; only `app.js` changed among these captured
inputs. An independent rerun of the six Clear-related regressions also passed
**6/6**, including the existing pending-PNG-read case.
All **1,723** default collector files excluded manual test fixtures. Seven
`derivation.source.src` originals are provenance references, not missing runtime
dependencies. No asset admission rule changed.

The prior Team edition receipt's **835 source inputs and six compiler/checker
pins** also match this commit and working tree. Its **14 passing in-memory
edition compiles** therefore remain attributable without another compile. The
largest output is **66,782,345 bytes**, **326,519 bytes** below 64 MiB. This is
source attribution and dependency closure, not a materialized build, offline
installation, native binary or publication receipt.

## Current browser fixture contract

Use
`http://127.0.0.1:8988/game/test/manual/authoring-controller.html?tool=motionCurrent`.
The case requires this isolated origin and English. Real standard-pad button
pulses navigate and activate production controls; it does not focus a target,
call a handler or mutate a domain model directly. Initial iframe focus only
establishes the test host.

Four required rows are:

1. Sections, canceled range/select drafts and committed speed/grid policy,
   preserving explicit paused intent.
2. Source and fit cancellation, decoded 640 × 360 bundled PNG assignment,
   canceled replacement, committed Cover and explicit Clear restoring focus to
   the usable background input.
3. Explicit Reset test collection, locked-equipment rejection, one simulated
   result, duplicate rejection and explicit Equip. Actual saved bytes must pass
   `restoreProfile` and `serializeProfile` unchanged and receive a SHA-256.
4. Paused/empty ability rejection, pickup, explicit arena entry/action/movement,
   Back to a paused entry, all four direction buttons and released Boost/Slow.
   These operations must not change the saved cosmetic profile.

The fixture snapshots local/session storage first. In `finally`, it restores
only the lab save/recovery namespace to its exact original values or absence,
then compares the complete storage snapshots. This is explicit test cleanup,
not a controller operation or a Save/Reopen UI claim. The tool's in-memory
qualification state may still be visible until reload. No original player save
or installed content is removed.

## Browser results and remaining gates

The final English virtual-pad journey on the isolated `8988` origin passed all
four rows against `97433cc62`:

| Row                | Observed result                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Configuration      | Canceled drafts retained values; committed speed 9.5 and `grid-center` turn policy preserved paused intent.                                                  |
| Background         | The bundled PNG decoded at 640 × 360; canceled source/fit/replacement preserved state; Clear released it and immediately focused `background-file`.          |
| Collection         | One simulated event unlocked the cosmetic; duplicate application wrote nothing; explicit Equip saved the production-valid profile below.                     |
| Arena and controls | Arena action/movement and Back passed; all four direction buttons worked; Boost and Slow ended false; final focus was `play-pause` and the study was paused. |

The actual UI-saved lab profile was **639 bytes**, SHA-256
`d54ceb23f9a96a8374f49f37448ea9eed55c3ef0e0c6ae418635e741e26193c9`.
`restoreProfile` accepted it without warning, and `serializeProfile` reproduced
the exact bytes. It contains one simulated event and `fpv-racer` equipment scoped
to `gameId=reveal-lab`, `themeId=fpv-front`, `caseId=campaign`,
`challengeId=first-flight`, `levelId=fpv-l01`, `mapId=open-corner`. This is an
actual saved-profile receipt, not a download or real-game reward. Fixture cleanup
then restored the complete pre-run local/session snapshots without error,
including the previously saved native first reward and Skyline equipment.

The initial bounded native observation after the semantic change showed all seven primary
Sections destinations; arena Enter, Right, E and Escape produced manual-input,
ability-used and paused states. It is not a complete workflow receipt.

A longer native EN journey against `e77284e78` used actual keyboard input to
change speed from 9 to 9.5, inspect the locked Skyline cosmetic with Equip
unavailable, apply the first simulated reward, and explicitly Equip it. The
actual Return to Workshop link restored focus to Motion Lab; Enter reopened
the tool with Skyline still equipped. The transient cruise-speed setting
returned to 9, as expected. This is real route leave/reopen persistence evidence,
not a browser reload: the attempted native Command+R had no observable effect
and is not counted. Source chooser Escape retained an empty preview, assigning
the bundled source decoded 640 × 360, and Clear then exposed the BODY-focus
defect described above.

The final targeted native Clear retest passed against `97433cc62`. After tool
reload as qualification setup, actual unbound Tab/Return input reached Sections
→ Palette, selected the bundled 640 × 360 Dawn Signal source, and activated
Clear. Accessibility focus immediately returned to `background-file`, matching
the virtual result. The reload setup is not counted as keyboard-driven
persistence reopening. The complete earlier EN save/route-reopen journey and
this targeted final correction have separate source attribution; they are not
presented as one uninterrupted final-source full journey.

The final native live-language check switched EN → UK through the real language
control with Space, Down and Return. All seven primary Sections destinations
and the nested stage-label option were visibly translated. The Ukrainian
Response destination focused `cruise-speed` with accessible name
“Крейсерська швидкість”; the turn-rate control was named “Реакція повороту
корпусу”. English was restored through the UI and the native Skyline profile
remained. This is a bounded language/navigation check, not a complete Ukrainian
editing workflow. The dialog container still exposed the English accessible
name “Sections” after the live change although its heading “Розділи” and options
were Ukrainian. That shared-dialog accessible-name issue remains open; no
additional runtime change is included in this batch.

For native qualification, use `&keyboard=1` and native keys only after setup.
Record an actual route leave/reopen or browser reload that restores the saved
simulated result and equipment, plus independent production validation of those saved bytes.
Do not substitute the virtual fixture's validator reopen for this UI evidence.
Motion has no download/export or child preview path. Complete EN/UK layout and
Ukrainian editing, the live Sections accessible name, invalid-file
browser intake, physical controllers, OS file dialogs and native device checks
remain separate gates.
