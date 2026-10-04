import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const [baseline, candidate, output] = process.argv.slice(2);
if (![baseline, candidate, output].every((p) => p && path.isAbsolute(p)))
  throw Error("ABS_BASELINE ABS_CANDIDATE ABS_NEW_OUTPUT");
const sha = (b) => createHash("sha256").update(b).digest("hex"),
  files = [],
  variants = [];
await fs.mkdir(output);
for (const [variant, root] of [
  ["baseline", baseline],
  ["candidate", candidate],
]) {
  const bytes = await fs.readFile(path.join(root, "fixture.json")),
    manifest = JSON.parse(bytes);
  if (
    manifest.files.length !== 106 ||
    manifest.overlays.length !== 1 ||
    manifest.inputs.length !== 95
  )
    throw Error("Expected frozen source fixture");
  variants.push({
    variant,
    manifestSha256: sha(bytes),
    sourceRevision: manifest.sourceRevision,
    inputs: manifest.inputs,
    overlays: manifest.overlays,
    admission: manifest.admission,
  });
  for (const row of manifest.files) {
    const src = path.join(root, row.path),
      data = await fs.readFile(src);
    if (data.length !== row.bytes || sha(data) !== row.sha256)
      throw Error("Changed " + row.path);
    const name = variant + "/" + row.path,
      dest = path.join(output, name);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.link(src, dest);
    files.push({ ...row, path: name });
  }
}
async function custom(name, bytes) {
  await fs.writeFile(path.join(output, name), bytes, { flag: "wx" });
  files.push({
    path: name,
    bytes: Buffer.byteLength(bytes),
    sha256: sha(bytes),
    provenance: "manual functional fixture",
  });
}
await custom("run.mjs", await fs.readFile(new URL("run.mjs", import.meta.url)));
await custom(
  "index.html",
  `<!doctype html><meta charset="utf-8"><title>Native HUD and stick layout comparison</title><style>body{margin:0;background:#142029;color:white;font:14px system-ui}header{padding:8px}button{font:inherit;padding:8px}iframe{display:block;border:0;width:1024px;height:720px}textarea{width:98%;height:180px}</style><header><button id="run">Compare native HUD and stick layouts</button><span id="status">Sequential baseline and candidate. No timing measurement in this run.</span></header><iframe id="sim" title="Native layout comparison" src="about:blank"></iframe><label>Summary<textarea id="summary" readonly></textarea></label><label>Complete receipt<textarea id="receipt" readonly></textarea></label><script type="module" src="run.mjs"></script>`,
);
const value = { format: "FPVHUDLayoutFunctionalFixture.v1", variants, files };
const bytes = JSON.stringify(value, null, 2) + "\n";
await fs.writeFile(path.join(output, "fixture.json"), bytes, { flag: "wx" });
console.log(
  JSON.stringify({ output, files: files.length, sha256: sha(bytes) }),
);
