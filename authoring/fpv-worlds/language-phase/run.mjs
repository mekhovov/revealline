const $ = (id) => document.getElementById(id),
  frame = $("sim");
const receipt = {
  format: "FPVLanguagePhaseOwnership.v1",
  checks: [],
  observations: [],
  hosts: [],
  limitations: [
    "Baseline is an exact retained admitted host. Candidate changes only the committed +55-byte host ownership guard; no new package claim.",
    "All public controls here use scripted DOM events. Native rendering, storage, proof verification, clocks and pause/arming guards remain intact.",
    "Language is accessed through public Settings, which deliberately pauses active flight. Active-to-Settings pause is checked; language changes during active flight are not invented.",
    "The diagnostic ground hold/land route supplies a real practice record. It is not a lesson, skill, hardware-performance or offline qualification.",
  ],
};
let w,
  d,
  p,
  fixture,
  variant,
  storage,
  finished = false;
const q = (s) => d.querySelector(s),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(ok, name, detail) {
  receipt.checks.push({
    name,
    passed: Boolean(ok),
    ...(detail === undefined ? {} : { detail }),
  });
  if (!ok) throw Error(name);
}
async function until(fn, name, ms = 30000) {
  const end = performance.now() + ms;
  while (!fn()) {
    if (performance.now() > end) throw Error("Timeout: " + name);
    await sleep(35);
  }
}
const visible = (n) =>
  Boolean(
    n?.checkVisibility({ checkVisibilityCSS: true }) &&
      !n.closest("[hidden],dialog:not([open])"),
  );
function click(n) {
  check(
    visible(n) && !n.disabled,
    "visible public control " + (n?.id || n?.textContent),
  );
  n.click();
}
function set(id, value) {
  const n = q("#" + id);
  check(visible(n) && !n.disabled, "visible public setting " + id);
  n.value = value;
  n.dispatchEvent(new w.Event("change", { bubbles: true }));
}
async function frames(n = 3) {
  for (let i = 0; i < n; i++)
    await new Promise(w.requestAnimationFrame.bind(w));
}
function observe(name) {
  const app = p.app.snapshot(),
    row = {
      variant,
      name,
      at: performance.now(),
      course: app.course,
      state: app.state,
      replay: app.replay,
      phase: q("[data-mode-play-shell]")?.dataset.phase,
      primary: q("#worlds-shell-action-primary")?.textContent,
      mission: q(".mode-play-mission")?.textContent,
      flightTitle: q("#flight-title")?.textContent,
      status: q("#flight-status")?.textContent,
      armDisabled: q("#world-arm")?.disabled,
      dialogs: [...d.querySelectorAll("dialog")]
        .filter((n) => n.open)
        .map((n) => n.id),
      focused: d.hasFocus(),
      visibility: d.visibilityState,
    };
  receipt.observations.push(row);
  return row;
}
async function menu() {
  if (q("#sim-settings").open) click(q("#close-sim-settings"));
  for (const name of ["briefing", "missions"])
    if (q("#worlds-shell-" + name + "-dialog")?.open) {
      click(q("#worlds-shell-action-" + name + "-back"));
      await until(
        () => !q("#worlds-shell-" + name + "-dialog").open,
        "Back " + name,
      );
    }
  if (!q("#worlds-shell-home-dialog").open)
    click(q("#worlds-shell-action-menu"));
  await until(() => q("#worlds-shell-home-dialog").open, "Home");
}
async function settings() {
  await menu();
  click(q("#worlds-shell-action-settings"));
  await until(() => q("#sim-settings").open, "Settings");
}
async function missions() {
  await menu();
  click(q("#worlds-shell-action-missions"));
}
async function fly() {
  await missions();
  click(q('[data-world="warm-frame-diagnostic"]'));
  click(
    [...d.querySelectorAll("button[aria-label]")].find(
      (n) =>
        n.getAttribute("aria-label") === "Fly: Diagnostic grounded recording",
    ),
  );
  await until(
    () =>
      q("#flight-status").textContent.startsWith("Ready. Choose") &&
      !q("#world-arm").disabled,
    "diagnostic Ready",
  );
  await frames();
  check(
    p.app.snapshot().course === "warm-frame-diagnostic-route",
    "exact diagnostic course",
  );
}
async function importPack() {
  await missions();
  click(q('[data-tab="packs"]'));
  const input = q("#import-pack");
  for (let n = input.parentElement; n; n = n.parentElement)
    if (n.tagName === "DETAILS" && !n.open)
      click(n.querySelector(":scope > summary"));
  check(visible(input.closest("label")), "visible native pack upload");
  const bytes = await (await fetch("diagnostic.rlpack")).arrayBuffer(),
    transfer = new w.DataTransfer();
  transfer.items.add(
    new w.File([bytes], "diagnostic.rlpack", {
      type: "application/octet-stream",
    }),
  );
  input.files = transfer.files;
  input.dispatchEvent(new w.Event("change", { bubbles: true }));
  await until(
    () => input.value === "" && q('[data-remove-pack="warm-frame-diagnostic"]'),
    "native pack installation",
  );
}
async function mount(name, prefix) {
  variant = name;
  storage = prefix ?? "phase-" + crypto.randomUUID() + ":";
  finished = false;
  const loadId = crypto.randomUUID();
  frame.src =
    name +
    "/player/optional-practice/fpv-worlds/phase-host.html?storage=" +
    encodeURIComponent(storage) +
    "&load=" +
    loadId;
  await until(
    () =>
      frame.contentWindow?.fpvPhase &&
      frame.contentWindow.fpvPhase.data.storagePrefix === storage &&
      new URL(frame.contentWindow.location.href).searchParams.get("load") ===
        loadId,
    "new native " + name + " host",
  );
  w = frame.contentWindow;
  d = frame.contentDocument;
  p = w.fpvPhase;
  w.focus();
  await frames();
}
async function dispose(name) {
  if (finished) return;
  await p.finish();
  finished = true;
  receipt.hosts.push({ variant, name, ...p.data });
  check(
    !p.data.errors.length && !p.data.warnings.length,
    name + " no observed warnings/errors",
  );
  check(
    !Object.keys(p.data.dropped).length,
    name + " bounded observations retained",
  );
  check(
    !p.data.disposed.resources ||
      Object.values(p.data.disposed.resources.registered).every((n) => n === 0),
    name + " ordinary disposal releases registered resources",
  );
}
function sameState(before, after, name) {
  check(equal(before.state, after.state), name + " exact state unchanged");
  check(before.course === after.course, name + " course unchanged");
  check(equal(before.replay, after.replay), name + " replay unchanged");
  if (before.state)
    check(
      before.flightTitle === after.flightTitle,
      name + " current mission title unchanged",
    );
}
function localeRoundTrip(expected, name) {
  const before = observe(name + " before");
  check(before.phase === expected, name + " initial phase");
  set("world-language", "uk");
  const uk = observe(name + " synchronous UK");
  check(uk.phase === expected, name + " UK retains phase before any RAF");
  sameState(before, uk, name + " UK");
  set("world-language", "en");
  const en = observe(name + " synchronous EN");
  check(en.phase === expected, name + " EN retains phase before any RAF");
  sameState(before, en, name + " EN");
  check(
    en.primary === before.primary,
    name + " original primary action restored synchronously",
  );
  return en;
}
async function initialLobby() {
  await settings();
  const before = observe("no-flight initial lobby");
  check(
    !before.state && !before.course && before.phase === "ready",
    "initial no-flight lobby is Ready",
  );
  localeRoundTrip("ready", "initial lobby language");
  check(
    q("#worlds-shell-action-primary").textContent === "Start",
    "no recovery offers Start",
  );
  click(q("#close-sim-settings"));
}
async function run() {
  $("run").disabled = true;
  receipt.startedAt = new Date().toISOString();
  try {
    fixture = await (await fetch("fixture.json")).json();
    receipt.fixture = fixture;
    for (const row of fixture.files) {
      const bytes = await (await fetch(row.path)).arrayBuffer(),
        sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
      check(
        bytes.byteLength === row.bytes && sha === row.sha256,
        "frozen file " + row.path,
      );
    }
    $("status").textContent =
      "Baseline: retain the synchronous phase/action failure";
    await mount("baseline");
    await initialLobby();
    await importPack();
    await fly();
    await settings();
    const old = observe("baseline before language");
    check(old.phase === "disarmed", "baseline selected course disarmed");
    set("world-language", "uk");
    const badUK = observe("baseline synchronous UK");
    set("world-language", "en");
    const badEN = observe("baseline synchronous EN");
    sameState(old, badUK, "baseline UK");
    sameState(old, badEN, "baseline EN");
    check(
      badUK.phase === "ready" &&
        badEN.phase === "ready" &&
        badEN.primary === "Start",
      "baseline reproduces lobby overwrite before RAF",
    );
    click(q("#close-sim-settings"));
    click(q("#worlds-shell-action-primary"));
    const opened = observe("baseline immediate primary");
    check(
      opened.dialogs.includes("worlds-shell-briefing-dialog") &&
        opened.state.status === "disarmed",
      "baseline Start opens briefing without arming",
    );
    await frames();
    const repaired = observe("baseline after native frames");
    check(
      repaired.phase === "disarmed",
      "baseline next RAF repairs phase after wrong action",
    );
    await dispose("baseline reproduction");

    $("status").textContent =
      "Candidate: same-event ownership across public flight states";
    await mount("candidate");
    await initialLobby();
    await importPack();
    await fly();
    await settings();
    set("flight-source", "keyboard");
    set("flight-camera", "chase");
    localeRoundTrip("disarmed", "disarmed language");
    click(q("#close-sim-settings"));
    click(q("#worlds-shell-action-primary"));
    const armed = observe("candidate primary immediately after language");
    check(
      !armed.dialogs.includes("worlds-shell-briefing-dialog"),
      "candidate primary does not open unrelated briefing",
    );
    await until(
      () => q("#flight-dialog").dataset.flightState === "active",
      "deliberate native arm",
    );
    const active = observe("active before Settings");
    check(active.state.status === "active", "real flight becomes active");
    await settings();
    const paused = observe("active enters public Settings");
    check(
      paused.state.status === "paused",
      "public Settings pauses active flight",
    );
    localeRoundTrip("paused", "paused language");
    click(q("#close-sim-settings"));
    click(q("#worlds-shell-action-primary"));
    await until(
      () =>
        q("#flight-dialog").dataset.flightState === "complete" &&
        [...d.querySelectorAll("#result-panel button")].some(
          (n) => n.textContent === "Watch verified flight",
        ),
      "native completed practice and Watch",
    );
    receipt.practiceRecord = p.app
      .snapshot()
      .records.find((r) => r.course.id === "warm-frame-diagnostic-route");
    check(
      receipt.practiceRecord?.status === "verified" &&
        receipt.practiceRecord.proof.frames.length === 60,
      "genuine 60-tick verified practice",
    );
    await settings();
    localeRoundTrip("results", "completed language");
    click(q("#close-sim-settings"));
    check(
      visible(q("#worlds-shell-action-home-results")),
      "completed Results remains reachable without a RAF repair",
    );
    click(q("#worlds-shell-action-home-results"));
    click(
      [...d.querySelectorAll("#result-panel button")].find(
        (n) => n.textContent === "Watch verified flight",
      ),
    );
    await until(
      () => p.app.snapshot().replay && !q("#world-arm").disabled,
      "native verified Watch prepared",
    );
    observe("Watch may auto-start before public pause");
    await settings();
    await frames();
    const playback = observe("public Settings pauses Watch");
    check(
      playback.replay && playback.state.status === "paused",
      "real replay paused by public Settings",
    );
    localeRoundTrip("paused", "replay language");
    await frames(3);
    sameState(
      playback,
      observe("replay after native frames"),
      "paused replay over frames",
    );
    click(q("#close-sim-settings"));

    $("status").textContent =
      "Candidate: native saved recovery after ordinary disposal and navigation";
    await fly();
    await menu();
    click(q("#worlds-shell-action-primary"));
    await until(() => {
      const s = p.app.snapshot().state;
      return s.status === "active" && s.ticks >= 5;
    }, "short nonterminal native practice");
    await settings();
    const saved = observe("saved native practice before dispose");
    check(
      saved.state.status === "paused" &&
        saved.state.ticks > 0 &&
        saved.state.ticks < 60,
      "bounded incomplete flight for saved recovery",
    );
    const prefix = storage;
    await dispose("candidate before recovery");
    await mount("candidate", prefix);
    const noFlight = observe("reloaded no-flight recovery lobby");
    check(
      !noFlight.state && !noFlight.course && noFlight.phase === "ready",
      "new host has no current flight and lobby Ready",
    );
    check(
      noFlight.primary === "Continue",
      "saved exact recovery offers Continue",
    );
    await settings();
    localeRoundTrip("ready", "no-flight saved recovery language");
    check(
      q("#worlds-shell-action-primary").textContent === "Continue",
      "language preserves no-flight recovery action",
    );
    click(q("#close-sim-settings"));
    click(q("#worlds-shell-action-primary"));
    await until(
      () =>
        p.app.snapshot().course === "warm-frame-diagnostic-route" &&
        !q("#world-arm").disabled,
      "ordinary recovery prepares same course",
    );
    const recovered = observe("native recovered flight Ready");
    check(
      ["paused", "disarmed"].includes(recovered.state.status),
      "recovery remains deliberately unarmed",
    );
    for (const key of ["ticks", "position", "orientation", "velocity"])
      check(
        equal(saved.state[key], recovered.state[key]),
        "native recovery retains " + key,
      );
    await settings();
    localeRoundTrip(
      recovered.state.status,
      "recovered current flight language",
    );
    await dispose("candidate recovered cleanup");
    receipt.passed = true;
    $("status").textContent =
      "PASS: original failure reproduced; candidate phase, action and recovery ownership retained";
  } catch (error) {
    receipt.passed = false;
    receipt.error = { message: String(error), stack: error.stack };
    try {
      if (p && !finished) {
        observe("failure before cleanup");
        await dispose("failure cleanup");
      }
    } catch (cleanup) {
      receipt.cleanupError = String(cleanup);
    }
    $("status").textContent = "FAIL: " + error;
  } finally {
    receipt.endedAt = new Date().toISOString();
    $("receipt").value = JSON.stringify(receipt, null, 2);
    $("summary").textContent = JSON.stringify(
      {
        passed: receipt.passed,
        checks: receipt.checks.length,
        failed: receipt.checks.filter((c) => !c.passed),
        error: receipt.error,
        observations: receipt.observations.map((r) => ({
          variant: r.variant,
          name: r.name,
          phase: r.phase,
          primary: r.primary,
          state: r.state?.status,
          ticks: r.state?.ticks,
          dialogs: r.dialogs,
        })),
        receiptCharacters: $("receipt").value.length,
      },
      null,
      2,
    );
  }
}
$("run").onclick = run;
