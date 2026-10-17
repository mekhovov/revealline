# Optional aircraft battery endurance

The aircraft setup screen now exposes the existing versioned battery-depletion
option. New presets keep it off. Explicit saved preferences remain intact.

- **Save for next flight** stores the draft without changing the current flight.
- **Fresh battery & restart flight** saves the draft and launches a new attempt
  from the normal spawn point with full charge.
- **Test draft** and Advanced handoff retain the selected depletion setting.
- Pause, resume and checkpoint recovery retain actual consumed charge and the
  attempt's frozen aircraft configuration.

Consumption uses current multiplied by simulated time, divided by 3,600 to obtain
amp-hours. Recording windows do not accelerate discharge. Disabling depletion keeps
charge full while retaining battery mass, instantaneous sag and propulsion limits.
The option participates in simulation and comparison identities. Existing backend
and replay identities are unchanged when configuration is unchanged.

Validation covers EN/UK controls, draft caching, backups, immutable captured flight
configuration, charge units, recovery/resume, fresh reset and recording-independent
battery behavior. Ordinary practice remains unlimited. Separate timed/endurance
challenge rules are a subsequent opt-in layer; this setting alone does not create
a scored challenge or certify real-aircraft flight duration.
