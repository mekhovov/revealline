/* global document, fetch, crypto, navigator */
const $ = (id) => document.getElementById(id),
  frame = $("sim");
const receipt = {
  format: "FPVFirstReadyQualification.v1",
  checks: [],
  blocks: [],
  startedAt: new Date().toISOString(),
  userAgent: navigator.userAgent,
  order: [
    "container-yard-08",
    "container-yard-01",
    "container-yard-01",
    "container-yard-08",
  ],
};
let w, d, p;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const q = (selector) => d.querySelector(selector);
function check(value, name, detail) {
  receipt.checks.push({ name, passed: Boolean(value), detail });
  if (!value) throw Error(name);
}
async function until(predicate, name) {
  const end = performance.now() + 25000;
  while (!predicate()) {
    if (performance.now() > end) throw Error("Timeout: " + name);
    await sleep(20);
  }
}
function click(node) {
  if (
    !node?.checkVisibility({ checkVisibilityCSS: true }) ||
    node.disabled ||
    node.closest("[hidden],dialog:not([open])")
  )
    throw Error("Public control unavailable: " + node?.id);
  node.click();
}
function select(id, value) {
  const node = q("#" + id);
  if (!node?.checkVisibility({ checkVisibilityCSS: true }))
    throw Error("Hidden selector: " + id);
  node.value = value;
  node.dispatchEvent(new w.Event("change", { bubbles: true }));
}
async function measure(id, block, repeat) {
  const phase = `${block}:${id}:${repeat === 0 ? "initial" : "repeat-fly" + repeat}`;
  p.begin(phase);
  if (repeat) click(q("#worlds-shell-action-menu"));
  click(q("#worlds-shell-action-missions"));
  click(q('[data-world="container-yard"]'));
  const entry = p.entries.find((e) => e.id === id);
  click(
    [...d.querySelectorAll("button[aria-label]")].find(
      (n) =>
        n.getAttribute("aria-label") ===
        "Fly: " + entry.course.locales.en.title,
    ),
  );
  await until(
    () =>
      p.data.draws.filter((r) => r.phase === phase).length === 3 &&
      /^Ready\./.test(q("#flight-status").textContent),
    phase + " warm/first three submissions",
  );
  const draws = p.data.draws.filter((r) => r.phase === phase),
    methods = p.data.methods.filter((r) => r.phase === phase),
    prepared = methods.filter((r) => r.name === "prepare"),
    count = id === "container-yard-08" ? 2 : 0;
  check(
    draws.every(
      (r) =>
        r.courseId === id &&
        r.state.ticks === 0 &&
        r.state.status === "disarmed",
    ),
    phase + " exact disarmed target",
  );
  check(
    draws.every((r) => !r.pending.prepare && !r.pending.loadScene),
    phase + " no intermediate draw",
  );
  check(
    prepared.length > 0 && prepared.every((r) => r.result === true && !r.error),
    phase + " native preparation succeeds",
  );
  check(
    draws.every(
      (r) =>
        r.before.visibility === "visible" &&
        r.before.focused &&
        r.after.focused,
    ),
    phase + " visible focused document",
  );
  const first = draws[0],
    post = draws[1],
    last = draws[2],
    ready = p.data.readyTransitions.find((r) => r.phase === phase);
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  check(
    draws.every((r) => equal(r.state, r.stateAfter)) &&
      equal(first.state, post.state) &&
      equal(post.state, last.state) &&
      equal(last.state, p.app.snapshot().state),
    phase + " rendering preserves exact native paused state",
  );
  check(
    draws.every((r) => equal(first.cameraOptions, r.cameraOptions)),
    phase + " unchanged lens for all submissions",
  );
  check(
    ready &&
      (receipt.fixture.warmupExpected
        ? first.end <= ready.at &&
          ready.at <= post.start &&
          first.before.armDisabled &&
          first.after.armDisabled
        : ready.at <= first.start),
    phase + " declared readiness submission boundary",
  );
  check(
    equal(first.after.registered, post.after.registered) &&
      equal(post.after.registered, last.after.registered),
    phase + " no lazy registered resources",
  );
  for (const key of ["geometries", "textures", "programs"])
    check(
      first.after.renderer[key] === post.before.renderer[key] &&
        post.before.renderer[key] === post.after.renderer[key] &&
        post.after.renderer[key] === last.after.renderer[key],
      phase + " no later upload/link: " + key,
    );
  check(
    equal(first.after.canvas.pixels, post.after.canvas.pixels) &&
      equal(post.after.canvas.pixels, last.after.canvas.pixels),
    phase + " warm and ready canvas dimensions exact",
  );
  const expectedDepth = count ? 6 : 5;
  const links = p.data.nativePrograms.filter(
    (r) => r.phase === phase && r.operation === "draw:1",
  );
  check(
    links.length === expectedDepth &&
      links.every((r) =>
        r.shaders.every((s) => s.signature.shaderType === "MeshDepthMaterial"),
      ),
    phase + " exact initial shadow program variants",
  );
  check(
    !p.data.nativePrograms.some(
      (r) =>
        r.phase === phase &&
        ["draw:2", "draw:3", "draw:later"].includes(r.operation),
    ),
    phase + " no post-first-submission native links",
  );
  const visibleCanvases = [...d.querySelectorAll("canvas")]
    .filter(
      (node) =>
        node.checkVisibility({ checkVisibilityCSS: true }) &&
        !node.closest("[hidden],dialog:not([open])"),
    )
    .map((node) => node.id);
  check(
    JSON.stringify(visibleCanvases) === '["world-canvas"]',
    phase + " one visible canvas at ready checkpoint",
  );
  check(
    draws.every(
      (r) =>
        r.after.quality === "balanced" && r.cameraOptions.cameraMode === "fpv",
    ),
    phase + " fixed quality and camera",
  );
  check(
    draws.every(
      (r) => r.state.actors.length === count && r.after.actors.length === count,
    ),
    phase + " original actor count",
  );
  check(
    JSON.stringify(draws[0].after.actors) ===
      JSON.stringify(draws[1].after.actors),
    phase + " disarmed actor presentation remains exact",
  );
  check(
    p.data.readyTransitions.some((r) => r.phase === phase),
    phase + " Ready transition recorded separately",
  );
}
$("run").onclick = async () => {
  $("run").disabled = true;
  document.body.dataset.running = "true";
  try {
    receipt.fixture = await (
      await fetch("fixture.json", { cache: "no-store" })
    ).json();
    for (const row of receipt.fixture.files) {
      const response = await fetch(row.path, { cache: "no-store" }),
        bytes = await response.arrayBuffer();
      const digest = [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      ]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      check(
        response.ok && bytes.byteLength === row.bytes && digest === row.sha256,
        "frozen file: " + row.path,
      );
    }
    for (let block = 0; block < receipt.order.length; block++) {
      const id = receipt.order[block];
      $("status").textContent = `Block ${block + 1}/4 · ${id}`;
      const previous = p;
      frame.src =
        "player/optional-practice/fpv-worlds/first-ready-host.html?block=" +
        block;
      await until(
        () =>
          frame.contentWindow.fpvFirstReady &&
          frame.contentWindow.fpvFirstReady !== previous,
        "fresh native host",
      );
      w = frame.contentWindow;
      d = frame.contentDocument;
      p = w.fpvFirstReady;
      w.focus();
      click(q("#worlds-shell-action-settings"));
      select("flight-quality", "balanced");
      select("flight-camera", "fpv");
      select("sim-appearance-world", "authored");
      click(q("#close-sim-settings"));
      for (let repeat = 0; repeat < 3; repeat++)
        await measure(id, block, repeat);
      const data = await p.finish();
      receipt.blocks.push(data);
      check(
        Object.values(data.disposedResources.registered).every((v) => v === 0),
        "block" + block + " resources disposed",
      );
      check(
        !data.errors.length && !data.warnings.length,
        "block" + block + " no unexpected errors/warnings",
      );
      check(
        data.nativeProgramObservationsDropped === 0 &&
          data.nativePrograms.length > 0 &&
          data.nativePrograms.every(
            (row) =>
              row.shaders.length === 2 &&
              row.shaders.some((shader) => shader.stage === "vertex") &&
              row.shaders.some((shader) => shader.stage === "fragment") &&
              row.shaders.every((shader) => shader.signature),
          ),
        "block" + block + " bounded native program signatures complete",
      );
    }
    check(
      receipt.blocks.reduce((n, b) => n + b.draws.length, 0) === 36,
      "all36 predeclared first three submissions retained",
    );
    receipt.completed = true;
    receipt.timingScope =
      "Native GL observation is diagnostic only; no total-load, FPS or GPU-elapsed claim; compare resource/readiness boundaries only.";
    $("status").textContent = "PASS " + receipt.checks.length;
  } catch (error) {
    receipt.error = String(error.stack ?? error);
    const current = frame.contentWindow;
    receipt.failedBlock = current?.fpvFirstReadyData
      ? structuredClone(current.fpvFirstReadyData)
      : null;
    $("status").textContent = "STOPPED: " + error.message;
    if (current?.fpvFirstReadyCleanup) {
      let timer;
      try {
        const data = await Promise.race([
          current.fpvFirstReadyCleanup(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(Error("Failure cleanup timeout")),
              10000,
            );
          }),
        ]);
        receipt.failureCleanup = data.disposedResources;
      } catch (cleanupError) {
        receipt.cleanupError = String(cleanupError);
        frame.src = "about:blank";
      } finally {
        clearTimeout(timer);
      }
    }
  } finally {
    receipt.finishedAt = new Date().toISOString();
    $("receipt").value = JSON.stringify(receipt, null, 2);
    document.body.dataset.running = "false";
  }
};
