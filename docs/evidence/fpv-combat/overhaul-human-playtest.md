# Human qualification — checklist and results template

**Status: pending.** No new physical-radio session or five-player study is recorded here. The user has deferred the radio check; schedule it when they are available. Earlier confirmation of flight and Fire does not qualify the added commands.

Use the [player guide](player-guide.md) for controls and activity rules. Release decisions belong in the [delivery gates](overhaul-delivery.md) and [release notes](overhaul-release-notes.md); [browser qualification](overhaul-browser-qualification.md) records the separate automated/browser evidence.

## Record once per tested build

- Date / facilitator / build commit or source hash: **pending**
- Browser / OS / computer / display resolution: **pending**
- Map and revision / art / effects / camera / flight mode: **pending**
- Requested and admitted population / difficulty: **pending**
- Weapons / payload / ammunition preset / both damage-assistance settings: **pending**
- Input device and saved profile / relevant bindings: **pending**
- Evidence links and known issues at session start: **pending**

Use anonymous participant IDs. Record observations before offering coaching; mark any assisted task. Record both wall time and the in-game timer when pausing makes them differ. A skipped task stays **not tested**, with its reason.

## A. Deferred physical-radio check

Before starting, record the saved channel mapping, axis direction, centers/endpoints, dead zones and rates. Confirm normal stick response and low-throttle arming. Use distinct controls for Fire, Weapon, Reload, Payload and Detonate; save through **Save & return**.

For every row below, perform one deliberate activation in each condition. Check the visible action and ammunition change. Use a partially depleted magazine for Reload and a deployed remote charge or drone for Detonate. Observe cooldown/readiness messages rather than counting an unavailable action as a binding failure.

| Command | Fresh armed flight | After pause/resume | After menu close | After disconnect/reconnect |
| --- | --- | --- | --- | --- |
| Fire | Pending | Pending | Pending | Pending |
| Weapon switch | Pending | Pending | Pending | Pending |
| Reload | Pending | Pending | Pending | Pending |
| Payload | Pending | Pending | Pending | Pending |
| Detonate | Pending | Pending | Pending | Pending |

At each interruption:

- [ ] Try a command held across the interruption: it must not trigger on return. Release it, then activate it deliberately and confirm the intended action.
- [ ] Confirm one command does not also switch weapons, deploy a payload or detonate ordnance through an overlapping binding.
- [ ] Confirm the paused/menu state does not advance combat, spend ammunition or finish a reload.
- [ ] Disconnect with a command held. Confirm the flight enters its safe paused/disarmed state; reconnect must not resume or arm automatically. Release controls and use a deliberate Arm OFF → ON transition.
- [ ] Compare the saved calibration and binding values before and after menu use, reconnect and page reload. Verify stick direction and neutral response remain correct.
- [ ] Record any stuck input, repeated action, unexpected discharge, lost binding or calibration change with exact steps and an evidence link.

Radio outcome: **pending**. Device/profile: **pending**. Findings: **pending**. A keyboard or simulated-radio pass cannot fill this table.

## B. Five-player formative sessions

These are **planned slots**, not enrolled or tested participants. Allow roughly 25–35 minutes per person, extending if an activity needs another attempt. Players choose comfortable visual-effect settings.

| Slot | Planned primary input | Actual input / experience | Completed / evidence |
| --- | --- | --- | --- |
| P1 | Physical radio | Pending | Pending |
| P2 | Physical radio | Pending | Pending |
| P3 | Controller | Pending | Pending |
| P4 | Controller | Pending | Pending |
| P5 | Keyboard | Pending | Pending |

If radio availability delays a slot, keep its radio coverage pending. Across the sessions, rotate all four weapons, all three payloads and Balanced/Arcade/Tactical ammunition; record the actual configuration rather than silently changing it during an attempt.

### Common itinerary

1. **Hunting:** find a target, fire, switch weapon, reload and finish the three-minute round. Ask what the ammunition display means and whether reloading interrupted the fun.
2. **Continuous:** defeat a wave, understand the break, start the next wave, and find/use a supply or service pad. Observe a five-second service while combat continues.
3. **Elimination:** identify the required roster and use guidance to find the last target. Record any target the player cannot reach or recognize.
4. **Strike:** understand the marked objective and payload. Include a deliberate separate detonation for a remote charge/drone. Record whether post-crash ordnance and the resulting outcome are understandable when encountered.
5. **Survival:** play one six-minute attempt, or record the actual death time; retry with a stated new tactic. Note formations, elites, supplies, the final threat and any overtime needed to clear it. Briefly sample Endless and confirm the player understands how it differs.
6. End by checking that **Retry** keeps the attempt configuration and **New run** is understood as a fresh attempt. Ask the player to identify their loadout and assistance settings in results.

### Timing sheet — copy per participant

| Milestone | Observed time / result |
| --- | --- |
| First meaningful engagement; target within ten seconds in Continuous and Survival | Pending |
| First intentional shot / hit / defeat | Pending / pending / pending |
| First defeat or resource payoff; target within 20–30 seconds in Continuous and Survival | Pending |
| First threat noticed and correctly explained | Pending |
| First deliberate switch / successful reload | Pending / pending |
| Secondary challenge offered/noticed; target within thirty seconds in Continuous and Survival | Pending / pending |
| Secondary challenge completion time, if completed | Pending |
| First supply noticed / collected; first completed service | Pending |
| Hunting ends at three accepted minutes | Pending |
| Survival formation / elite / final threat noticed | Pending / pending / pending |
| Survival six-minute boundary and actual completion or death | Pending |
| Death → explanation → changed tactic on retry | Pending |

### Short interview — copy per participant

- Impact satisfaction, **1–5** (1 very unsatisfying, 5 very satisfying): **pending**
- Threat clarity, **1–5** (1 cannot tell what threatens me, 5 consistently clear): **pending**
- In the player's words: “What caused your death or most serious damage?” **pending**
- “What would you change on the next attempt?” Chosen tactic and observed retry outcome: **pending**
- Reload/ammunition frustration: number of incidents, weapon/preset, what the player expected, and whether they understood how to recover: **pending**
- Could they distinguish damage, defeat, missed shots, empty ammunition and an unavailable command? **pending**
- Most enjoyable moment / most confusing moment / first change requested: **pending**
- Facilitator help, unfinished tasks and reproducible defects: **pending**

## Qualification summary

| Measure | Result |
| --- | --- |
| Physical-radio command matrix and preserved calibration | Pending |
| Five completed sessions; actual radio/controller/keyboard coverage | Pending |
| Five combat activities plus Timed/Endless coverage | Pending |
| Weapons, payloads and ammunition presets covered | Pending |
| Satisfaction scores / threat-clarity scores, P1–P5 | Pending / pending |
| Death explanations and observable new tactics | Pending |
| Reload/ammunition problems and fixes needed | Pending |
| Release decision / reviewer / date | Pending |

Retain individual scores and reasons; do not average missing answers or infer human approval from automated checks. The gate requires a median of at least **4/5** for both impact satisfaction and threat clarity. At least **four of five** participants must explain their death and identify another tactic to try. Carry unresolved usability defects into the release decision. Five formative sessions provide qualitative feedback; they do not replace the separate performance, catalogue or hardware gates.
