const query = new URL(location.href).searchParams;
const select = document.getElementById('locale');
const render = () => {
  const lang = select.value === 'uk' ? 'uk' : 'en';
  document.documentElement.lang = lang;
  for (const section of document.querySelectorAll('section[lang]'))
    section.hidden = section.lang !== lang;
  document.getElementById('play').href = 'index.html?lang=' + lang;
  const root = location.pathname.match(
    /^(.*\/practice\/)\w[\w-]*\/releases\/v\d+\.\d+\.\d+\/site\//,
  )?.[1];
  document.getElementById('directory').href = root
    ? root + '?lang=' + lang
    : '../../game/index.html?lang=' + lang;
};
select.value = query.get('lang') === 'uk' ? 'uk' : 'en';
select.onchange = render;
render();
