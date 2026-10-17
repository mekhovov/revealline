# Historical FPV update qualification

The local pre-tuning-main → feature update now passes for both Academy and World. This closes the historical-version gap left by the seventh review's two-revision lifecycle fixture. It does not qualify a public deployment or every prior release.

## Actual source versions

The earlier packages come from exact main commit `8b01991942dc764b8aa4726851699ce1985e53ae`. The runner exports tracked Git objects into a fresh temporary source directory, imports that commit's own unmodified package builder and policy, and checks every historical package input against its Git blob. Installed build dependencies are reused through a temporary `node_modules` link; source files are not copied from the feature tree. Both workers and manifests come from their respective production builders. The prior packages have no tuning module; the current packages do.

The [passing receipt](fpv-historical-update-qualification.json) records Chrome `155.0.8059.85`, 185 stable current source bindings, the runner digest, exact historical input digests, and both complete manifest inventories. Academy changes from 90 to 108 manifest files; World changes from 151 to 167. The final tested feature source includes the camera migration fix described below, the 128-collider Advanced terrain limit, and the restored canonical native-bridge import with its shared builder/publication capability matcher. The [pre-integration successful receipt](fpv-historical-update-pre-integration-qualification.json) is retained as historical evidence. Any subsequent source change must be checked against these bindings before reusing this receipt as current evidence.

## What was observed

For each package, a disposable persistent browser profile runs the actual historical host and saves:

- Legacy response: 480°/s, 42° self-level tilt, expo 45, response time 11 ticks.
- Synthetic radio calibration, explicitly unverified and never attached to a physical device.
- Camera tilt 27° and vertical FOV 108°, classic keyboard mapping, direct touch response, large/strong stick display.

Settings use the historical DOM event handlers; radio/response use the historical production store. After normal offline preparation, the runner switches the local server to the new package and requests an update. The new worker waits while the old controlled page remains open. The old runtime and settings remain unchanged. Closing the scope page lets the new worker activate naturally; both revision caches remain present.

The runner closes the entire browser process and reopens the same profile offline. Legacy settings and radio storage remain byte-for-byte unchanged, the legacy response is intact, and the new editor shows the migrated 27°/108° camera. The editor's save action persists this migrated setup. A new Actual profile with a 900°/s roll rate and an assigned 33°/105° drone setup is then saved using the production library API. A second full offline browser restart verifies the new profile, selected setup and exact saved library bytes (1,106 bytes in each case).

No page errors were observed. The runner never clears storage/caches, forces worker activation, changes the access gate, installs dependencies or accesses the user's browser profile. A remembered-unlock fixture is written only after checking the normal locked gate; this is not evidence of password entry.

## Defect found and fixed

The first actual update exposed an Academy migration-order defect: the tuning library captured HTML camera defaults before the legacy camera preferences were restored, so the first flight reset 27°/108° to 10°/82°. The [original failing receipt](fpv-historical-update-camera-migration-failure.json) is retained. Its old runner digest and source bindings are historical evidence, not the final passing runner.

Academy and World now restore the legacy per-host camera before capturing the new library's migration baseline. The shared helper uses the same existing clamping and malformed/unavailable-storage behavior. An already saved tuning library remains authoritative. Eight mounted-host regression cases cover legacy camera values, saved drone precedence, unavailable camera storage, and absent camera/World-settings fallback. They also check that opening the editor does not save or replace a library. All eight pass. The Academy test DOM now reflects `min`/`max` attributes like a browser, matching the existing World fixture.

An intermediate [harness failure](fpv-historical-update-save-wait-failure.json) read storage before the asynchronous editor save completed. The runner now waits for persisted data before asserting its contents. That correction required no additional production change.

## Reproduction and limits

```sh
node scripts/smoke-fpv-historical-update.mjs \
  /absolute/path/to/playwright/index.mjs \
  /absolute/path/to/new-report.json \
  8b01991942dc764b8aa4726851699ce1985e53ae
```

The runner needs the existing Chrome/Playwright installation and repository dependencies. It uses a local secure HTTP context and mutable direct optional-package routes. It does not publish, test public HTTPS delivery, exercise OS-installed applications, simulate eviction, or qualify physical controls, aircraft, pilot feedback, physics fidelity or performance. Advanced remains optional and unscored. The original saved-radio compatibility is verified as data preservation, not as hardware calibration evidence.
