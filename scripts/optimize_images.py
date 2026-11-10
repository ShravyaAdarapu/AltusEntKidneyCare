"""Create responsive WebP display copies. Originals remain untouched.
Run with Pillow installed; downloaded stock originals live in ignored .deploy-private/photo-originals.
The generated image manifest and WebP files are committed, so deployment needs no Pillow.
"""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageOps
ROOT=Path(__file__).resolve().parent.parent
DEST=ROOT/'src/assets/img'
inputs=list((ROOT/'.deploy-private/photo-originals').glob('*.jpg'))+list(DEST.glob('dr-chetan-*.png'))
manifest={}
for source in inputs:
 with Image.open(source) as raw:
  image=ImageOps.exif_transpose(raw).convert('RGB')
  variants=[]
  for width in [480,960,1600]:
   copy=image.copy();copy.thumbnail((width,10000),Image.Resampling.LANCZOS)
   import io
   stream=io.BytesIO();copy.save(stream,'WEBP',quality=82,method=6)
   data=stream.getvalue();name=f'{source.stem}-{copy.width}-{hashlib.sha256(data).hexdigest()[:10]}.webp'
   if not variants or copy.width!=variants[-1]['width']:
    (DEST/name).write_bytes(data);variants.append(dict(path='assets/img/'+name,width=copy.width,height=copy.height,bytes=len(data)))
  manifest[source.stem]=variants
(ROOT/'src/assets/image-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print('Optimized',len(manifest),'photos')
for stem,variants in manifest.items():
 if stem.startswith('dr-chetan-') and stem!='dr-chetan-profile':
  old=(DEST/(stem+'.png')).stat().st_size
  print(stem,old,'->',variants[-1]['bytes'])
