/** One password-gate projection for source pages and generated distribution pages. */
import { parse } from 'parse5';
import path from 'node:path';
import fs from 'node:fs/promises';

export function protectPageHTML(source, page, configSource, accessDirectory = 'game') {
  // Regenerate only the gate block; authored document bytes stay intact.
  if (!/<html\b/i.test(source))
    source = '<!doctype html><html>' + source.replace(/<!doctype[^>]*>/i, '') + '</html>';
  const protectedPage = source.includes('<!-- access-gate:start -->');
  const config = [
    ...configSource.matchAll(/<meta\s+name="revealline-access-[^"]+"\s+content="[^"]*"\s*\/?\s*>/g),
  ].map((match) => match[0]);
  if (config.length !== 4) throw new Error('The shared password configuration is incomplete.');
  const configByName = new Map(
    config.map((tag) => [tag.match(/name="([^"]+)"/)[1], tag.match(/content="([^"]*)"/)[1]]),
  );
  const edits = [];
  const visit = (node) => {
    const loc = node.sourceCodeLocation;
    if (loc && node.tagName) {
      const attrs = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
      const oldGate =
        (node.tagName === 'meta' && attrs.name?.startsWith('revealline-access-')) ||
        (node.tagName === 'script' && /(?:^|\/)access-gate\.mjs$/.test(attrs.src || '')) ||
        (node.tagName === 'link' && /(?:^|\/)access-gate\.css$/.test(attrs.href || ''));
      if (
        protectedPage &&
        node.tagName === 'meta' &&
        configByName.has(attrs.name) &&
        attrs.content !== configByName.get(attrs.name)
      ) {
        edits.push([
          loc.startOffset,
          loc.endOffset,
          source
            .slice(loc.startOffset, loc.endOffset)
            .replace(/content="[^"]*"/, `content="${configByName.get(attrs.name)}"`),
        ]);
      } else if (oldGate && !protectedPage) edits.push([loc.startOffset, loc.endOffset, '']);
      else if (
        !oldGate &&
        node.tagName === 'script' &&
        !('data-access-type' in attrs) &&
        (!attrs.type ||
          ['module', 'text/javascript', 'application/javascript'].includes(attrs.type))
      ) {
        const start = source
          .slice(loc.startTag.startOffset, loc.startTag.endOffset)
          .replace(/\s+type\s*=\s*(["'])[^"']*\1/i, '');
        edits.push([
          loc.startTag.startOffset,
          loc.startTag.endOffset,
          start.replace(
            />$/,
            ` type="application/x-revealline-locked" data-access-type="${attrs.type || ''}">`,
          ),
        ]);
      }
    }
    for (const child of node.childNodes || []) visit(child);
  };
  visit(parse(source, { sourceCodeLocationInfo: true }));
  for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0]))
    source = source.slice(0, start) + replacement + source.slice(end);
  if (protectedPage) return source;
  source = source.replace(/<meta\s+charset=["'][^"']+["']\s*\/?>/gi, '');
  const relative = path.posix.relative(path.posix.dirname(page), accessDirectory) || '.';
  const block = `<!-- access-gate:start -->\n${config.join('\n')}\n<style>html:not([data-access-state="unlocked"]) body > :not(#access-gate):not(script) { display: none !important; }</style>\n<link rel="stylesheet" href="${relative}/access-gate.css">\n<script src="${relative}/access-gate.mjs" defer></script>\n<!-- access-gate:end -->\n`;
  source = source.replace(
    /<html\b([^>]*)>/i,
    (_, attrs) =>
      `<html${attrs.replace(/\s+data-access-state="[^"]*"/g, '')} data-access-state="locked">`,
  );
  if (/<head\b[^>]*>/i.test(source))
    return source.replace(/<head\b[^>]*>/i, (head) => head + '\n<meta charset="utf-8">\n' + block);
  return source.replace(/<html\b[^>]*>/i, (html) => html + '\n<meta charset="utf-8">\n' + block);
}

export function protectPageEntries(entries) {
  const config = entries.find(({ name }) => name === 'game/index.html')?.bytes.toString();
  if (!config?.includes('revealline-access-id')) return; // Historical/minimal fixtures.
  for (const entry of entries.filter(({ name }) => name.endsWith('.html')))
    entry.bytes = Buffer.from(
      protectPageHTML(
        entry.bytes.toString(),
        entry.name,
        config,
        entry.name.startsWith('app/') ? 'app' : 'game',
      ),
    );
}

export async function protectSourcePages(root, { check = false } = {}) {
  const { collectBuildFiles, readBuildConfig } = await import('./game-cli.mjs');
  const config = await fs.readFile(path.join(root, 'game/index.html'), 'utf8');
  const files = (await collectBuildFiles(root, await readBuildConfig(root))).filter((file) =>
    file.endsWith('.html'),
  );
  if (!files.includes('game/offline/app.html')) files.push('game/offline/app.html');
  // Include legacy optional entries that remain directly reachable in source checkouts.
  for (const dir of ['optional-practice/civilian-flight'])
    for (const file of await fs.readdir(path.join(root, dir)))
      if (file.endsWith('.html') && !files.includes(`${dir}/${file}`)) files.push(`${dir}/${file}`);
  for (const file of files) {
    const original = await fs.readFile(path.join(root, file), 'utf8');
    const protectedHTML = protectPageHTML(original, file, config);
    if (check) {
      if (
        !original.includes('<!-- access-gate:start -->') ||
        /<script\b(?![^>]*access-gate\.mjs)(?![^>]*application\/x-revealline-locked)(?![^>]*application\/(?:ld\+json|json))[^>]*>/i.test(
          original,
        )
      )
        throw new Error(`Page is missing password protection: ${file}`);
    } else await fs.writeFile(path.join(root, file), protectedHTML);
  }
  return files;
}
