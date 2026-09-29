# RadioMaster TX15 USB verification — 2026-09-29

The user confirmed flight works in the local optional civilian FPV simulator at port 8777 after calibration. The browser reports TX15 Joystick (Vendor 1209, Product 4f54), eight axes and 24 buttons. This is a source-checkout browser result, not packaged/mobile/other-transport qualification.

Measured Mode 2 channels: Roll (right stick left/right) axis 0, Pitch (right stick up/down) axis 1, Yaw (left stick left/right) axis 3, Throttle (left stick up/down) axis 2. Roll/Pitch/Throttle span -1 to 1; Yaw spans -0.996 to 1. Centered attitude controls measured approximately 0.004. The user confirmed the animated stick directions; no channel reversal was needed. Full-travel throttle has no center calibration or dead zone. The verified profile was saved in browser storage.

Setup now offers guided inactive-to-active button-channel capture for arm/disarm, pause and reset. Capture accepts exactly one changing button channel, determines polarity, and rejects ambiguous changes. Switches must be exposed as USB joystick button channels by EdgeTX. Maintained switches suit arm/disarm; momentary buttons suit reset. Profile validation still rejects duplicate bindings. All four stick-mode diagrams have localized physical-stick descriptions.

The runtime preserves the observed OFF sample when an arm switch disarms, so the next deliberate ON edge can arm without an extra OFF frame. Reset remains edge-triggered and disarms; a held reset does not repeatedly restart. Focus/reconnect, low-throttle arming and airborne pickup checks remain in place.

41 focused radio, flight UI, boundary and setup tests passed, including switch polarity/ambiguity, all stick layouts, OFF/ON rearming and held-reset behavior. Scoped lint and diff checks passed. Physical arm/disarm and reset switch identification/testing is still in progress.
