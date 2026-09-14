const make = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (className) el.className = className;
  return el;
};
export function revealReviewURLs(asset, pageURL = import.meta.url) {
  if (!/^[a-f0-9]{64}$/.test(asset?.file?.sha256) || asset.file.mime !== 'image/png')
    throw new Error('Invalid prepared reveal image reference.');
  const page = new URL(pageURL),
    local = ['localhost', '127.0.0.1', '[::1]'].includes(page.hostname);
  const filename = asset.file.path.split('/').at(-1);
  if (!/^[a-z0-9-]+\.png$/.test(filename)) throw new Error('Invalid prepared reveal filename.');
  const source = asset.provenance?.source?.path;
  return {
    compiled: new URL(
      '../../../../../game/presentation/compiled/assets/' + asset.file.sha256 + '.png',
      page,
    ).href,
    sourceDerivative: local ? new URL('./' + filename, page).href : null,
    sourceOriginal:
      local &&
      /^authoring\/library\/fpv-field-kit\/originals\/reveals\/[a-z0-9-]+\.png$/.test(source ?? '')
        ? new URL('../../../../../' + source, page).href
        : null,
  };
}
const image = (asset) => {
  const img = document.createElement('img');
  const urls = revealReviewURLs(asset);
  let fallback = false;
  img.addEventListener('error', () => {
    if (!fallback && urls.sourceDerivative) {
      fallback = true;
      img.src = urls.sourceDerivative;
    } else
      img.replaceWith(
        make(
          'p',
          'Prepared image unavailable in this build. Restore the matching compiled presentation and reload.',
        ),
      );
  });
  img.src = urls.compiled;
  img.width = asset.file.width;
  img.height = asset.file.height;
  img.style.height = 'auto';
  img.loading = 'lazy';
  img.alt = `${asset.compositionId}, prepared Field Kit reveal scene`;
  return img;
};
async function renderReview() {
  try {
    const response = await fetch('./reveals.json');
    if (!response.ok) throw new Error(`Manifest unavailable (${response.status}).`);
    const manifest = await response.json();
    document.querySelector('#status').textContent =
      `${manifest.produced.compositions} / ${manifest.planned.compositions} compositions · ${manifest.produced.exports} / ${manifest.planned.exports} exports · ${manifest.produced.owners} / ${manifest.planned.owners} exact owners · ${manifest.produced.totalPNGBytes.toLocaleString()} PNG bytes. ${manifest.missingCompositions.length ? 'Remaining compositions are still pending.' : 'All planned sources and exact exports produced; context review remains separate.'}`;
    for (const asset of manifest.assets) {
      const article = make('article');
      article.append(make('h2', asset.id));
      const preview = make('div', '', 'preview');
      preview.append(image(asset));
      article.append(preview);
      article.append(
        make(
          'p',
          `${asset.file.width} × ${asset.file.height} · ${asset.file.bytes.toLocaleString()} bytes · ${asset.slotIds.length} exact owner${asset.slotIds.length > 1 ? 's' : ''}`,
          'meta',
        ),
      );
      article.append(
        make(
          'p',
          `${asset.preparation.logicalWidth} × ${asset.preparation.logicalHeight} sampled grid · ${asset.preparation.integerScale}× integer clusters · ${asset.preparation.usedColors.length} colors`,
          'meta',
        ),
      );
      const native = make('details');
      native.append(make('summary', 'Native pixels · 1:1 scrollable frame'));
      const box = make('div', '', 'native');
      box.append(image(asset));
      native.append(box);
      article.append(native);
      const urls = revealReviewURLs(asset);
      if (urls.sourceOriginal) {
        const original = make('button', 'Locate unchanged original in source checkout');
        original.type = 'button';
        original.addEventListener('click', async () => {
          original.disabled = true;
          try {
            const response = await fetch(urls.sourceOriginal, { method: 'HEAD' });
            if (!response.ok) throw new Error('Original is not included here.');
            const link = make('a', 'Open unchanged generated original');
            link.href = urls.sourceOriginal;
            original.replaceWith(link);
          } catch {
            original.replaceWith(
              make(
                'p',
                'Original retained in the source repository; its path, dimensions and hash are in the provenance record.',
              ),
            );
          }
        });
        article.append(original);
      } else
        article.append(
          make(
            'p',
            'Original retained in the source repository. See the exact path and hash below.',
            'meta',
          ),
        );
      const details = make('details');
      details.append(make('summary', 'Crop, ownership and prompt'));
      details.append(
        make(
          'p',
          asset.preparation.cropDecision?.reason ??
            'Centered aspect crop; original source remains unchanged.',
        ),
      );
      details.append(
        make(
          'code',
          JSON.stringify({
            source: asset.provenance.source,
            crop: asset.preparation.sourceCrop,
            clippedEdgePixels: asset.preparation.clippedEdgePixels,
            owners: asset.slotIds,
          }),
        ),
      );
      const prompt = make('textarea');
      prompt.readOnly = true;
      prompt.value = asset.provenance.prompt;
      prompt.setAttribute(
        'aria-label',
        `Full effective generation prompt for ${asset.compositionId}`,
      );
      details.append(prompt);
      article.append(details);
      document.querySelector('#inventory').append(article);
    }
  } catch (error) {
    document.querySelector('#status').textContent =
      `${error.message} Restore this matching review manifest and reload.`;
  }
}
if (typeof document !== 'undefined') void renderReview();
