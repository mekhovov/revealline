const status = document.querySelector('#status');
try {
  const response = await fetch('./study.json');
  if (!response.ok) throw new Error('Study metadata unavailable.');
  const study = await response.json();
  const source = new Image();
  source.src = study.file;
  await source.decode();
  if (source.naturalWidth !== study.dimensions[0] || source.naturalHeight !== study.dimensions[1]) {
    throw new Error('Source dimensions differ from the recorded study.');
  }
  let heading = 0;
  let background = 0;
  const palettes = ['#000000', '#243947', '#baaa84'];
  const painters = [];
  for (const item of study.items) {
    const article = document.createElement('article');
    const title = document.createElement('h2');
    title.textContent = item.label;
    const details = document.createElement('p');
    details.textContent = item.purpose;
    const sizes = document.createElement('div');
    sizes.className = 'sizes';
    for (const size of [16, 24, 32, 64]) {
      const figure = document.createElement('figure');
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.style.width = canvas.style.height = `${size}px`;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `${item.label}, ${size} pixel frame`);
      const label = document.createElement('figcaption');
      label.textContent = `${size}px`;
      figure.append(canvas, label);
      sizes.append(figure);
      painters.push(() => {
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.fillStyle = palettes[background];
        context.fillRect(0, 0, size, size);
        context.save();
        context.translate(size / 2, size / 2);
        context.rotate((heading * Math.PI) / 2);
        const [left, top, right, bottom] = item.sourceRect;
        const width = right - left;
        const height = bottom - top;
        const scale = size / Math.max(width, height);
        context.drawImage(
          source,
          left,
          top,
          width,
          height,
          (-width * scale) / 2,
          (-height * scale) / 2,
          width * scale,
          height * scale,
        );
        context.restore();
      });
    }
    article.append(title, details, sizes);
    document.querySelector('#cards').append(article);
  }
  const paint = () => painters.forEach((fn) => fn());
  document.querySelector('#turn').addEventListener('click', (event) => {
    heading = (heading + 1) % 4;
    event.currentTarget.textContent = `Turn right · ${['North', 'East', 'South', 'West'][heading]}`;
    paint();
  });
  document.querySelector('#background').addEventListener('click', (event) => {
    background = (background + 1) % palettes.length;
    event.currentTarget.textContent = `Background · ${['Black', 'Slate', 'Sand'][background]}`;
    paint();
  });
  paint();
  status.textContent = `${study.items.length} original source bodies · heading preview only · no collision or ability changes`;
} catch (error) {
  status.textContent = `Preview unavailable: ${error.message}`;
}
