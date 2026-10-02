import { readFile, writeFile } from 'node:fs/promises';

const directory = new URL('../authoring/library/neon-artwork/', import.meta.url);
export function buildNeonArtworkGallery(images) {
  const escape = (text) =>
    text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const groups = [
    ['neon-reference-pack', 'Neon Reference Pack'],
    ['neon-mosaic-pack', 'Neon Words & Symbols'],
  ];
  const sections = groups
    .map(
      ([id, name]) => `<section aria-labelledby="${id}">
  <h2 id="${id}">${name}</h2><div class="gallery">${images
    .filter((entry) => entry.packId === id)
    .map(
      (entry) => `
  <article data-ui-surface="panel" id="${entry.id}">
    <a href="${entry.file}" aria-label="Open ${escape(entry.title)} artwork">
      <img src="${entry.file}" alt="${escape(entry.title)} reveal illustration" width="1024" height="512" loading="lazy" decoding="async">
    </a><h3>${escape(entry.title)}</h3>
  </article>`,
    )
    .join('')}</div></section>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Neon reveal artwork · FPV / LINE</title>
<script src="../../../game/presentation/theme-bootstrap.mjs" data-theme-density="studio" data-theme-follow-context="true"></script>
<link rel="stylesheet" href="../../../game/presentation/industrial-workshop.css" data-industrial-workshop>
<script type="module" src="../../../game/presentation/theme-entry.mjs"></script>
<style>@layer legacy {
:root{color-scheme:dark;font:16px/1.5 system-ui,sans-serif;background:#070b14;color:#e0ecfa}
body{max-width:1500px;margin:auto;padding:36px 24px 80px}h1{font-size:clamp(2rem,4vw,3.4rem);line-height:1.1;margin:.4em 0;color:#99edff}
header{max-width:850px;margin-bottom:48px}p{color:#adc0d5}a{color:#9fe8ff}nav{display:flex;flex-wrap:wrap;gap:16px}h2{font-size:1.7rem;margin:44px 0 20px}
.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,350px),1fr));gap:24px}
article{overflow:hidden;background:#101b2c;border:1px solid #28435c;border-radius:12px}article a{display:block}img{display:block;width:100%;height:auto;aspect-ratio:2/1;object-fit:contain;background:#030810}h3{font-size:1rem;margin:14px 18px}a:focus-visible{outline:3px solid #ffd785;outline-offset:4px}
}</style></head><body><header><p>FPV / LINE · Art collection</p><h1>Pictures worth revealing.</h1>
<p>54 original illustrations, each matched to its arena. Cinematic neon environments for the reference layouts; lettering, craft, nature and cultural motifs for Words &amp; Symbols.</p>
<nav aria-label="Artwork sections"><a href="#neon-reference-pack">16 reference levels</a><a href="#neon-mosaic-pack">38 words &amp; symbols</a><a href="../neon-mosaic/">View symbol layouts</a><a href="../../../game/?journey=legacy">Open game</a></nav>
<p>AI-assisted original illustrations created with the built-in image generation tool. Cultural pictures are artistic interpretations; <a href="../neon-mosaic/references.json">research references</a> and <a href="prompts.json">effective prompts</a> are retained.</p></header>
<main>${sections}</main></body></html>\n`;
}
if (process.argv[1] && new URL(process.argv[1], 'file:').href === import.meta.url) {
  const images = JSON.parse(await readFile(new URL('prompts.json', directory), 'utf8'));
  await writeFile(new URL('index.html', directory), buildNeonArtworkGallery(images));
  console.log(`Neon artwork gallery: ${images.length} illustrations.`);
}
