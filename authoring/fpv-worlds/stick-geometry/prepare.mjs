import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const [root, revision, out] = process.argv.slice(2);
assert(
  path.isAbsolute(root) &&
    path.isAbsolute(out) &&
    /^[a-f0-9]{40}$/.test(revision),
);
const player = "/private/tmp/fpv-combined-final-player-0b54fd0fd";
const inventoryPath =
  "/private/tmp/fpv-combined-final-admission-0b54fd0fd/source-inventory-optional-fpv-worlds.json";
const oldFixture = "/private/tmp/fpv-longer-sessions-0b54-r1";
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
  inventory = JSON.parse(inventoryBytes),
  oldBytes = await fs.readFile(path.join(oldFixture, "fixture.json"));
assert.equal(
  sha(oldBytes),
  "a2ca92b3e1f6424a3ab543867f3e38d9cbf860e7ab38eee3b1fe20245a6a405a",
);
const old = JSON.parse(oldBytes);
assert.equal(stage.sourceRevision, "0b54fd0fdf8fe06dc900024a8b59713340b09bb3");
assert.equal(stage.sourceRevision, inventory.sourceRevision);
assert.equal(stage.sourceTree, inventory.sourceTree);
assert.equal(stage.files.length, 102);
assert.equal(inventory.inputs.length, 95);
assert(stage.checks.every((x) => x.passed));
const baseline = "21826c460e80fa4e7fa47ec8e6ba9f98f75beea4",
  hostPath = "optional-practice/civilian-fpv/world-app.mjs";
const variants = [];
for (const [name, ref] of [
  ["baseline", baseline],
  ["candidate", revision],
]) {
  const inputs = [],
    overlays = [];
  for (const row of inventory.inputs) {
    const bytes = git("show", ref + ":" + row.path),
      changed = sha(bytes) !== row.sha256 || bytes.length !== row.bytes;
    if (changed) {
      assert.equal(row.path, hostPath);
      overlays.push({
        path: row.path,
        bytes: bytes.length,
        sha256: sha(bytes),
      });
    }
    inputs.push({ ...row, bytes: bytes.length, sha256: sha(bytes), changed });
  }
  assert.equal(overlays.length, name === "baseline" ? 0 : 1);
  variants.push({
    name,
    revision: ref,
    tree: git("rev-parse", ref + "^{tree}")
      .toString()
      .trim(),
    inputs,
    overlays,
  });
}
for (const row of stage.files) {
  const b = await fs.readFile(path.join(player, row.path));
  assert.equal(b.length, row.bytes);
  assert.equal(sha(b), row.sha256);
}
await fs.mkdir(out);
const files = [];
async function write(name, b, provenance) {
  b = Buffer.from(b);
  const dest = path.join(out, name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, b, { flag: "wx" });
  files.push({ path: name, bytes: b.length, sha256: sha(b), provenance });
}
async function link(name, src, row, provenance) {
  const b = await fs.readFile(src);
  assert.equal(b.length, row.bytes);
  assert.equal(sha(b), row.sha256);
  const dest = path.join(out, name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.link(src, dest);
  files.push({ path: name, bytes: b.length, sha256: sha(b), provenance });
}
const html = await fs.readFile(path.join(player, stage.entry), "utf8");
assert(
  html.includes('data-fpv-worlds="true"') &&
    html.includes('src="../civilian-fpv/world-app.mjs"'),
);
for (const v of variants) {
  for (const row of stage.files) {
    const name = v.name + "/player/" + row.path;
    if (v.overlays.some((r) => r.path === row.path))
      await write(
        name,
        git("show", revision + ":" + row.path),
        "Exact committed source overlay",
      );
    else
      await link(
        name,
        path.join(player, row.path),
        row,
        "Exact immutable admitted member",
      );
  }
  await write(
    v.name + "/probe-host.mjs",
    await fs.readFile(new URL("probe-host.mjs", import.meta.url)),
    "Transparent native observation",
  );
  await write(
    v.name + "/player/optional-practice/fpv-worlds/steady-host.html",
    html
      .replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"')
      .replace(
        'src="../civilian-fpv/world-app.mjs"',
        'src="../../../probe-host.mjs"',
      ),
    "Native-depth diagnostic entry; original102 files retained",
  );
}
for (const name of ["content/world.rlpack", "content/proofs.json"]) {
  const row = old.files.find((r) => r.path === name);
  assert(row);
  await link(
    name,
    path.join(oldFixture, name),
    row,
    "Unchanged exact r16 data, separate proof import",
  );
}
for (const name of ["functional.mjs", "timing.mjs"])
  await write(
    name,
    await fs.readFile(new URL(name, import.meta.url)),
    "Manual public-control fixture",
  );
for (const [file, script, title, label] of [
  [
    "index.html",
    "functional.mjs",
    "Exact stick geometry comparison",
    "Compare native stick geometry",
  ],
  [
    "timing.html",
    "timing.mjs",
    "Matched native stick sizing CPU",
    "Measure eight native windows",
  ],
])
  await write(
    file,
    `<!doctype html><meta charset="utf-8"><title>${title}</title><style>body{margin:0;background:#142029;color:#fff;font:14px system-ui}header{padding:8px;display:flex;gap:12px}button{font:inherit;padding:8px}iframe{display:block;border:0;width:1024px;height:720px}textarea{width:98%;height:180px}body[data-running=true] textarea{display:none}</style><header><button id="run">${label}</button><button id="continue" hidden>Continue after fullscreen check</button><span id="status">Baseline and candidate have102 pinned members each; candidate has one declared host overlay.</span></header><iframe id="sim" title="Native stick geometry qualification" allow="fullscreen" src="about:blank"></iframe><label>Summary<textarea id="summary" readonly></textarea></label><label>Complete receipt (read in40000-character chunks)<textarea id="receipt" readonly></textarea></label><script type="module" src="${script}"></script>`,
    "Manual fixture UI",
  );
const manifest = {
  format: "FPVStickGeometryFixture.v1",
  variants,
  files,
  scenes: old.scenes,
  pack: old.pack,
  proofArchive: old.proofArchive,
  admission: {
    revision: stage.sourceRevision,
    tree: stage.sourceTree,
    stageSHA256: sha(stageBytes),
    inventorySHA256: sha(inventoryBytes),
    archive: stage.zip,
  },
  notes: [
    "Baseline95 equals currentmain21826 and admitted0b54; candidate is one exact committed host overlay.",
    "Academy runtime remains unchanged; the modified helper belongs only to Worlds.",
    "No production API/clock/state/physics substitution. Optional absent-ResizeObserver host is an explicitly named capability diagnostic.",
  ],
};
await fs.writeFile(
  path.join(out, "fixture.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    out,
    files: files.length,
    variants: variants.map((v) => ({
      name: v.name,
      revision: v.revision,
      overlays: v.overlays,
    })),
    sha256: sha(await fs.readFile(path.join(out, "fixture.json"))),
  }),
);
