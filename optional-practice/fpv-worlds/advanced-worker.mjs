// Keep the entry inside World's offline scope and install its native course
// adapter once. No evaluator function crosses the worker message boundary.
import { installAdvancedWorker, isAdvancedWorkerEntry } from '../civilian-fpv/advanced-worker.mjs';
import { validateWorldCourse, createWorldFlight } from '../civilian-fpv/world-model.mjs';
if (isAdvancedWorkerEntry(import.meta.url))
  installAdvancedWorker(self, {
    courseAdapter: {
      format: 'FlightCourse.v2',
      validate: validateWorldCourse,
      createMission: createWorldFlight,
    },
  });
