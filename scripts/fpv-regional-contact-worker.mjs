/** Node-only bridge for measuring the production browser-worker protocol. */
import { parentPort, workerData } from 'node:worker_threads';
import { createAdvancedWorkerHandler } from '../optional-practice/civilian-fpv/advanced-worker.mjs';

if (!parentPort || workerData !== 'fpv-regional-capacity')
  throw new Error('Start this helper through fpv-regional-contact-capacity.mjs');
const handler = createAdvancedWorkerHandler((message) => parentPort.postMessage(message));
parentPort.on('message', (message) => {
  void handler.receive(message);
});
