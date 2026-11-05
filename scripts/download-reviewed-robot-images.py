"""Download source image candidates without modifying their pixels."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'robot-source-audit' / 'images'

def download(item):
    result = {'name':item['name'], 'source':item['source'], 'image':item['image']}
    try:
        u = urlsplit(item['image'])
        url = urlunsplit((u.scheme,u.netloc,quote(u.path,safe='/%'),u.query,''))
        with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':quote(item['source'],safe=':/%')}),timeout=25) as r:
            mime = r.headers.get_content_type()
            data = r.read(15_000_001)
        if not data or len(data) > 15_000_000: raise ValueError('Empty or oversized image')
        if mime not in ('image/jpeg','image/png','image/webp'): raise ValueError('Unexpected image MIME: '+mime)
        suffix = {'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}[mime]
        filename = hashlib.sha256(item['name'].encode()).hexdigest()[:12] + suffix
        target = OUT / filename
        target.write_bytes(data)
        result.update(file=str(target),mime=mime,bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
    except Exception as e: result['error'] = str(e)
    return result

if __name__ == '__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    plan = json.loads((ROOT/'data/robot-source-review.json').read_text(encoding='utf-8'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(download,[p for p in plan if p.get('image')]))
    (OUT.parent/'downloaded-images.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    for r in results: print(json.dumps(r,ensure_ascii=False))
