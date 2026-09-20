import { mountToolReturnLinks } from './workshop-return.mjs';

mountToolReturnLinks({
  document,
  href: window.location.href,
  id: document.body.dataset.workshopTool,
});
