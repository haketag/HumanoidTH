import concurrent.futures
import importlib.util
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/robot-source-audit/followup'
spec=importlib.util.spec_from_file_location('download',ROOT/'scripts/download-reviewed-robot-images.py')
download=importlib.util.module_from_spec(spec)
spec.loader.exec_module(download)
download.OUT=OUT
pages=json.loads((OUT/'pages.json').read_text(encoding='utf8'))
candidates=[]
for name in ('Dinsaw Mini Home AI Assistance','Exoskeleton Wheelchair Robot','SR1 Security Robot'):
    p=next(p for p in pages if p['name']==name)
    candidates.append({'name':name,'source':p['requestedUrl'],'image':p['meta']['og:image']})
candidates.append({'name':'Exoskeleton paper figure 3','source':'https://www.mdpi.com/2218-6581/12/1/16','image':'https://pub.mdpi-res.com/robotics/robotics-12-00016/article_deploy/html/images/robotics-12-00016-g003.png'})
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results=list(pool.map(download.download,candidates))
(OUT/'downloads.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
for p in results: print(json.dumps(p,ensure_ascii=False))
