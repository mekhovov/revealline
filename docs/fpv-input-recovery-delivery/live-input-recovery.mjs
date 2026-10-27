/* global window, document, navigator */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const runner = fileURLToPath(import.meta.url);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const practicePath = "optional-practice/civilian-fpv/advanced-practice.mjs";
const simulationPath = "optional-practice/civilian-fpv/advanced-simulation.mjs";
const inputMessage =
  "Input unavailable. Practice is paused. Reconnect the radio or choose Keyboard / touch, then start explicitly. Your recording is retained.";
const writeJSON = (file, value) =>
  writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });

async function bounded(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function publicBinding(root, expectedRevision, installed) {
  const bytes = async (name) => {
    const url = new URL(name, root);
    url.searchParams.set("fpv-input-recovery", String(Date.now()));
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.ok, true, `Public HTTP ${response.status}: ${name}`);
    return Buffer.from(await response.arrayBuffer());
  };
  const metadataBytes = await bytes("main-deployment.json"),
    metadata = JSON.parse(metadataBytes),
    manifestBytes = await bytes("manifest.json"),
    manifest = JSON.parse(manifestBytes);
  assert.equal(metadata.format, "revealline-main-deployment.v1");
  assert.equal(metadata.sourceRevision, expectedRevision);
  assert.equal(metadata.buildVersion, `main-${expectedRevision.slice(0, 12)}`);
  assert.equal(manifest.sourceRevision, expectedRevision);
  assert.equal(sha(metadataBytes), installed.publicBinding.metadataSha256);
  assert.equal(sha(manifestBytes), installed.publicBinding.manifestSha256);
  const pins = {};
  for (const name of [practicePath, simulationPath]) {
    const pin = manifest.files.find((item) => item.path === name);
    assert.ok(pin, `Public manifest lacks ${name}`);
    const content = await bytes(name);
    assert.equal(content.length, pin.bytes);
    assert.equal(sha(content), pin.sha256);
    assert.deepEqual(pin, installed.publicBinding.pins[name]);
    pins[name] = pin;
  }
  return {
    metadata,
    metadataSha256: sha(metadataBytes),
    manifestSha256: sha(manifestBytes),
    pins,
  };
}

async function installedWorker(page, base) {
  return page.evaluate(async (base) => {
    const registration = await navigator.serviceWorker.getRegistration(base),
      worker = registration?.active;
    if (!worker) throw new Error("No installed active worker");
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel(),
        timer = setTimeout(() => {
          channel.port1.close();
          reject(new Error("Installed worker status timed out"));
        }, 30000);
      channel.port1.onmessage = ({ data }) => {
        if (data?.type !== "practice-status") return;
        clearTimeout(timer);
        channel.port1.close();
        resolve({
          revision: data.revision,
          ready: data.ready,
          scope: registration.scope,
          controllerURL: navigator.serviceWorker.controller?.scriptURL ?? null,
        });
      };
      worker.postMessage({ type: "practice-status" }, [channel.port2]);
    });
  }, base);
}

export async function liveInputRecovery({
  inputReport,
  expectedRevision,
  output,
  playwrightModule,
}) {
  delete process.env.FPV_LIVE_TEST_PASSWORD;
  const sourceReportBytes = await readFile(inputReport),
    installed = JSON.parse(sourceReportBytes),
    report = {
      format: "FpvLiveInputRecoveryAcceptance.v1",
      startedAt: new Date().toISOString(),
      expectedRevision,
      runner: { path: runner, sha256: sha(await readFile(runner)) },
      installReport: {
        path: path.resolve(inputReport),
        sha256: sha(sourceReportBytes),
      },
      passed: false,
      phase: "validate",
      packages: [],
      scope:
        "Actual public Academy and World UI in previously accepted task-owned fresh-install Chrome profiles. Existing remembered unlock and saved Actual profile are used normally. No credentials, unlock/storage injection, simulated getControls, application edits or forced worker activation.",
      limits: [
        "One Chrome desktop in English. No physical radio is available; selecting the real calibrated-radio path exercises its ordinary unavailable state.",
        "Short unscored flights validate retained recording, keyboard recovery, exact replay, prefix preservation, restart and disposal; not physical-device fidelity, Regional streaming, throughput or maximum-duration qualification.",
        "Worker instrumentation observes transport/telemetry and passes requests/responses unchanged. Replay calls the published production simulation module; it is not the comparison import UI.",
      ],
    };
  let context;
  try {
    assert.match(expectedRevision, /^[a-f0-9]{40}$/);
    assert.equal(installed.format, "FPVPublicFreshInstallEvidence.v1");
    assert.equal(
      installed.passed,
      true,
      "Run only after fresh-install acceptance succeeds",
    );
    assert.equal(installed.expectedRevision, expectedRevision);
    assert.equal(installed.runnerStable, true);
    assert.equal(installed.publicBindingStable, true);
    const root = new URL(installed.publicRoot);
    assert.equal(root.protocol, "https:");
    assert.equal(root.username + root.password + root.search + root.hash, "");
    report.publicRoot = root.href;
    report.phase = "bind-public-source";
    const binding = await publicBinding(root, expectedRevision, installed);
    report.publicBinding = binding;
    const { chromium } = await import(
      pathToFileURL(path.resolve(playwrightModule)).href
    );
    for (const id of ["civilian-fpv", "fpv-worlds"]) {
      const source = installed.packages.find((item) => item.id === id);
      assert.equal(source?.passed, true);
      assert.ok(path.isAbsolute(source.profile));
      assert.ok(
        path.basename(source.profile).startsWith(`fpv-public-fresh-${id}-`),
      );
      assert.equal((await stat(source.profile)).isDirectory(), true);
      const base = new URL(`optional-practice/${id}/`, root).href;
      assert.equal(source.base, base);
      const evidence = {
        id,
        base,
        profile: source.profile,
        passed: false,
        pageErrors: [],
        recordings: [],
        checks: {},
        servedSources: [],
      };
      report.packages.push(evidence);
      report.phase = `${id}:remembered-startup`;
      const env = { ...process.env };
      delete env.FPV_LIVE_TEST_PASSWORD;
      context = await chromium.launchPersistentContext(source.profile, {
        channel: "chrome",
        headless: true,
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: true,
        env,
        timeout: 60000,
      });
      report.browser = {
        channel: "chrome",
        version: context.browser().version(),
      };
      await context.addInitScript(() => {
        const NativeWorker = window.Worker;
        window.liveInputWorkers = [];
        window.Worker = class extends NativeWorker {
          constructor(...args) {
            super(...args);
            this.requests = new Map();
            this.record = {
              id: window.liveInputWorkers.length,
              url: String(args[0]),
              terminated: false,
              pendingSteps: 0,
              sequences: [],
              telemetry: null,
            };
            window.liveInputWorkers.push(this.record);
            this.addEventListener("message", ({ data }) => {
              if (this.requests.get(data.id) === "step")
                this.record.pendingSteps--;
              if (data?.result?.telemetry)
                this.record.telemetry = structuredClone(data.result.telemetry);
              this.requests.delete(data.id);
            });
          }
          postMessage(message, ...args) {
            this.requests.set(message.id, message.type);
            if (message.type === "step") {
              this.record.pendingSteps++;
              this.record.sequences.push(message.sample.sequence);
            }
            return super.postMessage(message, ...args);
          }
          terminate() {
            this.record.terminated = true;
            return super.terminate();
          }
        };
      });
      const page = context.pages()[0],
        observedSources = [];
      page.setDefaultTimeout(60000);
      page.on("pageerror", (error) => evidence.pageErrors.push(error.message));
      page.on("response", (response) => {
        const resource = new URL(response.url());
        if (
          [practicePath, simulationPath].some(
            (name) => resource.href === new URL(name, root).href,
          )
        )
          observedSources.push(
            response.body().then(
              (content) => ({
                path: resource.pathname.slice(root.pathname.length),
                bytes: content.length,
                sha256: sha(content),
                fromServiceWorker: response.fromServiceWorker(),
              }),
              () => ({
                path: resource.pathname.slice(root.pathname.length),
                captureFailure: "response-body-unavailable",
              }),
            ),
          );
      });
      await page.goto(`${base}index.html?lang=en`);
      await page.waitForFunction(
        () =>
          document.documentElement.dataset.accessState === "unlocked" &&
          !document.documentElement.dataset.modeShellPending &&
          document.querySelector('[data-mode-action="settings"]'),
      );
      assert.equal(
        await page.locator('#access-gate input[type="password"]').count(),
        0,
      );
      evidence.rememberedUnlock = true;
      evidence.gamepadsPresent = await page.evaluate(
        () => [...(navigator.getGamepads?.() ?? [])].filter(Boolean).length,
      );
      assert.equal(
        evidence.gamepadsPresent,
        0,
        "This check expects no attached physical radio",
      );
      evidence.installedWorker = await installedWorker(page, base);
      assert.equal(
        evidence.installedWorker.revision,
        installed.publicBinding.workers[id],
      );
      assert.equal(evidence.installedWorker.ready, true);
      assert.equal(evidence.installedWorker.scope, base);
      assert.equal(
        evidence.installedWorker.controllerURL,
        new URL("worker.js", base).href,
      );
      await page.locator('[data-mode-action="settings"]:visible').click();
      await page.getByRole("tab", { name: "Controls", exact: true }).click();
      await page
        .getByRole("button", { name: "Rates & throttle", exact: true })
        .filter({ visible: true })
        .click();
      await page
        .getByRole("dialog", { name: "Rates & throttle", exact: true })
        .waitFor();
      await page
        .getByLabel("Rate profile", { exact: true })
        .selectOption(source.savedProfile.id);
      assert.equal(
        await page.getByLabel("Profile name", { exact: true }).inputValue(),
        source.savedProfile.name,
      );
      assert.equal(
        await page
          .getByRole("group", { name: "Roll", exact: true })
          .getByRole("spinbutton", { name: "Maximum rate (°/s)", exact: true })
          .inputValue(),
        "900",
      );
      await page
        .getByRole("button", {
          name: "Advanced reference quad · experimental",
          exact: true,
        })
        .click();
      const pane = page.locator(".fpv-advanced-practice"),
        button = (name) => pane.getByRole("button", { name, exact: true }),
        input = pane.getByRole("combobox", { name: /^Input source/ }),
        status = pane.locator(':scope > [role="status"]'),
        state = () =>
          page.evaluate(() => structuredClone(window.liveInputWorkers)),
        settled = () =>
          page.waitForFunction(() =>
            window.liveInputWorkers.every(
              (worker) => worker.pendingSteps === 0,
            ),
          );
      await button("Start practice").click();
      await page.keyboard.down("ArrowRight");
      await page.waitForFunction(
        () =>
          window.liveInputWorkers[0]?.telemetry?.missionTick >= 60 &&
          window.liveInputWorkers[0]?.telemetry?.requestedRates.roll > 0,
      );
      await page.keyboard.up("ArrowRight");
      await button("Pause").click();
      await settled();
      assert.deepEqual(
        page.workers().map((worker) => worker.url()),
        [new URL("advanced-worker.mjs", base).href],
      );
      const exportAndVerify = async (label) => {
        const pending = page.waitForEvent("download");
        await button("Export practice recording").click();
        const download = await pending,
          bytes = await readFile(await download.path()),
          recording = JSON.parse(bytes);
        assert.equal(recording.format, "AdvancedRecording.v1");
        assert.equal(recording.scored, false);
        assert.ok(
          recording.missionTicks >= 50 && recording.missionTicks < 1000,
        );
        assert.ok(bytes.length < 1024 * 1024);
        assert.equal(
          recording.config.configuration.rateProfile.axes.roll.rate,
          90,
        );
        const target = `${output.replace(/\.json$/, "")}-${id}-${label}.json`;
        await writeFile(target, bytes, { mode: 0o600 });
        const replay = await bounded(
          page.evaluate(
            async ({ moduleURL, recording }) => {
              const { replayAdvancedRecording } = await import(moduleURL);
              const checked = await replayAdvancedRecording(recording);
              return {
                verified: checked.verified,
                verificationScope: checked.verificationScope,
                verifiedThroughMission: checked.verifiedThroughMission,
              };
            },
            { moduleURL: new URL(simulationPath, root).href, recording },
          ),
          60000,
          "Short public recording replay timed out",
        );
        assert.equal(replay.verified, true);
        assert.equal(replay.verificationScope, "complete");
        assert.equal(replay.verifiedThroughMission, recording.missionTicks);
        evidence.recordings.push({
          label,
          path: target,
          bytes: bytes.length,
          sha256: sha(bytes),
          missionTicks: recording.missionTicks,
          finalHash: recording.finalHash,
          replay,
        });
        return recording;
      };
      report.phase = `${id}:baseline-recording`;
      const before = await exportAndVerify("before-input-loss"),
        retainedState = await state();
      assert.ok(
        before.hashes.length > 0,
        "Baseline must include a periodic verification hash",
      );
      await input.selectOption("radio");
      await button("Start practice").click();
      await status.filter({ hasText: inputMessage }).waitFor();
      for (const name of [
        "Start practice",
        "Restart practice",
        "Export practice recording",
      ])
        assert.equal(
          await button(name).isEnabled(),
          true,
          `${name} disabled after missing input`,
        );
      assert.equal(await button("Pause").isDisabled(), true);
      await settled();
      assert.deepEqual(await state(), retainedState);
      await page.waitForTimeout(300);
      assert.deepEqual(await state(), retainedState);
      evidence.checks.unavailableRadioRetainsFlight = {
        message: await status.textContent(),
        missionTick: before.missionTicks,
      };
      report.phase = `${id}:retained-recording`;
      const retained = await exportAndVerify("input-unavailable");
      assert.deepEqual(
        retained,
        before,
        "Missing input changed the accepted recording",
      );
      evidence.checks.recordingUnchangedAfterInputFailure = true;
      await input.selectOption("keyboard");
      const selectedKeyboard = await state();
      await page.waitForTimeout(300);
      assert.deepEqual(await state(), selectedKeyboard);
      assert.equal(await button("Pause").isDisabled(), true);
      evidence.checks.keyboardSelectionDoesNotResume = true;
      await button("Start practice").click();
      await page.keyboard.down("KeyD");
      await page.waitForFunction(
        (tick) =>
          window.liveInputWorkers[0]?.telemetry?.missionTick >= tick + 60 &&
          window.liveInputWorkers[0]?.telemetry?.requestedRates.yaw > 0,
        retained.missionTicks,
      );
      await page.keyboard.up("KeyD");
      await button("Pause").click();
      await settled();
      report.phase = `${id}:resumed-recording`;
      const resumed = await exportAndVerify("resumed");
      assert.deepEqual(
        resumed.inputs.slice(0, retained.inputs.length),
        retained.inputs,
      );
      assert.deepEqual(
        resumed.hashes.slice(0, retained.hashes.length),
        retained.hashes,
      );
      const current = await state();
      assert.equal(current.length, 1);
      assert.equal(current[0].terminated, false);
      assert.deepEqual(
        current[0].sequences,
        Array.from(
          { length: current[0].sequences.length },
          (_, index) => index,
        ),
      );
      assert.deepEqual(
        resumed.inputs.map((sample) => sample[1]),
        current[0].sequences,
      );
      evidence.checks.exactPrefixAndContinuousSequences = {
        inputs: retained.inputs.length,
        hashes: retained.hashes.length,
        totalInputs: resumed.inputs.length,
      };
      await button("Restart practice").click();
      await page.waitForFunction(
        () =>
          window.liveInputWorkers.length === 2 &&
          window.liveInputWorkers[0].terminated &&
          window.liveInputWorkers[1].telemetry?.missionTick === 0,
      );
      evidence.checks.explicitRestartCreatesNewFlight = true;
      await button("Return to tuning").click();
      await page.waitForFunction(() =>
        window.liveInputWorkers.every((worker) => worker.terminated),
      );
      evidence.workerCleanup = (await state()).map(
        ({ id, url, terminated, pendingSteps, sequences, telemetry }) => ({
          id,
          url,
          terminated,
          pendingSteps,
          steps: sequences.length,
          missionTick: telemetry?.missionTick,
        }),
      );
      assert.deepEqual(page.workers(), []);
      assert.deepEqual(evidence.pageErrors, []);
      evidence.servedSources = await Promise.all(observedSources);
      assert.ok(
        evidence.servedSources.some((source) => source.path === practicePath),
      );
      assert.ok(
        evidence.servedSources.some((source) => source.path === simulationPath),
      );
      for (const source of evidence.servedSources) {
        assert.equal(source.sha256, binding.pins[source.path].sha256);
        assert.equal(source.bytes, binding.pins[source.path].bytes);
      }
      evidence.passed = true;
      await context.close();
      context = null;
    }
    report.phase = "recheck-public-source";
    assert.deepEqual(
      await publicBinding(
        new URL(report.publicRoot),
        expectedRevision,
        installed,
      ),
      report.publicBinding,
    );
    report.publicBindingStable = true;
    report.passed = true;
    report.phase = "complete";
  } catch (error) {
    report.failure = error.stack ?? String(error);
  } finally {
    try {
      await context?.close();
    } catch (error) {
      report.cleanupFailure = error.stack ?? String(error);
      report.passed = false;
    }
    report.runner.finalSha256 = sha(await readFile(runner));
    report.runner.stable = report.runner.sha256 === report.runner.finalSha256;
    report.installReport.stable =
      report.installReport.sha256 === sha(await readFile(inputReport));
    report.passed &&= report.runner.stable && report.installReport.stable;
    report.completedAt = new Date().toISOString();
    await writeJSON(output, report);
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === runner) {
  const [inputReport, expectedRevision, output, playwrightModule] =
    process.argv.slice(2);
  assert.equal(
    process.argv.length,
    6,
    "Usage: node /private/tmp/fpv-live-input-recovery.mjs INSTALL_REPORT.json EXPECTED_SHA OUTPUT.json PLAYWRIGHT_MODULE",
  );
  const report = await liveInputRecovery({
    inputReport,
    expectedRevision,
    output,
    playwrightModule,
  });
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        phase: report.phase,
        packages: report.packages.map(({ id, passed, checks }) => ({
          id,
          passed,
          checks,
        })),
        failure: report.failure,
      },
      null,
      2,
    ),
  );
  if (!report.passed) process.exitCode = 1;
}
