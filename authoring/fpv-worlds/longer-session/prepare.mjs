import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const [root, player, inventoryPath, revision, packPath, proofPath, out] =
  process.argv.slice(2);
assert(
  [root, player, inventoryPath, packPath, proofPath, out].every(
    (p) => p && path.isAbsolute(p),
  ) && /^[a-f0-9]{40}$/.test(revision ?? ""),
  "Use absolute ROOT PLAYER INVENTORY FULL_REVISION PACK PROOFS NEW_OUTPUT",
);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) =>
  execFileSync("git", args, {
    cwd: root,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
    maxBuffer: 24 * 1024 * 1024,
  });
const stageBytes = await fs.readFile(player + ".json"),
  inventoryBytes = await fs.readFile(inventoryPath),
  stage = JSON.parse(stageBytes),
  inventory = JSON.parse(inventoryBytes);
assert(
  stage.files.length === 102 &&
    inventory.inputs.length === 95 &&
    stage.checks.every((r) => r.passed),
);
assert.equal(stage.sourceRevision, revision);
assert.equal(inventory.sourceRevision, revision);
const tree = git("rev-parse", revision + "^{tree}")
  .toString()
  .trim();
assert.equal(stage.sourceTree, tree);
assert.equal(inventory.sourceTree, tree);
const sourceHost = git(
  "show",
  revision + ":optional-practice/civilian-fpv/world-app.mjs",
).toString();
assert(
  sourceHost.includes("projectGeneration = installed.generation"),
  "Integrated Creator commit ownership required",
);
assert(
  sourceHost.includes(
    "World pack saved. Reload the page to refresh the Library.",
  ),
  "Integrated truthful saved status required",
);
assert(
  git(
    "show",
    revision + ":optional-practice/civilian-fpv/world-library.mjs",
  ).includes("surface-coating-v1/index.json"),
  "Compatible Library prerequisite required",
);
const inputs = [];
for (const row of inventory.inputs) {
  const b = git("show", revision + ":" + row.path);
  assert.equal(b.length, row.bytes, row.path);
  assert.equal(sha(b), row.sha256, row.path);
  assert(
    (await fs.readFile(path.join(root, row.path))).equals(b),
    "Exact imported source closure: " + row.path,
  );
  inputs.push({ ...row, changed: false });
}
const playerReal = await fs.realpath(player);
assert(
  !out.startsWith(playerReal + "/") && out !== playerReal,
  "Separate immutable output required",
);
for (const row of stage.files) {
  assert(
    /^[A-Za-z0-9_./-]+$/.test(row.path) && !row.path.split("/").includes(".."),
  );
  const file = path.join(player, row.path),
    stat = await fs.lstat(file);
  assert(stat.isFile() && !stat.isSymbolicLink());
  assert((await fs.realpath(file)).startsWith(playerReal + "/"));
  const b = await fs.readFile(file);
  assert.equal(b.length, row.bytes);
  assert.equal(sha(b), row.sha256);
}
const packBytes = await fs.readFile(packPath),
  proofBytes = await fs.readFile(proofPath);
assert.equal(packBytes.length, 1379988);
assert.equal(
  sha(packBytes),
  "50ffbb0e5da7dec94862a8f2ca85cfeb60542d3fe9f86bd3c4e288dfa0a2e554",
);
assert.equal(proofBytes.length, 908574);
assert.equal(
  sha(proofBytes),
  "073ee3e359764d35039f607d02d0815ac0768b892d046b1426c5c4a55f4cacfb",
);
assert.equal(
  JSON.parse(await fs.readFile(path.join(root, "package.json"))).type,
  "module",
  "Authoring imports retain the repository ESM boundary",
);
const [
  { inspectPack },
  { WORLD_CATALOGUE },
  { WORLD_DEMONSTRATIONS },
  { resolveThemeProfile },
] = await Promise.all([
  import(
    pathToFileURL(
      path.join(root, "optional-practice/civilian-fpv/world-content.mjs"),
    )
  ),
  import(
    pathToFileURL(
      path.join(root, "optional-practice/civilian-fpv/world-catalogue.mjs"),
    )
  ),
  import(
    pathToFileURL(
      path.join(
        root,
        "optional-practice/civilian-fpv/world-demonstrations.mjs",
      ),
    )
  ),
  import(
    pathToFileURL(
      path.join(root, "optional-practice/civilian-fpv/world-themes.mjs"),
    )
  ),
]);
const pack = await inspectPack(packBytes),
  archive = JSON.parse(proofBytes);
assert.equal(pack.project.courses.length, 8);
assert.equal(archive.records.length, 16);
const yard = WORLD_CATALOGUE.find((e) => e.id === "container-yard-08"),
  natural = pack.project.courses.find((c) => c.id === "mountain-reservoir-08");
assert(yard && natural);
const yardProof = WORLD_DEMONSTRATIONS.find(
  (r) => r.proof.course === yard.id && r.proof.mode === "self-level",
).proof;
const naturalRecord = archive.records.find(
  (r) => r.course.id === natural.id && r.proof.mode === "self-level",
);
assert.equal(naturalRecord.packIdentity, "fpv-pack:" + pack.sha256);
const proof = (p) => ({
  courseIdentity: p.courseIdentity,
  worldIdentity: p.worldIdentity,
  mode: p.mode,
  frames: p.frames.length,
  responseIdentity: p.responseIdentity,
  rulesIdentity: p.rulesIdentity,
  finalStateIdentity: p.finalStateIdentity,
});
assert(
  yardProof.frames.length > 1250 && naturalRecord.proof.frames.length > 1250,
  "At least25s native reference in each selected demonstration",
);
const scenes = {
  yard: {
    id: yard.id,
    world: yard.world,
    title: yard.course.locales.en.title,
    profileId: resolveThemeProfile(yard.course).id,
    proof: proof(yardProof),
  },
  reservoir: {
    id: natural.id,
    world: pack.project.id,
    title: natural.locales.en.title,
    profileId: resolveThemeProfile(natural).id,
    proof: { id: naturalRecord.id, ...proof(naturalRecord.proof) },
  },
};
assert.equal(scenes.yard.profileId, "operations");
assert.equal(scenes.reservoir.profileId, "ukrainian");
await fs.mkdir(out);
const files = [];
async function record(name, b, provenance) {
  files.push({ path: name, bytes: b.length, sha256: sha(b), provenance });
}
async function link(name, source, b, provenance) {
  assert((await fs.lstat(source)).isFile());
  await fs.mkdir(path.dirname(path.join(out, name)), { recursive: true });
  await fs.link(source, path.join(out, name));
  assert((await fs.readFile(path.join(out, name))).equals(b));
  await record(name, b, provenance);
}
async function write(name, b) {
  b = Buffer.from(b);
  await fs.mkdir(path.dirname(path.join(out, name)), { recursive: true });
  await fs.writeFile(path.join(out, name), b, { flag: "wx" });
  await record(name, b, "Diagnostic observer/UI; production runtime unchanged");
}
for (const row of stage.files)
  await link(
    "player/" + row.path,
    path.join(player, row.path),
    await fs.readFile(path.join(player, row.path)),
    "Immutable exact admitted member",
  );
await link(
  "content/world.rlpack",
  packPath,
  packBytes,
  "Exact external original Reservoir r16 pack",
);
await link(
  "content/proofs.json",
  proofPath,
  proofBytes,
  "Explicit separate r16 proof archive",
);
for (const name of ["probe-host.mjs", "run.mjs"])
  await write(name, await fs.readFile(new URL(name, import.meta.url)));
const html = await fs.readFile(path.join(player, stage.entry), "utf8");
assert(
  html.includes('data-fpv-worlds="true"') &&
    html.includes('src="../civilian-fpv/world-app.mjs"'),
);
await write(
  "player/optional-practice/fpv-worlds/longer-host.html",
  html
    .replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"')
    .replace(
      'src="../civilian-fpv/world-app.mjs"',
      'src="../../../probe-host.mjs"',
    ),
);
await write(
  "index.html",
  `<!doctype html><meta charset="utf-8"><title>Bounded longer native sessions</title><style>body{margin:0;background:#101b20;color:#eee;font:14px system-ui}header{padding:8px;display:flex;gap:12px}button{font:inherit;padding:8px}iframe{display:block;border:0;width:100%;height:calc(100vh - 58px)}textarea{width:98%;height:220px}body[data-running=true] textarea{display:none}</style><header><button id="run">Run eight native windows</button><span id="status">About 3–5 minutes. Keep this visible; native clocks and pause guards stay active.</span></header><iframe id="sim" title="Exact integrated admitted player" src="about:blank"></iframe><label>Summary<textarea id="summary" readonly></textarea></label><label>Complete receipt; export in chunks up to 40000 characters<textarea id="receipt" readonly></textarea></label><script type="module" src="run.mjs"></script>`,
);
const manifest = {
  format: "FPVLongerNativeSessionFixture.v1",
  sourceRevision: revision,
  sourceTree: tree,
  admittedMembers: 102,
  overlays: [],
  inputs,
  files,
  scenes,
  pack: {
    id: pack.project.id,
    revision: pack.project.revision,
    sha256: pack.sha256,
    bytes: packBytes.length,
  },
  proofArchive: {
    bytes: proofBytes.length,
    sha256: sha(proofBytes),
    records: 16,
  },
  admission: {
    stageSHA256: sha(stageBytes),
    inventorySHA256: sha(inventoryBytes),
    archive: stage.zip,
  },
  matrix: ["yard", "reservoir", "yard", "reservoir"],
  windows: {
    count: 8,
    eachMs: 20000,
    phases: ["fixed-pose-ready", "verified-native-playback"],
  },
  resourcePlan:
    "Three same-owner Ready boundaries per scene, then owned-zero disposal and fresh-owner Ready reloads; internal renderer.info retained separately.",
  limits: [
    "Exact admitted production runtime; observer HTML is separate from unchanged native entry.",
    "No timing, art, hardware, offline or memory result implied by staging.",
    "Explicit external pack and separate proof import; no catalogue or storage-fault matrix.",
  ],
};
const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
await fs.writeFile(path.join(out, "fixture.json"), bytes, { flag: "wx" });
console.log(
  JSON.stringify({
    out,
    revision,
    files: files.length,
    fixtureSHA256: sha(bytes),
    overlays: 0,
  }),
);
