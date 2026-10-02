import { mountPracticeNavigation } from '../optional-practice/navigation.mjs';
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const bilingual = (tag, en, uk) =>
  `<${tag} data-en="${escape(en)}" data-uk="${escape(uk)}">${escape(en)}</${tag}>`;
export const PRACTICE_DIRECTORY_SCRIPT = `const select=document.getElementById('locale'); select.value=new URL(location.href).searchParams.get('lang')==='uk'?'uk':'en'; function render(){const lang=select.value==='uk'?'uk':'en';document.documentElement.lang=lang;for(const node of document.querySelectorAll('[data-en]'))node.textContent=node.dataset[lang];for(const link of document.querySelectorAll('[data-launch]')){const url=new URL(link.href);url.searchParams.set('lang',lang);link.href=url.href;}}select.onchange=render;render();\n(${mountPracticeNavigation.toString()})();\n`;

/** Lightweight metadata only. No simulator modules or installation side effects. */
export function practiceDirectoryHTML(packages, details) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flight practice</title><style>
body{margin:auto;max-width:72rem;padding:clamp(1rem,4vw,3rem);background:#0b1e2b;color:#f4f2e8;font:1.05rem/1.5 system-ui}header{display:flex;gap:1rem;justify-content:space-between;align-items:center;flex-wrap:wrap}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr));gap:1rem}article{border:1px solid #58748b;background:#10263b;padding:1rem;display:flex;flex-direction:column}h1{font-size:clamp(1.8rem,4vw,3rem)}article h2{margin:.5rem 0}img{width:100%;height:12rem;object-fit:cover}a,select{color:inherit;background:#10263b;border:2px solid #68b2ff;min-height:44px;box-sizing:border-box;padding:.6rem;display:inline-block;font:inherit}[data-practice-focus],a:focus-visible,select:focus-visible{outline:3px solid #ffd85c;outline-offset:4px}article footer{margin-top:auto;display:flex;gap:.5rem;flex-wrap:wrap}p{margin:.5rem 0 1rem}small{display:block;margin-bottom:1rem}nav{margin:1.5rem 0}.notice{border-left:4px solid #ffd85c;padding:1rem}
</style></head><body><header>${bilingual('h1', 'Flight practice', 'Практика польотів')}<label>Language / Мова <select id="locale"><option value="en">English</option><option value="uk">Українська</option></select></label></header>
${bilingual('p', 'Three ways to practise. No unlocks, installation, or campaign progress. Play opens a new tab; arming a flight is always your choice.', 'Три способи тренуватися. Без розблокування, встановлення й прогресу кампанії. Гра відкривається в новій вкладці; запуск польоту завжди потребує вашої дії.')}
<main>${packages
    .map((item) => {
      const detail = details.find((row) => row.id === item.id && row.revision === item.revision);
      const copy = detail?.description.copy;
      return `<article>${bilingual('h2', copy?.en.name ?? item.name, copy?.uk.name ?? item.name)}${detail ? `<img src="${escape(detail.preview)}" width="800" height="700" alt="" loading="lazy">${['description', 'purpose', 'inputs', 'requirements'].map((key) => bilingual('p', copy.en[key], copy.uk[key])).join('')}` : ''}<small>${escape(item.version)}${detail ? ` · ${(detail.downloadBytes / 1048576).toFixed(1)} MiB ZIP · ${(detail.offlineBytes / 1048576).toFixed(1)} MiB offline` : ''}</small><footer><a data-launch="play" href="${escape(item.href)}?action=play&amp;lang=en" target="_blank" rel="noopener noreferrer" data-en="Play ↗" data-uk="Грати ↗">Play ↗</a><a data-launch="details" href="${escape(item.href)}?lang=en" target="_blank" rel="noopener noreferrer" data-en="Details &amp; guide ↗" data-uk="Подробиці й посібник ↗">Details &amp; guide ↗</a></footer></article>`;
    })
    .join('')}</main>
${packages.length ? '' : `<div class="notice">${bilingual('p', 'No reviewed packages are selected on this host yet. You can still use the existing FPV flight simulator shortcut in the main game.', 'На цьому сайті ще не вибрано перевірених пакетів. Скористайтеся наявним ярликом симулятора FPV в основній грі.')}</div>`}
<nav><a href="../game/" data-en="Main game / FPV shortcut" data-uk="Основна гра / ярлик FPV">Main game / FPV shortcut</a> <a href="../optional-practice/civilian-fpv/guide.html" data-en="Player guide" data-uk="Посібник гравця">Player guide</a></nav>
${bilingual('p', '.rlpack files add content inside World Studio. They are not executable packages for this directory.', 'Файли .rlpack додають контент усередині World Studio. Це не виконувані пакети каталогу.')}
<script type="module" src="./directory.mjs"></script></body></html>\n`;
}
