// One-off manual verification. Not registered with a test runner or CI.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { diagnosticCourse } from "./course.mjs";

const [baseline, candidate, inventoryPath, out, phase = "schema"] =
  process.argv.slice(2);
if (
  ![baseline, candidate, inventoryPath, out].every(
    (p) => p && path.isAbsolute(p),
  ) ||
  !["schema", "physics"].includes(phase)
)
  throw Error(
    "ABS_BASELINE ABS_CANDIDATE ABS_BASELINE_95_INVENTORY ABS_NEW_RECEIPT [schema|physics]",
  );
const hash = (b) => createHash("sha256").update(b).digest("hex");
const clone = structuredClone;
const receipt = {
  format: "FPVGroundMotionCompatibilityManual.v1",
  phase,
  startedAt: new Date().toISOString(),
  baseline,
  candidate,
  checks: [],
  cases: [],
  limitations: [
    "Manual Node API verification, not native UI, cached-player delivery, physics-corpus or package admission.",
    "Actor editing invokes the real editor handlers through the existing deterministic DOM helper; layout, trusted input and full host Undo/Redo are not qualified here.",
    "Synthetic diagnostic data has no published-world or Harbor-completion status.",
    "Baseline95 bytes are read from the admitted Git revision. Baseline working world-app may contain the separate catalogue change and is never imported by this runner.",
  ],
};
const check = (ok, name, detail) => {
  receipt.checks.push({
    name,
    passed: !!ok,
    ...(detail === undefined ? {} : { detail }),
  });
  if (!ok) throw Error(name);
};
const equal = (a, b, name) => check(isDeepStrictEqual(a, b), name);
async function rejects(fn, name, pattern) {
  let error;
  try {
    await fn();
  } catch (e) {
    error = { name: e.name, message: e.message, code: e.code };
  }
  check(!!error && (!pattern || pattern.test(error.message)), name, error);
}
const load = (root, file) =>
  import(
    pathToFileURL(path.join(root, "optional-practice/civilian-fpv", file))
  );
const inputs = [];
const candidateRevision = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: candidate,
  env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
})
  .toString()
  .trim();
receipt.candidateRevision = candidateRevision;
const committedCandidate = (file) =>
  execFileSync("git", ["show", candidateRevision + ":" + file], {
    cwd: candidate,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
    maxBuffer: 20 * 1024 * 1024,
  });
try {
  const inventoryBytes = await fs.readFile(inventoryPath),
    inventory = JSON.parse(inventoryBytes);
  check(inventory.inputs.length === 95, "Baseline has95 exact admitted inputs");
  for (const row of inventory.inputs) {
    const old = execFileSync(
        "git",
        ["show", inventory.sourceRevision + ":" + row.path],
        {
          cwd: baseline,
          env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
          maxBuffer: 20 * 1024 * 1024,
        },
      ),
      next = committedCandidate(row.path);
    const candidateWorking = await fs
      .readFile(path.join(candidate, row.path))
      .catch((e) => {
        if (e.code === "ENOENT") return null;
        throw e;
      });
    check(
      !candidateWorking || candidateWorking.equals(next),
      "Candidate present working source matches committed input " + row.path,
    );
    const workingOld = await fs.readFile(path.join(baseline, row.path));
    check(
      workingOld.equals(old) ||
        row.path === "optional-practice/civilian-fpv/world-app.mjs",
      "Imported baseline modules remain exact " + row.path,
    );
    check(
      old.length === row.bytes && hash(old) === row.sha256,
      "Baseline exact input " + row.path,
    );
    const changed = !old.equals(next);
    check(
      !changed ||
        [
          "optional-practice/civilian-fpv/world-model.mjs",
          "optional-practice/civilian-fpv/world-collision.mjs",
          "optional-practice/civilian-fpv/world-library.mjs",
          "optional-practice/civilian-fpv/world-reaction-runtime.mjs",
        ].includes(row.path),
      "Only declared movement inputs may differ " + row.path,
    );
    inputs.push({
      path: row.path,
      baselineSHA256: hash(old),
      candidateSHA256: hash(next),
      baselineBytes: old.length,
      candidateBytes: next.length,
      presentCandidateSource: candidateWorking !== null,
      changed,
    });
  }
  receipt.inputs = inputs;
  receipt.inventory = {
    path: inventoryPath,
    sha256: hash(inventoryBytes),
    sourceRevision: inventory.sourceRevision,
    sourceTree: inventory.sourceTree,
  };
  const [
    oldModel,
    model,
    oldDefs,
    defs,
    oldContent,
    content,
    zip,
    records,
    catalogue,
  ] = await Promise.all([
    load(baseline, "world-model.mjs"),
    load(candidate, "world-model.mjs"),
    load(baseline, "content-definitions.mjs"),
    load(candidate, "content-definitions.mjs"),
    load(baseline, "world-content.mjs"),
    load(candidate, "world-content.mjs"),
    load(candidate, "world-zip.mjs"),
    load(candidate, "world-records.mjs"),
    load(candidate, "world-catalogue.mjs"),
  ]);
  equal(
    model.WORLD_RULES,
    oldModel.WORLD_RULES,
    "Global legacy rules unchanged",
  );
  equal(
    model.WORLD_FLIGHT_MODEL,
    oldModel.WORLD_FLIGHT_MODEL,
    "Global flight model unchanged",
  );
  const entries = [
    ...catalogue.WORLD_CATALOGUE,
    ...catalogue.BEGINNER_CATALOGUE,
  ];
  check(
    entries.length === 196,
    "All196 existing catalogue entries inventoried",
  );
  const legacy = [];
  for (const entry of entries) {
    const before = JSON.stringify(entry.course);
    check(
      !entry.course.actors?.some((a) => Object.hasOwn(a, "groundMotion")),
      "Existing course has no opt-in " + entry.id,
    );
    if (entry.course.format === "FlightCourse.v2") {
      equal(
        model.validateWorldCourse(entry.course),
        oldModel.validateWorldCourse(entry.course),
        "Legacy normalized course exact " + entry.id,
      );
      equal(
        model.exportWorldCourse(entry.course),
        oldModel.exportWorldCourse(entry.course),
        "Legacy exported course exact " + entry.id,
      );
    }
    equal(
      JSON.stringify(entry.course),
      before,
      "Retained source course bytes unchanged " + entry.id,
    );
    legacy.push({
      id: entry.id,
      format: entry.course.format,
      bytes: Buffer.byteLength(before),
      sha256: hash(before),
    });
  }
  receipt.legacy = legacy;
  const plain = model.validateWorldCourse(diagnosticCourse()),
    opt = model.validateWorldCourse(diagnosticCourse("support-v1"));
  check(
    !Object.hasOwn(plain.actors[0], "groundMotion"),
    "Absent field stays absent",
  );
  check(opt.actors[0].groundMotion === "support-v1", "Valid opt-in retained");
  for (const type of ["patrol", "sentry", "vehicle"]) {
    const c = clone(opt);
    c.actors[0].type = type;
    check(
      model.validateWorldCourse(c).actors[0].groundMotion === "support-v1",
      "Supported ground actor " + type,
    );
  }
  for (const value of [
    null,
    false,
    true,
    1,
    {},
    [],
    "",
    "support-v2",
    "legacy",
    "SUPPORT-V1",
  ]) {
    const c = clone(plain);
    c.actors[0].groundMotion = value;
    await rejects(
      () => model.validateWorldCourse(c),
      "Malformed/unknown groundMotion rejected " + JSON.stringify(value),
    );
  }
  for (const type of ["drone", "hazard"]) {
    const c = clone(opt);
    c.actors[0].type = type;
    if (type === "hazard") delete c.actors[0].role;
    await rejects(
      () => model.validateWorldCourse(c),
      "Non-ground actor opt-in rejected " + type,
    );
  }
  const unknown = clone(plain);
  unknown.actors[0].groundMotions = "support-v1";
  await rejects(
    () => model.validateWorldCourse(unknown),
    "Unknown actor key rejected",
  );
  await rejects(
    () => oldModel.validateWorldCourse(opt),
    "Older validator rejects new field",
    /actor|field|key/i,
  );
  await rejects(
    () => oldDefs.splitCourseDefinition(opt),
    "Older definition compiler rejects new field",
  );
  const layers = defs.splitCourseDefinition(opt);
  await rejects(
    () => oldDefs.compileChallengeDefinition(layers),
    "Older compiled definition rejects required movement policy",
  );
  const compiledLegacy = oldDefs.compileChallengeDefinition(
    oldDefs.splitCourseDefinition(plain),
  ).course;
  const expectedCompiled = clone(compiledLegacy);
  expectedCompiled.actors[0].groundMotion = "support-v1";
  equal(
    defs.compileChallengeDefinition(layers).course,
    expectedCompiled,
    "Definition compilation adds only policy beyond unchanged legacy theme resolution",
  );
  const project = content.resolveProject({
    format: "FPVWorldProject.v1",
    id: "ground-contract-project",
    title: "Ground contract diagnostic",
    world: { id: opt.world.id },
    courses: [opt, { ...clone(plain), id: "legacy-retained-course" }],
  });
  const rawBefore = JSON.stringify(project);
  const packed = await content.preparePack(project),
    inspected = await content.inspectPack(packed);
  equal(inspected.project, project, "Portable pack exact project roundtrip");
  equal(
    new Uint8Array(
      await (await content.preparePack(inspected.project)).arrayBuffer(),
    ),
    new Uint8Array(await packed.arrayBuffer()),
    "Portable pack bytes deterministic after reopen",
  );
  const zipped = await zip.exportEditableZip(project),
    unzipped = await zip.importEditableZip(zipped);
  equal(unzipped.project, project, "Editable ZIP exact project roundtrip");
  equal(
    JSON.stringify(project),
    rawBefore,
    "Project export leaves original bytes untouched",
  );
  // Raw pack parsing alone deliberately is not a runtime eligibility boundary.
  const oldInspected = await oldContent.inspectPack(packed);
  await rejects(
    () => oldInspected.project.courses.map(oldModel.validateWorldCourse),
    "Older actual-host course validation rejects parsed pack",
  );
  equal(
    oldInspected.project,
    project,
    "Old parse preserves unsupported bytes before host rejection",
  );
  // Real actor editor handlers; explicit shim for standard numeric input semantics.
  const { Document } = await import(
    pathToFileURL(path.join(baseline, "game/test/helpers/couch-dom.mjs"))
  );
  const { mountActorEditor } = await load(candidate, "world-actor-editor.mjs");
  const document = new Document(),
    createElement = document.createElement.bind(document);
  document.createElement = (tag) => {
    const node = createElement(tag);
    if (tag === "canvas") node.getContext = () => null;
    if (tag === "input")
      Object.defineProperty(node, "valueAsNumber", {
        get: () => (node.value === "" ? NaN : Number(node.value)),
      });
    return node;
  };
  const container = document.createElement("section");
  document.body.append(container);
  let editorCourse = clone(opt),
    commits = 0;
  const editor = mountActorEditor({
    container,
    getCourse: () => editorCourse,
    onChange: (mutate) => {
      const next = clone(editorCourse);
      mutate(next, {});
      editorCourse = model.validateWorldCourse(next);
      commits++;
    },
  });
  const buttons = () => [...container.querySelectorAll("button")];
  const speed = container.querySelector('[aria-label="Speed · m/s"]');
  check(!!speed, "Real actor editor exposes speed control");
  speed.value = "0.8";
  buttons()
    .find((b) => b.textContent === "Apply actor settings")
    .click();
  await Promise.resolve();
  await Promise.resolve();
  check(
    commits === 1 && editorCourse.actors[0].speed === 800,
    "Actual actor settings handler commits edit",
  );
  check(
    editorCourse.actors[0].groundMotion === "support-v1",
    "Numeric actor edit preserves opt-in",
  );
  const textarea = container.querySelector("textarea");
  check(!!textarea, "Real actor editor exposes waypoint JSON");
  textarea.value = JSON.stringify([
    { x: 4, y: 2, z: 0 },
    { x: 4, y: 2, z: 5 },
  ]);
  buttons()
    .find((b) => b.textContent === "Apply waypoint JSON")
    .click();
  await Promise.resolve();
  await Promise.resolve();
  check(
    commits === 2 && editorCourse.actors[0].path[1].z === 5000,
    "Actual waypoint JSON handler commits edit",
  );
  check(
    editorCourse.actors[0].groundMotion === "support-v1",
    "Waypoint edit preserves opt-in",
  );
  editor.dispose();
  check(container.children.length === 0, "Actor editor owned DOM removed");
  // Actual three-way semantic reimport, using a source actor with no opt-in.
  const sourceProject = clone(project);
  sourceProject.source.hash = "a".repeat(64);
  const imported = {
    sourceHash: "b".repeat(64),
    metadata: { anchors: [], colliders: [], diagnostics: [] },
  };
  const result = content.previewReimport(sourceProject, imported, {
    createCourse: (p) => {
      const c = clone(plain);
      if (p.source.hash === imported.sourceHash) c.actors[0].speed = 900;
      return c;
    },
    createCollider: (c) => clone(c),
    validateCourse: model.validateWorldCourse,
  });
  check(
    result.project.courses[0].actors[0].groundMotion === "support-v1",
    "Reimport retains local opt-in absent in both source revisions",
  );
  check(
    result.project.courses[0].actors[0].speed === 900,
    "Reimport independently accepts changed unoverridden source speed",
  );
  check(
    !Object.hasOwn(result.project.courses[1].actors[0], "groundMotion"),
    "Reimport leaves other legacy course absent",
  );
  equal(
    JSON.stringify(sourceProject.courses),
    JSON.stringify(project.courses),
    "Reimport does not mutate retained draft",
  );
  const synced = defs.splitCourseDefinition(result.project.courses[0]);
  const resynced = defs.compileChallengeDefinition(synced).course;
  equal(
    resynced.actors,
    result.project.courses[0].actors,
    "Post-reimport definition synchronization retains full actor",
  );
  equal(
    resynced.steps,
    result.project.courses[0].steps,
    "Post-reimport definition synchronization retains ordered modes",
  );
  if (phase === "physics") {
    await Promise.all([oldModel.initWorldRuntime(), model.initWorldRuntime()]);
    for (const mode of ["self-level", "acro"]) {
      const oldFlight = oldModel.createWorldFlight({ course: plain, mode }),
        legacyFlight = model.createWorldFlight({ course: plain, mode }),
        nextFlight = model.createWorldFlight({ course: opt, mode });
      try {
        equal(
          legacyFlight.identity,
          oldFlight.identity,
          mode + " legacy flight identity exact",
        );
        check(
          nextFlight.identity.courseIdentity !==
            legacyFlight.identity.courseIdentity,
          mode + " opt-in changes course identity",
        );
        for (const key of Object.keys(legacyFlight.identity).filter(
          (k) => k !== "courseIdentity",
        ))
          equal(
            nextFlight.identity[key],
            legacyFlight.identity[key],
            mode + " unrelated identity unchanged " + key,
          );
        const recorder = model.createWorldRecorder(nextFlight);
        oldFlight.arm();
        legacyFlight.arm();
        nextFlight.arm();
        for (let i = 0; i < 20; i++) {
          const input = { throttle: 0, yaw: 0, pitch: 0, roll: 0, actions: 0 };
          equal(
            legacyFlight.step(input),
            oldFlight.step(input),
            mode + " exact legacy tick " + (i + 1),
          );
          nextFlight.step(input);
          recorder.record();
        }
        const proof = recorder.export(),
          before = JSON.stringify(proof);
        const replay = await model.replayWorldFlight(opt, proof, {
          yieldControl: () => Promise.resolve(),
        });
        equal(
          replay.identity,
          nextFlight.identity,
          mode + " exact opt-in replay identity",
        );
        equal(
          model.worldStateIdentity(replay.state),
          proof.finalStateIdentity,
          mode + " exact replay final state",
        );
        await rejects(
          () => model.replayWorldFlight(plain, proof),
          mode + " legacy course rejects opt-in proof",
          /Exact world/,
        );
        await rejects(
          () => oldModel.replayWorldFlight(opt, proof),
          mode + " old runtime rejects opt-in proof",
        );
        for (const key of [
          "courseIdentity",
          "worldIdentity",
          "rulesIdentity",
          "conditionsIdentity",
          "backend",
          "responseIdentity",
        ]) {
          const wrong = { ...proof, [key]: proof[key] + "-wrong" };
          await rejects(
            () => model.replayWorldFlight(opt, wrong),
            mode + " exact dependency rejection " + key,
            /Exact world/,
          );
        }
        const record = {
          course: opt,
          proof,
          status: "missing-dependency",
          diagnostic: "Deliberate compatibility fixture",
          packIdentity: "fpv-pack:" + inspected.sha256,
          savedAt: 1,
        };
        record.id = records.worldRecordIdentity(record);
        const parts = records.partitionProofArchive([record]);
        const restored = records.readProofArchive(JSON.stringify(parts[0]));
        equal(
          restored[0].course,
          record.course,
          mode + " unavailable archive retains exact opt-in course",
        );
        equal(
          restored[0].proof,
          record.proof,
          mode + " unavailable archive retains exact proof",
        );
        equal(
          restored[0].packIdentity,
          record.packIdentity,
          mode + " unavailable archive retains exact pack identity",
        );
        check(
          restored[0].status === "missing-dependency",
          mode + " imported archive does not trust verified status",
        );
        receipt.cases.push({
          mode,
          identity: nextFlight.identity,
          proofSHA256: hash(before),
          recordIdentity: record.id,
          archiveReturn: typeof restored,
          frameCount: proof.frames.length,
        });
        equal(
          JSON.stringify(proof),
          before,
          mode + " all rejected replay paths retain proof bytes",
        );
        check(
          records.worldRecordIdentity({ course: plain, proof }) !== record.id,
          mode + " record identity binds optional actor policy",
        );
      } finally {
        oldFlight.dispose();
        legacyFlight.dispose();
        nextFlight.dispose();
      }
    }
  } else
    receipt.limitations.push(
      "Physics/replay section deliberately not run in schema phase.",
    );
  for (const row of inputs) {
    const after = await fs
      .readFile(path.join(candidate, row.path))
      .catch((e) => {
        if (e.code === "ENOENT") return null;
        throw e;
      });
    check(
      after ? hash(after) === row.candidateSHA256 : !row.presentCandidateSource,
      "Candidate source unchanged through run " + row.path,
    );
  }
  receipt.passed = true;
} catch (error) {
  receipt.passed = false;
  receipt.error = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
  process.exitCode = 1;
} finally {
  receipt.finishedAt = new Date().toISOString();
  await fs.writeFile(out, JSON.stringify(receipt, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(
    JSON.stringify({
      passed: receipt.passed,
      phase,
      checks: receipt.checks.length,
      error: receipt.error?.message,
      receipt: out,
    }),
  );
}
