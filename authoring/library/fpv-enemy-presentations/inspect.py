from pathlib import Path
import hashlib,json,time,datetime
from PIL import Image
SOURCE=Path(__file__).resolve().parent
provenance=json.loads((SOURCE/'provenance.json').read_text())
TYPES=['bouncer','border-patrol','contour-patrol','claimed-rover','eroder','lane-boss','relay-sentinel']
assert [x['type'] for x in provenance['items']]==TYPES
started=time.monotonic();rows=[]
for item in provenance['items']:
 p=SOURCE/item['original'];raw=p.read_bytes();assert len(raw)==item['bytes'] and hashlib.sha256(raw).hexdigest()==item['sha256']
 with Image.open(p) as image:image.verify()
 with Image.open(p) as image:
  image.load();assert image.mode=='RGBA' and list(image.size)==item['actualDimensions']
  width,height=image.size;area=width*height;alpha=image.getchannel('A');hist=alpha.histogram();substantial=alpha.point(lambda n:255 if n>=128 else 0).getbbox();bounds=alpha.getbbox();colors=image.getcolors(maxcolors=area);assert colors is not None
  visibleRGB={rgba[:3] for count,rgba in colors if rgba[3]>=128};opaqueRGB={rgba[:3] for count,rgba in colors if rgba[3]==255}
  near=sum(count for count,rgba in colors if rgba[3]>=250);light=sum(count for count,rgba in colors if rgba[3]>=250 and .2126*rgba[0]+.7152*rgba[1]+.0722*rgba[2]>=128)
  row={'type':item['type'],'bytes':len(raw),'sha256':item['sha256'],'dimensions':[width,height],'mode':image.mode,'alphaExtrema':list(alpha.getextrema()),'alpha':{'zero':hist[0],'partial':sum(hist[1:255]),'opaque':hist[255]},'alphaCorners':[alpha.getpixel(xy) for xy in [(0,0),(width-1,0),(0,height-1),(width-1,height-1)]],'anyAlphaBounds':list(bounds),'substantialAlpha128Bounds':list(substantial),'substantialWidthFraction':(substantial[2]-substantial[0])/width,'substantialHeightFraction':(substantial[3]-substantial[1])/height,'actualVisibleRGBColorsAlpha128':len(visibleRGB),'actualFullyOpaqueRGBColors':len(opaqueRGB),'nearOpaquePixels':near,'nearOpaqueMidOrLightPixels':light,'nearOpaqueMidOrLightFraction':light/near,'prompt12to16PaletteAchieved':len(visibleRGB)<=16}
  assert hist[0]>area*.05 and near>area*.1,'Actual transparent background and near-opaque body required'
  assert row['substantialWidthFraction']>=.70,'Minimum broad silhouette width'
  rows.append(row)
 # No image save, resize, quantization, crop, background removal or mutation.
 assert hashlib.sha256(p.read_bytes()).hexdigest()==item['sha256']
result={'format':'fpv-enemy-original-inspection.v1','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'seconds':time.monotonic()-started,'images':rows,'totalOriginalBytes':sum(x['bytes'] for x in rows),'method':'Sequential Pillow PNG verify/load and in-memory channel/count analysis only. No original or derivative image written. Source SHA checked before/after each image.','limits':['RGBA alpha and broad width established; exact palette brief is reported honestly per image.','Substantial bounds use alpha>=128; low-alpha fringe remains in original.','Neither dimensions nor source occupancy certify actual runtime size, pivot calibration, animation or gameplay readability.']}
print(json.dumps(result,indent=2))
