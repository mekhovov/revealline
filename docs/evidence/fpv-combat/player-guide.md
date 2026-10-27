# Trying the local FPV combat overhaul

Open the [local SIM](http://127.0.0.1:8768/optional-practice/fpv-worlds/index.html?lang=en) and refresh an older tab.

## Choose an activity

In **Settings → Gameplay → Flight activity**, choose:

| Activity | Objective |
| --- | --- |
| Continuous combat | Clear successive varied waves. **Start next wave** skips the preparation period. |
| Target hunting | Destroy moving targets for three minutes, without return fire. Replacements arrive after a delay on another safe route when available. |
| Elimination | Defeat the fixed required roster. Follow the target direction and distance to find survivors. Optional props do not block completion. |
| Strike | Deliver a payload or destroy the marked objective. Deployed ordnance can finish the objective after a crash. |
| Survival | Choose six-minute or Endless. Survive formations, elites and resource pressure. The timed run ends after six minutes and the final enemy is defeated. |
| Original course | Retain the lesson, race or course's existing objectives. |

Learning levels default to Original course; other levels default to Continuous combat. Choices are remembered separately. Learning/Other/Mixed Random and Self-level/Acro remain independent of activity.

**Retry** retains the seed and configuration. **New run** changes the seed. Changing the loadout, activity, difficulty or population starts another attempt.

Ordinary combat requests 6, 12 or 20 targets. Survival requests 64, 96 or 128. The admitted count can be lower where the map has less safe space. Survival builds toward its admitted population over time.

## Fly, fire and use payloads

Keep throttle down, then arm. A radio with an Arm switch requires OFF → ON. After arming, pause, menus, focus loss or reconnect, release weapon switches before activating them again.

| Action | Keyboard | Radio | Controller / touch |
| --- | --- | --- | --- |
| Fire | F in the standard preset; Space in the alternate preset | Assign **Fire** in Radio setup | X / Square; on-screen Fire |
| Switch equipped weapon | C | Assign **Weapon** | Optional combat D-pad left/right; on-screen Switch |
| Reload | L | Assign **Reload** | Optional combat D-pad up; on-screen Reload |
| Deploy or arm payload | G | Assign **Payload** | Optional combat D-pad down; on-screen Payload |
| Detonate | H | Assign **Detonate** | Optional combat D-pad L3; on-screen Detonate |

Enable **Combat D-pad** in the combat settings to use those controller shortcuts. This changes the D-pad from flight adjustment to weapon commands. Existing stick calibration is retained. Radio assignments must use distinct controls; save with **Save & return**.

Two different weapons are equipped at a time: autocannon, scatter, precision or rockets. Switching pauses an unfinished reload. Each payload slot selects bombs, remote charges or a drone charge. Remote charges and the drone charge require a separate fresh detonation command.

## Ammunition and repair

- **Balanced:** unlimited conventional reserve; rockets and payloads are limited. Earned physical supplies and the service pad replenish heavy ammunition.
- **Arcade:** release Fire for one second to begin recharging. Conventional weapons then need two seconds, rockets four and payloads ten.
- **Tactical:** conventional magazines plus two spares, two rockets and one payload. Ammunition replenishment requires the service pad.

Use **Service pad** to show its direction and distance. Hold a controlled position near it for five seconds with low throttle and weapons released. Combat continues while servicing.

Repair pickups restore 25 health and are earned after twelve unique hostile defeats. They remain available when health is full. Health display options are independent of damage rules. Invulnerability disables combat damage; the aircraft's collision and crash rules still apply. Invulnerability and one-hit enemies are optional assistance settings and are identified separately in results.

When a regional flight leaves its encounter area, flight continues and the existing targets wait. Combat resumes automatically on return, without another arm command. Return guidance appears automatically unless you selected another waypoint; **Guide to encounter** selects it explicitly. **Restart encounter here** abandons the old attempt and validates a new area. If combat terrain is still loading, flight continues while the targets wait for verified geometry. The aircraft still observes real terrain and outer map boundaries.

## Cameras and effects

Chase starts close to the drone. Adjust its distance from **0.75–6 m** in camera controls. **FPV propellers** shows the front arms/props in first person.

**Blood**, **Brutal** and **Remains** are independent:

- Blood controls blood and exposed organic detail.
- Brutal controls the destruction treatment and breakup.
- Remains controls settled objects and marks.
- **Full gore** enables all three. Changing settings does not erase saved destruction records.

In Gameplay, **Full gore enabled** confirms that all three are active. The nearby Blood, Dismemberment and Persistent remains checkboxes also control them individually and stay synchronized with Display settings. The status says whether changes were saved on this device. **Destruction detail & character style** opens the separate graphics controls; Full gore does not change graphics quality or download character art.

Camera shake and screen-effect intensity can each be zero. Fullscreen blood starts disabled. Existing Vocals preferences remain shared.

Destruction detail offers Auto / High / Ultra, capped by overall graphics quality. The optional **Realistic** character revision downloads approximately **14 MiB**. Current art remains usable if downloading, validation or graphics preparation fails. Art selection does not change hitboxes or damage. High and Ultra preserve complete authored Realistic remains; when the visible-effects budget fills, whole clusters wait while their saved records are retained.

For the most detailed remains, choose **Quality** graphics, **Ultra** destruction detail and **Realistic** character style, then use **Download realistic characters** if shown. Selecting the style alone does not download the pack. Enable **Full gore** for Blood, Brutal and Remains together. Auto reduces the number of visible effects under pressure before reducing character detail; Performance graphics retains its simpler overall tier.

## Studio, saves and recordings

Studio uses the same actors, weapons, encounter definitions and effects as play. Preview clean and bloody outcomes, pause or restart the animation, scrub the timeline and inspect surface contacts. Export/import and stable-ID reimport retain the authored encounter.

**Save combat session** exports recovery data. **Load combat session** opens an exported file; **Continue saved combat** resumes the local saved attempt. Both find the exact available map revision automatically, including installed regional maps. If that revision is unavailable, Settings explains what is missing. New files retain the aircraft, controls and regional starting location; older files may require matching those settings manually.

Automatic recovery keeps the latest complete saved attempt on this device. Large saves use the browser database, including all saved remains and impact records. Continue can discover that save even if browser preferences cannot store its small index. Recovery and combat recordings use separate storage; a recovery warning does not necessarily mean recording has stopped. If automatic recovery fails, use **Save combat session** to export the complete file.

**Watch current attempt** and **Watch combat file** replay recorded flight and combat inputs. Pause, resume, replay again or choose 0.25×, 0.5×, 1×, 2× or 4× playback. The faster speeds apply to combat recordings. Live controls do not change playback, and watching earns no rewards. A completed playback checks that the recorded inputs reproduce the original flight and combat result.

Watch current attempt is unavailable until a combat attempt exists. File loading, continuation and playback report progress or errors beside these buttons. The recordings list initially selects a completed recording when one exists; an incomplete recording explains why it cannot be watched.

Combat results remain local practice results. The live recovery window retains twelve complete one-minute segments plus the current segment; play continues when that window rolls over.

**Combat recordings** saves accepted one-minute segments on this device, preserving longer attempts while storage is available. **Export current recording** includes the current minute. Finished recordings can be watched, exported or deleted individually. The limits are 32 MiB per recording, 128 MiB total and 16 recordings; nothing is deleted automatically. The saved interval and any storage error are shown.

A complete archived chain can be replayed and checked beyond the live recovery window. Continuing a complete recording preserves its earlier sealed minutes and appends the resumed flight, so a later export retains the complete chain. A recovery file that contains only a retained interval cannot reconstruct an earlier missing interval.

An interrupted archive without its final saved boundary cannot be watched; a separate recovery file can still continue a valid saved attempt. If storage fills, flight continues and the warning explains that recording has stopped. Export retained data before deleting older recordings to free space.

## Qualification status

This is a local development build. Current automated and browser evidence is recorded in [overhaul-delivery.md](overhaul-delivery.md). Earlier reports in this folder describe earlier builds. The user has deferred the physical-radio check. New command bindings and five-player satisfaction sessions remain separate release checks.
