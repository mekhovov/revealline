// Both cohorts reuse complete exact admitted players; no runtime overlay path exists.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { diagnosticCourse } from "./course.mjs";
const [
  flag,
  root,
  revision,
  oldPlayer,
  oldInventoryPath,
  player,
  inventoryPath,
  out,
] = process.argv.slice(2);
if (
  flag !== "--admitted" ||
  ![root, oldPlayer, oldInventoryPath, player, inventoryPath, out].every(
    (p) => p && path.isAbsolute(p),
  ) ||
  !/^[a-f0-9]{40}$/.test(revision ?? "")
)
  throw Error(
    "--admitted ABS_SOURCE_ROOT EXACT_REV ABS_OLD_PLAYER ABS_OLD_95_INVENTORY ABS_CANDIDATE_PLAYER ABS_CANDIDATE_95_INVENTORY ABS_NEW_OUT",
  );
const hash = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) =>
  execFileSync("git", args, {
    cwd: root,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
    maxBuffer: 20 * 1024 * 1024,
  });
const sourceTree = git("rev-parse", revision + "^{tree}")
  .toString()
  .trim();
function rowsValid(rows, count) {
  return (
    Array.isArray(rows) &&
    rows.length === count &&
    new Set(rows.map((r) => r.path)).size === count &&
    rows.every(
      (r) =>
        typeof r.path === "string" &&
        !r.path.startsWith("/") &&
        !r.path.includes("\\") &&
        r.path.split("/").every((s) => s && s !== "." && s !== "..") &&
        Number.isSafeInteger(r.bytes) &&
        r.bytes >= 0 &&
        /^[a-f0-9]{64}$/.test(r.sha256),
    )
  );
}
async function admission(directory, inventoryFile, candidate) {
  const rawStage = await fs.readFile(directory + ".json"),
    stage = JSON.parse(rawStage),
    rawInventory = await fs.readFile(inventoryFile),
    inventory = JSON.parse(rawInventory);
  if (
    stage.format !== "FPVGeneratedShellAdmittedPlayer.v1" ||
    stage.packageId !== "fpv-worlds" ||
    stage.entry !== "optional-practice/fpv-worlds/index.html" ||
    inventory.format !== "revealline-optional-package-source.v1" ||
    inventory.packageId !== "fpv-worlds" ||
    !rowsValid(stage.files, 102) ||
    !rowsValid(inventory.inputs, 95) ||
    !Array.isArray(stage.checks) ||
    !stage.checks.length ||
    !stage.checks.every((r) => r.passed === true) ||
    stage.originalInputs !== 95 ||
    stage.sourceRevision !== inventory.sourceRevision ||
    stage.sourceTree !== inventory.sourceTree ||
    !/^[a-f0-9]{40}$/.test(stage.sourceRevision) ||
    git("rev-parse", stage.sourceRevision + "^{tree}")
      .toString()
      .trim() !== stage.sourceTree
  )
    throw Error(
      "Exact complete source-bound admitted player required: " + directory,
    );
  if (
    candidate &&
    (stage.sourceRevision !== revision || stage.sourceTree !== sourceTree)
  )
    throw Error("Candidate admission is not the requested exact revision/tree");
  const published = JSON.parse(
    await fs.readFile(path.join(directory, "optional-package.json")),
  );
  if (
    published.format !== "revealline-optional-practice-package.v1" ||
    published.id !== "fpv-worlds" ||
    published.engineCommit !== stage.sourceRevision ||
    published.engineTree !== stage.sourceTree
  )
    throw Error("Published descriptor differs from admitted revision/tree");
  for (const row of inventory.inputs) {
    const committed = git("show", stage.sourceRevision + ":" + row.path);
    if (committed.length !== row.bytes || hash(committed) !== row.sha256)
      throw Error("Admission input differs from committed source: " + row.path);
    if (
      candidate &&
      !committed.equals(await fs.readFile(path.join(root, row.path)))
    )
      throw Error("Working source differs from candidate input: " + row.path);
  }
  for (const row of stage.files) {
    const bytes = await fs.readFile(path.join(directory, row.path));
    if (bytes.length !== row.bytes || hash(bytes) !== row.sha256)
      throw Error("Changed admitted member: " + directory + "/" + row.path);
  }
  return { directory, rawStage, rawInventory, stage, inventory };
}
const old = await admission(oldPlayer, oldInventoryPath, false),
  candidate = await admission(player, inventoryPath, true);
const committedPackage = git("show", revision + ":package.json");
if (
  !committedPackage.equals(
    await fs.readFile(path.join(root, "package.json")),
  ) ||
  JSON.parse(committedPackage).type !== "module"
)
  throw Error("Exact source ESM package boundary required");
const stage = candidate.stage,
  inputs = candidate.inventory.inputs.map((row) => ({
    ...row,
    candidateBytes: row.bytes,
    candidateSHA256: row.sha256,
    changed: false,
  }));
const inputChangesFromOld = inputs.filter(
  (row) =>
    old.inventory.inputs.find((r) => r.path === row.path)?.sha256 !==
    row.sha256,
);
if (
  !inputChangesFromOld.some((r) => r.path.endsWith("/world-model.mjs")) ||
  !inputChangesFromOld.some((r) => r.path.endsWith("/world-collision.mjs"))
)
  throw Error("Expected admitted opt-in movement versus older compiler");
if (await fs.stat(out).catch(() => null))
  throw Error("Never overwrite frozen fixture");
await fs.mkdir(out);
const files = [];
async function write(name, bytes, provenance = "manual observer fixture") {
  await fs.mkdir(path.dirname(path.join(out, name)), { recursive: true });
  await fs.writeFile(path.join(out, name), bytes, { flag: "wx" });
  files.push({
    path: name,
    bytes: Buffer.byteLength(bytes),
    sha256: hash(bytes),
    provenance,
  });
}
for (const [variant, admitted] of [
  ["old", old],
  ["candidate", candidate],
]) {
  for (const row of admitted.stage.files) {
    const name = variant + "/" + row.path;
    await fs.mkdir(path.dirname(path.join(out, name)), { recursive: true });
    await fs.link(
      path.join(admitted.directory, row.path),
      path.join(out, name),
    );
    files.push({
      ...row,
      path: name,
      provenance: "immutable exact admitted hardlink; zero runtime overlays",
    });
  }
}
const content = await import(
    pathToFileURL(
      path.join(root, "optional-practice/civilian-fpv/world-content.mjs"),
    )
  ),
  model = await import(
    pathToFileURL(
      path.join(root, "optional-practice/civilian-fpv/world-model.mjs"),
    )
  ),
  zip = await import(
    pathToFileURL(
      path.join(root, "optional-practice/civilian-fpv/world-zip.mjs"),
    )
  ),
  packs = {};
for (const [name, policy] of [
  ["legacy", undefined],
  ["optin", "support-v1"],
]) {
  const course = model.validateWorldCourse(diagnosticCourse(policy)),
    project = content.resolveProject({
      format: "FPVWorldProject.v1",
      id: "ground-motion-project",
      title: "Ground movement diagnostic",
      world: { id: course.world.id },
      courses: [course],
    });
  const pack = Buffer.from(
      await (await content.preparePack(project)).arrayBuffer(),
    ),
    editable = Buffer.from(
      await (await zip.exportEditableZip(project)).arrayBuffer(),
    );
  await write(
    "content/" + name + ".rlpack",
    pack,
    "synthetic validated movement contract pack",
  );
  await write(
    "content/" + name + ".zip",
    editable,
    "matching editable diagnostic project",
  );
  packs[name] = {
    id: project.id,
    world: project.world.id,
    course,
    sha256: hash(pack),
    bytes: pack.length,
    zipSHA256: hash(editable),
    zipBytes: editable.length,
  };
}
for (const [variant, admitted] of [
  ["old", old],
  ["candidate", candidate],
]) {
  const html = await fs.readFile(
    path.join(admitted.directory, "optional-practice/fpv-worlds/index.html"),
    "utf8",
  );
  if (
    !html.includes('data-fpv-worlds="true"') ||
    !html.includes('src="../civilian-fpv/world-app.mjs"')
  )
    throw Error("Expected native entry markers");
  await write(
    variant + "/optional-practice/fpv-worlds/ground-host.html",
    html
      .replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"')
      .replace(
        'src="../civilian-fpv/world-app.mjs"',
        'src="../../../native-host.mjs"',
      ),
  );
}
for (const name of ["native-host.mjs", "native-run.mjs"])
  await write(name, await fs.readFile(new URL(name, import.meta.url)));
await write(
  "index.html",
  '<!doctype html><meta charset="utf-8"><title>Ground motion compatibility</title><style>body{margin:0;font:14px system-ui;background:#18232b;color:white}header{padding:10px}button{padding:8px}iframe{width:100%;height:820px;border:0}textarea{width:98%;height:200px}pre{white-space:pre-wrap}</style><header><button id="run">Run native contract</button><span id="status">Dedicated fresh origin required. Keep visible.</span></header><iframe id="sim" title="Actual native player"></iframe><pre id="summary"></pre><textarea id="receipt" readonly></textarea><script type="module" src="native-run.mjs"></script>',
);
const fixture = {
  format: "FPVGroundMotionNativeFixture.v1",
  revision,
  sourceTree,
  old: {
    sourceRevision: old.stage.sourceRevision,
    sourceTree: old.stage.sourceTree,
    receiptSHA256: hash(old.rawStage),
    inventorySHA256: hash(old.rawInventory),
  },
  candidate: {
    sourceRevision: stage.sourceRevision,
    sourceTree: stage.sourceTree,
    receiptSHA256: hash(candidate.rawStage),
    inventorySHA256: hash(candidate.rawInventory),
    members: 102,
    sourceInputs: 95,
    runtimeOverlays: 0,
  },
  inputs,
  inputChangesFromOld,
  overlays: [],
  packs,
  files,
  limitations: [
    "Both old and candidate cohorts are exact complete102-member admitted players with zero runtime overlays; the additional observer bootstrap is outside each admitted closure.",
    "Native standard-name IndexedDB shared across old/new owners on one dedicated origin. No clock/state/focus guard override.",
    "Export captures the actual generated Blob before browser download; no filesystem-save claim.",
    "Older-runtime reopen models the retained cached version using exact old bytes. Actual stopped-origin cached reopen is a separate root-owned step. No endpoint/index changes.",
  ],
};
await fs.writeFile(
  path.join(out, "fixture.json"),
  JSON.stringify(fixture, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    out,
    revision,
    overlays: fixture.overlays,
    files: files.length,
    fixtureSHA256: hash(await fs.readFile(path.join(out, "fixture.json"))),
  }),
);
