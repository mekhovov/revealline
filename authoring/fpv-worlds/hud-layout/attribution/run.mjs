/* Diagnostic orchestration: public controls; no private flight mutation or input replay injection. */
const $ = (id) => document.getElementById(id),
  frame = $("sim");
const receipt = {
  format: "FPVSteadyFlightAttribution.v1",
  checks: [],
  hosts: [],
  actions: [],
  courses: ["container-yard-08", "woodland-01"],
  windowsPerCourse: [
    "ready-paused",
    "verified-demonstration",
    "ordinary-grounded-practice",
    "paused-settings",
  ],
  requestedWindowMs: 5000,
  limitations: [
    "Exact102-member admitted8df closure with the one explicitly hashed committed world-app source overlay; this is attribution, not a candidate or an FPS/hardware benchmark.",
    "Single visible player. Eight bounded5-second windows, native clocks/RAF/physics/input/pause guards retained. Timer delay may make elapsed windows longer; every observed duration is retained.",
    "Only aggregate samples in measured windows. Full renderer state/resources captured at boundaries; app.snapshot metadata read only outside windows.",
    "Renderer duration is CPU command submission, not GPU elapsed. RAF callback CPU, RAF gaps and native clientWidth getter duration are distinct.",
    "Native structuredClone work is timed only inside the World host RAF; shape labels are structural proxies. Criterion-or-typed-object may include other typed objects. Attitude computation and other snapshot work are not isolated.",
    "Observed DOM fields have direct flight-/world-/aim- IDs. Child labels, style/dataset/classList writes and other layout APIs are not comprehensively counted.",
    "Observer wrappers/classification/clock reads add overhead. observerCPUms is a lower bound excluding clock dispatch, unsupported APIs and asynchronous observer work; nested metric durations must not be summed as independent totals.",
    "Long Animation Frame/longtask support is feature detected. Aggregates include entries starting inside each window, excluding earlier-starting overlap; no entries means no observed qualifying entry, not no jank. Host machine contention and GPU scheduling remain unknown.",
    "Practice uses ordinary Arm with neutral controls on the ground, not a flight skill proof. Unexpected native stalls/pauses remain recorded and are never automatically resumed within a window.",
  ],
};
const prefix = "steady-" + crypto.randomUUID() + ":",
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let w, d, p, fixture;
const q = (selector) => d.querySelector(selector);
function check(value, name, detail) {
  receipt.checks.push({
    name,
    passed: Boolean(value),
    ...(detail === undefined ? {} : { detail }),
  });
  if (!value) throw Error(name);
}
async function until(fn, name, ms = 30000) {
  const end = performance.now() + ms;
  while (!fn()) {
    if (performance.now() > end) throw Error("Timeout: " + name);
    await sleep(25);
  }
}
function visible(node) {
  return Boolean(
    node?.checkVisibility({ checkVisibilityCSS: true }) &&
      !node.closest("[hidden],dialog:not([open])"),
  );
}
function click(node) {
  check(
    visible(node) && !node.disabled,
    "public control " +
      (node?.id ||
        node?.getAttribute("aria-label") ||
        node?.textContent?.slice(0, 50)),
  );
  receipt.actions.push({
    at: new Date().toISOString(),
    id: node.id,
    label: node.getAttribute("aria-label") || node.textContent,
  });
  node.click();
}
async function frames(n = 3) {
  for (let i = 0; i < n; i++)
    await new Promise(w.requestAnimationFrame.bind(w));
}
async function menu() {
  if (q("#sim-settings").open) click(q("#close-sim-settings"));
  for (const id of [
    "worlds-shell-action-briefing-back",
    "worlds-shell-action-missions-back",
  ]) {
    const n = q("#" + id);
    if (visible(n)) click(n);
  }
  if (!q("#worlds-shell-home-dialog").open)
    click(q("#worlds-shell-action-menu"));
  await until(() => q("#worlds-shell-home-dialog").open, "Home");
}
async function launch(id, replay = false) {
  await menu();
  click(q("#worlds-shell-action-missions"));
  const e = p.entries.find((e) => e.id === id);
  check(e, "exact catalogue course " + id);
  click(q('[data-world="' + e.world + '"]'));
  const label =
    (replay ? "Watch demonstration: " : "Fly: ") + e.course.locales.en.title;
  click(
    [...d.querySelectorAll("button[aria-label]")].find(
      (n) => n.getAttribute("aria-label") === label,
    ),
  );
  await until(
    () =>
      p.peek().course === id &&
      !q("#world-arm").disabled &&
      (replay
        ? p.peek().status === "active"
        : q("#flight-status").textContent.startsWith("Ready. Choose")),
    "native ready " + label,
  );
  await frames();
  const meta = p.identity();
  check(
    meta.course === id && Boolean(meta.replay) === replay,
    "exact native session " + label,
    meta,
  );
  if (replay)
    check(
      meta.replay.kind === "demonstration" && meta.replay.rate === 1,
      "existing verified demonstration at1x",
      meta.replay,
    );
  else
    check(p.peek().status === "disarmed", "ordinary launch remains disarmed");
}
async function settings() {
  await menu();
  click(q("#worlds-shell-action-settings"));
  await until(() => q("#sim-settings").open, "Settings");
}
async function measure(name, id, expectedStatus) {
  $("status").textContent = id + " · " + name + " · 5s";
  w.focus();
  const row = p.begin(name, { course: id, status: expectedStatus });
  await sleep(5000);
  p.end();
  row.metadata = p.identity();
  check(
    row.before.course === id &&
      row.after.course === id &&
      row.before.generation === row.after.generation,
    "window retains course/generation " + name,
  );
  check(
    row.drawCPU.count > 0 && row.rafCPU["world-host"]?.count > 0,
    "window observes native host and draw submissions " + name,
  );
  check(
    !row.droppedDOM && !row.droppedScripts,
    "bounded aggregate fields retained " + name,
  );
  row.coverage = {
    expectedStatusAtStart: row.before.state?.status === expectedStatus,
    expectedStatusAtEnd: row.after.state?.status === expectedStatus,
    observedStatuses: Object.keys(row.states),
    nativeTickDelta: row.after.state.ticks - row.before.state.ticks,
    remainedFocused: !row.focus.false,
    remainedVisible: !row.visibility.hidden,
    timerWithin5500ms: row.elapsedMs <= 5500,
  };
  // Coverage is reported without concealing legitimate pauses or retrying a poor sample.
}
async function finish() {
  if (!p || p.data.finishedAt) return;
  await p.finish();
  receipt.hosts.push(p.data);
  check(
    Object.values(p.data.disposed.registered).every((n) => n === 0),
    "native disposal releases registered resources",
  );
  check(
    !p.data.errors.length && !p.data.warnings.length,
    "no unexpected native errors/warnings",
  );
  check(!Object.keys(p.data.dropped).length, "no bounded observation overflow");
}
async function openHost() {
  await finish();
  const old = p;
  p = null;
  frame.src =
    "player/optional-practice/fpv-worlds/steady-host.html?storage=" +
    encodeURIComponent(prefix) +
    "&host=" +
    crypto.randomUUID();
  await until(
    () =>
      frame.contentWindow?.fpvSteady && frame.contentWindow.fpvSteady !== old,
    "fresh native host",
  );
  w = frame.contentWindow;
  d = frame.contentDocument;
  p = w.fpvSteady;
  w.focus();
}
const sha = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
function output() {
  $("receipt").value = JSON.stringify(receipt, null, 2);
  $("summary").value = JSON.stringify(
    {
      completed: receipt.completed,
      error: receipt.error ?? null,
      checks: receipt.checks.length,
      failed: receipt.checks.filter((r) => !r.passed),
      windows: receipt.hosts.flatMap((h) =>
        h.windows.map((r) => ({
          name: r.name,
          course: r.before.course,
          elapsedMs: r.elapsedMs,
          coverage: r.coverage,
          hostCPU: r.rafCPU["world-host"],
          drawCPU: r.drawCPU,
          clone: r.clone,
          layoutReads: r.layoutReads,
          domCalls: Object.values(r.dom).reduce((n, v) => n + v.calls, 0),
          domUnchanged: Object.values(r.dom).reduce(
            (n, v) => n + v.unchanged,
            0,
          ),
          observerCPUms: r.observerCPUms,
        })),
      ),
    },
    null,
    2,
  );
}
$("run").onclick = async () => {
  $("run").disabled = true;
  document.body.dataset.running = "true";
  receipt.startedAt = new Date().toISOString();
  try {
    const bytes = await (await fetch("fixture.json")).arrayBuffer();
    fixture = JSON.parse(new TextDecoder().decode(bytes));
    receipt.fixture = fixture;
    receipt.fixtureSha256 = await sha(bytes);
    for (const f of fixture.files) {
      const b = await (await fetch(f.path)).arrayBuffer();
      check(
        b.byteLength === f.bytes && (await sha(b)) === f.sha256,
        "exact admitted/observer bytes " + f.path,
      );
    }
    check(
      fixture.overlays.length === 1 &&
        fixture.overlays[0] ===
          "optional-practice/civilian-fpv/world-app.mjs" &&
        fixture.inputs.length === 95 &&
        fixture.admittedMembers === 102,
      "one explicit committed host overlay on admitted provenance",
    );
    for (const id of receipt.courses) {
      await openHost();
      await launch(id);
      check(
        q("#flight-quality").value === "balanced" &&
          q("#flight-mode").value === "self-level",
        "fixed native Balanced/Self-level settings",
      );
      await measure("ready-paused", id, "disarmed");
      await launch(id, true);
      await measure("verified-demonstration", id, "active");
      await launch(id);
      await menu();
      check(
        q("#worlds-shell-action-primary").textContent.trim() === "Continue",
        "current flight owns native Continue",
      );
      click(q("#worlds-shell-action-primary"));
      await until(
        () => p.peek().status === "active",
        "ordinary deliberate Arm",
      );
      await measure("ordinary-grounded-practice", id, "active");
      await settings();
      await frames();
      await measure("paused-settings", id, "paused");
    }
    await finish();
    check(
      receipt.hosts.length === 2 &&
        receipt.hosts.every((h) => h.windows.length === 4),
      "all eight predeclared windows retained",
    );
    receipt.completed = true;
    $("status").textContent = "COMPLETE · bounded attribution only";
  } catch (error) {
    receipt.error = String(error.stack ?? error);
    if (!p) {
      receipt.bootFailure = frame.contentWindow?.fpvSteadyData ?? null;
      try {
        await frame.contentWindow?.fpvSteadyBootDispose?.();
      } catch (cleanup) {
        receipt.bootCleanupError = String(cleanup);
      }
    }
    receipt.completed = false;
    try {
      if (p) {
        receipt.failure = p.capture();
        await finish();
      }
    } catch (cleanup) {
      receipt.cleanupError = String(cleanup);
      if (p && !receipt.hosts.includes(p.data)) receipt.hosts.push(p.data);
    }
    $("status").textContent = "STOPPED · " + error.message;
  } finally {
    receipt.finishedAt = new Date().toISOString();
    document.body.dataset.running = "false";
    output();
  }
};
