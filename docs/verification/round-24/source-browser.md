# Round 24 source browser checks

Checked 12 September 2026 against working v0.14.0 at isolated port 8827. These checks use the real solo app, Playground and Controller Lab through visible UI in one desktop browser. No terminal state, storage value, hidden game object or private iframe API was injected. The workspace server on 8767 and its versioned player pages were untouched.

## Authored scenarios and real failures

The new normal-input fixture probes initially supplied a core-valid level without an authored name. Playground correctly rejected it with `level.name must be nonempty text`; its previous configuration remained intact. Adding an original name allowed the first self-contact practice check. The complete named scenarios subsequently prepared in `.cache/round-24/browser/` pass both the scenario and actual Playground document validators. They are editable practice content, not imported terminal results. Their README and manifest identify the source data and verified input routes.

Through Complete pack JSON → Apply content JSON → Play configuration:

- Reversed a live cut on the one-life self-contact map. The real loss displayed the unfinished-line reason and a relevant next step.
- In both Immediate and Grid + buffer, moved Right into a border patrol on the authored body-contact map. The persistent reason read “An enemy reached your character,” with advice that acknowledges patrols on safe ground. Read details and Done did not retry. Explicit Retry reset the same practice to one life, zero coverage/score and a running clock.
- In both policies, started the staged encounter fixture, moved Right briefly and stopped with its line open. The marked lane activated around 2.5 seconds and ended the attempt. The persistent reason correctly described character **or** unfinished-line contact; it did not invent an attacker. Explicit Retry reset both required objectives and the encounter to SHIELD RELAY.
- A cut-timeout fixture exercised the longer reason/tip and the separate consequence paragraph with Reduced effects enabled and sound left muted. Text remained the primary explanation.

## Two observed presentation corrections

The first compact self-contact check showed that the existing mobile/short-landscape CSS hides `overlay-footnote`. The initial screenshot is retained as [pre-correction evidence](screenshots/compact-self-loss-initial.jpg). Moved the loss-only consequence into its own `#retry-consequence` paragraph inside the existing named Mission details reading region. It clears and hides on every non-loss overlay. Retry and the reader toolbar remain outside the inner text scroller. The older loss footer is empty; other overlay footers retain their behavior.

Actual boss losses also exposed a stale recovery caption saying that revealed territory is kept. Since a terminal clock no longer advances, that caption remained beside Retry indefinitely. The terminal branch now replaces it once with “Flight ended. Read the details or try again.” Nonterminal life-loss captions and separate storage warnings are unchanged. A subsequent actual staged Grid loss confirmed the corrected final caption.

## Viewport evidence

The Playground reports requested and actual iframe sizes separately from preview display scale. Screenshots use ordinary pointer actions to bring the relevant paragraph into view; scrolled views are not claims that all text fits simultaneously.

| Actual reported size | Evidence and observation                                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 320 × 640            | [Consequence visible](screenshots/compact-consequence-visible.jpg). The paragraph can be reached within the reader. Retry may require outer-overlay scrolling; an actual click reached it and started one fresh attempt.                                                                                                  |
| 390 × 844            | [Phone](screenshots/phone-retry-consequence.jpg). Read/Done/Retry reported inside the arena, each at least 44px high; whole arena and no horizontal overflow reported.                                                                                                                                                    |
| 844 × 390            | [Landscape](screenshots/landscape-retry-consequence.jpg). Read/Done/Retry reported inside the arena at 44px high; whole arena visible, no horizontal overflow. Preview display scale was 84%.                                                                                                                             |
| 844 × 501            | [Short window](screenshots/short-window-retry-consequence.jpg). Read/Done visible; Retry and some flight actions require vertical scrolling. Retry is 107 × 45 CSS pixels; no horizontal overflow.                                                                                                                        |
| 1280 × 720           | [Desktop](screenshots/desktop-retry-explanation.jpg). Read/Done are 222 × 44 and Retry 107 × 45, inside the arena. Whole arena/no horizontal overflow reported. Existing compact desktop flight controls have a separate 34 × 28 minimum; this check does not claim every desktop control is 44px. Display scale was 55%. |

A native End key relinquished controller reading without retrying; a subsequent ordinary click brought the consequence into view. That screenshot is not evidence that End itself scrolled to the end. The actual held-controller scrolling check below provides separate end-of-details evidence.

## Controller reading and held Retry

In the actual Controller Lab at reported 320 × 640, selected optional Toggle Boost and used the original three-life First Signal map. Three real Down-cut/Up-reversal contacts reduced lives 3→2→1→0. The first two kept their nonterminal feedback; only the final loss showed the new terminal text and consequence, with Boost off.

Entered Read details and held virtual Down for at least 2.5 seconds. The controller reached **End of details**, with the complete practice consequence visible: [controller reader end](screenshots/controller-compact-consequence-end.jpg). Back returned focus to Read details and kept the loss frozen at 0:13. Used the Lab's 200 ms Pulse gesture for a single Down navigation step to Retry; longer held directions intentionally repeat and are not single-step navigation.

Changed to Hold gesture and pressed Confirm / South once on Retry. While that same button remained held, the new run advanced from 0:01 to 0:02 at zero coverage, three lives and zero score. Scout remained Ready and Toggle Boost off. It neither restarted repeatedly nor leaked an ability press. The separate real-router/navigation regression covers both this default Confirm→ability binding and remapped Confirm→Boost; the remapped case is not claimed as a physical browser-device check.

## Campaign rewards and logs

In the ordinary solo page, completed First Signal through Tap steering at **52.2%, three lives, 8,160 points and 0:03**. Selected that completed mission again, then lost all three lives through actual self-contact. The ordinary consequence explained that this reveal resets while collected pictures and best results remain. Read details/Done left it lost; explicit Retry started at zero coverage/score, three lives and 0:00.

After reload, Collection retained exactly one gold First Signal picture and the earlier first-clear appearances. Local scores retained exactly one scout / immediate / seed 1 entry at **8,160 points and 3.70 seconds**. Loss and Retry created no extra score or picture. The next campaign mission remained available.

Solo, Playground and Controller Lab error/warning logs were empty after these checks. Simulated controllers, authored practice routes and same-browser size fixtures establish software behavior only; physical controllers/phones, native apps, public-host operation and human comprehension/enjoyment remain unmeasured here. Full source gates, packaged checks and frozen/offline checks are separate records.
