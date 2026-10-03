# FlightDivision reference implementation — 3 October 2026

The authenticated simulator was inspected through its visible settings, Gear,
free-flight world and first lesson. This is a first-hand UI/art observation, not
a measurement of its flight fidelity or a claim that its assets are available for reuse.

## What to carry into FPV / LINE

- Group keyboard input like two radio sticks. FlightDivision exposes W/S throttle,
  A/D yaw and arrow-key pitch/roll, plus Space arm and R respawn. PR #986 adopts
  the movement grouping across Academy, World Studio and the learning lab, keeps
  Classic available and routes actions through our existing safety paths. Tab
  remains accessible menu navigation; combat fire is F in Two-stick.
- Use coherent industrial materials and recognizable geometry. The reference
  combines dark structural frames, pale building faces, restrained bright accents,
  defined contact/shadow cues, readable flight lines and recognizable quad hardware.
  Original local models and appropriately licensed material libraries are the
  implementation path; no reference textures, models, code or branding are extracted.
- Present one task at a time during flight. Keep our quiet mobile cockpit and
  detailed paused explanations; refine contrast and placement with actual world views.
- Favor quick retry, compatible ghosts and section practice over added menu friction.
  These are already implemented; preserve exact challenge/replay compatibility.

## Focused delivery sequence

| Priority | Increment                                           | State / remaining work                                                                                                                                                                                         | Estimate                           |
| -------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1        | Two-stick keyboard scheme                           | Implemented, source/package verified, published #986. Protected checks and deployment are separate.                                                                                                            | Completed implementation           |
| 2        | Drone and near-field Container Yard geometry        | Slimmer frames, larger swept props, camera/motor/battery detail and closed corrugated containers. Source/package visual qualification precedes focused PR.                                                     | Current increment                  |
| 3        | Stadium and Garage composition                      | Build recognizable large landmarks, surface scale and readable route silhouettes using shared Themes roles. Review FPV, chase, overview, replay and all presets.                                               | 3–5 working days per bounded batch |
| 4        | Two representative environment asset sets           | Author/import a cohesive realistic urban and natural kit; texture density, normal/roughness maps, grounded props, vegetation silhouettes and lighting together. Expand only after frame/resource measurements. | 5–8 working days per set           |
| 5        | Apply accepted visual language across the 14 worlds | Distinct palettes and landmarks, reliable obstacle silhouettes, actor readability, curated details and bounded streaming/quality tiers.                                                                        | Re-estimate after first asset set  |
| 6        | Qualification                                       | Named desktop/mobile/Steam Deck frame times and memory, physical inputs and deferred unit coverage. Human feedback stays nonblocking for continued implementation.                                             | Existing H/R7 scope                |

Counts stay184 challenges /14 worlds /58 school lessons. Art variants do not add
levels. Appearance remains independent of scoring, collision, command recordings,
radio profiles and physics. Performance quality keeps opaque obstacle silhouettes;
Pixel retains its deliberate palette and nearest-filtered presentation. Additional
geometry must earn its visual benefit against measured draw/resource cost, not an
unverified FPS claim. Content remains available without progression locks.

Each complete verified increment gets a focused PR. Independent changes start on
current main; native stacks are used only for real dependencies. Public availability
requires the deployment marker and actual player launch. The delivery log holds
current exact heads; research screenshots or functional fixtures alone do not
complete environment art acceptance or establish parity with a commercial simulator.

## References

- [Authenticated FlightDivision simulator](https://www.flightdivision.com/sim): observed settings, Gear, world and lesson presentation.
- [FlightDivision control axes](https://www.flightdivision.com/blog/fpv-drone-controls-explained): axis vocabulary for teaching.
- [Three.js standard PBR materials](https://threejs.org/docs/pages/MeshStandardMaterial.html): roughness/metalness and lighting together.
- [Poly Haven license](https://polyhaven.com/license) and [ambientCG license](https://docs.ambientcg.com/license/): possible licensed resources, subject to per-asset provenance and preparation; none newly downloaded in this increment.
