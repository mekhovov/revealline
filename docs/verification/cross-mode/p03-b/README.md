# P03-B — visible initial focus

Candidate `35efcc685eae50ede8d117b0c5cefcc6ac6e9a2d` fixes title focus attempted before the boot guard makes the menu visible, and skips hidden/disabled default targets. It preserves deliberate user focus and leaves background pages alone.

The native browser now automatically focuses **Deploy** at a fresh test origin and **Continue** with an existing saved flight. A direct Team entry followed by Escape returns to Solo with **Deploy** focused. [Recorded observations and source comparisons](evidence.json).

The existing focused suite passes 51/51 on both Node 20 and 22; the receipt retains those exact commands and limits. This native addition tests only the three named focus journeys. Broader navigation, physical input/devices, exact Missions return context, final integrated-source qualification and public release remain open.

The 1231×1348 browser used candidate source files through the bounded preview. Port 51652 falls back to exact 35efcc6; port 60366 retains the previous 09861a9 fallback for unchanged missing files, while the changed app and shell came from the held 35efcc6 working files. No published release was changed. Accessibility responses are retained with original hashes and explicit text normalization.
