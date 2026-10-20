# Community edition playtest packet

This packet covers the six current DroneAid Netherlands chapters (36 missions) and the historical Portuguese pilot (three missions). It provides a repeatable observation procedure, not a claim that a person has approved the current build. Previous broad reports do not identify individual participants, chapters or devices.

## Set up a session

Serve the repository with `node scripts/game-cli.mjs serve --port 8768`. Use a separate browser test profile and preserve participants' existing progress. Record the source revision, edition and mission IDs, browser/device, viewport, input method, difficulty and motion setting. Keep only consented, publication-safe observations under an anonymous participant ID.

Open `game/company.html?edition=droneaid-nl-workshop-lights`. Ask the player to complete **Open the Doors** using the in-game instructions. Observe whether they identify the coverage goal, required objectives, safe return and visible threats. Ask what they are trying to complete and what could interrupt their route. Record their explanation before giving help.

Check the win, revealed image, Continue, pause/resume and unfinished-session restoration. Repeat a short section with reduced motion or a different input if the player wants to. Stop for discomfort or an inaccessible control and record the blocker. A timing target is not a required human completion time.

## Chapter openings

| Edition | First mission | Observe |
| --- | --- | --- |
| `droneaid-nl-workshop-lights` | Open the Doors | Propeller readability, safe return and objective contrast |
| `droneaid-nl-parts-in-motion` | Six Little Stations | Shelf routes and clear overlays over the picture |
| `droneaid-nl-makers-together` | A Friendly Welcome | Paired routes and readable threat cues |
| `droneaid-nl-careful-handoff` | From Bench to Box | Long return and far-side decisions |
| `droneaid-nl-signals-of-support` | A Story Worth Sharing | Gathering island and palette contrast |
| `droneaid-nl-shared-horizon` | Canal Connections | Staggered returns and dusk contrast |

Open each with `game/company.html?edition=<edition>`. The separate historical Portuguese pilot retains Workshop Lights, Community Relay and After the Storm. Record historical and current results under their own content identities.

## Optional authoring exercise

[Transfer practice](../authoring/company-studio/playtest.html) demonstrates the generic workbench with a fictional bridge notice. All records are available immediately. Ask which crossing is available and what evidence supports the choice before Commit reveals feedback. The source is [practice-fixtures.mjs](../authoring/company-studio/practice-fixtures.mjs); participant exports omit answers, coaching and completion text.

This exercise does not write campaign progress, save personal responses or certify real-world proficiency. Its purpose is to inspect the generic learning controls separately from arcade play.

## Record observations

| Participant / mission | Build and content IDs | Goal and threat explanation | Input / access barriers | Time, pauses and retries | Result and evidence | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| Pending | Pending | Not observed | Not observed | Not observed | Not observed | Pending |

Keep observations separate from interpretations. Fix an observed blocker, then retest that case. Machine route proofs establish reachability, not enjoyment, readability or human understanding. Artwork, installed-PWA behavior, storage recovery and physical-device performance have separate verification requirements.
