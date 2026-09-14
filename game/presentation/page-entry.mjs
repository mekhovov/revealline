import { mountPresentationPage } from './page.mjs';

// Auxiliary document chrome only. Editor/source-preview canvases continue to
// render their explicit authored inputs; embedded game pages own their host.
mountPresentationPage();
