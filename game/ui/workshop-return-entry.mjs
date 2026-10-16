import { mountToolReturnLinks, workshopPageTool } from './workshop-return.mjs';

document.body.dataset.workshopTool = workshopPageTool(
  window.location.href,
  document.body.dataset.workshopTool,
);

mountToolReturnLinks({
  document,
  href: window.location.href,
  id: document.body.dataset.workshopTool,
});
