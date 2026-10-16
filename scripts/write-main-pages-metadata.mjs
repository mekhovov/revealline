import fs from 'node:fs';
import path from 'node:path';
import { protectPageHTML } from './access-pages.mjs';
const root = path.join(process.env.RUNNER_TEMP, 'main-pages');
const deployment = {
  format: 'revealline-main-deployment.v1',
  channel: 'main',
  sourceRevision: process.env.SOURCE_SHA,
  sourceCommittedAt: process.env.SOURCE_COMMITTED_AT,
  buildVersion: process.env.BUILD_VERSION,
  play: 'game/',
  releases: 'https://github.com/mekhovov/revealline/releases',
};
const json = JSON.stringify(deployment, null, 2) + '\n';
fs.writeFileSync(path.join(root, 'main-deployment.json'), json, { flag: 'wx' });
fs.writeFileSync(path.join(root, 'release.json'), json, { flag: 'wx' });
fs.mkdirSync(path.join(root, 'releases'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'releases/index.html'),
  protectPageHTML(
    '<!doctype html><meta charset="utf-8"><title>RevealLine releases</title><p>Immutable downloads and release notes are available on <a href="https://github.com/mekhovov/revealline/releases">GitHub</a>.',
    'releases/index.html',
    fs.readFileSync(path.join(root, 'game/index.html'), 'utf8'),
  ),
  { flag: 'wx' },
);
