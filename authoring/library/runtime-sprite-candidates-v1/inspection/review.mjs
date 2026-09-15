const select = (id) => document.getElementById(id);
select('size').addEventListener('change', () =>
  document.body.style.setProperty('--size', `${select('size').value}px`),
);
select('heading').addEventListener('change', () =>
  document.body.style.setProperty('--angle', `${select('heading').value}deg`),
);
select('backdrop').addEventListener('change', () => {
  document.body.dataset.backdrop = select('backdrop').value;
});
select('group').addEventListener('change', () => {
  for (const card of document.querySelectorAll('article[data-group]'))
    card.hidden = card.dataset.group !== select('group').value;
});
