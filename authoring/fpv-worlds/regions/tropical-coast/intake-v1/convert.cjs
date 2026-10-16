const fs = require('fs');
const path = require('path');
const root = path.resolve(process.argv[2]);
(async () => {
  const a = await require('./intake-tools/node_modules/assimpjs')();
  for (const rec of JSON.parse(fs.readFileSync(path.join(root, 'selection.json')))) {
    const dir = path.join(root, 'selected', rec.id);
    const list = new a.FileList();
    list.AddFile('prepared.dae', fs.readFileSync(path.join(dir, 'prepared.dae')));
    const result = a.ConvertFileList(list, 'glb2');
    if (!result.IsSuccess()) throw new Error(rec.id + ': ' + result.GetErrorCode());
    if (result.FileCount() !== 1) throw Error('Unexpected files');
    const bytes = Buffer.from(result.GetFile(0).GetContent());
    fs.writeFileSync(path.join(dir, 'converted.glb'), bytes);
    const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    console.log(
      rec.id,
      bytes.length,
      JSON.stringify({ nodes: doc.nodes, materials: doc.materials, images: doc.images }),
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
