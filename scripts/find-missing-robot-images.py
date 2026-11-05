"""Collect additional original-source image candidates; never write to the database."""
import concurrent.futures
import importlib.util
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/robot-source-audit/followup'
spec = importlib.util.spec_from_file_location('audit', ROOT/'scripts/audit-robot-sources.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
pages = {
    'Dinsaw Mini Home AI Assistance':'https://www.dinsaw.com/dinsaw-mini-home-ai/',
    'Exoskeleton Wheelchair Robot':'https://www.ise.eng.chula.ac.th/events/assoc-prof-ronnapee-chaichaowarat-ise-lecturer-has-opened-a-laboratory-to-showca',
    'Exoskeleton paper':'https://www.mdpi.com/2218-6581/12/1/16',
    'SR1 Security Robot':'https://mqdc.com/news/354-robot-helpers-start-work-at-whizdom-station-ratchada-thapra',
    'Kaitomm Robot':'https://www.obodroid.com/product/personal-assistant/',
}

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        results=list(pool.map(audit.fetch,[{'id':n,'canonicalName':n,'officialUrl':u} for n,u in pages.items()]))
    (OUT/'pages.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
    for p in results: print(json.dumps({k:p.get(k) for k in ('name','error','images','meta')},ensure_ascii=False))
    url='https://www.dop.go.th/download/statistics/th1635826412-975_0.pdf'
    try:
        with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30) as response:
            data=response.read(30_000_001)
        assert data.startswith(b'%PDF') and len(data)<=30_000_000
        pdf=OUT/'older-persons-2020.pdf'
        pdf.write_bytes(data)
        from pypdf import PdfReader
        page=PdfReader(pdf).pages[108]
        (OUT/'page-109.txt').write_text(page.extract_text(),encoding='utf8')
        for i,img in enumerate(page.images):
            target=OUT/f'page-109-{i}-{img.name}'
            target.write_bytes(img.data)
            print(str(target))
    except Exception as e: print('PDF:',str(e))
