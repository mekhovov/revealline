import { installOptionalLauncher } from '../optional-practice/launcher-template.mjs';
import { installPracticeWorker } from '../optional-practice/civilian-flight/worker-template.mjs';
import { createHash } from 'node:crypto';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
export function buildOptionalLauncher({ packageId, basePath, entries, contextSource }) {
  if (
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(packageId) ||
    !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath)
  )
    throw new Error('Optional launcher needs a stable package and absolute target directory.');
  const root = `${basePath}practice/${packageId}/`;
  const original = JSON.parse(entries.get(`optional-practice/${packageId}/app.webmanifest`));
  const installation = {
    basePath,
    id: root,
    scope: root,
    startURL: `${root}app/`,
    launcherRoot: 'launcher/',
  };
  const manifest = {
    ...original,
    id: root,
    scope: root,
    start_url: installation.startURL,
    icons: original.icons.map((icon) => ({
      ...icon,
      src: `${root}app/${icon.src.replace(/^\.\//, '')}`,
    })),
  };
  entries.set(`optional-practice/${packageId}/app.webmanifest`, json(manifest));
  const launcher = new Map([
    [
      'index.html',
      Buffer.from(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="manifest" href="./app.webmanifest"><title>Flight practice</title><style>body{font:1.2rem system-ui;background:#10231f;color:#f2fbf8;max-width:48rem;padding:clamp(1rem,5vw,4rem);margin:auto}a,button,select{display:block;margin:1rem 0;padding:.9rem;font:inherit;color:inherit;background:#24463d;border:2px solid #94cabb}a:focus-visible,button:focus-visible,select:focus-visible{outline:3px solid #fff;outline-offset:4px}[hidden]{display:none}</style></head><body><main><label>Language / Мова<select id="locale"><option value="en">English</option><option value="uk">Українська</option></select></label><h1 id="title"></h1><p id="status" role="status"></p><a id="open" hidden></a><button id="check" type="button"></button><a id="prepare" hidden></a><a id="previous" hidden></a></main><script type="module" src="./app.mjs"></script></body></html>\n',
      ),
    ],
    [
      'app.mjs',
      Buffer.from(
        `import { optionalInstallationKey, validateOptionalInstallationReference } from './context.mjs';\n(${installOptionalLauncher.toString()})(${JSON.stringify({ packageId, root })}, { optionalInstallationKey, validateOptionalInstallationReference });\n`,
      ),
    ],
    ['context.mjs', contextSource],
    ['app.webmanifest', json(manifest)],
    ...[192, 512].map((size) => [
      `icons/icon-${size}.png`,
      entries.get(`optional-practice/${packageId}/icons/icon-${size}.png`),
    ]),
  ]);
  const pins = [...launcher].map(([path, bytes]) => ({
    path,
    bytes: bytes.length,
    sha256: hash(bytes),
  }));
  const revision = hash(Buffer.from(JSON.stringify(pins)));
  launcher.set(
    'worker.js',
    Buffer.from(
      `// Generated exact optional launcher cache.\n(${installPracticeWorker.toString()})(self, ${JSON.stringify(pins)}, ${JSON.stringify(revision)});\n`,
    ),
  );
  for (const [name, bytes] of launcher) entries.set(`launcher/${name}`, bytes);
  return installation;
}
