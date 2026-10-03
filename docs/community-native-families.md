# Native community campaigns and progress ownership

The Community library accepts the existing Creator package, Classic Snake
packages, native Team campaigns (with optional Team media), and FPV World
packages. Family dispatch reads the package format, not its filename. Native
validators run before installation; imported campaign names and matching level
IDs do not grant official progress.

## Editing and sharing

| Content                                                 | Studio path                                                                            | Portable form                                                                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Capture, including Crossing Post                        | Main Studio source import/export                                                       | Editable content source; existing Creator publishing additionally requires its media and qualification package |
| Team, including Pincer Yard and Relay Rendezvous        | Main Studio → select Team campaign and difficulty → **Export shareable Team campaign** | `revealline-creator-team-portable.v2`; importing it into Main Studio restores its exact editable source        |
| Classic Snake, including Cable Cutoff and Shield Window | Snake Studio → load/edit campaign → export                                             | `revealline-classic-package.v1`                                                                                |
| FPV, including Low Pass Depot                           | FPV World Studio → clone/edit course → export world pack                               | Native `FPVWorldPack.v2` binary package                                                                        |

The Team v2 package pins the normalized source project, source pack ID,
campaign ID, selected difficulty and execution identity. The native compiler
must reproduce the complete runtime campaign exactly. Its admission evidence
is explicitly `structural-only`: it does not certify a winning route, two-seat
play quality, or human review. Historical Team v1 template packages keep their
existing replay qualification and interpretation.

The Community publisher and service validator use the same family registry.
Team and FPV retain their canonical native package bytes; Classic also retains
the exact original UTF-8 receipt. Installed storage can recreate a recovery
download before offloading an edition. Offloading removes installed content,
not the independent progress records. No public service deployment or
publication is implied by these local paths.

## Exact progress owners

- **Classic:** package records use
  `classic-snake-progress.proof.v2/community/<content-identity>`. Imported level
  and chapter IDs are namespaced. Only recipes derived from that package's
  accepted catalogue can own its replay proofs. The player does not award
  official chapter accents while an installed package is active.
- **Team:** attempts and clears belong to the exact edition SHA-256 in the
  installed Team progress store. Official/candidate Journey binding requires
  an owned source-pack object and owned row, not equal IDs or bytes. An imported
  edition cannot bind itself to those Journey receipts.
- **FPV:** records are keyed by the exact pack identity and course ID. Installed
  pack identity includes the package SHA-256. Removing one world revision does
  not remove other revisions or the independent flight proof store.

An exact content identity is not an author signature, moderation decision,
official score, or play-qualification certificate.

## Local validation performed

Production compiler, constructor, export/import and package-admission checks
accepted the following without running an automated test suite:

- Crossing Post: normalized editable source JSON round trip.
- Pincer Yard and Relay Rendezvous: Team v2 source → portable bytes → native
  import → Community family admission.
- All six new Team pursuit chapters: six missions per chapter, each exported
  and imported at Standard difficulty through the same source-backed path.
- Cable Cutoff and Shield Window: Classic package export/import.
- Low Pass Depot: cloned custom course in a native FPV World package, accepted
  by the Community family validator.

These checks establish data admission and round-trip compatibility. They do
not establish human completion, browser interaction coverage, server
deployment, or public release qualification. Ownership, proof rejection,
offload/reinstall and tampered-source regressions are authored under the
repository's explicit test waiver and remain unrun.
