import pathlib,zipfile,json,hashlib,xml.etree.ElementTree as E,urllib.parse,sys,stat
base=pathlib.Path(sys.argv[2]);base.mkdir(parents=True,exist_ok=False)
archive=pathlib.Path(sys.argv[1])
if archive.stat().st_size != 135821309 or hashlib.file_digest(archive.open('rb'),'sha256').hexdigest() != '32c9a3fcf2dea6e8094742c08b9dcc59cdfd0d6806b0906541eecc0bcf0f76ec': raise ValueError('Wrong source archive')
z=zipfile.ZipFile(archive)
seen=set()
for item in z.infolist():
 path=pathlib.PurePosixPath(item.filename)
 if path.is_absolute() or '..' in path.parts or '\\' in item.filename or stat.S_ISLNK(item.external_attr >> 16): raise ValueError('Unsafe source path')
 if item.filename.casefold() in seen: raise ValueError('Duplicate/case-colliding source path')
 seen.add(item.filename.casefold())
selection=[('beach-grass','groundCover/BeachGrass_01/BeachGrass01.DAE','BeachGrassOne200'),('young-bamboo','Plants/Bamboo02/Bamboo_02.dae','BambooTwo200'),('crate','props/crate_01/Crate_01.dae','CrateOne200'),('covered-jetty','props/Jetty01/Tropical_Jetty01.DAE','jettyOne256'),('open-jetty','props/Jetty02/Tropical_Jetty02.DAE','jettyTwo256'),('jungle-hut','props/JungleHut02/JungleHut02.dae','jungleHutTwo256'),('beach-rock','rocks/BeachRock01/BeachRock_01.dae','beachRockOne200'),('palm','trees/Palms/Palm03.dae','PalmThree256')]
records=[]
for ident,suffix,keep in selection:
 p=next(p for p in z.namelist() if p.endswith('/'+suffix));parent=p.rsplit('/',1)[0];raw=z.read(p);t=E.fromstring(raw);ns=t.tag.split('}')[0][1:];n={'c':ns};E.register_namespace('',ns)
 out=base/'selected'/ident;out.mkdir(parents=True,exist_ok=False);(out/'original.dae').write_bytes(raw)
 sources=[{'path':p,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}]; mappings=[]
 for im in t.findall('.//c:library_images//c:init_from',n):
  name=pathlib.PurePosixPath(urllib.parse.unquote(im.text)).name;matches=[q for q in z.namelist() if q.rsplit('/',1)[0]==parent and q.rsplit('/',1)[-1].lower()==name.lower()]
  if len(matches)!=1:raise Exception((ident,name,matches))
  b=z.read(matches[0]);(out/name).write_bytes(b);sources.append({'path':matches[0],'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()});mappings.append({'from':im.text,'to':name});im.text=name
 # Keep authored highest-detail visual subtree, preserving ancestor transforms.
 scene=t.find('.//c:visual_scene',n)
 def filter_node(el):
  if el.get('name')==keep:return True
  retained=False
  for child in list(el):
   if child.tag==f'{{{ns}}}node':
    if filter_node(child):retained=True
    else:el.remove(child)
  return retained
 if not filter_node(scene):raise Exception('missing visual subtree '+keep)
 materialPath=parent+'/materials.cs';material=None
 if materialPath in z.namelist():
  b=z.read(materialPath);(out/'materials.cs').write_bytes(b);sources.append({'path':materialPath,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()});material='materials.cs'
 (out/'prepared.dae').write_bytes(E.tostring(t,encoding='utf-8',xml_declaration=True))
 records.append({'id':ident,'selectedNode':keep,'sourceUnit':t.find('c:asset/c:unit',n).attrib,'sourceUpAxis':t.find('c:asset/c:up_axis',n).text,'sources':list({s['path']:s for s in sources}.values()),'imagePathRewrites':mappings,'materialSource':material})
(base/'selection.json').write_text(json.dumps(records,indent=2)+'\n')
print('selected',len(records))
