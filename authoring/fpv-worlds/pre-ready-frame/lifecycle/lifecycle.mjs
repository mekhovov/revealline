/* Native public controls, storage and graphics; one explicitly disclosed hidden legacy ghost handler if needed. */
const $ = (id) => document.getElementById(id),
  frame = $("sim");
const receipt = {
  format: "FPVPreReadyLifecycle.v1",
  checks: [],
  phases: [],
  snapshots: [],
  hosts: [],
  launches: [],
  limitations: [
    "Source fixture with declared host/renderer overlays; no package, offline, FPS or hardware acceptance.",
    "A native context loss is deliberately requested before one quality warm submission. No production state/clock/guards are replaced.",
    "The diagnostic grounded course creates a genuine practice proof through ordinary Arm and native ticks; it is not a flight-skill test.",
    "Rapid selections and replacement disposal prove pending-owner supersession only where their recorded pendingMethods contains the prior operation; no artificial delay establishes overlap.",
  ],
};
const prefix = "warm-" + crypto.randomUUID() + ":",
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  clone = (x) => structuredClone(x),
  equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let w, d, p, fixture, continuation;
const q = (s) => d.querySelector(s);
const pendingMethods = () =>
  p.data.methods
    .filter((m) => !m.end)
    .map((m) => ({
      id: m.id,
      generation: m.generation,
      name: m.name,
      course: m.courseId,
      start: m.start,
    }));
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
    await sleep(20);
  }
}
function visible(n) {
  return Boolean(
    n?.checkVisibility({ checkVisibilityCSS: true }) &&
      !n.closest("[hidden],dialog:not([open])"),
  );
}
function click(n) {
  check(
    visible(n) && !n.disabled,
    "public control: " +
      (n?.id || n?.getAttribute("aria-label") || n?.textContent?.slice(0, 60)),
  );
  n.click();
}
function set(id, value) {
  const n = q("#" + id);
  check(visible(n) && !n.disabled, "public setting: " + id);
  n.value = value;
  n.dispatchEvent(new w.Event("change", { bubbles: true }));
}
async function frames(n = 3) {
  for (let i = 0; i < n; i++)
    await new Promise(w.requestAnimationFrame.bind(w));
}
function phase(name) {
  p.begin(name);
  receipt.phases.push({ name, at: new Date().toISOString() });
  $("status").textContent = name;
}
function snapshot(name) {
  const v = { name, app: p.app.snapshot(), presentation: p.capture() };
  receipt.snapshots.push(v);
  return v;
}
async function finish() {
  if (p && !p.data.finishedAt) {
    await p.finish();
    receipt.hosts.push(p.data);
    check(
      Object.values(p.data.disposed.resources.registered).every((n) => n === 0),
      "dispose releases all registered resources",
    );
    check(
      !p.data.errors.length && !p.data.warnings.length,
      "no unexpected errors or warnings",
    );
    check(
      !Object.keys(p.data.dropped).length,
      "bounded observer retains all lifecycle observations",
    );
  }
}
async function openHost(initial = false) {
  await finish();
  const previous = p;
  frame.src =
    "player/optional-practice/fpv-worlds/lifecycle-host.html?storage=" +
    encodeURIComponent(prefix) +
    (initial ? "&initial-loss=1" : "") +
    "&load=" +
    crypto.randomUUID();
  await until(
    () =>
      frame.contentWindow?.fpvWarm && frame.contentWindow.fpvWarm !== previous,
    "native fresh host",
  );
  w = frame.contentWindow;
  d = frame.contentDocument;
  p = w.fpvWarm;
  w.focus();
}
async function menu() {
  if (q("#sim-settings").open) click(q("#close-sim-settings"));
  if (!q("#worlds-shell-home-dialog").open)
    click(q("#worlds-shell-action-menu"));
  await until(() => q("#worlds-shell-home-dialog").open, "native main menu");
}
async function missions() {
  await menu();
  click(q("#worlds-shell-action-missions"));
}
async function tab(name) {
  await missions();
  click(q('[data-tab="' + name + '"]'));
  await until(() => visible(q("#" + name)), "native " + name + " panel");
}
async function settings() {
  await menu();
  click(q("#worlds-shell-action-settings"));
  await until(() => q("#sim-settings").open, "native settings");
}
async function closeSettings() {
  click(q("#close-sim-settings"));
  await until(() => !q("#sim-settings").open, "settings close");
}
const target = (id) =>
  p.entries.find((e) => e.id === id) || {
    id,
    world: "warm-frame-diagnostic",
    course: { locales: { en: { title: "Diagnostic grounded recording" } } },
  };
async function launch(id) {
  await missions();
  const e = target(id);
  click(q('[data-world="' + e.world + '"]'));
  const n = [...d.querySelectorAll("button[aria-label]")].find(
    (b) => b.getAttribute("aria-label") === "Fly: " + e.course.locales.en.title,
  );
  receipt.launches.push({
    id,
    at: performance.now(),
    pendingMethods: pendingMethods(),
  });
  click(n);
}
async function ready(id) {
  await until(
    () =>
      p.app.snapshot().course === id &&
      q("#flight-status").textContent.startsWith("Ready. Choose") &&
      !q("#world-arm").disabled,
    "ready " + id,
  );
  await frames();
  const s = snapshot("ready " + id);
  check(
    s.app.state.status !== "active",
    "Ready never arms automatically: " + id,
  );
  check(
    s.presentation.resources.renderer.calls > 0 &&
      s.presentation.resources.renderer.triangles > 0,
    "Ready has real geometry: " + id,
  );
  return s;
}
async function fly(id) {
  await launch(id);
  return ready(id);
}
async function retry(id) {
  await menu();
  const direct = q("#worlds-shell-action-home-retry"),
    primary = q("#worlds-shell-action-primary");
  if (visible(direct)) click(direct);
  else if (primary.textContent.trim() === "Retry") click(primary);
  else {
    receipt.limitations.push(
      "Disarmed native Home omits Retry; this restoration uses visible Select Mission → same-course Fly instead of invoking a hidden Retry handler.",
    );
    await launch(id);
  }
  return ready(id);
}

async function arm() {
  await menu();
  click(q("#worlds-shell-action-primary"));
  await until(
    () => p.app.snapshot().state.status === "active",
    "deliberate ordinary Arm",
  );
}
function reveal(node) {
  for (let a = node.parentElement; a; a = a.parentElement)
    if (a.tagName === "DETAILS" && !a.open)
      click(a.querySelector(":scope > summary"));
}
function importDOM() {
  const n = q("#import-pack");
  return {
    at: performance.now(),
    focus: document.hasFocus(),
    hostFocused: d.hasFocus(),
    visibility: d.visibilityState,
    status: q("#flight-status")?.textContent,
    storageStatus: q("#storage-status")?.textContent,
    input: n
      ? {
          connected: n.isConnected,
          disabled: n.disabled,
          value: n.value,
          files: [...n.files].map((f) => ({
            name: f.name,
            bytes: f.size,
            type: f.type,
          })),
        }
      : null,
    installedRows: [...d.querySelectorAll("[data-remove-pack]")].map((row) => ({
      id: row.dataset.removePack,
      text: row.parentElement?.innerText?.slice(0, 1000),
    })),
    dialogs: [...d.querySelectorAll("dialog")].map((row) => ({
      id: row.id,
      open: row.open,
    })),
    packsText: q("#packs")?.innerText?.slice(0, 12000),
    bodyText: d.body.innerText.slice(0, 24000),
  };
}
async function importPack() {
  await tab("packs");
  const n = q("#import-pack");
  reveal(n);
  const label = n.closest("label");
  check(visible(label), "public Library import label");
  const bytes = await (await fetch("diagnostic.rlpack")).arrayBuffer(),
    transfer = new w.DataTransfer();
  transfer.items.add(
    new w.File([bytes], "warm-frame-diagnostic.rlpack", {
      type: "application/octet-stream",
    }),
  );
  receipt.importObservation = {
    before: importDOM(),
    storage: await navigator.storage?.estimate?.(),
  };
  n.files = transfer.files;
  n.dispatchEvent(new w.Event("change", { bubbles: true }));
  try {
    await until(
      () => n.value === "" && q('[data-remove-pack="warm-frame-diagnostic"]'),
      "native diagnostic pack install",
    );
    receipt.importObservation.after = importDOM();
  } finally {
    receipt.importObservation.terminal = importDOM();
  }
}
async function quality(value) {
  set("flight-quality", value);
  await until(
    () =>
      q("#flight-status").textContent.startsWith("Graphics ready.") &&
      !q("#world-arm").disabled,
    "quality ready " + value,
  );
  await frames();
  check(
    p.capture().resources.quality === value &&
      p.app.snapshot().state.status !== "active",
    "quality retains paused native state: " + value,
  );
}
function requireWarm(name, before) {
  const rows = p.data.warm.filter(
    (r) => r.phase === name && !r.error && r.result !== false,
  );
  check(rows.length > 0, "intentional prepared frame: " + name);
  for (const r of rows) {
    check(
      equal(r.state, r.stateAfter),
      "warm render preserves complete input/physics snapshot: " + name,
    );
    const prepared = r.preparation;
    check(
      prepared &&
        prepared.generation === r.generation &&
        prepared.courseId === r.courseId &&
        prepared.result === true &&
        !prepared.error &&
        prepared.end <= r.start,
      "warm render follows successful current-owner preparation: " + name,
      prepared,
    );
    check(
      !r.sceneLoad ||
        (r.sceneLoad.generation === r.generation &&
          r.sceneLoad.end <= r.start &&
          !r.sceneLoad.error),
      "warm render follows current-owner scene load: " + name,
      r.sceneLoad,
    );
    for (const prior of r.pendingMethods) {
      check(
        prior.id < prepared.id &&
          (prior.name === "prepare" || prior.generation < r.generation),
        "only superseded operations may remain pending at warm render: " + name,
        prior,
      );
      const settled = p.data.methods.find((m) => m.id === prior.id);
      check(
        settled?.end &&
          (settled.error ||
            (settled.name === "prepare" && settled.result === false)),
        "superseded pending operation settles without readiness ownership: " +
          name,
        settled,
      );
    }
    if (before)
      for (const k of [
        "ticks",
        "position",
        "orientation",
        "velocity",
        "lastInput",
      ])
        check(
          equal(r.state[k], before[k]),
          "warm render preserves " + k + ": " + name,
        );
  }
}
async function publishReceipt() {
  const complete = JSON.stringify(receipt);
  $("receipt").value = complete;
  const summary = {
    format: "FPVPreReadyLifecycleSummary.v1",
    completed: receipt.completed === true,
    error: receipt.error ?? null,
    disposeError: receipt.disposeError ?? null,
    receiptCharacters: complete.length,
    receiptSha256: [
      ...new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(complete),
        ),
      ),
    ]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join(""),
    checks: receipt.checks,
    phases: receipt.phases,
    qualitySelections: receipt.qualitySelections,
    launches: receipt.launches,
    replacementDisposal: receipt.replacementDisposal,
    ghostViews: receipt.ghostViews,
    importObservation: receipt.importObservation,
    failureDOM: receipt.failureDOM,
    storageFailure: receipt.storageFailure,
    hosts: receipt.hosts.map((h) => ({
      losses: h.losses,
      restorations: h.restorations,
      errors: h.errors,
      warnings: h.warnings,
      methods: h.methods,
      dropped: h.dropped,
      databaseEvents: h.databaseEvents,
      pageEvents: h.pageEvents,
      warm: h.warm.map((r) => ({
        phase: r.phase,
        courseId: r.courseId,
        generation: r.generation,
        start: r.start,
        end: r.end,
        result: r.result,
        pending: r.pending,
        pendingMethods: r.pendingMethods,
        preparation: r.preparation,
        sceneLoad: r.sceneLoad,
        error: r.error,
      })),
    })),
    limitations: receipt.limitations,
  };
  $("summary").value = JSON.stringify(summary);
}
$("continue").onclick = () => {
  $("continue").hidden = true;
  continuation?.();
};
$("run").onclick = async () => {
  $("run").disabled = true;
  document.body.dataset.running = "true";
  receipt.startedAt = new Date().toISOString();
  try {
    fixture = await (await fetch("fixture.json", { cache: "no-store" })).json();
    receipt.fixture = fixture;
    if (fixture.variant === "admitted")
      receipt.limitations[0] =
        "Exact admitted player with zero runtime overlays; no offline, FPS or hardware acceptance.";
    for (const row of fixture.files) {
      const response = await fetch(row.path, { cache: "no-store" }),
        bytes = await response.arrayBuffer(),
        hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
      check(
        response.ok && bytes.byteLength === row.bytes && hash === row.sha256,
        "frozen bytes: " + row.path,
      );
    }
    await openHost(true);
    phase("Initial native graphics loss");
    await launch("container-yard-08");
    await until(
      () => p.data.losses > 0 && q("#world-arm").disabled,
      "native initial loss",
    );
    check(p.data.nativeLossSupported, "native context loss supported");
    await frames();
    check(
      p.data.warm.length === 0,
      "initial failed preparation submits no warm frame",
    );
    await menu();
    click(q("#worlds-shell-action-primary"));
    await frames();
    check(
      p.app.snapshot().state.status !== "active",
      "public Continue cannot arm lost scene",
    );
    const restores = p.data.restorations;
    p.restore();
    await until(
      () => p.data.restorations > restores,
      "native initial restoration",
    );
    phase("Restored imported Yard");
    await retry("container-yard-08");
    requireWarm("Restored imported Yard");
    check(
      p.capture().resources.presentation.actors.length === 2,
      "restored first ready frame contains two actors",
    );
    $("continue").hidden = false;
    $("status").textContent =
      "Inspect restored Yard; Continue lifecycle checks";
    await publishReceipt();
    await new Promise((r) => {
      continuation = r;
    });
    w.focus();
    phase("Quality warm submission native loss");
    await settings();
    const prior = snapshot("before quality loss").app.state;
    p.requestWarmLoss();
    set("flight-quality", "high");
    await until(
      () =>
        p.data.losses === 2 &&
        q("#flight-status").textContent.startsWith("Graphics context lost."),
      "native loss during quality warm submission",
    );
    check(q("#world-arm").disabled, "quality loss leaves Arm disabled");
    const rejected = p.data.warm.find(
      (r) =>
        r.phase === "Quality warm submission native loss" && r.result === false,
    );
    check(
      rejected && equal(rejected.state, rejected.stateAfter),
      "lost-context warm submission rejected without physics mutation",
    );
    for (const k of [
      "ticks",
      "position",
      "orientation",
      "velocity",
      "lastInput",
    ])
      check(
        equal(p.app.snapshot().state[k], prior[k]),
        "quality loss retains " + k,
      );
    const prepares = p.data.methods.filter((m) => m.name === "prepare").length;
    set("flight-quality", "low");
    await frames();
    check(
      p.data.methods.filter((m) => m.name === "prepare").length === prepares,
      "onContextLost clears qualityPreparing: next lost quality selection does not prepare",
    );
    const restored = p.data.restorations;
    p.restore();
    await until(
      () => p.data.restorations > restored,
      "quality native context restoration",
    );
    await closeSettings();
    phase("Retry after quality context restoration");
    await retry("container-yard-08");
    requireWarm("Retry after quality context restoration");
    phase("Superseding public quality changes");
    await settings();
    const qualityState = p.app.snapshot().state;
    receipt.qualitySelections = [];
    for (const value of ["high", "low", "balanced"]) {
      receipt.qualitySelections.push({
        value,
        at: performance.now(),
        pendingMethods: pendingMethods(),
      });
      set("flight-quality", value);
    }
    await until(
      () =>
        q("#flight-status").textContent.startsWith("Graphics ready.") &&
        p.capture().resources.quality === "balanced" &&
        !q("#world-arm").disabled,
      "latest quality owner",
    );
    await frames();
    await until(
      () => !pendingMethods().length,
      "obsolete quality preparations settle",
    );
    requireWarm("Superseding public quality changes", qualityState);
    check(
      p.capture().resources.quality === "balanced",
      "superseded quality cannot replace final Balanced",
    );
    set("flight-camera", "chase");
    set("world-fov", "90");
    await quality("low");
    await frames();
    const lens = p.data.warm
      .filter((r) => r.phase === "Superseding public quality changes")
      .at(-1);
    check(
      lens.camera.cameraMode === "chase" && lens.camera.cameraFov === 90,
      "warm frame applies current camera and FOV",
    );
    await closeSettings();
    phase("Superseding public course start");
    await launch("container-yard-01");
    receipt.supersedingStart = {
      firstRequestReturnedAt: performance.now(),
      pendingMethods: pendingMethods(),
    };
    await launch("container-yard-08");
    receipt.supersedingStart.secondRequestReturnedAt = performance.now();
    await ready("container-yard-08");
    await frames(8);
    check(
      p.app.snapshot().course === "container-yard-08" &&
        p.capture().courseId === "container-yard-08",
      "latest rapid course selection retains final course and renderer",
    );
    phase("Genuine short practice recording");
    await importPack();
    await fly("warm-frame-diagnostic-route");
    await settings();
    set("flight-source", "keyboard");
    set("flight-camera", "fpv");
    await closeSettings();
    await arm();
    await until(
      () =>
        p.app
          .snapshot()
          .records.some(
            (r) =>
              r.course.id === "warm-frame-diagnostic-route" &&
              r.proof.session === "practice" &&
              r.status === "verified" &&
              r.diagnostic === "complete",
          ),
      "native verified practice recording",
    );
    const record = p.app
      .snapshot()
      .records.find((r) => r.course.id === "warm-frame-diagnostic-route");
    receipt.practiceRecord = record;
    check(
      record.proof.frames.length >= 60,
      "genuine native recording has both authored objectives",
    );
    phase("Load genuine personal best ghost");
    await retry("warm-frame-diagnostic-route");
    await until(
      () =>
        p.app.snapshot().sectorTiming.status === "ready" &&
        !q("#show-ghost").disabled,
      "genuine personal best reference",
    );
    const ghost = q("#show-ghost"),
      ghostVisible = visible(ghost);
    receipt.ghostAccess = {
      visible: ghostVisible,
      id: ghost.id,
      hidden: ghost.hidden,
      ancestors: [
        ...(function* (n) {
          for (let a = n.parentElement; a; a = a.parentElement)
            yield { tag: a.tagName, id: a.id, hidden: a.hidden };
        })(ghost),
      ],
    };
    if (ghostVisible) click(ghost);
    else {
      receipt.limitations.push(
        "Ghost control was not publicly visible. This ghost lifecycle portion explicitly invokes its unchanged DOM click handler; it does not qualify end-to-end ghost UI access.",
      );
      ghost.click();
    }
    await until(
      () =>
        p.app.snapshot().ghost.enabled &&
        !p.app.snapshot().ghost.loading &&
        p.app.snapshot().ghost.presentation.samples > 1,
      "native personal best ghost loaded",
    );
    await frames();
    const fpvGhost = p.app.snapshot().ghost.presentation;
    check(
      q("#flight-camera").value === "fpv" &&
        fpvGhost.pose &&
        !fpvGhost.visible &&
        equal(fpvGhost.pose.position, p.app.snapshot().state.position),
      "FPV suppresses the overlapping genuine ghost while retaining its exact pose",
    );
    await settings();
    set("flight-camera", "chase");
    await closeSettings();
    await frames();
    const ghostBefore = p.app.snapshot().ghost.presentation;
    receipt.ghostViews = { fpv: fpvGhost, chase: ghostBefore };
    check(
      ghostBefore.visible &&
        equal(ghostBefore.pose, fpvGhost.pose) &&
        ghostBefore.samples === fpvGhost.samples,
      "public Chase camera reveals the same genuine ghost pose and samples",
    );
    phase("Retry prepares loaded ghost before Ready");
    await retry("warm-frame-diagnostic-route");
    requireWarm("Retry prepares loaded ghost before Ready");
    const ghostWarm = p.data.warm
      .filter((r) => r.phase === "Retry prepares loaded ghost before Ready")
      .at(-1);
    check(
      ghostWarm.after.ghost.samples === ghostBefore.samples &&
        equal(ghostWarm.after.ghost.pose, ghostBefore.pose) &&
        ghostWarm.after.ghost.visible,
      "warm frame includes exact loaded ghost before readiness",
    );
    phase("Native paused ghost recovery");
    await arm();
    await until(
      () => p.app.snapshot().state.ticks >= 15,
      "native recording advances before recovery",
    );
    await menu();
    const saved = snapshot("paused genuine ghost recording");
    check(
      saved.app.state.status === "paused" && saved.app.state.ticks < 60,
      "native pause precedes completion",
    );
    await finish();
    await openHost();
    phase("Reopen native IDB and public recovery");
    await tab("packs");
    const resume = q("#resume-flight");
    reveal(resume);
    await until(() => !resume.disabled, "native recovery action");
    click(resume);
    await ready("warm-frame-diagnostic-route");
    const recovered = snapshot("native restored ghost recording");
    for (const k of [
      "ticks",
      "position",
      "orientation",
      "velocity",
      "lastInput",
    ])
      check(
        equal(recovered.app.state[k], saved.app.state[k]),
        "native recovery retains " + k,
      );
    check(
      recovered.app.ghost.enabled &&
        recovered.app.ghost.presentation.visible &&
        recovered.app.ghost.referenceId === saved.app.ghost.referenceId,
      "native recovery reloads exact genuine ghost",
    );
    requireWarm("Reopen native IDB and public recovery", saved.app.state);
    phase("Dispose while a replacement starts");
    await launch("container-yard-08");
    receipt.replacementDisposal = {
      at: performance.now(),
      pendingMethods: pendingMethods(),
    };
    await finish();
    await sleep(100);
    check(
      p.data.disposed.resources.registered.geometries === 0 &&
        Object.values(p.capture().resources.registered).every((n) => n === 0),
      "replacement cannot retain graphics after dispose",
    );
    receipt.completed = true;
  } catch (error) {
    receipt.error = String(error.stack ?? error);
    try {
      receipt.failureDOM = importDOM();
      receipt.storageFailure = await navigator.storage?.estimate?.();
      receipt.failed = p
        ? { snapshot: snapshot("failure"), data: clone(p.data) }
        : null;
    } catch (captureError) {
      receipt.captureError = String(captureError);
    }
  } finally {
    try {
      await finish();
    } catch (error) {
      receipt.disposeError = String(error.stack ?? error);
    }
    receipt.finishedAt = new Date().toISOString();
    await publishReceipt();
    document.body.dataset.running = "false";
    $("status").textContent =
      receipt.completed && !receipt.disposeError
        ? "PASS " + receipt.checks.length
        : "STOPPED: " + (receipt.error ?? receipt.disposeError);
  }
};
