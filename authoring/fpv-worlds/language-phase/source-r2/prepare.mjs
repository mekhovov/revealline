import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const [root, player, inventoryPath, baseline, candidate, out] =
  process.argv.slice(2);
if (
  ![root, player, inventoryPath, out].every((p) => p && path.isAbsolute(p)) ||
  ![baseline, candidate].every((r) => /^[a-f0-9]{40}$/.test(r ?? ""))
)
  throw Error(
    "ABS_ROOT ABS_PLAYER ABS_INVENTORY BASELINE_COMMIT CANDIDATE_COMMIT ABS_NEW_OUTPUT",
  );
const hash = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) =>
  execFileSync("git", args, {
    cwd: root,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
    maxBuffer: 20 * 1024 * 1024,
  });
const stageBytes = await fs.readFile(player + ".json"),
  inventoryBytes = await fs.readFile(inventoryPath);
const stage = JSON.parse(stageBytes),
  inventory = JSON.parse(inventoryBytes);
if (
  stage.files.length !== 102 ||
  inventory.inputs.length !== 95 ||
  stage.sourceRevision !== inventory.sourceRevision ||
  stage.sourceTree !== inventory.sourceTree ||
  !stage.checks.every((c) => c.passed)
)
  throw Error("Exact admitted 102-member/95-input baseline required");
await fs.mkdir(out);
const files = [],
  variants = [];
async function write(name, bytes, provenance = "manual fixture") {
  const dest = path.join(out, name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, bytes, { flag: "wx" });
  files.push({
    path: name,
    bytes: Buffer.byteLength(bytes),
    sha256: hash(bytes),
    provenance,
  });
}
for (const [name, revision, delta] of [
  ["baseline", baseline, 0],
  ["candidate", candidate, 105],
]) {
  const inputs = [],
    overlays = new Map();
  for (const row of inventory.inputs) {
    const bytes = git("show", revision + ":" + row.path),
      sha256 = hash(bytes);
    const changed = bytes.length !== row.bytes || sha256 !== row.sha256;
    if (changed) {
      if (
        row.path !== "optional-practice/civilian-fpv/world-app.mjs" ||
        bytes.length !== row.bytes + delta ||
        delta === 0
      )
        throw Error("Unexpected original input " + name + " " + row.path);
      overlays.set(row.path, bytes);
    }
    inputs.push({ ...row, bytes: bytes.length, sha256, changed });
  }
  if (overlays.size !== (delta ? 1 : 0))
    throw Error("Unexpected overlay count");
  for (const row of stage.files) {
    if (!/^[\w./-]+$/.test(row.path) || row.path.split("/").includes(".."))
      throw Error("Unsafe member");
    const src = path.join(player, row.path),
      bytes = await fs.readFile(src),
      dest = name + "/player/" + row.path;
    if (bytes.length !== row.bytes || hash(bytes) !== row.sha256)
      throw Error("Changed retained member " + row.path);
    if (overlays.has(row.path))
      await write(
        dest,
        overlays.get(row.path),
        "committed language-phase source overlay",
      );
    else {
      await fs.mkdir(path.dirname(path.join(out, dest)), { recursive: true });
      await fs.link(src, path.join(out, dest));
      files.push({
        ...row,
        path: dest,
        provenance: "immutable admitted member",
      });
    }
  }
  await write(
    name + "/host.mjs",
    await fs.readFile(new URL("host.mjs", import.meta.url)),
  );
  const html = await fs.readFile(
    path.join(player, "optional-practice/fpv-worlds/index.html"),
    "utf8",
  );
  if (
    !html.includes('data-fpv-worlds="true"') ||
    !html.includes('src="../civilian-fpv/world-app.mjs"')
  )
    throw Error("Native HTML changed");
  await write(
    name + "/player/optional-practice/fpv-worlds/phase-host.html",
    html
      .replace('data-fpv-worlds="true"', 'data-fpv-worlds="profile"')
      .replace(
        'src="../civilian-fpv/world-app.mjs"',
        'src="../../../host.mjs"',
      ),
  );
  variants.push({
    name,
    revision,
    inputs,
    overlays: [...overlays.keys()],
    sourceDelta: delta,
  });
}
for (const name of ["run.mjs", "diagnostic.rlpack"])
  await write(name, await fs.readFile(new URL(name, import.meta.url)));
await write(
  "index.html",
  '<!doctype html><meta charset="utf-8"><title>Language repaint phase ownership</title><style>body{margin:0;background:#142029;color:white;font:14px system-ui}header{padding:10px}button{font:inherit;padding:8px}iframe{display:block;border:0;width:100%;height:760px}textarea{width:98%;height:220px}pre{white-space:pre-wrap}</style><header><button id="run">Run bounded phase ownership comparison</button> <span id="status">Two fresh native hosts, sequentially disposed. No clock or flight-state changes.</span></header><iframe id="sim" title="Native phase ownership player" src="about:blank"></iframe><pre id="summary"></pre><label>Full receipt<textarea id="receipt" readonly></textarea></label><script type="module" src="run.mjs"></script>',
);
const manifest = {
  format: "FPVLanguagePhaseFixture.v1",
  baseline: {
    sourceRevision: stage.sourceRevision,
    sourceTree: stage.sourceTree,
    stageSHA256: hash(stageBytes),
    inventorySHA256: hash(inventoryBytes),
    zip: stage.zip,
  },
  variants,
  files,
  limitations: [
    "Source-only candidate host overlay; other 101 admitted members exact. Baseline all 102 members exact.",
    "Own iframe native IndexedDB, real diagnostic practice recording, public DOM controls; no clock, flight-state, guard or proof injection.",
    "Language is publicly reachable through Settings, which pauses active flight; no actively-flying language input is invented.",
    "No FPS, new offline or broad browser/device claim.",
  ],
};
const data = JSON.stringify(manifest, null, 2) + "\n";
await fs.writeFile(path.join(out, "fixture.json"), data, { flag: "wx" });
console.log(
  JSON.stringify({
    out,
    candidate,
    baseline,
    fixtureSHA256: hash(data),
    files: files.length,
    variants: variants.map((v) => ({
      name: v.name,
      overlays: v.overlays,
      sourceDelta: v.sourceDelta,
    })),
  }),
);
