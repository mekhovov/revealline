# Irregular delivery and audio-view follow-up

This follow-up addresses presentation work found during qualification. It does not change authoritative simulation, input sampling, saves, transport ownership or replay formats. Native timing and thermal results remain separate from these modeled correctness checks.

## Decorative adaptation

Commit `5076a0a83903661dc185478555be3ccb7cede085` adds a 512-byte interval histogram to the existing quality policy. A substantial population in two separated cadence buckets can identify irregular missed delivery even when synchronous JavaScript is inexpensive. The policy does not infer whether the cause is browser, GPU, compositor or device behavior. Steady slow delivery, bounded jitter and isolated hitches retain their existing treatment. The preparation cadence stays fixed; two overloaded windows, the ten-second dwell and restoration only at safe transitions remain unchanged.

The complete old-policy test files reproduce six new policy failures and one real-host tier failure; all original cases pass. The changed policy passes **17 policy, eight submission-host and six renderer tests (31/31)**. The host verifies unchanged fixed ticks and independently stepped authoritative checkpoints, stable 30 Hz at full quality, reduced decoration under irregular delivery, and restoration only through public Resume. No test threshold was tuned after observing results. Red receipt: `cecc01aff2d938e9e32932736ab8fa7e38eba3a9919127bb28cf3dbbcec1101c`; green receipt: `853ab04314e677c7ccaa4c5e930485c6b56ff4a76d6f25fd9db4717b08c59f65`.

## Audio presentation

Commit `aef69ebe258e9097e9758d2846df7212e21c8f27` fixes ordinary music progress notifications that reached inactive Demo widgets and refreshed unchanged active Demo controls. The soundtrack dialog also updated its transport and audition presentation while closed or hidden. The fixes defer inactive/hidden view work, compare only fields actually displayed in Demo, and force a current refresh on explicit actions, open, language change and visibility return. Demo still publishes media-preparation ownership before skipping hidden presentation. Clearing a closed dialog's status affects only its owned UI; actual playback, cancellation and errors retain their owners. A duplicate quick-control refresh in the shared callback is removed.

In the modeled actual host, 20 shared-player media progress events produced **1,400 observed writes to unchanged visible Demo controls** and **760 writes to closed Demo controls** before the fix. Both tested paths produce **zero** afterward. These are instrumented DOM-boundary counts, not browser frame-cost or power measurements.

Five complete files pass **210/210**: Demo widget 15, Demo host four, soundtrack panel 154, shared Demo media admission seven, and soundtrack host 30. They cover track advance, background ownership, language changes, explicit controls, errors, closed preparation status, visible return and the ordinary authoritative checkpoint. Scoped lint, formatting and diff checks pass. Eight intended failures reproduce on unchanged runtime after correcting one new test observer's text-node handling; the original observer failure remains retained and is not runtime evidence. Summary receipt: `25b86c1b47a3bba22987705d839b8c14825a79298d1a68c5a6d3da23a3c0e97c`; green receipt: `6abbe0946febfa106ddc078c96f1f33e9a967b8e86842020ade221002a0ed483`.

The complete cadence/input host file also passes **4/4** on the combined policy and audio source, including keyboard/gamepad schedules and interruption behavior. Its receipt is `778268698783737a157c2b41a80f33a70945051bfcad4f194a487abda9318140`. The combined affected group passes **245/245 across nine complete files**. [Machine-readable evidence](solo-presentation-followup.json).

The existing production preview workflow now includes all six affected complete test files in its focused gate. A separately verified successor package and affected native observations are required. Existing `8c1af9d1` measurements retain their original source identity; none is relabeled as evidence for these follow-up changes.
