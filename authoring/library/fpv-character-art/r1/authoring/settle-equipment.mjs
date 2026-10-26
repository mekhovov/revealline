// Bake rigid wardrobe into the same idle-frame-zero pose as assemble.py's
// damage regions. Nodes share existing meshes; binary geometry and textures
// remain byte-identical. No browser, graphics context or Blender run is needed.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const repo = process.env.FPV_REPO;
if (!repo) throw new Error("FPV_REPO must point to the application checkout.");
const { Matrix4, Quaternion, Vector3 } = await import(
  pathToFileURL(
    path.join(repo, "optional-practice/civilian-fpv/vendor/three.core.js"),
  )
);
const { prepareCombatAppearancePack } = await import(
  pathToFileURL(
    path.join(repo, "optional-practice/civilian-fpv/combat-appearance.mjs"),
  )
);
const base =
  process.env.FPV_ASSET_DIR ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bytes = await readFile(path.join(base, "characters.glb"));
const jsonLength = bytes.readUInt32LE(12);
const document = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binaryChunk = bytes.subarray(20 + jsonLength);
const binary = binaryChunk.subarray(8);
const manifest = JSON.parse(await readFile(path.join(base, "manifest.json")));
if (
  manifest.characters.some((c) => c.equipment?.some((item) => item.remainsRoot))
)
  throw new Error("Run finalize.mjs first; equipment is already settled.");
const originalNodes = structuredClone(document.nodes);
const names = new Map(originalNodes.map((node, index) => [node.name, index]));
const parents = new Map();
originalNodes.forEach((node, index) =>
  (node.children ?? []).forEach((child) => parents.set(child, index)),
);
const local = (node) =>
  node.matrix
    ? new Matrix4().fromArray(node.matrix)
    : new Matrix4().compose(
        new Vector3().fromArray(node.translation ?? [0, 0, 0]),
        new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
        new Vector3().fromArray(node.scale ?? [1, 1, 1]),
      );
const worlds = (nodes) => {
  const cache = new Map();
  const get = (index) => {
    if (index === undefined) throw new Error("Missing source equipment node.");
    if (!cache.has(index)) {
      const parent = parents.get(index);
      cache.set(
        index,
        (parent === undefined ? new Matrix4() : get(parent).clone()).multiply(
          local(nodes[index]),
        ),
      );
    }
    return cache.get(index);
  };
  return get;
};
const values = (index) => {
  const accessor = document.accessors[index];
  if (accessor.componentType !== 5126 || accessor.sparse || accessor.normalized)
    throw new Error("Pose baking requires dense float animation accessors.");
  const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type];
  if (!width) throw new Error("Unexpected animation accessor type.");
  const view = document.bufferViews[accessor.bufferView];
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return Array.from({ length: accessor.count }, (_, i) =>
    Array.from({ length: width }, (_, j) =>
      binary.readFloatLE(start + i * (view.byteStride ?? width * 4) + j * 4),
    ),
  );
};
const rest = worlds(originalNodes),
  posedByClip = new Map();
const posed = (clipName) => {
  if (!posedByClip.has(clipName)) {
    const clip = document.animations.find((row) => row.name === clipName);
    if (!clip) throw new Error("Missing idle animation.");
    const nodes = structuredClone(originalNodes);
    for (const channel of clip.channels) {
      const sampler = clip.samplers[channel.sampler];
      if (!["LINEAR", "STEP", undefined].includes(sampler.interpolation))
        throw new Error("Unsupported pose interpolation.");
      if (Math.abs(values(sampler.input)[0][0]) > 1e-7)
        throw new Error("Idle animation must start at frame zero.");
      if (!["translation", "rotation", "scale"].includes(channel.target.path))
        throw new Error("Unexpected pose animation target.");
      const node = nodes[channel.target.node];
      if (node.matrix) throw new Error("Animated node must use TRS.");
      node[channel.target.path] = values(sampler.output)[0];
    }
    posedByClip.set(clipName, worlds(nodes));
  }
  return posedByClip.get(clipName);
};
const copies = new Map(),
  report = [];
for (const character of manifest.characters) {
  for (const item of character.equipment ?? []) {
    const key = `${character.clips.idle}/${item.root}/${item.bone}`;
    if (!copies.has(key)) {
      const root = names.get(item.root),
        bone = names.get(item.bone);
      const matrix = posed(character.clips.idle)(bone)
        .clone()
        .multiply(rest(bone).clone().invert())
        .multiply(rest(root));
      const remainsRoot = `settled_${item.root}_${item.bone}`;
      if (remainsRoot.length > 80 || names.has(remainsRoot))
        throw new Error("Invalid settled node name.");
      const cloneBranch = (index, isRoot = false) => {
        const source = originalNodes[index],
          node = structuredClone(source);
        node.name = isRoot ? remainsRoot : `${remainsRoot}_${index}`;
        if (isRoot) {
          delete node.translation;
          delete node.rotation;
          delete node.scale;
          node.matrix = matrix.toArray();
        }
        const target = document.nodes.length;
        document.nodes.push(node);
        if (source.children)
          node.children = source.children.map((child) => cloneBranch(child));
        return target;
      };
      const newRoot = cloneBranch(root, true);
      document.scenes[document.scene ?? 0].nodes.push(newRoot);
      copies.set(key, remainsRoot);
      report.push({
        root: item.root,
        bone: item.bone,
        remainsRoot,
        matrix: matrix.toArray(),
      });
    }
    item.remainsRoot = copies.get(key);
  }
}
const json = Buffer.from(JSON.stringify(document));
const encoded = Buffer.concat([
  json,
  Buffer.alloc((4 - (json.length % 4)) % 4, 32),
]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + encoded.length + binaryChunk.length, 8);
header.writeUInt32LE(encoded.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const output = Buffer.concat([header, encoded, binaryChunk]);
const sha = (content) => createHash("sha256").update(content).digest("hex");
manifest.files[0].bytes = output.length;
manifest.files[0].sha256 = sha(output);
const manifestBytes = Buffer.from(JSON.stringify(manifest) + "\n");
const admitted = await prepareCombatAppearancePack({
  manifestBytes,
  sha256: sha(manifestBytes),
  assets: new Map([["characters.glb", output]]),
});
await writeFile(path.join(base, "characters.glb"), output);
await writeFile(path.join(base, "manifest.json"), manifestBytes);
await writeFile(
  path.join(base, "settled-equipment-report.json"),
  JSON.stringify(
    {
      sourceSHA256: sha(bytes),
      outputSHA256: sha(output),
      manifestSHA256: sha(manifestBytes),
      pose: "idle frame zero; bone-pose × inverse bone-rest × source equipment-world",
      rows: report,
      metrics: admitted.metrics,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    nodes: report.length,
    file: manifest.files[0],
    manifestSHA256: sha(manifestBytes),
    metrics: admitted.metrics,
  }),
);
