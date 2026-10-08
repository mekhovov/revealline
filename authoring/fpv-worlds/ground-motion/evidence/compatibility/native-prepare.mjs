// Immutable102-member reuse; source overlays are explicit and allowlisted.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { diagnosticCourse } from "./course.mjs";
const [root, revision, player, inventoryPath, out] = process.argv.slice(2);
if (
  ![root, player, inventoryPath, out].every((p) => p && path.isAbsolute(p)) ||
  !/^[a-f0-9]{40}$/.test(revision ?? "")
)
  throw Error("ABS_ROOT EXACT_REV ABS_OLD_PLAYER ABS_95_INVENTORY ABS_NEW_OUT");
const hash = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) =>
  execFileSync("git", args, {
    cwd: root,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
    maxBuffer: 20 * 1024 * 1024,
  });
const rawStage = await fs.readFile(player + ".json"),
  stage = JSON.parse(rawStage),
  rawInventory = await fs.readFile(inventoryPath),
  inventory = JSON.parse(rawInventory);
if (
  stage.files.length !== 102 ||
  inventory.inputs.length !== 95 ||
  !stage.checks.every((r) => r.passed) ||
  stage.sourceRevision !== inventory.sourceRevision ||
  stage.sourceTree !== inventory.sourceTree
)
  throw Error("Exact complete admitted baseline required");
const allowed = [
    "world-model.mjs",
    "world-collision.mjs",
    "world-library.mjs",
    "world-reaction-runtime.mjs",
  ].map((p) => "optional-practice/civilian-fpv/" + p),
  inputs = [];
for (const row of inventory.inputs) {
  const bytes = git("show", revision + ":" + row.path),
    changed = hash(bytes) !== row.sha256;
  if (changed && !allowed.includes(row.path))
    throw Error("Unexpected candidate source " + row.path);
  const working = await fs.readFile(path.join(root, row.path)).catch((e) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  if (working && !bytes.equals(working))
    throw Error("Working candidate changed " + row.path);
  inputs.push({
    ...row,
    candidateBytes: bytes.length,
    candidateSHA256: hash(bytes),
    changed,
  });
}
if (
  !inputs.some((r) => r.changed && r.path.endsWith("/world-model.mjs")) ||
  !inputs.some((r) => r.changed && r.path.endsWith("/world-collision.mjs"))
)
  throw Error("Expected opt-in model and collision changes");
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
for (const variant of ["old", "candidate"])
  for (const row of stage.files) {
    const bytes = await fs.readFile(path.join(player, row.path)),
      name = variant + "/" + row.path;
    if (hash(bytes) !== row.sha256 || bytes.length !== row.bytes)
      throw Error("Changed admitted member " + row.path);
    if (
      variant === "candidate" &&
      inputs.find((r) => r.path === row.path)?.changed
    )
      await write(
        name,
        git("show", revision + ":" + row.path),
        "exact committed source overlay",
      );
    else {
      await fs.mkdir(path.dirname(path.join(out, name)), { recursive: true });
      await fs.link(path.join(player, row.path), path.join(out, name));
      files.push({
        ...row,
        path: name,
        provenance: "immutable admitted hardlink",
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
const html = await fs.readFile(
  path.join(player, "optional-practice/fpv-worlds/index.html"),
  "utf8",
);
if (
  !html.includes('data-fpv-worlds="true"') ||
  !html.includes('src="../civilian-fpv/world-app.mjs"')
)
  throw Error("Expected native entry markers");
for (const variant of ["old", "candidate"])
  await write(
    variant + "/optional-practice/fpv-worlds/ground-host.html",
    html
      .replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"')
      .replace(
        'src="../civilian-fpv/world-app.mjs"',
        'src="../../../native-host.mjs"',
      ),
  );
for (const name of ["native-host.mjs", "native-run.mjs"])
  await write(name, await fs.readFile(new URL(name, import.meta.url)));
await write(
  "index.html",
  '<!doctype html><meta charset="utf-8"><title>Ground motion compatibility</title><style>body{margin:0;font:14px system-ui;background:#18232b;color:white}header{padding:10px}button{padding:8px}iframe{width:100%;height:820px;border:0}textarea{width:98%;height:200px}pre{white-space:pre-wrap}</style><header><button id="run">Run native contract</button><span id="status">Dedicated fresh origin required. Keep visible.</span></header><iframe id="sim" title="Actual native player"></iframe><pre id="summary"></pre><textarea id="receipt" readonly></textarea><script type="module" src="native-run.mjs"></script>',
);
const fixture = {
  format: "FPVGroundMotionNativeFixture.v1",
  revision,
  sourceTree: git("rev-parse", revision + "^{tree}")
    .toString()
    .trim(),
  old: {
    sourceRevision: stage.sourceRevision,
    sourceTree: stage.sourceTree,
    receiptSHA256: hash(rawStage),
    inventorySHA256: hash(rawInventory),
  },
  inputs,
  overlays: inputs.filter((r) => r.changed),
  packs,
  files,
  limitations: [
    "Actual old admitted runtime plus explicit committed candidate overlays; not candidate admission.",
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
