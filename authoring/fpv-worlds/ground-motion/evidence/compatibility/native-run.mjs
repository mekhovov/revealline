// Functional native clock run. Root owns browser focus and any offline follow-up.
const $ = (id) => document.getElementById(id),
  frame = $("sim");
const receipt = {
  format: "FPVGroundMotionNative.v1",
  checks: [],
  actions: [],
  hosts: [],
  snapshots: [],
  limitations: [],
};
let fixture, w, d, p;
const q = (s) => d.querySelector(s),
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = async (b) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
function check(ok, name, detail) {
  receipt.checks.push({
    name,
    passed: !!ok,
    ...(detail === undefined ? {} : { detail }),
  });
  if (!ok) throw Error(name);
}
async function until(fn, name, ms = 30000) {
  const end = performance.now() + ms;
  while (!(await fn())) {
    if (performance.now() > end) throw Error("Timeout: " + name);
    await sleep(40);
  }
}
const visible = (n) =>
  !!(
    n?.checkVisibility({ checkVisibilityCSS: true }) &&
    !n.closest("[hidden],dialog:not([open])")
  );
function click(n) {
  check(
    visible(n) && !n.disabled,
    "Visible public control " + (n?.id || n?.textContent),
  );
  receipt.actions.push({
    id: n.id,
    text: n.textContent,
    phase: q("#flight-dialog")?.dataset.flightState,
    at: new Date().toISOString(),
  });
  n.click();
}
function reveal(n) {
  const ancestors = [];
  for (let a = n?.parentElement; a; a = a.parentElement)
    if (a.tagName === "DETAILS" && !a.open) ancestors.unshift(a);
  for (const a of ancestors) click(a.querySelector(":scope > summary"));
}
async function home() {
  if (q("#sim-settings")?.open) click(q("#close-sim-settings"));
  if (q("#worlds-shell-missions-dialog")?.open)
    click(q("#worlds-shell-action-missions-back"));
  if (!q("#worlds-shell-home-dialog")?.open)
    click(q("#worlds-shell-action-menu"));
  await until(() => q("#worlds-shell-home-dialog").open, "Home");
}
async function missions(tab = "packs") {
  await home();
  click(q("#worlds-shell-action-missions"));
  await until(() => q("#worlds-shell-missions-dialog").open, "Missions");
  click(q('[data-tab="' + tab + '"]'));
}
async function mount(variant) {
  const token = "ground-" + crypto.randomUUID();
  frame.src =
    variant + "/optional-practice/fpv-worlds/ground-host.html?token=" + token;
  await until(
    () =>
      frame.contentWindow?.fpvGround?.token === token &&
      !frame.contentWindow.fpvGround.disposed,
    "Fresh " + variant + " native owner",
  );
  w = frame.contentWindow;
  d = frame.contentDocument;
  p = w.fpvGround;
  w.focus();
  check(
    document.visibilityState === "visible" && d.visibilityState === "visible",
    "Owner is visible " + variant,
  );
}
async function finish(label) {
  if (!p || p.disposed) return;
  await p.finish();
  receipt.hosts.push({
    label,
    ...p.data,
    downloads: p.data.downloads.map((r) => ({
      name: r.name,
      bytes: r.blob.size,
    })),
  });
  check(
    !p.data.errors.length && !p.data.warnings.length,
    label + " no errors/warnings",
  );
  check(Object.values(p.data.dropped ?? {}).every((n) => n === 0), label + " observer retained every bounded event");
  check(
    p.data.rendererCount === 0
      ? p.data.resources === null
      : !!p.data.resources &&
          Object.values(p.data.resources.registered).every((n) => n === 0),
    label + " renderer owner disposed",
  );
}
async function capture(label) {
  const data = await p.inspect();
  receipt.snapshots.push({ label, ...data });
  return data;
}
async function upload(bytes, name, id = "import-pack", rejection = false) {
  await missions();
  const node = q("#" + id);
  reveal(node);
  check(
    visible(node.closest("label")) && !node.disabled,
    "Visible native file input " + id,
  );
  const before = q("#studio-status").textContent,
    files = new w.DataTransfer();
  files.items.add(
    new w.File([bytes], name, {
      type: name.endsWith(".json")
        ? "application/json"
        : "application/octet-stream",
    }),
  );
  node.files = files.files;
  node.dispatchEvent(new w.Event("change", { bubbles: true }));
  if (rejection)
    await until(
      () => q("#studio-status").textContent !== before,
      "Native rejection status",
    );
  else await until(() => node.value === "", "Native import completed " + name);
}
async function selectCourse() {
  await missions("explore");
  click(
    q('[data-world="' + fixture.packs.optin.id + '"]') ||
      q('[data-world="' + fixture.packs.optin.world + '"]'),
  );
  click(
    [...d.querySelectorAll("button[aria-label]")].find(
      (n) =>
        n.getAttribute("aria-label") ===
        "Fly: " + fixture.packs.optin.course.locales.en.title,
    ),
  );
  await until(
    () =>
      p.data.course === fixture.packs.optin.course.id &&
      p.data.lastDraw &&
      !q("#world-arm").disabled &&
      q("#flight-status").textContent.startsWith("Ready. Choose"),
    "Exact selected opt-in course Ready",
  );
}
async function arm() {
  await home();
  check(
    q("#worlds-shell-action-primary").textContent === "Continue",
    "Current paused/disarmed owner Continue",
  );
  click(q("#worlds-shell-action-primary"));
  await until(
    () => p.data.lastDraw?.status === "active",
    "Deliberate native Arm/Resume",
  );
}
async function nativeProgress(tick, label) {
  await until(
    () => {
      const draw = p.data.lastDraw;
      if (draw?.status === "paused")
        throw Error("Native pause during " + label + "; no automatic resume");
      return draw?.ticks >= tick;
    },
    label,
    15000,
  );
}
async function execute() {
  $("run").disabled = true;
  receipt.startedAt = new Date().toISOString();
  try {
    check(
      (await indexedDB.databases()).length === 0 &&
        (await caches.keys()).length === 0,
      "Unused dedicated origin; never erase retained data",
    );
    const fixtureBytes = await (await fetch("fixture.json")).arrayBuffer();
    fixture = JSON.parse(new TextDecoder().decode(fixtureBytes));
    receipt.fixtureSHA256 = await sha(fixtureBytes);
    receipt.fixture = fixture;
    receipt.limitations = fixture.limitations;
    for (const row of fixture.files) {
      const bytes = await (await fetch(row.path)).arrayBuffer();
      check(
        bytes.byteLength === row.bytes && (await sha(bytes)) === row.sha256,
        "Served file exact " + row.path,
      );
    }
    const files = {};
    for (const name of ["legacy.rlpack", "optin.rlpack", "optin.zip"])
      files[name] = await (await fetch("content/" + name)).arrayBuffer();
    await mount("old");
    await upload(files["legacy.rlpack"], "legacy.rlpack");
    const legacy = await capture("older runtime exact legacy install");
    check(
      legacy.revisions.some(
        (r) => r.active && r.sha256 === fixture.packs.legacy.sha256,
      ),
      "Older runtime installs absent-field legacy pack",
    );
    for (const name of ["optin.rlpack", "optin.zip"]) {
      // Make rejection status transitions distinguishable using a completed public legacy import.
      await upload(files["legacy.rlpack"], "legacy-again.rlpack");
      const before = await p.inspect();
      await upload(files[name], name, "import-pack", true);
      const after = await p.inspect();
      check(
        same(before, after),
        "Older runtime rejects " + name + " before data mutation",
      );
      receipt.actions.push({
        rejected: name,
        status: q("#studio-status").textContent,
      });
    }
    await finish("older runtime import owner");
    await mount("candidate");
    await upload(files["optin.rlpack"], "optin.rlpack");
    const installed = await capture("candidate exact opt-in install");
    check(
      installed.revisions.some(
        (r) => r.active && r.sha256 === fixture.packs.optin.sha256,
      ),
      "Candidate installs exact opt-in revision",
    );
    check(
      installed.revisions.some(
        (r) => !r.active && r.sha256 === fixture.packs.legacy.sha256,
      ),
      "Candidate preserves old absent-field revision",
    );
    check(
      installed.records.length === 0 && !p.app.snapshot().state,
      "Pack install neither arms nor invents recordings",
    );
    await selectCourse();
    const start = p.app.snapshot();
    receipt.initialFlight = start;
    check(
      start.state.actors[0].position.z === 0 && start.state.ticks === 0,
      "Actor starts at exact authored position before arming",
    );
    await arm();
    await nativeProgress(30, "native opt-in actor progress");
    await home();
    const paused = p.app.snapshot();
    receipt.pausedFlight = paused;
    check(
      paused.state.status === "paused" &&
        paused.state.actors[0].position.z > 200,
      "Native Pause retains measured actor travel",
    );
    const pausedKey = p.model.worldStateIdentity(paused.state);
    await sleep(160);
    check(
      p.model.worldStateIdentity(p.app.snapshot().state) === pausedKey,
      "Paused physics and actor state remain unchanged",
    );
    await arm();
    await until(
      () => {
        if (p.data.lastDraw?.status === "paused")
          throw Error("Unrequested native pause before completion");
        return p.data.lastDraw?.status === "complete";
      },
      "Native zero-throttle practice completes",
      15000,
    );
    await until(
      async () =>
        (await p.inspect()).records.some(
          (r) => r.status === "verified" && r.proof.session === "practice",
        ),
      "Actual recording saved and verified",
    );
    const saved = await capture("completed actual practice");
    const record = saved.records.find((r) => r.status === "verified");
    check(
      record.course.actors[0].groundMotion === "support-v1" &&
        record.proof.frames.length === 150 &&
        record.proof.mode === "self-level" &&
        record.packIdentity === "fpv-pack:" + fixture.packs.optin.sha256,
      "Saved practice binds exact policy/mode/frames/pack",
    );
    await missions();
    const beforeDownloads = p.data.downloads.length;
    click(q("#backup-proofs"));
    await until(
      () => p.data.downloads.length > beforeDownloads,
      "Actual proof export generated",
    );
    const exported = p.data.downloads.at(-1).blob,
      exportedBytes = await exported.arrayBuffer();
    const parsed = await p.recordsModule.importProofPart(await exported.text());
    check(
      parsed.length === 1 &&
        same(parsed[0].course, record.course) &&
        same(parsed[0].proof, record.proof) &&
        parsed[0].packIdentity === record.packIdentity,
      "Exported archive exact retained proof/course/dependency",
    );
    receipt.exported = {
      bytes: exportedBytes.byteLength,
      sha256: await sha(exportedBytes),
    };
    await upload(exportedBytes, "native-ground-proof.json", "import-proofs");
    await until(
      () => q("#studio-status").textContent.includes("Imported 1/1"),
      "Native exported proof reimport verifies",
    );
    check(
      same((await p.inspect()).records[0].proof, record.proof),
      "Reimport preserves original command recording",
    );
    await home();
    click(q("#worlds-shell-action-home-results"));
    click(
      [...d.querySelectorAll("#result-panel button")].find(
        (n) => n.textContent === "Watch verified flight",
      ),
    );
    await until(
      () =>
        p.data.lastDraw?.status === "active" &&
        p.app.snapshot().replay?.kind === "recording",
      "Actual native verified-record Watch starts",
    );
    await until(
      () => q("#flight-status").textContent.startsWith("Playback ended."),
      "Actual Watch completes",
      15000,
    );
    const watched = p.app.snapshot();
    receipt.watched = watched;
    check(
      watched.replay.mode === record.proof.mode &&
        watched.replay.frames === record.proof.frames.length &&
        p.model.worldStateIdentity(watched.state) ===
          record.proof.finalStateIdentity,
      "Native Watch exact mode/frame/final state",
    );
    const beforeOldReopen = await capture(
      "candidate retained data before old reopen",
    );
    await finish("candidate practice and replay owner");
    await mount("old");
    const oldReopen = await capture(
      "old exact runtime reopened newer stored data",
    );
    check(
      same(oldReopen, beforeOldReopen),
      "Older runtime reopen retains newer exact pack/proof/recovery bytes",
    );
    await missions("explore");
    check(
      ![...d.querySelectorAll("#world-grid .challenge-row strong")].some(
        (n) => n.textContent === fixture.packs.optin.course.locales.en.title,
      ),
      "Older runtime does not expose unsupported course as playable",
    );
    await finish("older retained-data owner");
    await mount("candidate");
    const reopened = await capture(
      "compatible runtime reopens retained revision",
    );
    check(
      same(reopened, beforeOldReopen),
      "Compatible reopen recovers exact retained bytes",
    );
    await finish("compatible reopened owner");
    frame.src = "about:blank";
    receipt.passed = true;
    $("status").textContent =
      "Native contract passed. Actual old cached offline reopen remains a separate root-owned step.";
  } catch (error) {
    receipt.passed = false;
    receipt.error = { message: error.message, stack: error.stack };
    try {
      if (p && !p.disposed)
        receipt.failure = {
          stored: await p.inspect(),
          snapshot: p.app.snapshot(),
          status: q("#flight-status")?.textContent,
          studio: q("#studio-status")?.textContent,
          data: p.data,
        };
    } catch (e) {
      receipt.captureError = String(e);
    }
    try {
      await finish("failed native owner");
    } catch (e) {
      receipt.cleanupError = String(e);
    }
    $("status").textContent = "FAILED: " + error.message;
  }
  receipt.finishedAt = new Date().toISOString();
  $("receipt").value = JSON.stringify(receipt);
  $("summary").textContent = JSON.stringify(
    {
      passed: receipt.passed,
      checks: receipt.checks.length,
      error: receipt.error?.message,
      hosts: receipt.hosts.length,
    },
    null,
    2,
  );
  window.fpvGroundReceipt = receipt;
}
$("run").addEventListener("click", execute, { once: true });
