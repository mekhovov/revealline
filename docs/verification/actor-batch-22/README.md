# Procedural FPV motion, encounter proof and safe preview replacement — batch 22

Parent: `a9ef79cdbaf5dabdcfe62893356bbf8bcc2b128d` (PR761).
Three bounded source slices continue A/B/C-support in parallel. Production review
remains deferred; no candidate art, production record, mission, version or release
is adopted here. The publisher's earlier integration commits `a4a1a29aa`,
`88aa86471` and `183ee6ae4` contain the prior Guide/Team/reading corrections;
those source integrations are not a public acceptance claim.

## A2: six company-theme FPV recipes use the real rotor clock

All six procedural quad bodies used general body phase multiplied by seven,
bypassing the shared alias-safe rotor phase. At 10 FPS and a sampled travel speed
of 12 cells/s, that advanced painted blades about 1.792 radians per frame. A
three-blade silhouette then appeared to advance roughly -0.302 radians: the
opposite direction. Their row-major index parity also put equal directions on
the same side, and negative rotors did not mirror blade handedness.

The recipes now consume the existing shared `rotorPhase`, select diagonal
counterrotation by motor quadrant, and mirror the original local blade profile.
Authored per-hub offsets are unchanged and are not signed a second time. All six
body specifications, radii, motor centers, static silhouettes, caller badges and
physical contact cues remain unchanged. Missing/nonfinite legacy rotor phase
keeps a finite stopped pose; ordinary runtime callers supply the shared phase.
Pause/freeze hold it; reduced effects retain a static pose.

This matches the existing generic props-in art convention: viewed from above,
nose up, front-left/rear-right turn clockwise and the other diagonal turns
counterclockwise. [Betaflight's Motors Tab](https://betaflight.com/docs/wiki/app/motors-tab)
distinguishes props-in and reversed props-out. This is not a nationality rule or
proof of a particular manufacturer's rig. No real-world flight configuration or
simulation mechanic changes.

The complete four-file cohort passes **50/50**:

```sh
node --test game/test/company-fpv-body-recipes.test.mjs game/test/actor-presentation.test.mjs game/test/rotor-presentation.test.mjs game/test/enemy-body-motion.test.mjs
```

Tests inspect transformed painted blade polygons for every recipe at
10/30/60/120 FPS, signed apparent motion, mirrored profiles, full sweep/count,
held states, invalid/legacy input and actual DroneAid Core/BoardPainter use with
an unchanged authoritative checkpoint. `rotors-parent-red.tap.gz` preserves the
original 2-pass/4-fail draw result. These are Canvas-command checks, not native
pixel/perceptual approval. Independent source review found no blocker.

A bounded native IAB check used ordinary Start on local
`game/index.html?edition=droneaid-nl-community` at 1280×720 CSS, visual scale 1.
The 1152×576 logical board fit a 1243.02×621.51 CSS box. Keyboard Down reached a
foundation capture (0.5%, 120 points, 3 lives); Pause focused Resume; explicit Return
then fresh Down reached 57.7%, 13,280 points, 3 lives; a second Pause retained state.
No warn/error entries were returned by the browser log API. The source server
reported the expected absent development `game/build-info.json`; this was not a
built release. The loaded body was visually present. This does not establish all
six recipes' native low-FPS direction, responsive bounds, victory or physical
input qualification. Exact HTTP module bytes matched local source and are recorded
separately. The temporary browser/server were closed after inspection.

Existing production declarations already include `fpv-body-recipes.mjs` in motion,
effects and Team source sets. Their hashes change and require the applicable
reviewed successor before release. No dependency or historical fingerprint was
silently added or rewritten. Publisher comparison found the same original recipe;
port only this small correction, retaining newer hosts and approved artwork.

## B: complete Lens intercept practice and replay

The existing Lens intercept mission combines heading interception, a frontier
patrol and a field keeper. Its immutable core route already existed; this batch
adds one complete actual Solo practice host test using that route. It changes no
mission or gameplay source.

```sh
node --test game/test/pressure-combination-practice.test.mjs
```

**1/1 passes** (70.32 seconds), covering 5,130 actual host ticks and the retained
terminal checkpoint `fc18d9f52830479d` for level identity `2497ae07cb45e615`.
There are ten cuts, 0.743 coverage and no loss. Warning starts occur at
769/2676/4668/5088, commits at 889/2796 and capture cancellation at
954/2850/4758/5130. The host pauses with a fixed locked target, preserves the
frontier patrol's state, exports the actual recorder inputs and verifies replay.
Held native Enter cannot retry across victory; a released fresh command can.
Retry retains the exact authored scenario/theme/setup and returns to its initial
checkpoint without campaign/profile writes.

This is the **authored Standard / Immediate / seed1 preview** route, not a claim
about ordinary fresh-attempt difficulty tuning. It uses a greybox practice with
explicitly null decoded actor/backdrop leases. Retaining those null leases and the
rover-yard theme is not proof of production-art restoration. Existing core routes,
this host proof, native play and human fairness remain distinct. The first run also
passed; no product failure was invented. Independent review found no source blocker.

## C6 support: rejected image selections retire old work

With accepted background A, pending read/decode B and a rejected file C, Motion Lab
used to report C's rejection before invalidating B. B could later replace A and
its message. Selecting a real file now retires pending work using the existing
cancellation helper before type/size validation. A stays accepted, Clear stays
consistent and stale callbacks cannot resurrect B. Cancelling the file picker
without selecting a file does not supersede B. Playback, focus and saved source
bytes remain untouched.

The complete four-file cohort passes **101/101**:

```sh
node --test game/test/motion-lab-display-host.test.mjs game/test/motion-lab-png-preview.test.mjs game/test/motion-lab-preview-loop.test.mjs game/test/motion-lab-display-restoration.test.mjs
```

The new cases cover pending byte read/native-decode handlers, invalid type and
oversized replacements, exact accepted-image draw calls, stale callbacks and
empty-picker intent. `motion-parent-red.tap.gz` preserves four failures and one
passing cancel-picker case. The separate initial copy-regex mismatch is a fixture
error, not a product defect. The publisher had the same race at `81df80dda`;
retain its newer controller/editor and Clear-focus work when applying this narrow
ten-line diff. Tests use modeled Image/URL/DOM/RAF; URL revocation is not proof of
native decoder memory release.

## Source checks and remaining acceptance

Scoped ESLint, syntax, Prettier and diff checks pass. Independent review verifies
the rotor phase/transform path and the preview's ownership/cleanup contract.
All three evidence cohorts have zero final failures, skips or cancellations;
they are reported separately, not substituted for the long suites waived by policy.
The manifest pins exact source and decoded preserved-log bytes.

Required integrated source/provenance/build gates, production successor review,
immutable publication and public byte/player checks remain with the canonical
publisher. No heavy build, new comparison tool, artwork generation, shared-branch
rebase, approval, version or release mutation is part of this worker batch.
A2 full-roster art adoption, B broader difficulty/fairness, C first-cohort adoption,
whole-content/device qualification and C2's human study remain open.
