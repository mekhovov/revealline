import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const [sourceRoot, player, inventoryPath, revision, output, variant] =
  process.argv.slice(2);
if (
  ![sourceRoot, player, inventoryPath, output].every(
    (p) => p && path.isAbsolute(p),
  ) ||
  !/^[a-f0-9]{40}$/.test(revision ?? "")
)
  throw Error(
    "Use ABS_SOURCE_ROOT ABS_ADMITTED_PLAYER ABS_SOURCE_INVENTORY EXACT_COMMIT ABS_NEW_OUTPUT",
  );
if (!["baseline", "prepared"].includes(variant))
  throw Error("Require baseline or prepared variant");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) =>
  execFileSync("git", args, {
    cwd: sourceRoot,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
    maxBuffer: 16 * 1024 * 1024,
  });
const [stageBytes, inventoryBytes] = await Promise.all([
  fs.readFile(player + ".json"),
  fs.readFile(inventoryPath),
]);
const stage = JSON.parse(stageBytes),
  inventory = JSON.parse(inventoryBytes);
if (
  stage.files.length !== 102 ||
  inventory.inputs.length !== 95 ||
  stage.sourceRevision !== inventory.sourceRevision ||
  stage.sourceTree !== inventory.sourceTree ||
  !stage.checks.every((row) => row.passed)
)
  throw Error("Require exact retained102 member/95 source input admission.");
const overlays = new Map(),
  inputs = [];
const allowed = new Set([
  "optional-practice/civilian-fpv/world-app.mjs",
  "optional-practice/civilian-fpv/renderer.mjs",
]);
for (const row of inventory.inputs) {
  const bytes = git("show", revision + ":" + row.path),
    changed = bytes.length !== row.bytes || sha(bytes) !== row.sha256;
  if (changed && !allowed.has(row.path))
    throw Error("Unexpected main input: " + row.path);
  if (changed) overlays.set(row.path, bytes);
  inputs.push({
    path: row.path,
    bytes: bytes.length,
    sha256: sha(bytes),
    changed,
  });
}
if (overlays.size !== (variant === "prepared" ? 2 : 0))
  throw Error("Unexpected overlay count");
await fs.mkdir(output);
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
    throw Error("Changed admitted file: " + row.path);
  const name = "player/" + row.path,
    dest = path.join(output, name),
    overlay = overlays.get(row.path);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  if (overlay) await fs.writeFile(dest, overlay, { flag: "wx" });
  else await fs.link(src, dest);
  const actual = overlay ?? bytes;
  files.push({
    path: name,
    bytes: actual.length,
    sha256: sha(actual),
    provenance: overlay
      ? "declared committed warm-frame prototype overlay"
      : "immutable admitted member",
  });
}
for (const row of overlays.keys())
  if (!stage.files.some((f) => f.path === row))
    throw Error("Overlay is not a member");
const custom = async (name, bytes) => {
  await fs.writeFile(path.join(output, name), bytes, { flag: "wx" });
  files.push({
    path: name,
    bytes: Buffer.byteLength(bytes),
    sha256: sha(bytes),
    provenance: "observation fixture",
  });
};
for (const name of ["probe.mjs", "run.mjs", "native-programs.mjs"])
  await custom(name, await fs.readFile(new URL(name, import.meta.url)));
const html = await fs.readFile(
  path.join(player, "optional-practice/fpv-worlds/index.html"),
  "utf8",
);
if (
  !html.includes('data-fpv-worlds="true"') ||
  !html.includes('src="../civilian-fpv/world-app.mjs"')
)
  throw Error("Unexpected native HTML");
await custom(
  "player/optional-practice/fpv-worlds/first-ready-host.html",
  html
    .replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"')
    .replace('src="../civilian-fpv/world-app.mjs"', 'src="../../../probe.mjs"'),
);
await custom(
  "index.html",
  `<!doctype html><meta charset="utf-8"><title>Pre-ready frame resource qualification</title>
<style>body{margin:0;background:#101b20;color:#eee;font:14px system-ui}header{padding:8px;display:flex;gap:12px}button{font:inherit;padding:8px}iframe{display:block;border:0;width:100%;height:calc(100vh - 66px)}textarea{width:98%;height:220px}body[data-running=true] textarea{display:none}</style>
<header><button id="run">Run paused preparation check</button><span id="status">One player. Native clock.12 loads; first3 submissions and bounded GL signatures. Timings diagnostic only.</span></header>
<iframe id="sim" title="Frozen native FPV player" src="about:blank"></iframe>
<label>Complete receipt<textarea id="receipt" readonly></textarea></label><script type="module" src="run.mjs"></script>`,
);
const manifest = {
  format: "FPVFirstReadyFixture.v1",
  sourceRevision: revision,
  variant,
  warmupExpected: variant === "prepared",
  baseline: {
    sourceRevision: stage.sourceRevision,
    packageRevision: inventory.packageRevision,
    stageSha256: sha(stageBytes),
    inventorySha256: sha(inventoryBytes),
    archive: stage.zip,
  },
  inputs,
  files,
  limits: [
    "Source functional/CPU submission observation; no package, offline, FPS or GPU-elapsed acceptance.",
    "Existing rendererFactory wrappers return original methods/results; source overlay changes only declared warm-frame readiness; native clock/state/physics preserved.",
    "Fresh documents do not reset HTTP/OS/GPU caches. Integrity reads warm static files.",
    "Two original Yard courses differ in goals; timings cannot be subtracted to estimate pure actor cost.",
    "Native WebGL2 shaderSource/attachShader/linkProgram wrappers record bounded signatures only, with original arguments/results and no extra GL queries. This run's timings are diagnostic-only.",
  ],
};
const bytes = JSON.stringify(manifest, null, 2) + "\n";
await fs.writeFile(path.join(output, "fixture.json"), bytes, { flag: "wx" });
console.log(
  JSON.stringify({
    output,
    fixtureSha256: sha(bytes),
    files: files.length,
    overlays: [...overlays.keys()],
    sourceRevision: revision,
  }),
);
