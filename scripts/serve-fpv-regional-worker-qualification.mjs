import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { frozenSource, committedInputMap, verifyCommittedInputs } from './frozen-source.mjs';

const page = 'scripts/fpv-regional-worker-qualification.html';
const helper = 'game/test/helpers/fpv-aircraft-regional-worker-qualification.mjs';
const worker = 'optional-practice/civilian-fpv/advanced-worker.mjs';
const serverPath = 'scripts/serve-fpv-regional-worker-qualification.mjs';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const child of Object.values(node))
    if (Array.isArray(child)) child.forEach((item) => walk(item, visit));
    else if (child && typeof child === 'object') walk(child, visit);
}
export function qualificationDependencies(text, filename) {
  const result = new Set();
  const add = (specifier) => {
    if (!specifier.startsWith('.')) throw new Error(`Unpinned browser dependency: ${specifier}`);
    const name = path.posix.normalize(path.posix.join(path.posix.dirname(filename), specifier));
    if (name.startsWith('../') || name.startsWith('/') || !/\.(m?js|json|wasm)$/.test(name))
      throw new Error(`Invalid qualification dependency: ${name}`);
    result.add(name);
  };
  walk(parse(text, { ecmaVersion: 'latest', sourceType: 'module' }), (node) => {
    if (
      ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) &&
      node.source
    )
      add(node.source.value);
    if (node.type === 'ImportExpression') {
      if (node.source.type !== 'Literal' || typeof node.source.value !== 'string')
        throw new Error('Unpinned dynamic import');
      add(node.source.value);
    }
    if (node.type === 'NewExpression' && node.callee?.name === 'URL') {
      const [first, second] = node.arguments;
      if (second?.type === 'MemberExpression' && second.object?.type === 'MetaProperty') {
        if (first?.type !== 'Literal' || typeof first.value !== 'string')
          throw new Error('Unpinned worker/resource URL');
        add(first.value);
      }
    }
  });
  return [...result];
}
export async function captureRegionalQualification(root) {
  const source = frozenSource(root),
    files = new Map(),
    pending = [helper, worker, 'optional-practice/civilian-fpv/advanced-worker-client.mjs'];
  while (pending.length) {
    const name = pending.pop();
    if (files.has(name)) continue;
    const bytes = await readFile(path.join(root, name));
    files.set(name, bytes);
    if (/\.m?js$/.test(name))
      pending.push(...qualificationDependencies(bytes.toString('utf8'), name));
  }
  for (const name of [page, serverPath, 'scripts/frozen-source.mjs'])
    files.set(name, await readFile(path.join(root, name)));
  verifyCommittedInputs(files, committedInputMap(root));
  const after = frozenSource(root);
  if (after.sourceRevision !== source.sourceRevision || after.sourceTree !== source.sourceTree)
    throw new Error('Qualification source changed during capture');
  const metadata = {
    ...source,
    inputs: [...files]
      .map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
  return { files, metadata };
}
export async function serveRegionalQualification({
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  port = 9241,
} = {}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('Use a local port from1024 to65535');
  const captured = await captureRegionalQualification(root),
    metadata = Buffer.from(JSON.stringify(captured.metadata, null, 2));
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const name = pathname === '/' ? page : pathname.slice(1);
    const bytes = pathname === '/source.json' ? metadata : captured.files.get(name);
    if (!['GET', 'HEAD'].includes(request.method) || !bytes) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': name.endsWith('.html')
        ? 'text/html; charset=utf-8'
        : name.endsWith('.wasm')
          ? 'application/wasm'
          : pathname === '/source.json'
            ? 'application/json'
            : 'text/javascript',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    ...captured,
    server,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
    url: `http://127.0.0.1:${port}/${page}`,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length > 3) throw new Error('Use [port]');
  const owner = await serveRegionalQualification({
    port: process.argv[2] === undefined ? 9241 : Number(process.argv[2]),
  });
  console.log(
    JSON.stringify({
      url: owner.url,
      sourceRevision: owner.metadata.sourceRevision,
      sourceTree: owner.metadata.sourceTree,
      pinnedFiles: owner.files.size,
    }),
  );
  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, async () => {
      if (closing) return;
      closing = true;
      await owner.close();
      process.exitCode = 0;
    });
}
