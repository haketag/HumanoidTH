"""Read public source pages; output review material, never change database records."""
import concurrent.futures
import json
import gzip
import zlib
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'robot-source-audit'

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text, self.images, self.meta = [], [], {}
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script', 'style'): self.skip += 1
        if tag == 'meta': self.meta[a.get('property', a.get('name', ''))] = a.get('content', '')
        if tag == 'img': self.images.append({k:a[k] for k in ('src','data-src','alt','srcset') if k in a})
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.skip = max(0, self.skip - 1)
    def handle_data(self, value):
        if not self.skip and value.strip(): self.text.append(value.strip())

def fetch(item):
    name, url = item['canonicalName'], item.get('officialUrl')
    result = {'id':item['id'], 'name':name, 'requestedUrl':url}
    if not url: return {**result, 'error':'No source URL'}
    try:
        with urlopen(Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=25) as r:
            raw, result['finalUrl'], result['status'] = r.read(5_000_000), r.url, r.status
            encoding = r.headers.get('Content-Encoding', '')
            if encoding == 'gzip': raw = gzip.decompress(raw)
            if encoding == 'deflate': raw = zlib.decompress(raw)
        page = Page()
        page.feed(raw.decode('utf-8', errors='replace'))
        result.update(meta=page.meta, images=page.images, text='\n'.join(page.text))
    except Exception as e: result['error'] = str(e)
    return result

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    robots = json.loads((OUT / 'robots-before.json').read_text(encoding='utf-8'))
    overrides = {
        'NAO':'https://maxtronics.com/en/nao6/',
        'Kaitomm Robot':'https://www.obodroid.com/product/personal-assistant/',
        'SR1 Security Robot':'https://www.obodroid.com/product/security/',
        'Ninja Robot':'https://web-stage.ccc.chula.ac.th/en/news/33484/',
        'Mirror Telepresence System':'https://web-stage.ccc.chula.ac.th/en/news/30492/',
    }
    for robot in robots:
        if robot['canonicalName'] in overrides: robot['officialUrl'] = overrides[robot['canonicalName']]
        elif robot.get('officialUrl', '') and 'chula.ac.th/' in robot['officialUrl']: robot['officialUrl'] = robot['officialUrl'].rstrip('/') + '/'
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(fetch, robots))
    (OUT / 'source-pages-reviewed.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    for p in results:
        print(json.dumps({k:p.get(k) for k in ('name','status','error','finalUrl')},ensure_ascii=False))
