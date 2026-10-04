import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const [root, player, inventoryPath, revision, output] = process.argv.slice(2);
if (
  ![root, player, inventoryPath, output].every((p) => p && path.isAbsolute(p))
)
  throw Error(
    "Use ABS_ROOT ABS_ADMITTED_PLAYER ABS_SOURCE_INVENTORY EXACT_REVISION ABS_NEW_OUTPUT",
  );
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const [stageBytes, inventoryBytes] = await Promise.all([
  fs.readFile(player + ".json"),
  fs.readFile(inventoryPath),
]);
const stage = JSON.parse(stageBytes),
  inventory = JSON.parse(inventoryBytes);
if (
  stage.sourceRevision !== "8df41944e5014725046b04621b3a82d3284a157e" ||
  stage.files.length !== 102 ||
  inventory.inputs.length !== 95 ||
  stage.sourceRevision !== inventory.sourceRevision ||
  stage.sourceTree !== inventory.sourceTree ||
  !stage.checks.every((c) => c.passed)
)
  throw Error(
    "Require exact admitted8df102/95 closure and passing staging checks",
  );
if (!/^[a-f0-9]{40}$/.test(revision))
  throw Error("Exact committed source required");
const inputs = [],
  overlays = new Map();
for (const row of inventory.inputs) {
  const bytes = execFileSync("git", ["show", revision + ":" + row.path], {
    cwd: root,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
    maxBuffer: 20 * 1024 * 1024,
  });
  const changed = bytes.length !== row.bytes || sha(bytes) !== row.sha256;
  if (changed) {
    if (row.path !== "optional-practice/civilian-fpv/world-app.mjs")
      throw Error("Unexpected overlay " + row.path);
    overlays.set(row.path, bytes);
  }
  inputs.push({ ...row, bytes: bytes.length, sha256: sha(bytes), changed });
}
if (overlays.size !== 1) throw Error("One exact host overlay required");
await fs.mkdir(output); // Refuse replacement of frozen or failed fixtures.
const files = [];
for (const row of stage.files) {
  if (
    !/^[a-zA-Z0-9_./-]+$/.test(row.path) ||
    row.path.split("/").includes("..")
  )
    throw Error("Unsafe member");
  const src = path.join(player, row.path),
    bytes = await fs.readFile(src);
  if (bytes.length !== row.bytes || sha(bytes) !== row.sha256)
    throw Error("Changed admitted member " + row.path);
  const name = "player/" + row.path,
    dest = path.join(output, name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const actual = overlays.get(row.path) ?? bytes;
  if (overlays.has(row.path)) await fs.writeFile(dest, actual, { flag: "wx" });
  else await fs.link(src, dest);
  files.push({
    path: name,
    bytes: actual.length,
    sha256: sha(actual),
    provenance: overlays.has(row.path)
      ? "declared committed host overlay"
      : "immutable admitted member",
  });
}
const custom = async (name, bytes) => {
  await fs.writeFile(path.join(output, name), bytes, { flag: "wx" });
  files.push({
    path: name,
    bytes: Buffer.byteLength(bytes),
    sha256: sha(bytes),
    provenance: "observation fixture",
  });
};
for (const name of ["probe-host.mjs", "run.mjs"])
  await custom(name, await fs.readFile(new URL(name, import.meta.url)));
const html = await fs.readFile(path.join(player, stage.entry), "utf8");
if (
  !html.includes('data-fpv-worlds="true"') ||
  !html.includes('src="../civilian-fpv/world-app.mjs"')
)
  throw Error("Unexpected native HTML");
await custom(
  "player/optional-practice/fpv-worlds/steady-host.html",
  html
    .replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"')
    .replace(
      'src="../civilian-fpv/world-app.mjs"',
      'src="../../../probe-host.mjs"',
    ),
);
await custom(
  "index.html",
  `<!doctype html><meta charset="utf-8"><title>Bounded steady-flight attribution</title>
<style>body{margin:0;background:#101b20;color:#eee;font:14px system-ui}header{padding:8px;display:flex;gap:12px}button{font:inherit;padding:8px}iframe{display:block;border:0;width:100%;height:calc(100vh - 58px)}textarea{width:98%;height:220px}body[data-running=true] textarea{display:none}</style>
<header><button id="run">Run eight bounded windows</button><span id="status">One visible player; native clocks and public controls. About1minute; keep this tab visible.</span></header>
<iframe id="sim" title="Exact admitted FPV player" src="about:blank"></iframe><label>Compact summary<textarea id="summary" readonly></textarea></label><label>Complete receipt (export in chunks up to40000characters)<textarea id="receipt" readonly></textarea></label><script type="module" src="run.mjs"></script>`,
);
const manifest = {
  format: "FPVSteadyFlightFixture.v1",
  sourceRevision: revision,
  sourceTree: execFileSync("git", ["rev-parse", revision + "^{tree}"], {
    cwd: root,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
  })
    .toString()
    .trim(),
  baselineRevision: stage.sourceRevision,
  admittedMembers: 102,
  overlays: [...overlays.keys()],
  inputs,
  files,
  admission: {
    packageRevision: inventory.packageRevision,
    stageSha256: sha(stageBytes),
    inventorySha256: sha(inventoryBytes),
    archive: stage.zip,
  },
  limits: [
    "Historical8df admitted closure with one explicit committed host overlay. Source qualification, not new admission or latest public-player acceptance.",
    "The102 baseline hashes are checked; only world-app is copied from the exact named commit. All other members are immutable hardlinks.",
    "Eight5-second native-clock windows aggregate only; root owns native browser execution. No GPU elapsed, hardware/FPS or optimization acceptance.",
  ],
};
const bytes = JSON.stringify(manifest, null, 2) + "\n";
await fs.writeFile(path.join(output, "fixture.json"), bytes, { flag: "wx" });
console.log(
  JSON.stringify({
    output,
    fixtureSha256: sha(bytes),
    files: files.length,
    sourceRevision: revision,
    overlays: [...overlays.keys()],
  }),
);
