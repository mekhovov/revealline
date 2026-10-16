import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildOptionalPractice } from '../../../../scripts/build-optional-practice.mjs';
import { OPTIONAL_PACKAGE_POLICIES } from '../../../../publishing/optional-package-policy.mjs';
import { OVERFLIGHT_BATTLEFIELDS } from '../../../../game/overflight/battlefields.mjs';
import {
  createOverflightProject,
  compileOverflightProject,
} from '../../../../game/overflight/project.mjs';
import { overflightAtlasInventory } from '../../../../game/overflight/atlas.mjs';
import { overflightWorldImageSlots } from '../../../../game/presentation/overflight-world-slots.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const baseline = '6e16bd5b9';
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
const priorSources = new Map();
const old = (name) => priorSources.get(name) ?? git('show', `${baseline}:${name}`);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const moduleURL = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const policyPath = 'publishing/optional-package-policy.mjs';
const oldPolicyURL = moduleURL(old(policyPath));
const previousPolicies = (await import(oldPolicyURL)).OPTIONAL_PACKAGE_POLICIES;
const baselinePaths = [
  ...new Set(
    ['civilian-flight', 'civilian-fpv', 'fpv-worlds'].flatMap((id) => {
      const policy = previousPolicies[id];
      return [...policy.localFiles.map((name) => policy.root + name), ...policy.sharedFiles];
    }),
  ),
];
const batch = execFileSync('git', ['cat-file', '--batch'], {
  cwd: root,
  maxBuffer: 64 * 1024 * 1024,
  input: baselinePaths.map((name) => `${baseline}:${name}`).join('\n') + '\n',
});
let offset = 0;
for (const name of baselinePaths) {
  const end = batch.indexOf(10, offset);
  const header = batch.subarray(offset, end).toString();
  const size = Number(header.split(' ')[2]);
  if (!Number.isInteger(size)) throw new Error(`Missing baseline source: ${name}`);
  priorSources.set(name, batch.subarray(end + 1, end + 1 + size));
  offset = end + size + 2;
}

const packages = [];
for (const packageId of ['civilian-flight', 'civilian-fpv', 'fpv-worlds']) {
  const current = await buildOptionalPractice(root, { packageId });
  // Compare exact policy-admitted source bytes; generated archive overhead is
  // reported separately for the current real standalone packages.
  const closure = async (policy, read) => {
    const names = [
      ...new Set([...policy.localFiles.map((name) => policy.root + name), ...policy.sharedFiles]),
    ];
    return {
      files: await Promise.all(
        names.sort().map(async (path) => {
          const data = await read(path);
          return { path, bytes: data.length, sha256: hash(data) };
        }),
      ),
    };
  };
  const before = await closure(previousPolicies[packageId], old);
  const after = await closure(OPTIONAL_PACKAGE_POLICIES[packageId], (name) =>
    readFile(new URL(`../../../../${name}`, import.meta.url)),
  );
  const bytes = (items) => items.reduce((total, item) => total + item.bytes, 0);
  const beforeByPath = new Map(before.files.map((file) => [file.path, file]));
  packages.push({
    packageId,
    standalone: {
      files: current.entries.length,
      manifestFiles: current.manifest.files.length,
      pinnedBytes: bytes(current.manifest.files),
      completeBytes: current.entries.reduce((total, entry) => total + entry.bytes.length, 0),
      zipBytes: current.zip.length,
      limits: current.manifest.limits,
      revision: current.manifest.revision,
    },
    sourceClosure: {
      baselineFiles: before.files.length,
      currentFiles: after.files.length,
      baselineBytes: bytes(before.files),
      currentBytes: bytes(after.files),
      deltaBytes: bytes(after.files) - bytes(before.files),
      added: after.files.filter((file) => !beforeByPath.has(file.path)),
      changed: after.files
        .filter(
          (file) =>
            beforeByPath.has(file.path) && file.sha256 !== beforeByPath.get(file.path).sha256,
        )
        .map((file) => ({
          path: file.path,
          beforeBytes: beforeByPath.get(file.path).bytes,
          bytes: file.bytes,
          deltaBytes: file.bytes - beforeByPath.get(file.path).bytes,
        })),
      files: after.files,
    },
  });
}
const worlds = OVERFLIGHT_BATTLEFIELDS.map((layout) => {
  const compiled = compileOverflightProject(
    createOverflightProject({ rulesVersion: 4, layout: layout.id }),
  );
  return {
    layout: layout.id,
    world: layout.world,
    visualIdentity: compiled.visualIdentity,
    selectedSlots: overflightWorldImageSlots(compiled.presentation),
    resources: [2048, 512].map((maxTextureSize) => {
      const atlas = overflightAtlasInventory({
        maxTextureSize,
        presentation: compiled.presentation,
        arena: compiled.arena,
      });
      return {
        maxTextureSize,
        frames: atlas.frames.length,
        pages: atlas.pages.length,
        worldTiles: atlas.worldTiles.length,
        textures: atlas.textures,
        spriteRGBABytes: atlas.spriteRGBABytes,
        worldRGBABytes: atlas.worldRGBABytes,
        baseRGBABytes: atlas.baseRGBABytes,
        retainedCanvasBytes: atlas.retainedCanvasBytes,
        preparationScratchBytes: atlas.preparationScratchBytes,
      };
    }),
  };
});
const result = {
  createdAt: new Date().toISOString(),
  commit: git('rev-parse', 'HEAD').toString().trim(),
  baseline: git('rev-parse', baseline).toString().trim(),
  evidence:
    'Actual in-memory optional package manifests and ZIP sizes; admitted source closure compares exact source bytes against baseline. The source delta excludes generated worker/manifest/icon overhead and is not a compressed archive delta or final full-site release size. Atlas counts are deterministic inventory; renderer lifecycle tests use the Phaser contract fake, not a physical GPU/context or browser-soak measurement. Decoded appearance images and Phaser render targets are separate from the listed atlas and retained preparation canvases.',
  packages,
  worlds,
};
await writeFile(
  new URL('./resource-accounting.json', import.meta.url),
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      ...result,
      packages: packages.map((item) => ({
        ...item,
        sourceClosure: { ...item.sourceClosure, files: undefined },
      })),
      worlds: [
        worlds[0],
        {
          layoutCount: worlds.length,
          uniqueWorlds: new Set(worlds.map((world) => world.world)).size,
        },
      ],
    },
    null,
    2,
  ),
);
