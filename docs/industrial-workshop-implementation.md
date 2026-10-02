# Unified appearance implementation

The latest [theme-selection review](verification/appearance-theme-selection-2026-10-03/README.md)
records immediate matching selectors, quieter controls, crimson Vyshyvanka,
Classic Field Kit and three additional shared families.

The preceding [runtime continuation](verification/appearance-runtime-2026-10-02/README.md)
records distant gate cues, packaged embedded-texture loading, Replay recovery,
independent asset rendering and the remaining production/device acceptance gates.

The preceding [continuation report](verification/appearance-continuation-2026-10-02/README.md)
records the subsequent Industrial state, Neon entrypoint, SIM badge and original
marking-kit work, with scoped browser evidence and prioritized remaining gates.

The subsequent [quality-first implementation follow-up](verification/appearance-quality-2026-10-02/README.md)
records the custom community registration path, deeper surface/contrast repairs,
localization, classified baseline and the latest build/test evidence. The initial
verification counts below describe the earlier implementation pass.

Implemented in the working tree on 2026-10-02. One shared appearance system now
coordinates game UI, menu decoration, compatible arcade art, optional SIM resources
and creator tools. Industrial Workshop is the application fallback for new profiles;
existing preferences migrate without rewriting them on read. No Factorio assets
are included. This is a local implementation, not a published release.

Eleven coordinated built-in families are available: Industrial Workshop, Vyshyvanka,
Dnipro Porcelain, Tryzub, Desktop 98, DOS Navigator, Orchard Workshop, Neon Ruins,
Pocket LCD, Copper Observatory and Sakura Station. Classic Field Kit is also
available; exact older revisions remain loadable. Palette and material roles use the same engine
contracts across communities; a community theme is not restricted to its source
campaign. Ukrainian palette research used the user's Swarmshared palette examples
at commit `da1c1f3c4b985ead2b8d306c9d883cb0dbcd1521`. Dnipro Porcelain is an original
light adaptation of its dark Dnipro palette. Orchard and Neon are original designs.

The reference research informed hierarchy, quiet text surfaces, explicit interaction
states and independent material sampling, not asset copying:
[Factorio GUI](https://factorio.com/blog/post/fff-238),
[controller navigation](https://factorio.com/blog/post/fff-370),
[surfaces and decals](https://coigame.com/Blog/cd-43),
[Windows system colors](https://learn.microsoft.com/en-us/windows/win32/uxguide/vis-color),
and [the supplied Ukrainian palettes](https://github.com/mekhovov/swarmshared/tree/alex_dev_swarmshared_1/themes/palettes).

## Try it

- Run `npm run dev`, open Settings → Display & Language → Appearance. Pick a
  gallery card or theme from the selector to apply immediately. Both controls
  expose the same complete inventory, including community themes. **Follow campaign / community** uses the campaign default,
  then community default, then Industrial Workshop. An explicit personal choice
  wins globally. **Customize** retains independent mission-art and decorative-detail
  overrides; choosing a complete theme resets those and SIM overrides to Follow. Accessibility
  preferences are preserved.
- In Academy or World flight options, choose the interface and world appearance
  separately. Follow game, Authored and all eleven collections preserve independent
  preferences. World/model changes after the first successful arm take effect
  on Retry or a new flight; interface and accessibility changes remain immediate.
- Open `/authoring/asset-studio/`, expand **Theme workbench**, and create an
  independent workspace from any installed family. Save, reload, duplicate, inspect, and export
  it. `.rltheme` retains editable history; `.rlruntime` contains one compiled
  snapshot, its interface/family/SIM bindings and the selected original files.
- Open `/authoring/fpv-worlds/calibration.html` to compare real renderer output,
  all eight environments, camera views, quality presets and shared material
  swatches. Desktop 98 and DOS Navigator are selectable families with
  flat interface treatments and compatible SIM/arcade collections.

## Framework and interface

`game/presentation/theme-system.mjs` owns validated `ThemeFamily.v1` and
legacy `InterfaceTheme.v1` plus current `InterfaceTheme.v2` documents and immutable
`ResolvedPresentation.v2` values.
Families reference independent interface, arcade and SIM revisions. Unavailable
interface revisions are rejected rather than silently resolving a newer one.
Resolution applies theme values, input/density/text preferences, then accessibility
overrides. Serialized contracts and transfer containers have separate versions.

`theme-host.mjs` prepares styles and fonts before applying the latest requested
presentation. Failed or superseded loads retain the accepted appearance and expose
status to controls. Per-document leases clean up subscriptions and owned tokens.
The optional SIM host embeds the same stylesheet and font sources to preserve
offline closure and the existing file caps.

The material system provides charcoal panels, painted steel, inset controls,
amber accents and restrained material depth. Repeated decorative nine-slice borders
are removed from ordinary controls; sparse motifs stay at page edges. Text centers
stay quiet. Exo 2 is the interface face, IBM Plex Mono provides telemetry, and
Handjet is reserved for display headings. DOS uses a flat mono interface; the
light Desktop 98 family exercises a different palette and geometry. Primary,
selected, input and semantic fills have explicit foreground partners. The shared
unlayered recipes override legacy page paint held in `@layer legacy`, preserving
layout and authored image ownership. Icons inherit their action foreground rather
than carrying an unrelated cyan raster. A generated read-only first-paint seed
covers the original 45 public entrypoints plus 18 Neon authoring entrypoints,
including gates and offline launchers.

Shared adapters cover the game DOM, native menus, settings and dialogs, Canvas
board labels, Team Canvas, Company interface, SIM interface and creator entry
points. Canvas interface fonts resolve independently of artwork selection.
Original pictures, explicitly selected custom actor assets, and source presentation
identities retain their existing ownership.

Component contracts include hover, pressed, disabled, loading, selection, error
and focus. Focus is independent of selection and validation. Player target size
is 44 CSS pixels; Studio may use 32 with a fine pointer. Enlarged text and coarse
pointer modes expand controls. Plain text, ornaments Off, high contrast, opaque
HUD and reduced effects override theme decoration. Native controls retain existing
keyboard/controller behavior; appearance controls are included in the controller
navigation allowlists. English and Ukrainian labels are catalogued.

## Community defaults and exact revisions

Edition catalog v2 and BrandPack v2 admit bounded `{familyId, revision}` appearance
defaults. Campaign defaults precede brand defaults. V1 documents remain readable
and retain their exact historical data. Company Studio edits the local draft and
increments the affected edition revision; it does not publish. Compiled entrypoints
carry the selected pin for cold startup, and legacy brand CSS is scoped so it cannot
override active theme or accessibility tokens. SIM launch links carry only bounded
cosmetic pins, independent of content/proof identity.

Current Industrial interface/arcade and Desktop/DOS interface revisions coexist
with their retained r1 definitions. New candidate exports use `ThemeCandidate.v2`
with exact basis pins; v1 candidates remain bound to the original r1 definitions.
Unavailable stored choices remain recoverable and report their fallback.

## SIM collection and recordings

The shared `theme-system.mjs` validates `SimVisualCollection.v1` without importing
the optional renderer. `world-themes.mjs` re-exports those roles and owns profile
resolution and appearance preference/session contracts. `world-visuals.mjs` supplies original
deterministic steel, rubber, copper, concrete, enamel, timber and grass textures.
The actual renderer and hangar share drone geometry and material bindings.
World course thumbnails and the Creator spatial viewport resolve the selected
preview appearance independently of a frozen flight. Fourteen semantic effect
roles retain distinct goal states, player/hostile pulses, ghost and trail cues.

All three drone bodies, gates, markers, landing pads, vehicles, actors, obstacles
and scenery receive compatible material treatment. Gym, field, woodland, courtyard,
warehouse, stadium, container yard and garage retain their environment identity.
Decorative additions are bounded and separately identified; collider geometry,
gate openings, transforms, camera rules, physics, scoring and proof generation
are not theme inputs. Existing goal and orientation cues remain recognizable.

SIM surfaces use mipmaps and bounded anisotropy (Low/Balanced/High: 1/4/8, limited
by device support). UI and arcade sampling remain independent. Material ownership
disposes replaced geometry, textures and instance buffers. Repeated switching
also exposed and fixed a shadow-depth material retaining a disposed color map.

Imported GLB models retain authored materials unless their author supplies a
validated `extras.reveallineTheme` binding to an exact collection revision and
material role. Bindings do not change geometry, transforms, animation hierarchy
or collision data. Transparent materials require explicit authoring consent to
be replaced by opaque material roles. Unsupported bindings retain originals and
report diagnostics. See the [source kit](../authoring/fpv-worlds/industrial-workshop.md)
for metadata, Blender export examples, supported image profile and lifecycle data.

Appearance freezes after the first successful arm, including after disarming.
Retry/new-flight boundaries apply pending world and model preferences. Pre-arm
appearance changes preserve the focused control; explicit Retry retains its
normal viewport-focus behavior. Existing profiles migrate to Authored and new
profiles follow the game. Unavailable preferences remain stored for later recovery.

World recordings copy appearance into `world.themeProfile` without mutating the
installed course or changing the existing course/proof archive identity. New
`ThemeProfile.v2` snapshots retain one bounded, validated authored fallback.
Available pinned revisions preserve their exact embedded palette; unavailable
revisions render the saved fallback with an explanation. Legacy v1 profiles still
load and use an explicit environment fallback when exact resources are missing.

Academy appearance is separately validated recording-wrapper metadata, outside
the course and simulation proof. Legacy wrappers and proof-hash identity remain
supported. Theme switching and recording import/export are tested against identical
simulation results. Replay rendering never makes cosmetics part of verification.

## Studio and arcade

Studio workspaces have independent identities and revision histories. Migration
preserves the former workspace recovery data. Duplication copies the selected
snapshot, and imports create independent identities unless replacement is explicit.
Replacement retains recovery data. Generation checks protect concurrent writes.

The workbench offers shared component specimens, resolved-role inspection,
contrast/coverage/dependency/provenance/size checks, and native renderer previews.
The arcade comparison prepares the exact workspace through the normal runtime
host, including original-file validation and decoding. It does not substitute the
published collection. The SIM action transfers a bounded, validated candidate
through one-use session storage into the actual calibration renderer; saving
first preserves staged edits during same-tab navigation. Candidate preferences
never replace player settings.

The `RLRUN2` compact runtime envelope contains the selected compiled presentation,
candidate `ThemeFamily`/`InterfaceTheme` documents and exact installed-engine SIM
dependency descriptor. Procedural resources are explicitly engine dependencies,
not falsely represented as bundled model files. The reader retains `RLRUN1`
compatibility and validates manifest and asset hashes, candidate/source agreement,
size, truncation and trailing bytes. Full editable history stays in `.rltheme`.
This prepares content for the existing curated publication path; it does not
install arbitrary theme files into player profiles.

The arcade adapter decorates 35 exact built-in bitmap roles using cached original
material treatment. Source identity and content hash must both match. Alpha,
frames, footprints, rotors, player markers, custom uploads and level pictures stay
intact. Solo, Versus and Team capture the selected appearance for a new attempt.
Company shares interface styling and uses the adapter where a compiled arcade
snapshot is available.

## Verification and release boundary

Focused checks cover resolver contracts and revision pins, contrast, DOM token
ownership, cancelled/failed loads, controller navigation, independent Canvas fonts,
workspace migration/export, arcade ownership, SIM switching/freeze, proof identity,
legacy recordings, material bounds, explicit GLB bindings and resource disposal.
The full practice suite and explicit World suites are run separately because the
standard practice command does not include all World coverage.

Browser checks use isolated profiles. The Studio journey creates a workspace,
edits a token, saves, reloads, exports `.rltheme` and `.rlruntime`, and verifies
the compiled export carries the edited value. Game settings were checked at
1440 pixels and at 390 pixels with enlarged/high-contrast presentation. SIM checks
exercise actual WebGL, first-arm freezing, queued changes, retry, independent UI,
accessibility and Academy recording round-trip.

Actual WebGL checks cover eight collections × eight World environments × three
quality presets (192 combinations), plus actors and the 64-slot projectile pools.
Repeated eight-family switching showed stable resource counts. Local p95 cadence
was 16.7–16.8 ms in a fixed balanced-quality container-yard sample. These are local
browser measurements, not physical-device qualification or spare GPU headroom.
See [the SIM evidence](verification/eight-theme-sim-2026-10-02.json).

The [appearance evidence](verification/appearance-system-2026-10-02/) contains
actual eight-theme Apply checks, readable Start/Resume actions, eleven tool/support
routes, narrow layouts and cold gates. The Studio browser journey seeds Dnipro
Porcelain, edits and saves a token, exports and validates an exact v2 runtime
candidate, compares 35 arcade roles, and opens the same candidate in SIM calibration
without writing player preferences.

The initial implementation used Academy's 8 MiB/64-file and World's 16 MiB/96-file
limits. Subsequent main integration inherited 72 and 104 file caps respectively;
the byte limits are unchanged and this appearance continuation does not raise them.
Shared SIM CSS/fonts are embedded from exact source assets, and new runtime logic
is consolidated into admitted modules. Optional SIM resources remain outside the
mandatory game cache. Use `node scripts/refresh-fpv-presentation-assets.mjs --check`
to detect drift after changing shared presentation CSS or font inputs.

Final validation results and measured package sizes are recorded in the
[final verification report](verification/appearance-system-2026-10-02/final/README.md).
The final local build, 111 focused checks, 207 practice checks, 62 World checks,
lint and validation pass. Its eight-theme browser matrix and complete Studio-to-SIM
export journey pass. Packaging uses test-only bindings, not publication. The
existing immutable compiled release 104 and publication ledger are not regenerated
to hide unrelated source-history failures.

Remaining release qualification includes human art/readability review, physical
touch and controller devices, the complete localization/accessibility matrix and
performance measurements beyond this machine. Restored historical arcade attempts
retain authored appearance because their session schemas do not pin this cosmetic
layer. Detailed SIM realism, new sound production, texture streaming and direct
player theme-file installation remain later work. The compatible bounded floor
markings, projectile pools and peripheral scenery from the parallel SIM art pass
were integrated; its full unmerged asset branch was not wholesale merged.
