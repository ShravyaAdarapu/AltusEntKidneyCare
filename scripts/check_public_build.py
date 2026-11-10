"""Check production image references, form scripts and eager third-party embeds."""
from html.parser import HTMLParser
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent.parent/'dist'
class Page(HTMLParser):
 def __init__(self):super().__init__();self.images=[];self.scripts=[];self.frames=[];self.font_links=[]
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag=='img':self.images.append(attrs)
  if tag=='script':self.scripts.append(attrs.get('src',''))
  if tag=='iframe':self.frames.append(attrs.get('src',''))
  if tag=='link':self.font_links.append(attrs.get('href',''))
for path in ROOT.glob('*.html'):
 page=Page();page.feed(path.read_text(encoding='utf-8'))
 assert any('booking.js' in x for x in page.scripts)==(path.stem in ['book-appointment','contact']),path
 for image in page.images:
  src=image.get('src','')
  if src.startswith('assets/'):
   assert (ROOT/src).is_file(),(path,src)
  assert not src.startswith('https://images.unsplash.com/'),(path,src)
  if 'srcset' in image:
   assert int(image['width'])>0 and int(image['height'])>0,(path,src)
   for variant in image['srcset'].split(','):assert (ROOT/variant.strip().split()[0]).is_file(),variant
 assert not any('youtube' in x for x in page.frames),path
 assert not any('fonts.googleapis.com' in x for x in page.font_links),path
css=ROOT/'assets/css/style.css'
for url in re.findall(r'url\((\.\./[^)]+)\)',css.read_text(encoding='utf-8')):assert (css.parent/url).is_file(),url
print('PASS: public asset references, responsive images, fonts, conditional booking scripts and click-to-load video.')
