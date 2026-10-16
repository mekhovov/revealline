import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  REGION_LIMITS,
  validateRegionManifest,
  createRegionPlanner,
} from "./region-manifest.mjs";

/** Verifies bytes only. GLB, collision semantics, licenses and flight safety need admission. */
export async function inspectRegion(manifestPath, assetRoot = null) {
  const size = (await stat(manifestPath)).size;
  if (size > REGION_LIMITS.jsonBytes)
    throw new TypeError("Region JSON exceeds authoring limit");
  const manifest = validateRegionManifest(await readFile(manifestPath, "utf8"));
  if (assetRoot) {
    const root = await realpath(assetRoot);
    for (const asset of manifest.assets) {
      const file = await realpath(resolve(root, asset.path)),
        subpath = relative(root, file);
      if (
        !subpath ||
        subpath === ".." ||
        subpath.startsWith("../") ||
        isAbsolute(subpath)
      )
        throw new TypeError("Asset escapes content root");
      const details = await stat(file);
      if (!details.isFile() || details.size !== asset.bytes)
        throw new TypeError(`Asset size mismatch: ${asset.id}`);
      const bytes = await readFile(file);
      if (
        bytes.byteLength !== asset.bytes ||
        createHash("sha256").update(bytes).digest("hex") !== asset.sha256
      )
        throw new TypeError(`Asset hash mismatch: ${asset.id}`);
    }
  }
  const plan = createRegionPlanner(manifest);
  return {
    format: manifest.format,
    id: manifest.id,
    revision: manifest.revision,
    chunks: manifest.chunks.length,
    assets: manifest.assets.length,
    assetsVerified: Boolean(assetRoot),
    playerAdmitted: false,
    spawnPlans: manifest.spawns.map((spawn) => ({
      id: spawn.id,
      ...plan(spawn.position),
    })),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [manifestPath, flag, root, ...extra] = process.argv.slice(2);
  if (
    !manifestPath ||
    extra.length ||
    (flag && flag !== "--assets") ||
    (flag && !root)
  ) {
    console.error(
      "Usage: node inspect-region.mjs manifest.json [--assets content-directory]",
    );
    process.exitCode = 1;
  } else {
    try {
      console.log(
        JSON.stringify(
          await inspectRegion(
            resolve(manifestPath),
            flag ? resolve(root) : null,
          ),
          null,
          2,
        ),
      );
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
