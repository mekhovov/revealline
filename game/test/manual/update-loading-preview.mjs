// Manual browser preview only. Does not run an automated test suite.
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const patched = new Set([
  'game/offline.mjs',
  'game/downloads.mjs',
  'game/download-initialization.mjs',
  'game/i18n/catalogs.mjs',
]);
const upstream = 'https://mekhovov.github.io/revealline/';
const saved = new Map();
let failNext = false;
let slowNext = false;
async function upstreamFile(path) {
  if (!saved.has(path))
    saved.set(
      path,
      fetch(new URL(path, upstream)).then(async (r) => ({
        status: r.status,
        type: r.headers.get('content-type') || 'application/octet-stream',
        bytes: Buffer.from(await r.arrayBuffer()),
      })),
    );
  return saved.get(path);
}
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1:8899');
      if (url.pathname === '/preview') {
        if (url.searchParams.has('fail')) {
          failNext = true;
          res.writeHead(303, { Location: '/revealline/app/update.html' });
          res.end();
          return;
        }
        if (url.searchParams.has('slow')) {
          slowNext = true;
          res.writeHead(303, { Location: '/revealline/app/update.html' });
          res.end();
          return;
        }
        res.setHeader('Content-Type', 'text/html');
        res.end(
          '<h1>Local update recovery preview</h1><p>Real published launcher and manifests, with local fixes. No game download starts automatically.</p><a href="/revealline/app/update.html">Open corrected updater</a><p><a href="/preview?fail">Fail next manifest request</a></p><p><a href="/preview?slow">Stall next manifest request</a></p>',
        );
        return;
      }
      if (!url.pathname.startsWith('/revealline/')) {
        res.writeHead(404);
        res.end();
        return;
      }
      const path = url.pathname.slice('/revealline/'.length);
      if (path === 'offline-cache.json' && (failNext || slowNext)) {
        if (slowNext) {
          slowNext = false;
          await new Promise((r) => setTimeout(r, 35000));
        } else {
          failNext = false;
          res.writeHead(503);
          res.end('Preview: interrupted metadata request');
          return;
        }
      }
      let value;
      if (patched.has(path))
        value = { status: 200, type: 'text/javascript', bytes: await readFile(`${root}/${path}`) };
      else value = await upstreamFile(path);
      if (path === 'game/downloads.html') {
        const local = await readFile(`${root}/${path}`, 'utf8');
        value = {
          ...value,
          bytes: Buffer.from(
            value.bytes
              .toString()
              .replace(/<body[^>]*>[\s\S]*<\/body>/, local.match(/<body[^>]*>[\s\S]*<\/body>/)[0]),
          ),
        };
      }
      res.writeHead(value.status, { 'Content-Type': value.type, 'Cache-Control': 'no-store' });
      res.end(value.bytes);
    } catch (error) {
      console.error(error.message);
      res.writeHead(500);
      res.end('Preview server failure');
    }
  })
  .listen(8899, '127.0.0.1', () => console.log('Update preview: http://127.0.0.1:8899/preview'));
