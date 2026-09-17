# Team candidate browser retest

2026-09-17. Exact170508 source plus two runtime files pinned in binding.json: relay-rescue.mjs `9792a0818a6fc2e171de196387f51678685cc9919afd3d1a036cf3988475ebc5`, CSS `4b9edcf9072ad99b5c9503c0458b0587e819211f60763a8ff2075d1f43225bd8`. Local port60889/tab15; unchanged Viewport host explicitly loaded Couch, then its real Team link. This candidate is separate from frozen v0.60.0.

## Verified original failures

- At844×390, Relay Yard / Full teamwork / Standard, Enter Start then Escape; sixTabs from Resume to Options, Enter, Tab/native select Plain, Tab/native select Large. Focus remained coop-text-size and clock0:00. Selector y306.4921875..351.9921875,h45.5; overlay y12..378,h366,clientHeight362,scrollTop386,scroll-padding8px. The entire control and 7px ring fit. Inline screenshot visually confirmed this. Former selector ended383.9921875 and clipped. Large→Standard retained focus/clock and selector y238.578125..282.578125. Returning Large remained usable.
- Native Touch select Show both players, Escape twice and explicit Resume retained the passing844×390 arrangement: two140×206.03125 pads y121.6328125..327.6640625, directions44×44, Boost/Support68×62.03125; complete canvas440×220 at202/114.6484375; Pause y331..378.
- Escape then parent preset390×844 retained paused clock0:10. Explicit Resume: full canvas362×181 at14/258.484375, Pause y489.484375..536.484375, both pads179×206.03125 atx12/199,y593.484375..799.515625, all inside390×844 without horizontal overflow. The former bottom855.515625 now has44.484375px clearance. The live masthead is hidden; pausing restores it as flex and keeps the mode actions available. Clock after the real resumed interval was0:30. No movement commands were sent.
- Returning844×390 while paused, selecting Theme and toggling Reduced on preserved focused checkbox and paused0:30 clock; checkbox20×20 y184.773..204.773 stayed inside overlay. This checks native preference/focus behavior, not a contrast or touch-target audit.

## New unresolved variant

Theme font / Large / Reduced off / Touch Auto hidden, explicit Resume at844×390: canvas296×148 y217.890625..365.890625, Pause91.453125×47 y382.890625..429.890625. Page viewport height390, scrollHeight469, scrollTop0. Masthead remains56px tall. Fresh repeated DOM read and inline screenshot confirmed Pause below the initial viewport. This is a new Theme/Large hidden-touch case; it does not invalidate the passing Plain/Large case. The Team layout correction is not complete until this variant is resolved and retested.

## Boundaries and cleanup

Actual iframe CSS sizes are measured browser layout, not physical-phone/controller/touch or200%zoom certification. Parent screenshot clips the tall preview within its intentionally scrollable stage; exact child bounds establish the portrait fit. No full input, win, difficulty, offline, storage-denial or OS preference acceptance is claimed. Parent contentDocument evaluation was unsupported; supported frame-scoped read-only DOM observations succeeded. No application state was injected.

Restored Theme/Standard/Reduced off/Touch Auto through actual controls, left attempt paused, closedtab15, retainedpublictab1, stoppedserver84499. All successful response bodies are independently checked by request-byte-review.json. No source/index/version/remote changed and no phase was marked complete.
