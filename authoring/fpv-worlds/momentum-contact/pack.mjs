/** Generate the ordinary editable/importable world formats with production producers. */
import fs from 'node:fs';
import {
  resolveProject,
  preparePack,
  inspectPack,
  compilePlayable,
  exportEditedProject,
} from '../../../optional-practice/civilian-fpv/world-content.mjs';
import { importEditableZip } from '../../../optional-practice/civilian-fpv/world-zip.mjs';
import { validateWorldCourse } from '../../../optional-practice/civilian-fpv/world-model.mjs';
import { momentumPracticeCourse } from './course.mjs';

export async function probePack({ check, equal, write = false }) {
  const project = resolveProject({
    format: 'FPVWorldProject.v1',
    id: 'momentum-contact-practice',
    title: 'Keep moving after the catch',
    world: { id: 'stadium', title: 'Momentum contact practice' },
    courses: [momentumPracticeCourse()],
  });
  const pack = await preparePack(project),
    loaded = await inspectPack(pack);
  equal(loaded.project, project, 'Editable project survives binary pack import exactly');
  equal(
    compilePlayable(loaded.project).courses.map(validateWorldCourse),
    project.courses.map(validateWorldCourse),
    'Imported pack compiles to exact accepted courses',
  );
  equal(
    new Uint8Array(await (await preparePack(project)).arrayBuffer()),
    new Uint8Array(await pack.arrayBuffer()),
    'Independent pack builds are byte-identical',
  );
  const zip = await exportEditedProject(loaded.project, { assets: loaded.assets });
  const editable = await importEditableZip(zip);
  equal(editable.project, project, 'Editable ZIP import preserves full project');
  const repack = await inspectPack(
    await preparePack(editable.project, { assets: editable.assets }),
  );
  equal(
    repack.sha256,
    loaded.sha256,
    'Editable export/import repacks to the same exact dependency identity',
  );
  check(pack.size < 8192 && zip.size < 8192, 'Fictional practice fits a bounded asset-free pack');
  if (write) {
    fs.writeFileSync(
      new URL('momentum-contact-practice.rlpack', import.meta.url),
      new Uint8Array(await pack.arrayBuffer()),
    );
    fs.writeFileSync(
      new URL('momentum-contact-practice.zip', import.meta.url),
      new Uint8Array(await zip.arrayBuffer()),
    );
  }
  return {
    kind: 'importable-practice',
    pack: 'momentum-contact-practice.rlpack',
    editable: 'momentum-contact-practice.zip',
    bytes: pack.size,
    editableBytes: zip.size,
    identity: `fpv-pack:${loaded.sha256}`,
    course: project.courses[0].id,
    reproducible: true,
    exactEditableRoundTrip: true,
  };
}
